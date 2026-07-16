# DataMarket — Deployment Guide

---

## Before you start — install dependencies

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

Verify they're all present:
```bash
databricks -v && node -v && npm -v && psql --version
```

---

## Alternative — Deploy from a Databricks notebook (no local Node/npm)

If laptops are locked down (no `brew`, no local Node), use the workspace notebook instead of `deploy.sh` on a Mac:

1. Import **`scripts/deploy_notebook.py`** into your workspace (Repos → import, or upload as notebook).
2. Attach to a **single-node cluster** with internet access (DBR 14.3+).
3. Fill the widgets: `admin_email`, `lakebase_project`, optional `warehouse_id` and `lakebase_host`.
4. Run all cells (~5–10 minutes).

The notebook installs Node + Databricks CLI on the cluster driver, clones this repo, and runs `deploy.sh` — same result as a local deploy.

> **Do not use** the browser Web Terminal — it lacks Node/npm. Use this notebook on a cluster.

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

The script runs 10 steps end-to-end with no manual input:

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
| 9 | Grants SP `USE CATALOG + BROWSE + SELECT` on all Unity Catalog catalogs and schemas |
| 10 | Tags the App and SQL Warehouse (`app=datamarket`) for spend observability in `system.billing.usage` |

After deploy, an onboarding wizard opens in the app. The SQL Warehouse ID is auto-filled from what the script detected — just verify and continue.

> Branding, integrations, feature toggles, and notifications are all configured in **Manage → Settings** — no redeploy needed. The only thing that requires a redeploy is changing `--demo-mode`.

---

## Permissions set by the script

| Resource | Who | What | Step |
|---|---|---|---|
| Lakebase | App SP | `USAGE + CREATE` on schema, `ALL PRIVILEGES` on tables | 7 |
| SQL Warehouse | App SP | `CAN USE` | 8 |
| Unity Catalog | App SP | `USE CATALOG + BROWSE + SELECT` on all catalogs/schemas | 9 |
| Databricks App + Warehouse | — | Tagged `app=datamarket` for cost attribution | 10 |
| Unity Catalog | End users | `SELECT` on approved tables | via approval flow |

---

## Troubleshooting

**No Manage tab after login** — email mismatch. Re-run deploy or pass `--admin-email you@company.com` explicitly.

**`relation "settings" does not exist`** — `psql` wasn't installed when deploy ran. Install it (`brew install postgresql@16`) and re-run.

**Lakebase not ready after 3 min / "project slug already exists"** — previous deploy was interrupted. Use `--lakebase-project datamarket-app` (or any new name), or delete the broken project in Compute → Lakebase and re-run.

**App shows wrong user / "Hi Richard"** — SP OAuth role wasn't created. Re-run deploy; Step 7 now handles this explicitly.

**Approvals don't issue UC grants** — Warehouse missing or SP lacks `CAN USE`. Re-run; Step 8 re-applies automatically.

**UC Import shows no catalogs or schemas** — SP lacks UC permissions. Re-run; Step 9 re-applies `USE CATALOG + BROWSE + SELECT ON SCHEMA`. If a new schema was created after deploy, use **Manage → Settings → Re-open setup wizard → Catalog Access** to generate the exact `GRANT SELECT ON SCHEMA` SQL and run it in the SQL editor.

**Lakebase custom tags** — The Lakebase API doesn't expose tags via CLI yet. Set them manually: Compute → Lakebase → your project → Settings → Custom tags → add `app = datamarket`.

**Want to switch from Demo to Production mode** — redeploy without the flag: `./deploy.sh --profile my-profile` (default is `--demo-mode false`).

**Sample Data Preview shows "SQL Warehouse required"** — Either the Warehouse ID isn't saved in **Manage → Settings**, or the app's service principal doesn't have "Can use" permission on the warehouse.

---

## Alternative: Deploy with Databricks Asset Bundles (DAB)

If you prefer infrastructure-as-code or are integrating into a CI/CD pipeline, DataMarket ships with a full `databricks.yml` that provisions Lakebase **and** deploys the app declaratively.

**Requires:** Databricks CLI ≥ 0.287.0

```bash
# From repo root
./deploy.sh \
  --profile      my-profile \
  --admin-email  you@company.com \
  --warehouse-id YOUR_WAREHOUSE_ID \
  --use-bundle   true \
  --bundle-target prod
```

The `--use-bundle true` flag changes the deploy flow: DAB provisions Lakebase and deploys the app; the script still runs psql grants and API permission steps that DAB can't do.
