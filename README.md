# DataMarket — Self-Service Data Product Marketplace on Databricks

![DataMarket](docs/datamarket-thumbnail.png)

A production-ready demo of a governed, self-service data product marketplace built **entirely on Databricks**. Designed to show enterprise and public sector customers that a modern data portal — with AI features, real RBAC/ABAC enforcement, and persistent workflows — can be delivered natively, without third-party vendor tooling.

> **Origin:** Built as a proof-of-concept to show how Databricks can replace proprietary third-party data portals costing $500K–$1M+. Reusable across any industry vertical.

---

## Post-Deployment Checklist

After running `deploy.sh`, complete these steps **before** using the app:

| # | Step | Where | Why it matters |
|---|---|---|---|
| **0** | **Set `ADMIN_EMAIL` in `app.yaml`** | `app.yaml` → `env_vars` | **Critical first step.** Set this to the deployer's email (e.g. `sglendye@yourorg.com`). On first SSO login the app auto-promotes this email to admin. Without it you land as a regular analyst with no Manage tab and no way to configure anything. Comma-separate multiple emails for co-admins. |
| 1 | Import your UC tables | **Manage → Data Products → Import from UC** | Populates the catalog — nothing shows in Discover until you do this |
| 2 | Set SQL Warehouse ID | **Manage → Settings → Integrations** | Required for `GRANT SELECT` to actually execute when you approve access requests. Without it, approvals are logged but UC permissions are never set. |
| 3 | Turn off demo mode | Set `DEMO_MODE: "false"` in `app.yaml` and redeploy | Disables the persona switcher and enables real SSO identity. Do this before any customer-facing demo. |
| 4 | Add team members | **Manage → Users** | Add data stewards and analysts, or configure Entra ID groups under the **Groups** tab for bulk role assignment. |

> **Stuck as the wrong persona after turning off demo mode?** Make sure `ADMIN_EMAIL` is set to your email and redeploy. The identity endpoint auto-promotes on first login.

> Steps 1–4 take about 10 minutes total.

---

## What It Does

- **Data Catalog** — Browse and search data products (dashboards, datasets, Genie Spaces, AI/BI dashboards, apps, ML models) with domain filters, classification tags, and per-user access status
- **Access Request Workflow** — Business users request access with a justification; requests persist to Lakebase Postgres in real time
- **Admin Approval Queue** — Data Stewards approve/deny requests; each approval generates a Unity Catalog `GRANT SELECT` statement
- **ABAC Column Masking** — Sensitive columns (SSN, DOB, bank info) stay masked even post-approval; only data stewards see them unredacted
- **My Data** — Personal shelf of approved and pinned data products per user, with access expiry tracking
- **RBAC Demo** — Three built-in personas (Analyst, Manager, Data Steward) demonstrate the full access control story without requiring real user accounts
- **Ask AI** — Natural language → SQL backed by a live Databricks Genie Space
- **Insights** — Curated gallery of AI/BI dashboards with access-gated "Open" buttons
- **Floating AI Assistant** — Context-aware chatbot for access status, approval queue, and data discovery
- **Audit Trail** — Every action logged persistently to Lakebase
- **Data Steward Flow** — Register new data products, review pending registrations, publish to catalog

---

## Architecture

```
Browser (React + Vite + Tailwind)
        │  SSO (Entra ID / SAML — injected by Databricks Apps)
        ▼
Databricks App (Serverless Node.js / Express)
  /api/portal/products  · /requests  · /library  · /audit  · /config
        │                              │
  Lakebase Autoscaling          Unity Catalog (Delta)
  (Managed Postgres)            your_catalog.your_schema.*
  ─ users                       ─ your gold/curated tables
  ─ data_products               ─ column tags (for ABAC)
  ─ access_requests             ─ GRANT/REVOKE enforcement
  ─ audit_log
  ─ user_library
        │
  AI/BI Dashboard · Genie Space · Knowledge Assistant
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Lucide Icons, Recharts |
| Backend | Node.js, Express.js |
| Database (OLTP) | Lakebase Autoscaling (Databricks managed Postgres) |
| Data / Governance | Unity Catalog (Delta tables, RBAC, ABAC column masking) |
| Hosting | Databricks Apps (serverless, SSO auth baked in) |
| AI Features | Genie Space, Knowledge Assistant, AI/BI Dashboards |

---

## Project Structure

```
schema/
├── schema.sql       # DDL only — use this for fresh production deployments
└── seed.sql         # DDL + generic demo data — use this for demos/dev

src/app/
├── app.js           # Express server — all API routes + Lakebase connection
├── app.yaml         # Databricks Apps config — env vars and branding here
├── package.json     # Dependencies (pg, express, compression, cors, helmet)
├── src/
│   ├── App.jsx                          # Root router
│   ├── context/
│   │   ├── PersonaContext.jsx           # RBAC persona state + API calls
│   │   └── AppConfigContext.jsx         # Branding config from /api/portal/config
│   ├── pages/
│   │   ├── DataMarketHomePage.jsx
│   │   ├── DataMarketCatalogPage.jsx    # Browse + filter catalog, UC Import
│   │   ├── DataMarketProductDetailPage.jsx  # ABAC column preview, request modal
│   │   ├── DataMarketLibraryPage.jsx    # My Data (user) / Admin panel
│   │   ├── DataMarketRegisterPage.jsx   # Register new data products
│   │   ├── DataMarketInsightsPage.jsx   # Curated dashboard gallery
│   │   ├── DataMarketAdminPage.jsx      # Approval queue, user mgmt, demo reset
│   │   └── AIExplorerPage.jsx           # Genie Space ask-AI interface
│   └── components/
│       ├── DataMarketAssistant.jsx      # Floating chatbot
│       ├── ImportUCModal.jsx            # Unity Catalog bulk import modal
│       └── layout/
│           └── DataMarketLayout.jsx    # Top-nav shell with persona switcher

docs/
├── datamarket-thumbnail.png
├── consumption_model.md
├── user_guide.md
└── *_data_dictionary.md
```

---

## Lakebase Schema (`datamarket`)

| Table | Purpose |
|---|---|
| `users` | Portal users — email, role, department |
| `data_products` | Catalog entries with UC full names, type, URL, classification |
| `access_requests` | Requests with status, reason, UC grant SQL, expiry |
| `audit_log` | Every submit/approve/deny action |
| `user_library` | Per-user pinned and approved products |

Once registered as a UC catalog, tables are queryable directly from Databricks SQL, notebooks, and AI/BI dashboards.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portal/config` | App branding (name, subtitle, logo URL) |
| `GET` | `/api/portal/products` | List data products (filterable by domain, type, search) |
| `GET` | `/api/portal/requests?email=` | Requests for a specific user |
| `GET` | `/api/portal/requests/pending` | Admin approval queue |
| `POST` | `/api/portal/requests` | Submit new access request |
| `PUT` | `/api/portal/requests/:id/approve` | Approve + log UC grant SQL |
| `PUT` | `/api/portal/requests/:id/deny` | Deny with reason |
| `GET` | `/api/portal/library?email=` | User's approved + pinned products |
| `GET` | `/api/portal/audit` | Recent audit log entries |
| `GET` | `/api/portal/admin/uc-catalogs` | List UC catalogs (no warehouse needed) |
| `GET` | `/api/portal/admin/uc-schemas?catalog=` | List schemas in a catalog |
| `GET` | `/api/portal/admin/uc-tables-browse?catalog=&schema=` | List tables in a schema |
| `POST` | `/api/portal/admin/import-uc` | Bulk import selected UC tables as data products |
| `POST` | `/api/portal/products` | Register a new data product |
| `POST` | `/api/portal/demo-reset` | Clear all demo data (requests, audit, library) |

---

## Deploying in a New Databricks Environment

### Option A — One-step script (recommended)

> **Full guide:** [`docs/deploy_guide.md`](docs/deploy_guide.md)

**Prerequisites:** Databricks CLI, Node.js ≥ 18, psql (optional for seeding).

```bash
# 1. Clone
git clone https://github.com/rautsamir/datamarket-databricks.git
cd datamarket

# 2. Authenticate the CLI
databricks auth login --host https://your-workspace.azuredatabricks.net --profile my-profile

# 3a. Deploy — if you already have a Lakebase Autoscaling instance (ep-* hostname)
./scripts/deploy.sh \
  --profile       my-profile \
  --email         you@company.com \
  --lakebase-host ep-your-project.database.region.azuredatabricks.net \
  --seed          demo

# 3b. Deploy — let the script create a Lakebase instance for you
./scripts/deploy.sh \
  --profile           my-profile \
  --email             you@company.com \
  --lakebase-instance datamarket \
  --seed              demo

# 3c. Fully interactive — script will prompt for everything
./scripts/deploy.sh --profile my-profile
```

> **Azure workspaces:** add `--pat YOUR_DATABRICKS_PAT` if the app can't authenticate at runtime.

The script handles everything: CLI auth check → Lakebase setup → schema + seed → frontend build → workspace upload → app create/deploy. It prints the app URL when done.

> **Branding** (name, tagline, logo, Genie Space ID) is configured in **Admin → Settings** inside the app — no redeploy needed.

Run `./scripts/deploy.sh --help` for all flags. Full log always written to `/tmp/datamarket-deploy-<ts>.log`; add `--verbose` for live output.

---

### Option B — Manual steps

> Follow these if you prefer step-by-step control or are troubleshooting.

### Step 1 — Clone the repo

```bash
git clone https://github.com/rautsamir/datamarket-databricks.git
cd datamarket
```

### Step 2 — Create a Lakebase Autoscaling project

In the Databricks UI: **Compute → Lakebase → Create project** (choose Autoscaling).

Note the hostname it gives you — it looks like:
```
ep-your-project.database.region.azuredatabricks.net
```

### Step 3 — Initialize the database schema

Connect to Lakebase via `psql` (or from a Databricks notebook) using your Databricks token as the password:

```bash
# Install psql if needed: brew install postgresql

PGPASSWORD="your-databricks-personal-access-token" psql \
  -h ep-your-project.database.region.azuredatabricks.net \
  -p 5432 \
  -U your-email@company.com \
  -d databricks_postgres \
  --set=sslmode=require \
  -c "CREATE SCHEMA IF NOT EXISTS datamarket;"

# For a fresh production deployment (empty catalog):
PGPASSWORD="..." psql -h ... -U ... -d databricks_postgres --set=sslmode=require \
  -f schema/schema.sql

# For a demo deployment (comes with 8 sample data products + 1 sample request):
PGPASSWORD="..." psql -h ... -U ... -d databricks_postgres --set=sslmode=require \
  -f schema/seed.sql
```

### Step 4 — Configure `app.yaml`

Open `src/app/app.yaml` and fill in these values:

```yaml
env:
  - name: DATABRICKS_USER
    value: "your-email@company.com"        # Your Databricks login email
  - name: LAKEBASE_HOST
    value: "ep-your-project.database.region.azuredatabricks.net"
  - name: LAKEBASE_DB
    value: "databricks_postgres"
  - name: LAKEBASE_SCHEMA
    value: "datamarket"

  # ── Branding ────────────────────────────────────────────────────────────
  - name: APP_NAME
    value: "DataMarket"                    # Change to your org's portal name
  - name: APP_SUBTITLE
    value: "Data Discovery & Access"       # Tagline shown under the name
  - name: APP_LOGO_URL
    value: "/your-logo.png"               # Path to logo in dist/public, or "" to hide

  # ── Mode ────────────────────────────────────────────────────────────────
  - name: DEMO_MODE
    value: "true"                          # true = persona switcher, false = real SSO
```

`DATABRICKS_HOST` is set explicitly by the deploy script. `DATABRICKS_TOKEN` is auto-injected by Databricks Apps at runtime on most workspaces. On some Azure workspaces it may need to be set explicitly via `--pat` (see Option A troubleshooting above).

### Step 5 — Build the frontend

```bash
cd src/app
npm install
npm run build:local     # compiles React → dist/
```

### Step 6 — Upload to your Databricks workspace

```bash
# Set your target workspace path
TARGET=/Workspace/Users/your-email@company.com/datamarket

databricks workspace import --file dist/index.html --format AUTO --overwrite \
  $TARGET/dist/index.html

databricks workspace import-dir dist/assets $TARGET/dist/assets --overwrite

databricks workspace import --file app.js --format AUTO --overwrite $TARGET/app.js

databricks workspace import --file app.yaml --format AUTO --overwrite $TARGET/app.yaml
```

### Step 7 — Create and deploy the Databricks App

```bash
# Create the app (waits ~2 min for compute to provision)
databricks apps create datamarket

# Then deploy the code
databricks apps deploy datamarket --source-code-path $TARGET
```

### Step 8 — Open the app and add your data

1. Open the app URL Databricks gives you
2. Switch to the **Admin** persona (top-right dropdown)
3. Go to **Manage → Settings** to configure portal name, logo, and Genie Space ID
4. Go to **Discover** — if no products exist, the onboarding banner will appear
5. Click **"Import from Unity Catalog"** to browse your UC catalog in a nested explorer (catalog → schema → table) and bulk-register tables as data products — no SQL Warehouse needed
6. Or click **"Register a Product"** to add them manually with descriptions, tags, and URLs

---

## Deployment Modes

DataMarket supports two modes controlled by `DEMO_MODE` in `app.yaml`:

### Demo Mode (`DEMO_MODE=true`, default)

For presentations, POCs, and sales demos. Uses a persona switcher (Analyst / Manager / Data Steward) with synthetic data. UC GRANT/REVOKE statements are generated and shown but not executed.

### Production Mode (`DEMO_MODE=false`)

For real customer deployments. SSO identity flows from Databricks Apps headers (Entra ID / Okta). UC GRANT/REVOKE is executed for real via the SQL Statement Execution API. Set `SQL_WAREHOUSE_ID` to enable this.

| Capability | Demo Mode | Production Mode |
|---|---|---|
| Identity | Persona switcher | SSO via Databricks Apps headers |
| UC GRANT/REVOKE | Generated, not executed | Executed via SQL Statement Execution API |
| RFA notifications | Optional (`RFA_ENABLED=true`) | Optional (`RFA_ENABLED=true`) |
| Column schemas | Synthetic (hardcoded per domain) | Live from UC `information_schema` + tags |
| Audit trail | Lakebase | Lakebase |

### Optional: Enable UC GRANT execution

```yaml
- name: SQL_WAREHOUSE_ID
  value: "your-sql-warehouse-id"
```

### Optional: Enable RFA notifications

```yaml
- name: RFA_ENABLED
  value: "true"
```

Then configure where notifications go (email, Slack, Teams):

```bash
databricks rfa update-access-request-destinations catalog:your_catalog \
  --json '{"destinations": [{"destination_id": "data-stewards@company.com", "destination_type": "EMAIL"}]}'
```

### Optional: Expose Lakebase to Unity Catalog

Register Lakebase as a federated catalog so you can query request/audit data directly from SQL Editor and AI/BI dashboards:

```bash
databricks database create-database-catalog \
  datamarket_lakebase YOUR_LAKEBASE_PROJECT_NAME databricks_postgres
```

After this, `SELECT * FROM datamarket_lakebase.datamarket.access_requests` works anywhere in the workspace.

---

## Customizing for Your Customer

Most customization is done through the **Admin → Settings** tab — no code changes or redeployment needed:

| What to change | Where |
|---|---|
| Portal name & tagline | Admin → Settings (in-app) |
| Logo | Admin → Settings → Logo URL (path or full URL) |
| Genie Space ID | Admin → Settings → Genie Space ID |
| UC grant execution | Admin → Settings → SQL Warehouse ID |
| RFA notifications | Admin → Settings → RFA toggle |
| Default data products | Discover → Import from Unity Catalog (in-app) |
| Demo mode vs. production | `app.yaml` → `DEMO_MODE` (requires redeploy) |
| Persona names / departments | `src/context/PersonaContext.jsx` (requires code change) |

---

## Why Databricks Native vs. Third-Party Portals

| | Third-Party Portal | DataMarket (Databricks Native) |
|---|---|---|
| Cost | $500K–$1M+ licensing + implementation | Included in your Databricks investment |
| Data ownership | Data piped into vendor layer | Stays in Unity Catalog |
| Access control | Vendor UI + separate policy | UC GRANT/REVOKE, enforced at engine |
| AI features | Add-on / roadmap | Genie + Knowledge Assistant, live day one |
| Infrastructure | Containers, VMs to manage | Serverless Databricks Apps |
| Login | New identity system | Existing SSO (Entra ID / SAML) |
| Audit trail | Internal to vendor | Persistent Postgres, SQL-queryable |
| Customization | Vendor SOW + timeline | Edit a YAML file |
| Time to deploy | 6–18 months | Hours |

---

## License

MIT — see [LICENSE](LICENSE)
