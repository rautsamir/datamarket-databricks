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
# MAGIC - A **Lakebase Autoscaling** project (create in Compute → Lakebase if missing)
# MAGIC - A **SQL Warehouse** for UC grants on approval
# MAGIC - Cluster with **outbound internet** (GitHub, npm)
# MAGIC
# MAGIC **Recommended:** Single-node cluster, DBR 14.3+ or 15.x, `Standard_DS3_v2` or larger.
# MAGIC
# MAGIC > Use this notebook on a **cluster** — not the browser **Web Terminal**.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 1 — Configuration

# COMMAND ----------

dbutils.widgets.text("repo_url", "https://github.com/rautsamir/datamarket-databricks.git", "Git repo URL")
dbutils.widgets.text("git_branch", "main", "Git branch")
dbutils.widgets.text("admin_email", "", "Admin email (SSO login — becomes admin)")
dbutils.widgets.text("app_name", "datamarket", "Databricks App name")
dbutils.widgets.text("lakebase_project", "datamarket", "Lakebase project name")
dbutils.widgets.text("lakebase_host", "", "Lakebase hostname (optional)")
dbutils.widgets.text("warehouse_id", "", "SQL Warehouse ID (optional)")
dbutils.widgets.dropdown("demo_mode", "false", ["false", "true"], "Demo mode")

REPO_URL         = dbutils.widgets.get("repo_url").strip()
GIT_BRANCH       = dbutils.widgets.get("git_branch").strip() or "main"
ADMIN_EMAIL      = dbutils.widgets.get("admin_email").strip()
APP_NAME         = dbutils.widgets.get("app_name").strip() or "datamarket"
LAKEBASE_PROJECT = dbutils.widgets.get("lakebase_project").strip() or "datamarket"
LAKEBASE_HOST    = dbutils.widgets.get("lakebase_host").strip()
WAREHOUSE_ID     = dbutils.widgets.get("warehouse_id").strip()
DEMO_MODE        = dbutils.widgets.get("demo_mode").strip()

if not ADMIN_EMAIL:
    raise ValueError("admin_email is required — use your workspace SSO email.")

print("Configuration:")
for k, v in [
    ("Repo", f"{REPO_URL} @ {GIT_BRANCH}"),
    ("Admin", ADMIN_EMAIL),
    ("App", APP_NAME),
    ("Lakebase project", LAKEBASE_PROJECT),
    ("Lakebase host", LAKEBASE_HOST or "(auto-detect)"),
    ("Warehouse ID", WAREHOUSE_ID or "(auto-detect)"),
    ("Demo mode", DEMO_MODE),
]:
    print(f"  {k:16}: {v}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 2 — Configure CLI from notebook identity

# COMMAND ----------

import os, textwrap, subprocess, json
from pathlib import Path

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
HOST = (w.config.host or "").rstrip("/")
TOKEN = w.config.token
USER = w.config.username or ADMIN_EMAIL
PROFILE = "notebook-deploy"

if not HOST or not TOKEN:
    raise RuntimeError("Could not read workspace host/token from notebook context.")

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
# MAGIC ## Step 3 — Bootstrap, build, and deploy (~5–10 min)
# MAGIC
# MAGIC Do not interrupt this cell.

# COMMAND ----------

import shlex

WORKDIR = "/tmp/datamarket-deploy"
REPO_DIR = f"{WORKDIR}/datamarket-databricks"

deploy_flags = [
    f"--profile {shlex.quote(PROFILE)}",
    f"--admin-email {shlex.quote(ADMIN_EMAIL)}",
    f"--app-name {shlex.quote(APP_NAME)}",
    f"--lakebase-project {shlex.quote(LAKEBASE_PROJECT)}",
    f"--demo-mode {shlex.quote(DEMO_MODE)}",
]
if WAREHOUSE_ID:
    deploy_flags.append(f"--warehouse-id {shlex.quote(WAREHOUSE_ID)}")

cache_cmd = ""
if LAKEBASE_HOST:
    cache_cmd = f'mkdir -p "{REPO_DIR}/src/app" && echo {shlex.quote(LAKEBASE_HOST)} > "{REPO_DIR}/src/app/.lakebase-{APP_NAME}.cache"'

deploy_script = f"""
set -euo pipefail
export PATH="$HOME/.databricks/bin:$PATH"

echo "════════════════════════════════════════"
echo " Installing Databricks CLI"
echo "════════════════════════════════════════"
if ! command -v databricks >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
  export PATH="$HOME/.databricks/bin:$PATH"
fi
databricks -v

echo "════════════════════════════════════════"
echo " Installing Node.js 20 (nvm)"
echo "════════════════════════════════════════"
export NVM_DIR="/tmp/nvm"
mkdir -p "$NVM_DIR"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
# shellcheck disable=SC1091
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
cd datamarket-databricks
{cache_cmd}

echo "════════════════════════════════════════"
echo " Running deploy.sh"
echo "════════════════════════════════════════"
chmod +x deploy.sh src/app/deploy.sh
./deploy.sh {' '.join(deploy_flags)}
"""

print("Starting deploy — expect 5–10 minutes...")
proc = subprocess.run(["bash", "-c", deploy_script], check=False)
if proc.returncode != 0:
    raise RuntimeError(f"deploy.sh failed (exit {proc.returncode}). See output above.")
print("✅ Deploy finished")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 4 — App URL

# COMMAND ----------

import json, subprocess, os

cli = str(Path.home() / ".databricks" / "bin" / "databricks")
env = {**os.environ, "PATH": f"{Path.home() / '.databricks' / 'bin'}:{os.environ.get('PATH', '')}"}

out = subprocess.run(
    [cli, "apps", "get", APP_NAME, "--profile", PROFILE, "-o", "json"],
    capture_output=True, text=True, env=env, check=True,
)
app = json.loads(out.stdout)
url = app.get("url") or ""

print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("  DataMarket is live")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"  URL   : {url or f'Apps UI → {APP_NAME}'}")
print(f"  Admin : {ADMIN_EMAIL}")
print()
print("Next steps:")
print("  1. Open the URL → log in with SSO")
print("  2. Manage → Import from UC")
print("  3. Manage → Settings → confirm SQL Warehouse ID")

if url:
    displayHTML(f'<h3><a href="{url}" target="_blank">Open DataMarket →</a></h3>')

# COMMAND ----------

# MAGIC %md
# MAGIC ## Troubleshooting
# MAGIC
# MAGIC | Error | Fix |
# MAGIC |---|---|
# MAGIC | `npm not found` | Run on a **cluster notebook**, not Web Terminal |
# MAGIC | `Lakebase hostname is required` | Create project in Compute → Lakebase, or set **lakebase_host** widget |
# MAGIC | `Cannot authenticate` | Re-run Step 2 (token expired) |
# MAGIC | `Deploy did not reach SUCCEEDED` | Apps → your app → logs; need Apps create permission |
# MAGIC | `psql not found` (warning) | Non-fatal — app creates tables on first start |
# MAGIC
# MAGIC **Scott / locked-down laptop:** Only need browser + this notebook — no brew, no local Node.
