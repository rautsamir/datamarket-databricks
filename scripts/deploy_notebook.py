# Databricks notebook source
# MAGIC %md
# MAGIC # DataMarket — Deploy from Workspace (no local laptop required)
# MAGIC
# MAGIC Run this notebook on a **Databricks cluster** to build and deploy DataMarket
# MAGIC without installing Node.js or the Databricks CLI on a locked-down laptop.
# MAGIC
# MAGIC **What it does** (same as `deploy.sh` on a Mac):
# MAGIC 1. Installs Node.js + Databricks CLI on the cluster driver (temporary)
# MAGIC 2. Clones the repo and builds the React frontend
# MAGIC 3. Uploads code to Workspace Files and deploys the Databricks App
# MAGIC 4. Initializes Lakebase schema and grants permissions
# MAGIC
# MAGIC **Prerequisites (workspace admin):**
# MAGIC - Permission to create **Databricks Apps** and **Lakebase** projects
# MAGIC - Lakebase is auto-provisioned via API (same as `deploy.sh`) — no UI step required
# MAGIC - A **SQL Warehouse** for UC grants on approval
# MAGIC - Cluster with **outbound internet** (GitHub, npm)
# MAGIC
# MAGIC **Recommended:** Single-node cluster, DBR 14.3+ or 15.x, `Standard_DS3_v2` or larger.
# MAGIC
# MAGIC > **Attach a cluster** for Steps 2–4 — Serverless compute does not expose driver host/token for CLI setup, and cannot install Node/npm for the build.
# MAGIC >
# MAGIC > Do not use the browser **Web Terminal**.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 1 — Configuration
# MAGIC
# MAGIC Fill **admin_email** at the top of this notebook, or leave it blank to use your logged-in workspace identity.

# COMMAND ----------

dbutils.widgets.text("repo_url", "https://github.com/rautsamir/datamarket-databricks.git", "Git repo URL")
dbutils.widgets.text("git_branch", "main", "Git branch")
dbutils.widgets.text("admin_email", "", "Admin email (blank = your SSO email)")
dbutils.widgets.text("app_name", "datamarket", "Databricks App name")
dbutils.widgets.text("lakebase_project", "datamarket", "Lakebase project name")
dbutils.widgets.text("lakebase_host", "", "Lakebase hostname (optional override)")
dbutils.widgets.text("warehouse_id", "", "SQL Warehouse ID (optional)")
dbutils.widgets.dropdown("demo_mode", "false", ["false", "true"], "Demo mode")
dbutils.widgets.dropdown("seed_data", "auto", ["auto", "true", "false"], "Seed data (auto=on when demo_mode)")
dbutils.widgets.dropdown("grant_catalogs", "true", ["true", "false"], "Grant UC catalog access to app SP")

REPO_URL         = dbutils.widgets.get("repo_url").strip()
GIT_BRANCH       = dbutils.widgets.get("git_branch").strip() or "main"
ADMIN_EMAIL      = dbutils.widgets.get("admin_email").strip()
APP_NAME         = dbutils.widgets.get("app_name").strip() or "datamarket"
LAKEBASE_PROJECT = dbutils.widgets.get("lakebase_project").strip() or "datamarket"
LAKEBASE_HOST    = dbutils.widgets.get("lakebase_host").strip()
WAREHOUSE_ID     = dbutils.widgets.get("warehouse_id").strip()
DEMO_MODE        = dbutils.widgets.get("demo_mode").strip()
SEED_DATA        = dbutils.widgets.get("seed_data").strip() or "auto"
GRANT_CATALOGS   = dbutils.widgets.get("grant_catalogs").strip() or "true"

def _detect_notebook_email():
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        me = w.current_user.me()
        for e in (me.emails or []):
            if getattr(e, "primary", False) and e.value:
                return e.value.strip()
        if me.user_name and "@" in me.user_name:
            return me.user_name.strip()
        if w.config.username and "@" in w.config.username:
            return w.config.username.strip()
    except Exception:
        pass
    try:
        user = dbutils.notebook.entry_point.getDbutils().notebook().getContext().userName().get()
        if user and "@" in user:
            return user.strip()
    except Exception:
        pass
    return ""

if not ADMIN_EMAIL:
    ADMIN_EMAIL = _detect_notebook_email()

if not ADMIN_EMAIL:
    raise ValueError(
        "admin_email is required. Either fill the widget at the top of this notebook "
        "with your SSO email, or re-run on a cluster where your identity is available."
    )

print("Configuration:")
for k, v in [
    ("Repo", f"{REPO_URL} @ {GIT_BRANCH}"),
    ("Admin", ADMIN_EMAIL),
    ("App", APP_NAME),
    ("Lakebase project", LAKEBASE_PROJECT),
    ("Lakebase host", LAKEBASE_HOST or "(auto-detect)"),
    ("Warehouse ID", WAREHOUSE_ID or "(auto-detect)"),
    ("Demo mode", DEMO_MODE),
    ("Seed data", f"{SEED_DATA} (auto → {'true' if DEMO_MODE == 'true' else 'false'})"),
    ("Grant UC catalogs", GRANT_CATALOGS),
]:
    print(f"  {k:16}: {v}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 2 — Configure CLI from notebook identity
# MAGIC
# MAGIC **Compute:** must be attached to a **cluster** (top-right cluster picker). Serverless will fail here.

# COMMAND ----------

import os, textwrap, subprocess, json
from pathlib import Path

def _notebook_auth():
    """Workspace host + token from notebook context (clusters) with SDK fallback."""
    host, token, user = "", "", ""
    try:
        ctx = dbutils.notebook.entry_point.getDbutils().notebook().getContext()
        host = (ctx.apiUrl().get() or "").rstrip("/")
        token = ctx.apiToken().get() or ""
        user = ctx.userName().get() or ""
    except Exception:
        pass
    if not host or not token:
        try:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            host = host or (w.config.host or "").rstrip("/")
            token = token or (w.config.token or "")
            user = user or (w.config.username or "")
        except Exception:
            pass
    # apiUrl is occasionally returned with /api/2.0 suffix
    for suffix in ("/api/2.0", "/api/2.1"):
        if host.endswith(suffix):
            host = host[: -len(suffix)]
    return host.rstrip("/"), token, user

HOST, TOKEN, NOTEBOOK_USER = _notebook_auth()
USER = NOTEBOOK_USER if "@" in (NOTEBOOK_USER or "") else ADMIN_EMAIL
PROFILE = "notebook-deploy"

if not HOST or not TOKEN:
    raise RuntimeError(
        "Could not read workspace host/token. Attach this notebook to a "
        "**single-node cluster** (not Serverless), then re-run Step 2."
    )

cfg_path = Path.home() / ".databrickscfg"
cfg_path.write_text(textwrap.dedent(f"""\
[{PROFILE}]
host  = {HOST}
token = {TOKEN}
"""))
os.chmod(cfg_path, 0o600)

# Ensure CLI on PATH for later Python cells
CLI_BIN = Path.home() / ".databricks" / "bin"
os.environ["PATH"] = f"{CLI_BIN}:{os.environ.get('PATH', '')}"

print(f"✅ CLI profile '{PROFILE}' → {HOST}")
print(f"✅ User: {USER}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 3 — Build frontend (~3 min)
# MAGIC
# MAGIC Clones the repo and runs `npm run build`. **No Databricks CLI** — some workspaces block CLI in notebooks.

# COMMAND ----------

import shlex, subprocess

WORKDIR = "/tmp/datamarket-deploy"
REPO_DIR = f"{WORKDIR}/datamarket-databricks"

build_script = f"""
set -euo pipefail
echo "════════════════════════════════════════"
echo " Installing Node.js 20 (nvm)"
echo "════════════════════════════════════════"
export NVM_DIR="/tmp/nvm"
mkdir -p "$NVM_DIR"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
node -v && npm -v

echo "════════════════════════════════════════"
echo " Cloning repo"
echo "════════════════════════════════════════"
rm -rf "{WORKDIR}"
mkdir -p "{WORKDIR}"
cd "{WORKDIR}"
git clone --depth 1 --branch {shlex.quote(GIT_BRANCH)} {shlex.quote(REPO_URL)} datamarket-databricks
echo "════════════════════════════════════════"
echo " Git commit cloned for deploy"
echo "════════════════════════════════════════"
git -C datamarket-databricks log -1 --format="  %h %s (%ci)"
grep -qE "w\.(postgres|database)\.create_project" datamarket-databricks/scripts/notebook_deploy_lib.py \\
  && echo "  deploy lib: OK (Lakebase SDK)" \\
  || echo "  deploy lib: STALE — push latest main to GitHub and re-run Step 3"
cd datamarket-databricks/src/app
npm install --silent
npm run build:local
echo "Build complete"
"""

print("Building frontend — expect ~3 minutes...")
proc = subprocess.run(["bash", "-c", build_script], check=False)
if proc.returncode != 0:
    raise RuntimeError(f"Frontend build failed (exit {proc.returncode}). See output above.")
if LAKEBASE_HOST:
    cache = f"{REPO_DIR}/src/app/.lakebase-{APP_NAME}.cache"
    Path(cache).parent.mkdir(parents=True, exist_ok=True)
    Path(cache).write_text(LAKEBASE_HOST)
print("✅ Frontend built")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 4 — Deploy via Python SDK (~3 min)
# MAGIC
# MAGIC Uses the Databricks Python SDK (not the CLI). Works on workspaces that block CLI in notebooks.

# COMMAND ----------

# MAGIC %pip install --quiet --upgrade "databricks-sdk>=0.40.0" psycopg2-binary

# COMMAND ----------

import importlib.util
import sys
import subprocess
import importlib
from databricks.sdk import WorkspaceClient

if not Path(REPO_DIR).is_dir():
    raise RuntimeError("REPO_DIR missing — run Step 3 first (it clones the repo to /tmp).")

subprocess.check_call(
    [sys.executable, "-m", "pip", "install", "--quiet", "--upgrade", "databricks-sdk>=0.40.0"],
)
if not (importlib.util.find_spec("databricks.sdk.service.postgres") or importlib.util.find_spec("databricks.sdk.service.database")):
    raise RuntimeError(
        "databricks-sdk Lakebase API still missing after upgrade.\n"
        "Re-run the pip cell above, then this cell."
    )
import databricks.sdk
print(f"databricks-sdk: {getattr(databricks.sdk, '__version__', 'unknown')}")

git_info = subprocess.run(
    ["git", "-C", REPO_DIR, "log", "-1", "--format=%h %s (%ci)"],
    capture_output=True, text=True, check=False,
)
if git_info.stdout.strip():
    print(f"Repo at deploy time: {git_info.stdout.strip()}")

sys.path.insert(0, f"{REPO_DIR}/scripts")
if "notebook_deploy_lib" in sys.modules:
    importlib.reload(sys.modules["notebook_deploy_lib"])
from notebook_deploy_lib import DEPLOY_LIB_VERSION, deploy_from_notebook, resolve_seed

lib_path = Path(REPO_DIR) / "scripts" / "notebook_deploy_lib.py"
lib_src = lib_path.read_text()
if not ("create_project" in lib_src and "seed.sql" in lib_src):
    raise RuntimeError(
        "Stale notebook_deploy_lib.py — re-run Step 3 to clone latest from GitHub.\n"
        f"File: {lib_path}"
    )
print(f"deploy_lib version: {DEPLOY_LIB_VERSION}")
print(f"seed: {SEED_DATA} → apply={resolve_seed(SEED_DATA, DEMO_MODE)}")

w = WorkspaceClient(host=HOST, token=TOKEN)
result = deploy_from_notebook(
    w,
    repo_dir=REPO_DIR,
    admin_email=ADMIN_EMAIL,
    app_name=APP_NAME,
    lakebase_project=LAKEBASE_PROJECT,
    lakebase_host=LAKEBASE_HOST,
    warehouse_id=WAREHOUSE_ID,
    demo_mode=DEMO_MODE,
    seed_data=SEED_DATA,
    grant_catalogs=GRANT_CATALOGS,
)
APP_URL = result.get("url") or ""

print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("  DataMarket is live")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"  URL   : {APP_URL or f'Apps UI → {APP_NAME}'}")
print(f"  Admin : {ADMIN_EMAIL}")
print()
print("Next steps:")
print("  1. Open the URL → log in with SSO")
print("  2. Manage → Import from UC")
print("  3. Manage → Settings → confirm SQL Warehouse ID")

if APP_URL:
    displayHTML(f'<h3><a href="{APP_URL}" target="_blank">Open DataMarket →</a></h3>')

# COMMAND ----------

# MAGIC %md
# MAGIC ## Troubleshooting
# MAGIC
# MAGIC | Error | Fix |
# MAGIC |---|---|
# MAGIC | `npm not found` | Attach a **cluster** (not Serverless), re-run Step 3 |
# MAGIC | `CLI only supported in web terminal` | Expected on some workspaces — Steps 3–4 use SDK, not CLI |
# MAGIC | `No module named databricks.sdk.service.postgres` | Re-run the **pip cell** then Step 4 (upgrades databricks-sdk) |
# MAGIC | `No API found for POST /postgres/autoscaling` | **Stale clone** — re-run Step 3; check git commit printed above |
# MAGIC | `Could not read workspace host/token` | Attach a **cluster** (not Serverless), re-run Step 2 |
# MAGIC | `Deploy did not reach SUCCEEDED` | Apps → your app → logs; need Apps create permission |
# MAGIC | `psql` / schema warnings | Non-fatal — app creates tables on first start |
# MAGIC
# MAGIC **No local install required:** Browser + this notebook on a cluster — no local Node or CLI.
