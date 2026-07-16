"""SDK-based DataMarket deploy for notebook environments (CLI blocked)."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.workspace import ImportFormat


def _api(w: WorkspaceClient, method: str, path: str, body=None):
    if body is not None:
        return w.api_client.do(method, path, body=body)
    return w.api_client.do(method, path)


def _lakebase_branch(w: WorkspaceClient, project: str) -> str:
    try:
        data = _api(w, "GET", f"/api/2.0/postgres/autoscaling/projects/{project}/branches")
        branches = data.get("branches") or data.get("items") or []
        names = []
        for b in branches:
            name = b.get("name") or ""
            names.append(name.split("/")[-1] if "/" in name else name)
        return next((n for n in names if n == "production"), names[0] if names else "")
    except Exception:
        return ""


def _lakebase_host(w: WorkspaceClient, project: str, branch: str) -> str:
    try:
        data = _api(
            w, "GET",
            f"/api/2.0/postgres/autoscaling/projects/{project}/branches/{branch}/endpoints",
        )
        endpoints = data if isinstance(data, list) else data.get("endpoints") or data.get("items") or []
        for ep in endpoints:
            host = (ep.get("status") or {}).get("hosts", {}).get("host", "")
            if host:
                return host
            host = ep.get("read_write_dns") or ep.get("dns") or ""
            if host:
                return host
    except Exception:
        pass
    try:
        path = f"projects/{project}/branches/{branch}/endpoints/primary"
        data = _api(w, "GET", f"/api/2.0/postgres/endpoints/{path}")
        return data.get("read_write_dns") or data.get("dns") or ""
    except Exception:
        return ""


def _ensure_lakebase_project(w: WorkspaceClient, project: str) -> str:
    branch = _lakebase_branch(w, project)
    if branch:
        return branch
    print(f"  Creating Lakebase project '{project}' (~2–3 min)...")
    try:
        _api(w, "POST", "/api/2.0/postgres/autoscaling/projects", body={"project_id": project})
    except Exception as e:
        print(f"  create-project note: {e}")
    for _ in range(36):
        branch = _lakebase_branch(w, project)
        if branch:
            print(f"  Branch ready: {branch}")
            return branch
        time.sleep(5)
    raise RuntimeError(
        f"Lakebase project '{project}' not ready. Create it in Compute → Lakebase "
        "or set the lakebase_host widget."
    )


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


def _lakebase_schema_grants(
    w: WorkspaceClient,
    *,
    repo_dir: str,
    app_name: str,
    lakebase_project: str,
    branch: str,
    lakebase_host: str,
    sp_uuid: str,
    demo_mode: str,
) -> None:
    try:
        import psycopg2
    except ImportError:
        print("  psycopg2 not installed — skipping schema grants (app creates tables on start)")
        return

    user = w.config.username or ""
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

    branch_path = f"projects/{lakebase_project}/branches/{branch}"
    roles = []
    try:
        roles = _api(w, "GET", f"/api/2.0/postgres/autoscaling/{branch_path}/roles") or []
    except Exception:
        pass
    if not isinstance(roles, list):
        roles = roles.get("roles") or roles.get("items") or []

    has_oauth = any(
        (r.get("status") or {}).get("postgres_role") == sp_uuid
        and (r.get("status") or {}).get("auth_method") == "LAKEBASE_OAUTH_V1"
        for r in roles
    )
    if not has_oauth:
        try:
            _api(
                w, "POST",
                f"/api/2.0/postgres/autoscaling/{branch_path}/roles",
                body={"spec": {"identity_type": "SERVICE_PRINCIPAL", "postgres_role": sp_uuid}},
            )
            print("  SP OAuth role registered in Lakebase")
        except Exception as e:
            print(f"  SP OAuth role warning: {e}")

    grant_sql = f"""
        GRANT CONNECT ON DATABASE databricks_postgres TO "{sp_uuid}";
        GRANT USAGE  ON SCHEMA {app_name} TO "{sp_uuid}";
        GRANT CREATE ON SCHEMA {app_name} TO "{sp_uuid}";
        GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA {app_name} TO "{sp_uuid}";
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA {app_name} TO "{sp_uuid}";
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
    """Deploy DataMarket using the Python SDK (no Databricks CLI)."""
    host = (w.config.host or "").rstrip("/")
    app_dir = Path(repo_dir) / "src" / "app"
    if not (app_dir / "app.js").is_file():
        raise FileNotFoundError(f"Expected app at {app_dir}/app.js — run the build cell first")

    user_email = admin_email
    workspace_path = f"/Workspace/Users/{_workspace_user_path(user_email)}/{app_name}"

    print("[1/6] Resolving Lakebase...")
    branch = _ensure_lakebase_project(w, lakebase_project)
    lb_host = lakebase_host or _lakebase_host(w, lakebase_project, branch)
    cache_file = app_dir / f".lakebase-{app_name}.cache"
    if not lb_host and cache_file.is_file():
        lb_host = cache_file.read_text().strip()
    if not lb_host:
        raise RuntimeError(
            "Could not resolve Lakebase hostname. Set the lakebase_host widget "
            f"(Compute → Lakebase → {lakebase_project} → Connection details)."
        )
    cache_file.write_text(lb_host)
    lb_endpoint = f"projects/{lakebase_project}/branches/{branch}/endpoints/primary"
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
    routes_dir = app_dir / "routes"
    if routes_dir.is_dir():
        _upload_tree(w, str(routes_dir), f"{workspace_path}/routes")
    lib_dir = app_dir / "lib"
    if lib_dir.is_dir():
        _upload_tree(w, str(lib_dir), f"{workspace_path}/lib")
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
            branch=branch, lakebase_host=lb_host, sp_uuid=sp_uuid, demo_mode=demo_mode,
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
