"""SDK-based DataMarket deploy — mirrors src/app/deploy.sh Lakebase logic via w.postgres."""

from __future__ import annotations

# Bump when deploy logic changes — printed in Step 4 so you can verify the clone is current.
DEPLOY_LIB_VERSION = "2026-07-16-wpostgres-sdk40"

import os
import time
from pathlib import Path

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.workspace import ImportFormat


def _pg_types():
    """Lazy import — cluster DBR may ship an older databricks-sdk until pip upgrade."""
    from databricks.sdk.service.postgres import (
        Project, ProjectSpec, Role, RoleIdentityType, RoleRoleSpec,
    )
    return Project, ProjectSpec, Role, RoleIdentityType, RoleRoleSpec


def _require_postgres_sdk() -> None:
    import importlib.util
    if importlib.util.find_spec("databricks.sdk.service.postgres") is None:
        raise RuntimeError(
            "databricks-sdk on this cluster is too old (no postgres / Lakebase API).\n"
            "Run the pip cell above, then re-run this cell:\n"
            "  %pip install --upgrade 'databricks-sdk>=0.40.0'"
        )


def _get_branch(w: WorkspaceClient, project: str) -> str:
    """Same as deploy.sh _get_branch — `databricks postgres list-branches`."""
    try:
        items = list(w.postgres.list_branches(parent=f"projects/{project}"))
        names = []
        for b in items:
            name = getattr(b, "name", "") or ""
            names.append(name.split("/")[-1] if "/" in name else name)
        return next((n for n in names if n == "production"), names[0] if names else "")
    except Exception:
        return ""


def _get_host(w: WorkspaceClient, project: str, branch: str) -> str:
    """Same as deploy.sh _get_host — `databricks postgres list-endpoints`."""
    try:
        parent = f"projects/{project}/branches/{branch}"
        for ep in w.postgres.list_endpoints(parent=parent):
            status = getattr(ep, "status", None)
            hosts = getattr(status, "hosts", None) if status else None
            host = getattr(hosts, "host", None) if hosts else None
            if host:
                return host
    except Exception:
        pass
    return ""


def _ensure_lakebase(
    w: WorkspaceClient,
    project: str,
    cache_file: Path,
    host_override: str = "",
) -> tuple[str, str, str]:
    """
    Mirror deploy.sh step 3: detect → create-project if missing → poll → resolve host.
    Returns (branch, hostname, endpoint path).
    """
    if host_override:
        branch = _get_branch(w, project) or "production"
        return branch, host_override.strip(), f"projects/{project}/branches/{branch}/endpoints/primary"

    print(f"  Looking up Lakebase project: {project}")
    branch = _get_branch(w, project)

    if not branch:
        print(f"  Project '{project}' not found — creating Lakebase Autoscaling project...")
        print("  (This takes ~2–3 minutes on first deploy)")
        try:
            Project, ProjectSpec, _, _, _ = _pg_types()
            op = w.postgres.create_project(
                project=Project(spec=ProjectSpec(pg_version=17, enable_pg_native_login=False)),
                project_id=project,
            )
            op.wait()
            print(f"  Project '{project}' created")
        except Exception as e:
            print(f"  create-project note: {e}")

        print("  Waiting for Lakebase branch to be ready...")
        for _ in range(36):
            branch = _get_branch(w, project)
            if branch:
                print(f"  Branch ready: {branch}")
                break
            print(".", end="", flush=True)
            time.sleep(5)
        print()

        if not branch:
            raise RuntimeError(
                f"Lakebase branch unavailable for project '{project}' after 3 min.\n"
                "Options:\n"
                f"  1. Try a different project name in the lakebase_project widget\n"
                f"  2. Delete the broken project in Compute → Lakebase and re-run Step 4"
            )

    endpoint = f"projects/{project}/branches/{branch}/endpoints/primary"
    host = _get_host(w, project, branch)

    if not host and cache_file.is_file():
        host = cache_file.read_text().strip()
        if host:
            print("  Lakebase hostname loaded from cache")

    if not host:
        raise RuntimeError(
            f"Could not resolve Lakebase hostname for '{project}' (endpoint may still be provisioning).\n"
            "Wait a minute and re-run Step 4, or paste the hostname into the lakebase_host widget."
        )

    cache_file.write_text(host)
    return branch, host, endpoint


def _workspace_user_path(email: str) -> str:
    return email.replace("@", "%40")


def _upload_file(w: WorkspaceClient, local_path: str, remote_path: str) -> None:
    with open(local_path, "rb") as fh:
        w.workspace.upload(remote_path, fh.read(), format=ImportFormat.AUTO, overwrite=True)


def _upload_tree(w: WorkspaceClient, local_root: str, remote_root: str) -> None:
    w.workspace.mkdirs(remote_root)
    for dirpath, _, filenames in os.walk(local_root):
        for name in filenames:
            local = os.path.join(dirpath, name)
            rel = os.path.relpath(local, local_root).replace("\\", "/")
            remote = f"{remote_root}/{rel}"
            parent = remote.rsplit("/", 1)[0]
            if parent != remote_root:
                w.workspace.mkdirs(parent)
            _upload_file(w, local, remote)


def _write_app_yaml(app_dir: Path, *, host: str, admin_email: str, lakebase_host: str,
                    lakebase_endpoint: str, app_name: str, demo_mode: str) -> None:
    content = f"""command:
  - "node"
  - "app.js"
env:
  - name: DATABRICKS_HOST
    value: "{host}"
  - name: ADMIN_EMAIL
    value: "{admin_email}"
  - name: LAKEBASE_HOST
    value: "{lakebase_host}"
  - name: LAKEBASE_DB
    value: "databricks_postgres"
  - name: LAKEBASE_SCHEMA
    value: "{app_name}"
  - name: LAKEBASE_ENDPOINT
    value: "{lakebase_endpoint}"
  - name: DEMO_MODE
    value: "{demo_mode}"
"""
    (app_dir / "app.yaml").write_text(content)


def _app_sp_uuid(w: WorkspaceClient, app_name: str) -> str:
    app = w.apps.get(app_name)
    for candidate in (
        getattr(app, "service_principal_client_id", None),
        getattr(getattr(app, "service_principal", None), "client_id", None),
    ):
        if candidate:
            return candidate
    return ""


def _auto_warehouse_id(w: WorkspaceClient) -> str:
    best = None
    best_score = -1
    for wh in w.warehouses.list():
        name = (wh.name or "").lower()
        state = (getattr(wh.state, "value", None) or str(wh.state or "")).upper()
        score = 0
        if state == "RUNNING":
            score += 10
        if "starter" in name:
            score += 4
        if "serverless" in name:
            score += 3
        if score > best_score and wh.id:
            best_score = score
            best = wh.id
    return best or ""


def _grant_warehouse(w: WorkspaceClient, warehouse_id: str, sp_uuid: str) -> None:
    w.api_client.do(
        "PATCH",
        f"/api/2.0/permissions/warehouses/{warehouse_id}",
        body={"access_control_list": [{
            "service_principal_name": sp_uuid,
            "permission_level": "CAN_USE",
        }]},
    )


def _ensure_sp_oauth_role(w: WorkspaceClient, branch_parent: str, sp_uuid: str) -> None:
    """Mirror deploy.sh — register SP as LAKEBASE_OAUTH_V1 role via w.postgres."""
    existing_auth = ""
    wrong_role_name = ""
    try:
        for role in w.postgres.list_roles(parent=branch_parent):
            status = getattr(role, "status", None)
            if status and getattr(status, "postgres_role", None) == sp_uuid:
                existing_auth = str(getattr(status, "auth_method", "") or "")
                wrong_role_name = getattr(role, "name", "") or ""
                break
    except Exception:
        pass

    if existing_auth == "LAKEBASE_OAUTH_V1":
        print("  SP OAuth role already registered in Lakebase")
        return

    if wrong_role_name and existing_auth and existing_auth != "LAKEBASE_OAUTH_V1":
        try:
            w.postgres.delete_role(name=wrong_role_name)
        except Exception:
            pass

    try:
        _, _, Role, RoleIdentityType, RoleRoleSpec = _pg_types()
        op = w.postgres.create_role(
            parent=branch_parent,
            role=Role(spec=RoleRoleSpec(
                identity_type=RoleIdentityType.SERVICE_PRINCIPAL,
                postgres_role=sp_uuid,
            )),
        )
        op.wait()
        print("  SP OAuth role created in Lakebase")
    except Exception as e:
        print(f"  SP OAuth role warning: {e}")


def _lakebase_schema_grants(
    w: WorkspaceClient,
    *,
    repo_dir: str,
    app_name: str,
    lakebase_project: str,
    branch: str,
    lakebase_host: str,
    sp_uuid: str,
    admin_email: str,
) -> None:
    """Mirror deploy.sh step 7 — schema.sql + OAuth role + psql grants."""
    try:
        import psycopg2
    except ImportError:
        print("  psycopg2 not installed — skipping schema grants (app creates tables on start)")
        return

    user = w.config.username or admin_email
    token = w.config.token or ""
    if not token:
        print("  No OAuth token — skipping Lakebase grants")
        return

    schema_sql = Path(repo_dir) / "schema" / "schema.sql"
    conn_str = dict(
        host=lakebase_host, port=5432, dbname="databricks_postgres",
        user=user, password=token, sslmode="require",
    )

    with psycopg2.connect(**conn_str) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {app_name}")
            if schema_sql.is_file():
                cur.execute(f"SET search_path TO {app_name}")
                cur.execute(schema_sql.read_text())
                print("  schema.sql applied")

    branch_parent = f"projects/{lakebase_project}/branches/{branch}"
    _ensure_sp_oauth_role(w, branch_parent, sp_uuid)

    grant_sql = f"""
        GRANT CONNECT ON DATABASE databricks_postgres TO "{sp_uuid}";
        GRANT USAGE  ON SCHEMA {app_name} TO "{sp_uuid}";
        GRANT CREATE ON SCHEMA {app_name} TO "{sp_uuid}";
        GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA {app_name} TO "{sp_uuid}";
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA {app_name} TO "{sp_uuid}";
        ALTER DEFAULT PRIVILEGES IN SCHEMA {app_name} GRANT ALL ON TABLES    TO "{sp_uuid}";
        ALTER DEFAULT PRIVILEGES IN SCHEMA {app_name} GRANT ALL ON SEQUENCES TO "{sp_uuid}";
    """
    with psycopg2.connect(**conn_str) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(grant_sql)
    print("  Lakebase schema grants applied")


def deploy_from_notebook(
    w: WorkspaceClient,
    *,
    repo_dir: str,
    admin_email: str,
    app_name: str = "datamarket",
    lakebase_project: str = "datamarket",
    lakebase_host: str = "",
    warehouse_id: str = "",
    demo_mode: str = "false",
) -> dict:
    """Deploy DataMarket using w.postgres + w.apps (same APIs as deploy.sh CLI)."""
    print(f"  deploy_lib version: {DEPLOY_LIB_VERSION}")
    _require_postgres_sdk()
    host = (w.config.host or "").rstrip("/")
    app_dir = Path(repo_dir) / "src" / "app"
    if not (app_dir / "app.js").is_file():
        raise FileNotFoundError(f"Expected app at {app_dir}/app.js — run the build cell first")

    workspace_path = f"/Workspace/Users/{_workspace_user_path(admin_email)}/{app_name}"
    cache_file = app_dir / f".lakebase-{app_name}.cache"

    print("[1/6] Resolving Lakebase (same as deploy.sh)...")
    branch, lb_host, lb_endpoint = _ensure_lakebase(w, lakebase_project, cache_file, lakebase_host)
    print(f"  host: {lb_host}")

    print("[2/6] Writing app.yaml...")
    _write_app_yaml(
        app_dir, host=host, admin_email=admin_email, lakebase_host=lb_host,
        lakebase_endpoint=lb_endpoint, app_name=app_name, demo_mode=demo_mode,
    )

    print("[3/6] Uploading to workspace...")
    dist_dir = app_dir / "dist"
    if dist_dir.is_dir():
        _upload_tree(w, str(dist_dir), f"{workspace_path}/dist")
    for fname in ("app.js", "db.js", "auth.js", "databricks.js", "package.json", "manifest.yaml", "app.yaml"):
        fpath = app_dir / fname
        if fpath.is_file():
            _upload_file(w, str(fpath), f"{workspace_path}/{fname}")
    for subdir in ("routes", "lib"):
        d = app_dir / subdir
        if d.is_dir():
            _upload_tree(w, str(d), f"{workspace_path}/{subdir}")
    print(f"  → {workspace_path}")

    print("[4/6] Deploying Databricks App...")
    try:
        w.apps.get(app_name)
    except NotFound:
        w.apps.create(name=app_name, description="DataMarket — Self-Service Data Product Marketplace")
    w.apps.deploy(app_name=app_name, source_code_path=workspace_path)
    print("  deploy submitted")

    print("[5/6] Lakebase schema + SP grants...")
    sp_uuid = _app_sp_uuid(w, app_name)
    if sp_uuid:
        _lakebase_schema_grants(
            w, repo_dir=repo_dir, app_name=app_name, lakebase_project=lakebase_project,
            branch=branch, lakebase_host=lb_host, sp_uuid=sp_uuid, admin_email=admin_email,
        )
        w.apps.deploy(app_name=app_name, source_code_path=workspace_path)
    else:
        print("  SP UUID not found — grant Lakebase schema manually after first deploy")

    print("[6/6] SQL Warehouse permission...")
    wh_id = warehouse_id or _auto_warehouse_id(w)
    if wh_id and sp_uuid:
        try:
            _grant_warehouse(w, wh_id, sp_uuid)
            print(f"  CAN_USE granted on warehouse {wh_id}")
        except Exception as e:
            print(f"  warehouse grant warning: {e}")
    elif not wh_id:
        print("  no warehouse detected — set in Manage → Settings after login")

    app = w.apps.get(app_name)
    url = getattr(app, "url", "") or ""
    return {"url": url, "workspace_path": workspace_path, "lakebase_host": lb_host, "warehouse_id": wh_id}
