# DataMarket — Deployment Guide

---

## Prerequisites

```bash
# Databricks CLI
brew tap databricks/tap && brew install databricks

# Node.js v18+
brew install node

# psql — used for Lakebase schema init and SP grants
# Optional but strongly recommended; schema step is skipped without it
brew install postgresql@16
```

> **python3** is also required (used for JSON parsing throughout the script). It's pre-installed on macOS and most Linux distros.

---

## Deploy

**1. Authenticate the CLI** against the workspace you want to deploy to:

```bash
databricks auth login \
  --host https://your-workspace.azuredatabricks.net \
  --profile my-profile
```

**2. Clone and run:**

```bash
git clone https://github.com/rautsamir/datamarket-databricks.git
cd datamarket-databricks
./deploy.sh --profile my-profile
```

That's it. Everything else is automatic.

### Optional flags

| Flag | Default | Description |
|---|---|---|
| `--profile` | `DEFAULT` | Databricks CLI profile |
| `--admin-email` | auto-detected from CLI | Your email — auto-promoted to admin on first login |
| `--lakebase-project` | `datamarket` | Lakebase project name — created automatically if missing |
| `--app-name` | `datamarket` | Databricks App name |
| `--warehouse-id` | auto-detected | SQL Warehouse ID — script picks the best running one |
| `--grant-catalogs` | `true` | Grant SP `USE CATALOG + USE SCHEMA` on all UC catalogs |
| `--demo-mode` | `false` | `true` = persona switcher for demos; `false` = real SSO + UC grants |
| `--seed` | auto | Load demo products/users/requests. Defaults `true` when `--demo-mode true` |
| `--use-bundle` | `false` | Use Databricks Asset Bundle (DAB) instead of direct deploy |
| `--bundle-target` | `prod` | DAB target: `dev` or `prod` |

---

## Re-deploying (updates)

```bash
git pull origin main && ./deploy.sh --profile my-profile
```

Pass the same flags you used originally (e.g. `--lakebase-project datamarket-app` if you used a custom name). The script is fully idempotent.

---

## How it works

The script runs 9 steps end-to-end with no manual input:

| Step | What happens |
|---|---|
| 1 | Validates prerequisites; warns if psql missing |
| 2 | Reads workspace host + your email from the CLI profile (admin auto-detected) |
| 3 | Looks up the Lakebase project; **creates it if missing** (~2–3 min first time) and resolves the endpoint hostname |
| 4 | Generates `app.yaml` with all required env vars |
| 5 | Builds the React frontend |
| 6 | Uploads source + built assets, deploys the Databricks App |
| 7 | Creates Lakebase schema via `schema.sql`, registers the SP as an OAuth role, applies grants |
| 8 | Auto-detects a running SQL Warehouse, grants SP `CAN USE` |
| 9 | Grants SP `USE CATALOG + USE SCHEMA` on all Unity Catalog catalogs |

After deploy, an onboarding wizard opens in the app. The SQL Warehouse ID is auto-filled from what the script detected — just verify and continue.

> Branding, integrations, feature toggles, and notifications are all configured in **Manage → Settings** — no redeploy needed. The only thing that requires a redeploy is changing `--demo-mode`.

---

## Permissions set by the script

| Resource | Who | What | Step |
|---|---|---|---|
| Lakebase | App SP | `USAGE + CREATE` on schema, `ALL PRIVILEGES` on tables | 7 |
| SQL Warehouse | App SP | `CAN USE` | 8 |
| Unity Catalog | App SP | `USE CATALOG + USE SCHEMA` on all catalogs | 9 |
| Unity Catalog | End users | `SELECT` on approved tables | via approval flow |

---

## Troubleshooting

**No Manage tab after login** — email mismatch. Re-run deploy or pass `--admin-email you@company.com` explicitly.

**`relation "settings" does not exist`** — `psql` wasn't installed when deploy ran. Install it (`brew install postgresql@16`) and re-run.

**Lakebase not ready after 3 min / "project slug already exists"** — previous deploy was interrupted. Use `--lakebase-project datamarket-app` (or any new name), or delete the broken project in Compute → Lakebase and re-run.

**App shows wrong user / "Hi Richard"** — SP OAuth role wasn't created. Re-run deploy; Step 7 now handles this explicitly.

**Approvals don't issue UC grants** — Warehouse missing or SP lacks `CAN USE`. Re-run; Step 8 re-applies automatically.

**UC Import shows no catalogs or schemas** — SP lacks UC permissions. Re-run; Step 9 re-applies `USE CATALOG + USE SCHEMA`.

**Want to switch from Demo to Production mode** — redeploy without the flag: `./deploy.sh --profile my-profile` (default is `--demo-mode false`).
