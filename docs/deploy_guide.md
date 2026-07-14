# DataMarket — Deployment Guide

> How to install DataMarket in a Databricks workspace from scratch.

---

## Prerequisites

Install these tools on your laptop before you start:

```bash
# Databricks CLI
brew tap databricks/tap && brew install databricks

# Node.js v18+
brew install node

# psql — used for Lakebase schema init and SP grants
# Optional but strongly recommended; the schema step is skipped without it
brew install postgresql@16
```

> **python3** is also required by the deploy script (for JSON parsing). It is pre-installed on macOS and most Linux distros — no action needed unless `python3 --version` returns "not found".

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/rautsamir/datamarket-databricks.git
cd datamarket-databricks
```

---

## Step 2 — Authenticate the Databricks CLI

Point the CLI at the workspace you want to deploy to:

```bash
databricks auth login \
  --host https://your-workspace.azuredatabricks.net \
  --profile my-profile
```

Verify it worked:

```bash
databricks auth describe --profile my-profile
# Should print your workspace URL and your email
```

---

## Step 3 — Run the deploy script

```bash
./deploy.sh --profile my-profile
```

That's it. The script handles everything automatically — including creating the Lakebase project if it doesn't exist yet.

> If a previous deploy was interrupted mid-provisioning and the default project name (`datamarket`) is in a broken state, pass a custom project name:
> ```bash
> ./deploy.sh --profile my-profile --lakebase-project datamarket-app
> ```

### What it does automatically

| Step | What happens |
|---|---|
| 1 | Validates prerequisites (CLI, Node, npm, python3; warns if psql missing) |
| 2 | Reads workspace host and your email from the CLI profile |
|   | Admin email **auto-detected** — no flag needed |
| 3 | Looks up Lakebase project → **creates it if missing** (~2–3 min first time) |
|   | Resolves the endpoint hostname automatically via API |
| 4 | Generates `app.yaml` with all required environment variables |
| 5 | Builds the React frontend (`npm run build:local`) |
| 6 | Uploads source code + built assets to workspace, deploys the Databricks App |
| 7 | Creates Lakebase schema, applies `schema.sql`, creates SP OAuth role, grants SP full access |
|   | Seed data applied automatically when `--demo-mode true` (or `--seed true`) |
| 8 | **Auto-detects** a running SQL Warehouse and grants SP `CAN USE` |
| 9 | Grants SP `USE CATALOG` + `USE SCHEMA` on all Unity Catalog catalogs |

> The script pauses ~2–3 minutes on first deploy while Lakebase provisions and the app deploys — this is normal, don't Ctrl+C.

### All flags

| Flag | Default | Description |
|---|---|---|
| `--profile` | `DEFAULT` | Databricks CLI profile to use |
| `--admin-email` | **auto-detected** from CLI profile | Your email — auto-promoted to admin on first login |
| `--lakebase-project` | `datamarket` | Lakebase Autoscaling project name — created automatically if missing |
| `--app-name` | `datamarket` | Databricks App name and workspace folder |
| `--warehouse-id` | **auto-detected** | SQL Warehouse ID — script picks the best running warehouse automatically |
| `--grant-catalogs` | `true` | Auto-grant SP `USE CATALOG` + `USE SCHEMA` on all UC catalogs |
| `--demo-mode` | `false` | `true` = persona switcher for demos; `false` = real SSO + UC grants |
| `--seed` | auto | Apply `schema/seed.sql` — loads demo products, users, requests. Defaults to `true` when `--demo-mode true`, `false` otherwise |
| `--use-bundle` | `false` | Use Databricks Asset Bundle (DAB) for deploy (requires CLI ≥ 0.287.0) |
| `--bundle-target` | `prod` | DAB target: `dev` or `prod` |

> Branding (logo, app name, colour), integrations (Slack, email), and feature toggles are all configured in **Manage → Settings** in the UI — no redeployment needed.

---

## Step 4 — Open the app and finish setup

Once the script prints your URL, open it in a browser. You'll land with the **Manage** tab visible because your email was auto-promoted to admin.

An onboarding wizard opens automatically with 3 quick steps:

1. **SQL Warehouse** — the deploy script auto-detects and pre-fills this. Just verify and confirm.
2. **Import data products** — browse Unity Catalog and import your first tables. Users can't discover anything until at least one product is imported.
3. **You're live** — share the URL with your team.

### Configure via Settings (UI — no redeploy needed)

| Setting | Where |
|---|---|
| SQL Warehouse ID | Manage → Settings → Integrations (auto-set by script) |
| Branding (logo, app name) | Manage → Settings → Branding |
| Feature toggles (Requests, AI, Insights) | Manage → Settings → Features |
| RFA Notifications | Manage → Settings → Notifications |
| Search chips, About/FAQ/Contact | Manage → Settings → respective sections |

> **Only one setting requires a redeploy:** `--demo-mode`. Everything else is live via the Settings UI.

---

## Re-deploying (updates)

Pull the latest and re-run with the same flags you used originally. The script is fully idempotent — existing resources are reused, grants are re-applied safely.

```bash
git pull origin main && ./deploy.sh --profile my-profile
```

If you used a custom Lakebase project name, pass it again:

```bash
git pull origin main && ./deploy.sh --profile my-profile --lakebase-project datamarket-app
```

---

## Permissions Reference

### 1. Lakebase (PostgreSQL)

| Who | What | How | Required for |
|---|---|---|---|
| App service principal | `USAGE + CREATE` on schema, `ALL PRIVILEGES` on tables/sequences | `deploy.sh` Step 7 — fully automatic | App to read/write all portal data |

### 2. SQL Warehouse

| Who | What | How | Required for |
|---|---|---|---|
| App service principal | **Can use** | Auto-detected and granted in Step 8 | UC GRANTs on approval, schema preview |

### 3. Unity Catalog

| Who | What | How | Required for |
|---|---|---|---|
| App service principal | `USE CATALOG` + `USE SCHEMA` on all catalogs | `deploy.sh` Step 9 — automatic | UC Import browser, schema panel |
| App service principal | `SELECT` on individual tables | Granted via DataMarket approval flow | Sample data preview |
| End users | `SELECT` on approved tables | DataMarket approval flow executes `GRANT SELECT` | Users to actually query data |

### 4. Databricks Apps

| Who | What | How | Required for |
|---|---|---|---|
| App service principal | Auto-created by platform | Nothing needed | App identity |
| End users | Access the app URL | Apps → datamarket → Permissions | Opening the app |

> By default the app is accessible to all workspace users. Restrict via Apps → Permissions if needed.

### Summary: what the script automates

| Step | Automated? |
|---|---|
| Lakebase project creation | ✅ Always — created if missing |
| Lakebase schema + SP role + grants | ✅ Always (requires `psql`) |
| App created & deployed | ✅ Always |
| Warehouse detection + SP "Can use" | ✅ Always — best running warehouse auto-selected |
| UC catalog/schema visibility for SP | ✅ Always |
| Seed data (demo products/users) | ✅ When `--demo-mode true` or `--seed true` |
| End-user UC SELECT grants | ✅ Via DataMarket approval flow |

---

## Troubleshooting

**No Manage tab after login**
Your login email doesn't match `ADMIN_EMAIL`. The script auto-detects this from your CLI profile. Re-run deploy to reset it, or pass `--admin-email you@company.com` explicitly.

**App starts but data doesn't persist / `relation "settings" does not exist`**
Lakebase schema wasn't applied — usually because `psql` wasn't installed when deploy ran. Install it (`brew install postgresql@16`) and re-run. The script is fully idempotent.

**Lakebase branch not ready after 3 min / "project slug already exists" warning**
The project exists in the backend in a broken state (can happen if a previous deploy was interrupted mid-provisioning). Options:
1. Use a different project name: `./deploy.sh --profile my-profile --lakebase-project datamarket-app`
2. Delete the project from the UI (**Compute → Lakebase**) and re-run

**App shows wrong user / "Hi Richard"**
The SP's Lakebase OAuth role wasn't created correctly. Re-run deploy — Step 7 now creates the role explicitly via the Databricks API before applying grants.

**Approvals don't issue UC grants**
SQL Warehouse ID not configured, or the SP doesn't have "Can use". Re-run deploy — Step 8 re-applies the grant automatically.

**Discover / Insights show no data after deployment**
No data products imported yet. Go to **Manage → Data Products → Import from Unity Catalog**.

**UC Import shows no catalogs**
The app SP lacks Unity Catalog permissions. Re-run deploy — Step 9 re-applies `USE CATALOG` + `USE SCHEMA` grants.

**Want to switch from Demo to Production mode**
Redeploy without the flag: `./deploy.sh --profile my-profile` (default is `--demo-mode false`).

---

## Alternative: Deploy with Databricks Asset Bundles (DAB)

For CI/CD pipelines or infrastructure-as-code workflows, DataMarket ships with a full `databricks.yml`.

**Requires:** Databricks CLI ≥ 0.287.0

```bash
./deploy.sh \
  --profile      my-profile \
  --use-bundle   true \
  --bundle-target prod
```

The `--use-bundle true` flag switches the deploy flow to use `databricks bundle deploy`. The script still handles psql schema grants and permissions (DAB can't do those).

### Pure DAB (CI/CD)

```bash
# Provision Lakebase + deploy app
databricks bundle deploy -t prod \
  --var admin_email=you@company.com \
  --var demo_mode=false \
  --var lakebase_project=datamarket \
  --profile my-profile

# Run grants separately (required — DAB doesn't handle psql or permissions API)
./deploy.sh \
  --profile    my-profile \
  --use-bundle true
```
