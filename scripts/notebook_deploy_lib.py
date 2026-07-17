"""SDK-based DataMarket deploy — mirrors src/app/deploy.sh (same APIs, same steps)."""

from __future__ import annotations

# Bump when deploy logic changes — printed in Step 4 so you can verify the clone is current.
DEPLOY_LIB_VERSION = "2026-07-17-lakebase-rest-fallback"

import os
import time
from pathlib import Path
from types import SimpleNamespace

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.workspace import ImportFormat

SKIP_CATALOGS = frozenset({"system", "__databricks_internal", "hive_metastore"})


class _DoneOp:
    def wait(self, **_kwargs):
        return self


class _LakebaseRest:
    """REST fallback — same routes as `databricks postgres` CLI (deploy.sh)."""

    def __init__(self, w: WorkspaceClient):
        self._api = w.api_client

    @staticmethod
    def _items(data):
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("branches", "endpoints", "roles", "items"):
                if key in data and data[key]:
                    return data[key]
        return []

    @staticmethod
    def _project_id(parent: str) -> str:
        return parent.replace("projects/", "").split("/")[0]

    def list_branches(self, parent: str):
        pid = self._project_id(parent)
        for path in (
            f"/api/2.0/postgres/projects/{pid}/branches",
            f"/api/2.0/postgres/autoscaling/projects/{pid}/branches",
        ):
            try:
                items = self._items(self._api.do("GET", path))
                if items:
                    for b in items:
                        yield SimpleNamespace(name=b.get("name", ""), status=b.get("status"))
                    return
            except Exception:
                continue

    def list_endpoints(self, parent: str):
        for path in (
            f"/api/2.0/postgres/{parent}/endpoints",
            f"/api/2.0/postgres/autoscaling/{parent}/endpoints",
        ):
            try:
                items = self._items(self._api.do("GET", path))
                if items:
                    for ep in items:
                        st = ep.get("status") or {}
                        hosts = st.get("hosts") or {}
                        yield SimpleNamespace(
                            name=ep.get("name", ""),
                            status=SimpleNamespace(
                                hosts=SimpleNamespace(host=hosts.get("host", "")),
                            ),
                        )
                    return
            except Exception:
                continue
        try:
            data = self._api.do("GET", f"/api/2.0/postgres/endpoints/{parent}/endpoints/primary")
            host = data.get("read_write_dns") or data.get("dns") or ""
            if host:
                yield SimpleNamespace(
                    status=SimpleNamespace(hosts=SimpleNamespace(host=host)),
                )
        except Exception:
            pass

    def create_project(self, project, project_id: str):
        spec = getattr(project, "spec", None)
        pg_version = getattr(spec, "pg_version", 17) if spec else 17
        enable_native = getattr(spec, "enable_pg_native_login", False) if spec else False
        body = {
            "project_id": project_id,
            "spec": {"pg_version": pg_version, "enable_pg_native_login": enable_native},
        }
        errors = []
        for path in ("/api/2.0/postgres/projects", "/api/2.0/postgres/autoscaling/projects"):
            try:
                self._api.do("POST", path, body=body)
                print(f"  create-project OK ({path})")
                return _DoneOp()
            except Exception as e:
                errors.append(f"{path}: {e}")
        raise RuntimeError("create-project failed — " + "; ".join(errors))

    def list_roles(self, parent: str):
        for path in (
            f"/api/2.0/postgres/{parent}/roles",
            f"/api/2.0/postgres/autoscaling/{parent}/roles",
        ):
            try:
                items = self._items(self._api.do("GET", path))
                for r in items:
                    st = r.get("status") or {}
                    yield SimpleNamespace(
                        name=r.get("name", ""),
                        status=SimpleNamespace(
                            postgres_role=st.get("postgres_role", ""),
                            auth_method=st.get("auth_method", ""),
                        ),
                    )
                return
            except Exception:
                continue

    def create_role(self, parent: str, role):
        spec = getattr(role, "spec", None)
        identity = getattr(spec, "identity_type", None) if spec else "SERVICE_PRINCIPAL"
        postgres_role = getattr(spec, "postgres_role", None) if spec else None
        id_val = getattr(identity, "value", identity) if identity else "SERVICE_PRINCIPAL"
        body = {"spec": {"identity_type": str(id_val), "postgres_role": postgres_role}}
        for path in (
            f"/api/2.0/postgres/{parent}/roles",
            f"/api/2.0/postgres/autoscaling/{parent}/roles",
        ):
            try:
                self._api.do("POST", path, body=body)
                return _DoneOp()
            except Exception:
                continue
        raise RuntimeError(f"create-role failed for {parent}")

    def delete_role(self, name: str):
        for prefix in ("/api/2.0/postgres/", "/api/2.0/postgres/autoscaling/"):
            try:
                self._api.do("DELETE", prefix + name.lstrip("/"))
                return _DoneOp()
            except Exception:
                continue


def _lakebase(w: WorkspaceClient):
    """
    Lakebase **Autoscaling** API only (w.postgres).
    Do NOT use w.database — that is provisioned DB instances, not autoscaling projects.
    """
    pg = getattr(w, "postgres", None)
    if pg is not None and callable(getattr(pg, "create_project", None)):
        return pg
    return _LakebaseRest(w)


def _pg_types():
    from databricks.sdk.service.postgres import (
        Project, ProjectSpec, Role, RoleIdentityType, RoleRoleSpec,
    )
    return Project, ProjectSpec, Role, RoleIdentityType, RoleRoleSpec


def _require_lakebase_sdk() -> None:
    """Any recent databricks-sdk works — REST fallback covers missing w.postgres."""
    import importlib.util
    if importlib.util.find_spec("databricks.sdk") is None:
        raise RuntimeError("pip install --upgrade 'databricks-sdk>=0.40.0'")


def resolve_seed(seed_data: str, demo_mode: str) -> bool:
    """Same as deploy.sh: --seed auto → true when demo_mode, else explicit true/false."""
    if not seed_data or seed_data == "auto":
        return demo_mode.lower() == "true"
    return seed_data.lower() == "true"


def _get_branch(w: WorkspaceClient, project: str) -> str:
    try:
        items = list(_lakebase(w).list_branches(parent=f"projects/{project}"))
        names = []
        for b in items:
            name = getattr(b, "name", "") or ""
            names.append(name.split("/")[-1] if "/" in name else name)
        return next((n for n in names if n == "production"), names[0] if names else "")
    except Exception:
        return ""


def _get_host(w: WorkspaceClient, project: str, branch: str) -> str:
    try:
        parent = f"projects/{project}/branches/{branch}"
        for ep in _lakebase(w).list_endpoints(parent=parent):
            status = getattr(ep, "status", None)
            hosts = getattr(status, "hosts", None) if status else None
            host = getattr(hosts, "host", None) if hosts else None
            if host:
                return host
    except Exception:
        pass
    return ""


def _ensure_lakebase(
    w: WorkspaceClient, project: str, cache_file: Path, host_override: str = "",
) -> tuple[str, str, str]:
    if host_override:
        branch = _get_branch(w, project) or "production"
        return branch, host_override.strip(), f"projects/{project}/branches/{branch}/endpoints/primary"

    print(f"  Looking up Lakebase project: {project}")
    branch = _get_branch(w, project)

    if not branch:
        print(f"  Project '{project}' not found — creating Lakebase Autoscaling project...")
        print("  (This takes ~2–3 minutes on first deploy)")
        api = _lakebase(w)
        print(f"  Lakebase API: {type(api).__name__}")
        created = False
        try:
            if isinstance(api, _LakebaseRest):
                api.create_project(None, project).wait()
            else:
                Project, ProjectSpec, _, _, _ = _pg_types()
                api.create_project(
                    project=Project(spec=ProjectSpec(pg_version=17, enable_pg_native_login=False)),
                    project_id=project,
                ).wait()
            created = True
            print(f"  Project '{project}' created")
        except Exception as e:
            print(f"  create-project note: {e}")
            if not created and not _get_branch(w, project):
                raise RuntimeError(
                    f"Could not create Lakebase project '{project}'.\n"
                    f"API error: {e}\n"
                    "Check Lakebase is enabled in this workspace, or use a different lakebase_project name."
                ) from e

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
                "Try a different lakebase_project name or delete the broken project in Compute → Lakebase."
            )

    endpoint = f"projects/{project}/branches/{branch}/endpoints/primary"
    host = _get_host(w, project, branch)

    if not host and cache_file.is_file():
        host = cache_file.read_text().strip()
        if host:
            print("  Lakebase hostname loaded from cache")

    if not host:
        raise RuntimeError(
            f"Could not resolve Lakebase hostname for '{project}'.\n"
            "Wait and re-run Step 4, or paste hostname into the lakebase_host widget."
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


def _sql_grant(w: WorkspaceClient, warehouse_id: str, statement: str) -> str:
    try:
        data = w.api_client.do(
            "POST", "/api/2.0/sql/statements",
            body={"warehouse_id": warehouse_id, "statement": statement, "wait_timeout": "10s"},
        )
        return (data.get("status") or {}).get("state", "UNKNOWN")
    except Exception:
        return "ERROR"


def _grant_uc_catalogs(w: WorkspaceClient, sp_uuid: str, warehouse_id: str) -> None:
    """deploy.sh step 9 — USE CATALOG + BROWSE + SELECT ON SCHEMA for Import from UC."""
    try:
        data = w.api_client.do("GET", "/api/2.1/unity-catalog/catalogs")
        catalogs = [
            c.get("name", "") for c in data.get("catalogs", [])
            if c.get("name", "") not in SKIP_CATALOGS
        ]
    except Exception as e:
        print(f"  UC catalog list warning: {e}")
        return

    if not catalogs:
        print("  no UC catalogs found — skip UC grants")
        return

    print(f"  granting UC access on {len(catalogs)} catalog(s)...")
    errors = 0
    for catalog in catalogs:
        use_cat = _sql_grant(w, warehouse_id, f"GRANT USE CATALOG ON CATALOG `{catalog}` TO `{sp_uuid}`")
        _sql_grant(w, warehouse_id, f"GRANT BROWSE ON CATALOG `{catalog}` TO `{sp_uuid}`")

        schemas = []
        try:
            sd = w.api_client.do("GET", f"/api/2.1/unity-catalog/schemas?catalog_name={catalog}")
            schemas = [s["name"] for s in sd.get("schemas", []) if s.get("name") != "information_schema"]
        except Exception:
            pass

        schema_ok = schema_fail = 0
        for schema in schemas:
            state = _sql_grant(
                w, warehouse_id,
                f"GRANT SELECT ON SCHEMA `{catalog}`.`{schema}` TO `{sp_uuid}`",
            )
            if state == "SUCCEEDED":
                schema_ok += 1
            else:
                schema_fail += 1

        if use_cat == "SUCCEEDED":
            print(f"    ✓ {catalog} — USE CATALOG, SELECT on {schema_ok} schema(s)")
            if schema_fail:
                print(f"    ⚠ {catalog} — {schema_fail} schema(s) need manual grant")
        else:
            print(f"    ⚠ {catalog} — USE CATALOG failed")
            errors += 1

    if errors:
        print(f"  UC grants: {errors} catalog(s) failed — use Manage → Settings wizard")
    else:
        print("  UC catalog grants complete")


def _ensure_sp_oauth_role(w: WorkspaceClient, branch_parent: str, sp_uuid: str) -> None:
    existing_auth = ""
    wrong_role_name = ""
    try:
        for role in _lakebase(w).list_roles(parent=branch_parent):
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
            _lakebase(w).delete_role(name=wrong_role_name)
        except Exception:
            pass

    try:
        if isinstance(_lakebase(w), _LakebaseRest):
            role = SimpleNamespace(spec=SimpleNamespace(
                identity_type="SERVICE_PRINCIPAL",
                postgres_role=sp_uuid,
            ))
            _lakebase(w).create_role(branch_parent, role).wait()
        else:
            _, _, Role, RoleIdentityType, RoleRoleSpec = _pg_types()
            _lakebase(w).create_role(
                parent=branch_parent,
                role=Role(spec=RoleRoleSpec(
                    identity_type=RoleIdentityType.SERVICE_PRINCIPAL,
                    postgres_role=sp_uuid,
                )),
            ).wait()
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
    seed: bool,
) -> None:
    """deploy.sh step 7 — schema.sql, optional seed.sql, OAuth role, psql grants."""
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
    seed_sql = Path(repo_dir) / "schema" / "seed.sql"
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
            if seed:
                if seed_sql.is_file():
                    cur.execute(f"SET search_path TO {app_name}")
                    cur.execute(seed_sql.read_text())
                    print("  seed.sql applied — demo products, users, requests loaded")
                else:
                    print(f"  seed.sql not found at {seed_sql}")
            else:
                print("  seed skipped (production mode — pass seed_data=true to force)")

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
    seed_data: str = "auto",
    grant_catalogs: str = "true",
) -> dict:
    """Deploy DataMarket — same steps as deploy.sh (SDK instead of CLI subprocess)."""
    print(f"  deploy_lib version: {DEPLOY_LIB_VERSION}")
    _require_lakebase_sdk()
    seed = resolve_seed(seed_data, demo_mode)
    print(f"  seed_data: {seed_data} → {'apply seed.sql' if seed else 'skip'}")

    host = (w.config.host or "").rstrip("/")
    app_dir = Path(repo_dir) / "src" / "app"
    if not (app_dir / "app.js").is_file():
        raise FileNotFoundError(f"Expected app at {app_dir}/app.js — run the build cell first")

    workspace_path = f"/Workspace/Users/{_workspace_user_path(admin_email)}/{app_name}"
    cache_file = app_dir / f".lakebase-{app_name}.cache"

    print("[1/7] Lakebase detect / create (deploy.sh step 3)...")
    branch, lb_host, lb_endpoint = _ensure_lakebase(w, lakebase_project, cache_file, lakebase_host)
    print(f"  host: {lb_host}")

    print("[2/7] app.yaml (deploy.sh step 4)...")
    _write_app_yaml(
        app_dir, host=host, admin_email=admin_email, lakebase_host=lb_host,
        lakebase_endpoint=lb_endpoint, app_name=app_name, demo_mode=demo_mode,
    )

    print("[3/7] Upload (deploy.sh step 6)...")
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

    print("[4/7] Deploy app (deploy.sh step 6)...")
    try:
        w.apps.get(app_name)
    except NotFound:
        w.apps.create(name=app_name, description="DataMarket — Self-Service Data Product Marketplace")
    w.apps.deploy(app_name=app_name, source_code_path=workspace_path)

    print("[5/7] Lakebase schema + seed + SP grants (deploy.sh step 7)...")
    sp_uuid = _app_sp_uuid(w, app_name)
    if sp_uuid:
        _lakebase_schema_grants(
            w, repo_dir=repo_dir, app_name=app_name, lakebase_project=lakebase_project,
            branch=branch, lakebase_host=lb_host, sp_uuid=sp_uuid, admin_email=admin_email,
            seed=seed,
        )
        w.apps.deploy(app_name=app_name, source_code_path=workspace_path)
    else:
        print("  SP UUID not found — grant Lakebase schema manually after first deploy")

    print("[6/7] Warehouse CAN_USE (deploy.sh step 8)...")
    wh_id = warehouse_id or _auto_warehouse_id(w)
    if wh_id and sp_uuid:
        try:
            _grant_warehouse(w, wh_id, sp_uuid)
            print(f"  CAN_USE granted on warehouse {wh_id}")
        except Exception as e:
            print(f"  warehouse grant warning: {e}")
    elif not wh_id:
        print("  no warehouse detected — set in Manage → Settings after login")

    print("[7/7] UC catalog grants (deploy.sh step 9)...")
    if grant_catalogs.lower() == "true" and wh_id and sp_uuid:
        _grant_uc_catalogs(w, sp_uuid, wh_id)
    elif grant_catalogs.lower() != "true":
        print("  skipped (grant_catalogs=false)")
    else:
        print("  skipped (no warehouse or SP)")

    app = w.apps.get(app_name)
    url = getattr(app, "url", "") or ""
    return {
        "url": url, "workspace_path": workspace_path, "lakebase_host": lb_host,
        "warehouse_id": wh_id, "seed_applied": seed,
    }
