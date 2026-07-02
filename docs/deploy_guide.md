# DataMarket — Deployment Guide

> How to install DataMarket in a brand-new Databricks workspace.

---

## Prerequisites

Install these three tools on your laptop before you start:

```bash
# Databricks CLI
brew tap databricks/tap && brew install databricks

# Node.js (v18 or later)
brew install node

# psql — only needed for demo data seeding (optional but recommended)
brew install postgresql@16
```

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/rautsamir/datamarket-databricks.git
cd datamarket
```

---

## Step 2 — Authenticate the Databricks CLI

Point the CLI at the workspace you want to deploy to:

```bash
databricks auth login \
  --host https://your-workspace.azuredatabricks.net \
  --profile my-profile
```

Follow the browser prompt to log in. Verify it worked:

```bash
databricks auth env --profile my-profile
# Should print your workspace URL and email
```

> **Azure workspaces only:** If the workspace does not auto-inject a token into the app at runtime (common on Azure), generate a Personal Access Token (PAT) in the Databricks UI under **Settings → Developer → Access Tokens**. You'll pass it as `--pat` in Step 3.

---

## Step 3 — Run the deploy script

### Option A — You have an existing Lakebase Autoscaling instance

If you can see an `ep-` hostname in **Compute → Lakebase** in the UI:

```bash
./scripts/deploy.sh \
  --profile           my-profile \
  --email             you@company.com \
  --lakebase-host     ep-your-project.database.region.azuredatabricks.net \
  --lakebase-endpoint projects/my-project/branches/production/endpoints/ep-my-project-abc123 \
  --seed              demo
```

> The `--lakebase-endpoint` value is the full resource name of your Autoscaling endpoint — required for the app's service principal to authenticate to Lakebase at runtime. The script will attempt to auto-discover it; pass it explicitly if auto-discovery fails. Find it with: `databricks postgres list-endpoints projects/<project>/branches/production --profile my-profile`

> Add `--pat YOUR_PAT` at the end if you're on Azure and need an explicit token.

### Option B — No Lakebase instance yet (script creates one)

```bash
./scripts/deploy.sh \
  --profile           my-profile \
  --email             you@company.com \
  --lakebase-instance datamarket \
  --seed              demo
```

The script will create a new Autoscaling Lakebase project named `datamarket`.

### Option C — Interactive (script asks you everything)

```bash
./scripts/deploy.sh --profile my-profile
```

The script will prompt for each setting one at a time.

---

## What the script does

| Step | What happens |
|---|---|
| 1 | Validates CLI auth and detects your workspace URL |
| 2 | Connects to (or creates) your Lakebase instance |
| 3 | Creates the `datamarket` schema and seeds demo data |
| 4 | Builds the React frontend (`npm install && npm run build:local`) |
| 5 | Generates `app.yaml` and uploads all files to the workspace |
| 6 | Creates the Databricks App and waits for compute (~2 min) |
| 7 | Deploys the app and prints the URL |
| 7b | Creates a Postgres OAuth role for the app's service principal and grants it DML access on the schema (Autoscaling only) |

> The script pauses ~2 minutes while app compute provisions on first deploy — this is normal, don't Ctrl+C.

---

## Step 4 — Open the app and configure it

Once the script prints `✅ DataMarket deployed successfully!`, open the URL it gives you. You'll be logged in automatically via SSO — the deployer email is auto-promoted to **Admin**.

Go to **Manage → Settings** to complete the one-time setup. There are two critical integrations that unlock the full feature set:

---

### ⚡ Critical: SQL Warehouse ID (enables real UC access grants)

**Without this:** Approving an access request logs the approval in the portal but does **nothing** in Unity Catalog — the user cannot actually query the table.

**With this:** Approving an access request executes `GRANT SELECT ON <table> TO <user>` in Unity Catalog automatically. This is what makes DataMarket a real self-service access portal rather than a request tracker.

**How to find your Warehouse ID:**
1. In your Databricks workspace, go to **SQL Warehouses** (under Compute)
2. Click any running warehouse (or start one)
3. Copy the ID from the URL: `https://your-workspace.net/sql/warehouses/**abc123def456**`
   — or from the **Connection details** tab

**How to set it:** Paste the ID into **Manage → Settings → Integrations → SQL Warehouse ID** → Save Settings.

> **Recommendation:** Use a small serverless warehouse. The app only runs quick GRANT/REVOKE statements — it won't generate significant DBU spend.

---

### 🤖 Optional: Genie Space ID (enables natural language Ask AI)

**Without this:** The Ask AI page in the top nav shows a placeholder.

**With this:** Users can type natural language questions about your data products — *"show me fire incidents from last month"* — and get live SQL results powered by Genie.

**Important:** A Genie Space must be **built on your specific UC tables** — it is not generic. You need to create one that knows about your data.

**How to set up a Genie Space for your data:**
1. In your workspace, go to **AI/BI → Genie → New Space**
2. Add the UC tables you want to make queryable (e.g. `your_catalog.gold.*`)
3. Give it a name, optionally add natural language instructions
4. Save it — then copy the Space ID from the URL:
   `https://your-workspace.net/genie/spaces/**01f3a...**`
5. Paste that ID into **Manage → Settings → Integrations → Genie Space ID** → Save Settings

> One Genie Space can cover multiple tables from the same catalog/schema. Configure it to cover your gold/published data products for the best Ask AI experience.

---

### Populate the catalog

After saving settings, go to **Manage → Data Products → Import from UC** to pull in your Unity Catalog tables as data products. No warehouse required for browsing or importing metadata.

> All settings persist in Lakebase — no redeployment needed when you change them.

> **Switching from Demo to Production mode** is the one exception: `DEMO_MODE` is an `app.yaml` env var, not a UI setting. To disable the persona switcher and enable real SSO identity + UC grants, set `--demo-mode false` when redeploying (see Re-deploying below).

---

## All script flags

| Flag | Default | Notes |
|---|---|---|
| `--profile` | prompted | Databricks CLI profile name |
| `--host` | auto-detected | Workspace URL (usually auto-detected from profile) |
| `--email` | prompted | Your Databricks login email — used as Postgres username |
| `--lakebase-host` | — | Direct `ep-` hostname (Autoscaling). Fastest option if you have one. |
| `--lakebase-instance` | `datamarket-lakebase` | Instance name to look up or create (Provisioned) |
| `--lakebase-endpoint` | auto-discovered | Full resource name of the Autoscaling endpoint — required for app SP auth to Lakebase. Auto-discovered when possible. |
| `--db` | `databricks_postgres` | Postgres database name |
| `--schema` | `datamarket` | Postgres schema name |
| `--app-slug` | `datamarket` | App URL slug and workspace folder name |
| `--workspace-path` | `/Workspace/Users/<email>/<slug>` | Where files are uploaded in the workspace |
| `--seed` | `demo` | `demo` = sample data, `schema` = empty schema, `skip` = no DB changes |
| `--demo-mode` | `true` | `true` = persona switcher shown; `false` = real SSO + UC grants mode |
| `--pat` | — | Explicit PAT — needed on some Azure workspaces |
| `--verbose` | off | Print full output of every command |
| `--log-file` | `/tmp/datamarket-deploy-<ts>.log` | Path for full deployment log |

> **Branding, integrations, and RFA settings** (portal name, tagline, logo, Genie Space ID, SQL Warehouse ID, RFA toggle) are configured via **Manage → Settings** in the app — no flags or redeployment needed.

---

## Troubleshooting

**Script fails partway through**
Every run writes a full log to `/tmp/datamarket-deploy-<timestamp>.log`. Run with `--verbose` to see all command output live.

**App loads but shows no data products**
The seed step may have had errors (often duplicate-key if schema already existed). Try resetting:
```bash
./scripts/deploy.sh --profile my-profile --lakebase-host <ep-...> --seed demo --email you@company.com
```
Or log in as Admin and use the **Load Demo Data** button under **Manage → Demo Controls**.

**Discover / Insights show no data after deployment**
The `LAKEBASE_ENDPOINT` was not set during deploy. The app's service principal can't authenticate to Lakebase without it. Redeploy with `--lakebase-endpoint` explicitly:
```bash
# Find your endpoint resource name:
databricks postgres list-endpoints projects/<project>/branches/production --profile my-profile

./scripts/deploy.sh --profile my-profile --lakebase-host ep-... --lakebase-endpoint projects/.../endpoints/ep-... --email you@company.com --seed skip
```

**UC Import shows no catalogs**
The `DATABRICKS_TOKEN` the app uses doesn't have Unity Catalog permissions, or the token is missing. On Azure, pass `--pat YOUR_PAT` when deploying.

**App shows `DATABRICKS_HOST and DATABRICKS_TOKEN required`**
The app can't authenticate. Redeploy with `--pat YOUR_PAT` so the token is baked into `app.yaml`.

**"Instance did not become available" during Lakebase creation**
Your workspace may have an existing instance under a different name. Use `--lakebase-host` with the `ep-` hostname from **Compute → Lakebase** in the UI instead of `--lakebase-instance`.

**Want to switch from Demo to Production mode**
`DEMO_MODE` is an `app.yaml` env var and cannot be changed from the UI. Redeploy with `--demo-mode false`:
```bash
./scripts/deploy.sh --profile my-profile --lakebase-host ep-... --email you@company.com --demo-mode false --seed skip
```

---

## Re-deploying (updates)

Pull the latest code and run the same deploy command again. The script skips Lakebase creation if the instance already exists, rebuilds the frontend only if source files changed, and re-uploads everything.

```bash
git pull
./scripts/deploy.sh --profile my-profile --lakebase-host ep-... --lakebase-endpoint projects/.../endpoints/ep-... --email you@company.com --seed skip
```

Use `--seed skip` on re-deploys to avoid re-running the seed and resetting demo data.
