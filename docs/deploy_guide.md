# DataMarket — Deployment Guide

> How to install DataMarket in a brand-new Databricks workspace.

---

## Prerequisites

Install these tools on your laptop before you start:

```bash
# Databricks CLI
brew tap databricks/tap && brew install databricks

# Node.js (v18 or later)
brew install node

# psql — needed for Lakebase schema grants
brew install postgresql@16
```

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/rautsamir/datamarket-databricks.git
cd datamarket-databricks/lac_dna_portal/src/app
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
# Should print your workspace URL and email
```

---

## Step 3 — Create a Lakebase Autoscaling project

DataMarket needs a Lakebase Autoscaling project to store portal metadata (users, requests, audit log).

1. In your Databricks workspace go to **Compute → Lakebase**
2. Click **Create project** → choose **Autoscaling**
3. Name it `datamarket` (simplest — matches the default in the deploy script)
4. Wait ~2 minutes for it to provision
5. Note the hostname it gives you — looks like:
   `ep-your-project.database.region.azuredatabricks.net`

> The deploy script auto-detects this hostname via the API. If auto-detection fails it will prompt you to paste it.

---

## Step 4 — Run the deploy script

```bash
./deploy.sh \
  --profile my-profile \
  --admin-email you@company.com \
  --lakebase-project datamarket
```

That's it. The script handles the rest.

### What it does automatically

| Step | What happens |
|---|---|
| 1 | Validates prerequisites (CLI, Node, psql) |
| 2 | Reads workspace host and user from your CLI profile |
| 3 | Auto-detects Lakebase hostname from the project name |
| 4 | Writes `app.yaml` with all required environment variables |
| 5 | Builds the React frontend (`npm run build:local`) |
| 6 | Uploads source code and built assets to your workspace |
| 7 | Deploys the Databricks App (waits for `SUCCEEDED`) |
| 8 | Gets the app's service principal UUID from the deployed app |
| 9 | Connects to Lakebase and grants `CREATE + USAGE` on the schema |
| 10 | Restarts the app so database migrations run with the new permissions |
| 11 | Prints your live URL |

> The script pauses ~2–3 minutes while the app deploys — this is normal, don't Ctrl+C.

### All flags

| Flag | Default | Description |
|---|---|---|
| `--profile` | `DEFAULT` | Databricks CLI profile to use |
| `--admin-email` | prompted | **Required.** Your email — auto-promoted to admin on first login |
| `--lakebase-project` | `datamarket` | Name of your Lakebase Autoscaling project |
| `--app-name` | `datamarket` | Databricks App name and workspace folder |
| `--warehouse-id` | none | SQL Warehouse ID — script auto-grants SP "Can use" permission |
| `--grant-catalogs` | `true` | Auto-grant SP `USE CATALOG` + `USE SCHEMA` on all UC catalogs |
| `--demo-mode` | `false` | `true` = persona switcher (demos/POCs); `false` = real SSO + UC grants |

---

## Step 5 — Open the app and finish setup

Once the script prints your URL, open it in a browser. Because you set `--admin-email`, you'll land with the **Manage** tab visible.

A **first-run setup wizard** appears automatically. It walks you through the two critical configuration steps:

### Wizard Step 1 — SQL Warehouse ID

**Why it matters:** Without this, approving an access request logs the approval in the portal but does **nothing** in Unity Catalog — the user can't actually query the table. It also enables live Data Schema and Sample Data Preview on every product detail page.

**With it:** Every approval automatically executes `GRANT SELECT ON <table> TO <user>` in Unity Catalog. The product detail page shows real column names, types, and 5 live sample rows.

**How to find it:**
1. Go to **SQL Warehouses** (under Compute)
2. Click your warehouse → **Connection details**
3. Copy the ID shown next to the warehouse name, or the last segment of the HTTP path after `/sql/1.0/warehouses/`

### Wizard Step 2 — Grant the app SP access to the warehouse

After saving the Warehouse ID, you must give the app's service principal permission to use it:

1. Go to **SQL Warehouses → your warehouse → Permissions**
2. Click **Add permission**
3. Find the app SP — it's named something like `app-xxxxx datamarket` (visible in **Compute → Apps → datamarket → Details**)
4. Grant it **Can use**

Without this step, sample data preview and UC grants will silently fail.

### Wizard Step 3 — Import your data catalog

Click **Import from Unity Catalog**, browse your catalog → schema → tables, and import. This populates the portal — users can't discover anything until you do this.

The wizard marks setup complete when you're done. You can revisit both settings any time via **Manage → Settings**.

---

## Enabling Optional Features

All optional features are toggled from **Manage → Settings** — no redeployment needed.

| Feature | Where to enable |
|---|---|
| Data Requests board | Settings → Features → Data Requests toggle |
| Ask AI / Insights nav items | Settings → show/hide Ask AI and Insights |
| About / FAQ / Contact pages | Settings → Page Content — edit text and toggle visibility |
| Custom homepage search chips | Settings → Search Chips |
| Demo mode (persona switcher) | Redeploy with `--demo-mode true` — this is the one setting that requires a redeploy |

---

## Permissions Reference

DataMarket touches four permission surfaces. This table covers everything — there is no other surface area.

### 1. Lakebase (PostgreSQL)

| Who | What | How to grant | Required for |
|---|---|---|---|
| App service principal | `USAGE + CREATE` on schema, `ALL PRIVILEGES` on tables/sequences | `deploy.sh` does this automatically (Step 7) | App to read/write all portal data |

> `deploy.sh` handles this fully. No manual action needed.

---

### 2. SQL Warehouse

| Who | What | How to grant | Required for |
|---|---|---|---|
| App service principal | **Can use** | `deploy.sh --warehouse-id YOUR_ID` (automated) or Warehouse → Permissions → Add SP (manual) | UC GRANTs on approval, INFORMATION_SCHEMA queries |

> **Automated** with `--warehouse-id` flag. If you skip the flag, grant manually: SQL Warehouses → your warehouse → Permissions → Add SP.

---

### 3. Unity Catalog

| Who | What | How to grant | Required for |
|---|---|---|---|
| App service principal | `USE CATALOG` + `USE SCHEMA` on all catalogs | `deploy.sh --warehouse-id YOUR_ID` (automated) or SQL `GRANT` (manual) | UC Import browser to see schemas/tables |
| App service principal | `SELECT` on individual tables | Granted automatically via DataMarket approval flow | Schema panel to show real columns (REST API path) |
| End users | `SELECT` on approved tables | DataMarket approval flow executes `GRANT SELECT` automatically | Users to actually query the data |

> **Automated** with `--warehouse-id` flag — the script iterates all visible catalogs and grants `USE CATALOG` + `USE SCHEMA ON ALL SCHEMAS`. For `samples.*`, permissions are public by default.

**Quick SQL to grant SP access to your catalog:**
```sql
-- Run in a Databricks notebook or SQL editor
GRANT USE CATALOG ON CATALOG your_catalog TO `app-xxxxx datamarket`;
GRANT USE SCHEMA  ON SCHEMA  your_catalog.your_schema TO `app-xxxxx datamarket`;
-- Optional: so schema panel works for all tables without per-table grants
GRANT SELECT ON ALL TABLES IN SCHEMA your_catalog.your_schema TO `app-xxxxx datamarket`;
```

---

### 4. Databricks Apps

| Who | What | How to grant | Required for |
|---|---|---|---|
| App service principal | Auto-created by platform | Nothing needed | App identity |
| End users | Access the app URL | Apps → datamarket → Permissions | Users to open the app at all |

> By default Databricks Apps is accessible to all workspace users. Restrict via Apps → Permissions if needed.

---

### Summary: what requires manual action

| Step | Automated? | How |
|---|---|---|
| Lakebase schema grants | ✅ Always | `deploy.sh` Step 7 |
| App created & deployed | ✅ Always | `deploy.sh` Step 6 |
| Warehouse SP "Can use" | ✅ With `--warehouse-id` flag | `deploy.sh` Step 8 |
| UC catalog/schema visibility for SP | ✅ With `--warehouse-id` flag | `deploy.sh` Step 9 |
| End-user UC SELECT grants | ✅ Always | DataMarket approval flow |

**Fully automated deploy command:**
```bash
./deploy.sh \
  --profile my-profile \
  --admin-email you@company.com \
  --warehouse-id YOUR_WAREHOUSE_ID \
  --lakebase-project datamarket
```

With `--warehouse-id` provided, zero manual permission steps are required.

---

**No Manage tab after login**
`ADMIN_EMAIL` in `app.yaml` doesn't match your login email. The deploy script sets this from `--admin-email`. Re-run the script with the correct email.

**Approvals don't issue UC grants**
SQL Warehouse ID not configured. Go to **Manage → Settings → Integrations**.

**App starts but data doesn't persist / `relation "settings" does not exist`**
Lakebase schema grants weren't applied. Usually means the `psql` step in the deploy script failed. Re-run the script — it's idempotent. If psql is not installed, install it (`brew install postgresql@16`) and re-run.

**Deploy script can't detect Lakebase hostname**
The script will prompt you to paste it manually (once). Find it in **Compute → Lakebase → your project → hostname**. After you paste it, the value is cached in `.lakebase-datamarket.cache` next to `deploy.sh` — subsequent deploys are fully silent on this step.

**Sample Data Preview shows "SQL Warehouse required"**
Either the Warehouse ID isn't saved in **Manage → Settings**, or the app's service principal doesn't have "Can use" permission on the warehouse. See Step 5 above.

**UC Import shows no catalogs**
The app's service principal doesn't have Unity Catalog permissions. Ensure the workspace has UC enabled and the app SP has at least `USE CATALOG` privilege.

---

## Re-deploying (updates)

Pull the latest code and run the same deploy command. The script is idempotent — it skips steps that are already done and re-uploads everything that changed. The Lakebase hostname is cached so you won't be prompted again.

```bash
git pull origin main
./deploy.sh \
  --profile my-profile \
  --admin-email you@company.com \
  --lakebase-project datamarket
```
