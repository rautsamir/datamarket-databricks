# DataMarket — Self-Service Data Product Marketplace on Databricks

![DataMarket](docs/datamarket-thumbnail.png)

A production-ready data product marketplace built **entirely on Databricks**. Designed to show enterprise and public sector customers that a modern data portal — with AI-powered discovery, real RBAC/ABAC enforcement, and persistent access workflows — can be delivered natively on Databricks, without third-party vendor tooling.

> **Origin:** Built as a proof-of-concept to show how Databricks can replace proprietary data portals costing $500K–$1M+. Reusable across any industry vertical.

---

## What It Does

- **Data Catalog** — Browse and search data products (datasets, dashboards, Genie Spaces, ML models) with domain filters, classification tags, and per-user access status
- **Access Request Workflow** — Business users request access with a justification; requests persist to Lakebase Postgres and trigger optional RFA notifications
- **Admin Approval Queue** — Data stewards approve/deny requests; each approval executes a real Unity Catalog `GRANT SELECT` via the SQL Statement Execution API
- **UC Import** — Browse Unity Catalog (catalog → schema → table) in-app and bulk-register tables as data products in seconds
- **Data Schema & Sensitivity** — Live column schema pulled from `information_schema`, with PII/Confidential sensitivity auto-detected from column names and UC tags
- **Ask AI** — Natural language data discovery backed by Databricks FMAPI (Llama 3.3-70B)
- **Insights** — Curated gallery of AI/BI dashboards with access-gated "Open" buttons
- **My Data** — Personal shelf of approved and pinned data products per user
- **Audit Trail** — Every action (request, approve, deny, revoke) logged persistently to Lakebase
- **ABAC Column Masking** — Sensitive columns stay masked post-approval; UC row filters and column masks enforce at the query engine layer

---

## Architecture

```
Browser (React + Vite + Tailwind)
        │  SSO (Entra ID / SAML — injected by Databricks Apps)
        ▼
Databricks App (Serverless Node.js / Express)
  routes/products · routes/requests · routes/users · routes/config
        │                              │
  Lakebase Autoscaling          Unity Catalog (Delta)
  (Managed Postgres)            your_catalog.your_schema.*
  ─ users                       ─ your gold/curated tables
  ─ data_products               ─ column tags (ABAC)
  ─ access_requests             ─ GRANT/REVOKE enforcement
  ─ audit_log
        │
  FMAPI (Llama 3.3-70B) · AI/BI Dashboards · Genie Space (optional)
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
| AI Features | FMAPI (Llama 3.3-70B), optional Genie Space + AI/BI Dashboards |

---

## Deploying

### One-step script (recommended)

> **Full guide:** [`docs/deploy_guide.md`](docs/deploy_guide.md)

**Prerequisites:** Databricks CLI, Node.js ≥ 18, python3. (`psql` optional — only needed for manual schema inspection.)

```bash
# 1. Clone
git clone https://github.com/rautsamir/datamarket-databricks.git
cd datamarket-databricks/src/app

# 2. Authenticate the CLI
databricks auth login --host https://your-workspace.azuredatabricks.net --profile my-profile

# 3. Deploy — that's it
./deploy.sh --profile my-profile
```

The script handles everything automatically: workspace URL detection, Lakebase creation + schema init, SP grants, frontend build, workspace upload, and app create/deploy. Prints the app URL when done.

**Common optional flags:**

```bash
./deploy.sh \
  --profile        my-profile \
  --warehouse-id   abc123def       # auto-detected if omitted; enables UC GRANTs on access approval
  --demo-mode      false           # default — real SSO + UC grants
  --lakebase-project datamarket    # default Lakebase project name
  --app-name       datamarket      # default app name / workspace folder
```

Run `./deploy.sh --help` for all flags.

### Databricks Marketplace install

When installing from the Marketplace listing, no CLI or pre-build step is required. The platform handles everything:

1. **Select resources** — choose your Lakebase Autoscaling project and a SQL Warehouse when prompted at install time
2. **Run the setup notebook** — `scripts/setup_notebook.py` initialises the Lakebase schema (one-time, run before or after install)
3. **Open the app** — the app builds its frontend (`npm install` + `vite build`) on first start automatically, then serves normally

The `manifest.yaml` startup command (`npm install --include=dev && npm run build && node app.js`) means the Marketplace installer gets a working app from raw source with no manual build step. First cold start takes ~2 minutes while dependencies are installed and the React frontend is compiled.

---

## After Deploying

The app launches a **4-step setup wizard** on first login that walks you through:

1. **SQL Warehouse** — paste or confirm your warehouse ID (auto-detected if possible)
2. **Catalog access** — checks SP permissions across all UC catalogs; click "Grant access automatically" to run `USE CATALOG + USE SCHEMA + SELECT ON CATALOG` for any that need it — covers all current and future schemas with no per-schema configuration
3. **Import data** — browse UC catalog tree and select tables to register as data products
4. **You're live** — wizard closes, catalog is populated

> **Admin access is automatic.** The deployer's email is auto-promoted to admin on first SSO login — no manual `app.yaml` editing required.

> **Branding** (portal name, tagline, logo, Genie Space ID) is configured in **Admin → Settings** inside the app — no redeploy needed.

---

## Deployment Modes

| Capability | Demo Mode (`--demo-mode true`) | Production Mode (`--demo-mode false`, default) |
|---|---|---|
| Identity | Persona switcher (Analyst / Manager / Admin) | SSO via Databricks Apps headers |
| UC GRANT/REVOKE | Generated, not executed | Executed via SQL Statement Execution API |
| Column schemas | Synthetic (hardcoded per domain) | Live from UC `information_schema` + tags |
| Audit trail | Lakebase | Lakebase |
| RFA notifications | Optional | Optional |

---

## Project Structure

```
src/app/
├── app.js           # Express server entry point
├── auth.js          # SP OAuth token + Lakebase credential helpers
├── databricks.js    # UC REST API, SQL Statement Execution, FMAPI helpers
├── db.js            # Lakebase connection, settings cache, env defaults
├── deploy.sh        # One-step deployment script
├── app.yaml         # Databricks Apps config (generated by deploy.sh)
├── lib/
│   └── roles.js     # Role normalization helpers
├── routes/
│   ├── config.js    # App config, settings, UC access check + auto-grant
│   ├── products.js  # Data products, UC import, schema fetch, delete
│   ├── requests.js  # Access request submit/approve/deny/revoke
│   ├── users.js     # Identity resolution, user management, SCIM display names
│   ├── insights.js  # Dashboard gallery
│   ├── demo.js      # Demo data reset
│   └── ask-catalog.js  # FMAPI natural language → catalog answer
└── src/
    ├── App.jsx
    ├── context/
    │   ├── PersonaContext.jsx      # Identity state (real SSO or demo persona)
    │   └── AppConfigContext.jsx    # Branding config from /api/portal/config
    ├── components/
    │   ├── FirstRunWizard.jsx      # 4-step onboarding wizard
    │   ├── ImportUCModal.jsx       # UC catalog tree browser + bulk import
    │   └── layout/
    │       └── DataMarketLayout.jsx
    └── pages/
        ├── DataMarketHomePage.jsx
        ├── DataMarketCatalogPage.jsx
        ├── DataMarketProductDetailPage.jsx
        ├── DataMarketAdminPage.jsx
        └── admin/
            ├── AdminProductsTab.jsx
            ├── AdminSettingsPanel.jsx
            └── AdminUsersTab.jsx

docs/
├── deploy_guide.md          # Full deployment reference
├── user_guide.md
└── consumption_model.md

schema/
├── schema.sql               # DDL only — for fresh production deployments
└── seed.sql                 # DDL + demo data — for demos/POCs
```

---

## Lakebase Schema (`datamarket`)

| Table | Purpose |
|---|---|
| `users` | Portal users — email, display name, role, department |
| `data_products` | Catalog entries with UC full names, type, URL, tags, classification |
| `access_requests` | Requests with status, reason, UC grant SQL, expiry |
| `audit_log` | Every submit/approve/deny/revoke action |
| `user_library` | Per-user pinned and approved products |
| `app_settings` | Key/value store for in-app configuration (name, logo, warehouse ID, etc.) |

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portal/config` | App branding and feature flags |
| `GET` | `/api/portal/identity` | Resolve SSO identity, register/backfill user |
| `GET` | `/api/portal/products` | List data products (filterable by domain, type, search) |
| `POST` | `/api/portal/products` | Register a new data product |
| `DELETE` | `/api/portal/products/:ref` | Delete a data product + cascade |
| `GET` | `/api/portal/requests?email=` | Requests for a specific user |
| `GET` | `/api/portal/requests/pending` | Admin approval queue |
| `POST` | `/api/portal/requests` | Submit new access request |
| `PUT` | `/api/portal/requests/:id/approve` | Approve + execute UC GRANT |
| `PUT` | `/api/portal/requests/:id/deny` | Deny with reason |
| `GET` | `/api/portal/library?email=` | User's approved + pinned products |
| `GET` | `/api/portal/audit` | Recent audit log entries |
| `GET` | `/api/portal/admin/uc-catalogs` | List UC catalogs visible to SP |
| `GET` | `/api/portal/admin/uc-schemas?catalog=` | List schemas in a catalog |
| `GET` | `/api/portal/admin/uc-tables-browse?catalog=&schema=` | List tables in a schema (filters internal tables) |
| `GET` | `/api/portal/admin/uc-registered` | Names of already-imported UC tables |
| `POST` | `/api/portal/admin/import-uc` | Bulk import selected UC tables as data products |
| `GET` | `/api/portal/admin/uc-access-check` | Check SP access across all UC catalogs |
| `POST` | `/api/portal/admin/uc-run-grants` | Auto-execute UC grants for inaccessible catalogs |
| `POST` | `/api/portal/ask-catalog` | FMAPI natural language → catalog answer |

---

## Why Databricks Native vs. Third-Party Portals

| | Third-Party Portal | DataMarket (Databricks Native) |
|---|---|---|
| Cost | $500K–$1M+ licensing + implementation | Included in your Databricks investment |
| Data ownership | Data piped into vendor layer | Stays in Unity Catalog |
| Access control | Vendor UI + separate policy | UC GRANT/REVOKE, enforced at engine |
| AI features | Add-on / roadmap | FMAPI + Genie, live day one |
| Infrastructure | Containers, VMs to manage | Serverless Databricks Apps |
| Login | New identity system | Existing SSO (Entra ID / SAML) |
| Audit trail | Internal to vendor | Persistent Postgres, SQL-queryable |
| Customization | Vendor SOW + timeline | Edit a YAML or click in Settings |
| Time to deploy | 6–18 months | Under an hour |

---

## License

MIT — see [LICENSE](LICENSE)
