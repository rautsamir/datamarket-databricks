# LACES Data Portal — LA County Auditor-Controller

A production-ready demo of a governed data product marketplace built **entirely on Databricks**. Designed to show LA County that a modern data portal with AI features, real RBAC, and persistent workflows can be delivered natively — without a third-party vendor engagement.

---

## What It Does

- **Data Catalog** — Browse 12+ LA County data products (dashboards, datasets, reports) with domain filters, classification tags, and access status
- **Access Request Workflow** — Request access with a business justification; requests persist to Lakebase Postgres in real time
- **Admin Approval Queue** — Data Stewards approve/deny requests; each approval generates a Unity Catalog `GRANT SELECT` statement
- **My Library** — Personal shelf of approved and pinned data products
- **RBAC Demo** — Three personas (Analyst, Finance Manager, Data Steward) show the full access control story without requiring real user accounts
- **AI Explorer** — Natural language → SQL backed by a live Genie Space on the UC gold layer
- **Budget & Finance Dashboards** — Native Lakeview AI/BI dashboards replacing Power BI
- **Document Assistant** — RAG-powered chat on data dictionaries and governance docs via Knowledge Assistant
- **Audit Trail** — Every action logged to Lakebase with full persistence

---

## Architecture

```
Browser (React + Tailwind)
        │  Entra ID SSO
        ▼
Databricks App (Serverless Node.js / Express)
  /api/portal/products  · /requests  · /library  · /audit
        │                          │
  Lakebase (Postgres)        Unity Catalog (Delta)
  laces_portal schema        samir_raut_demo.lac_dna_portal.*
  ─ users                    ─ gold_departments
  ─ data_products            ─ gold_budget_summary
  ─ access_requests          ─ gold_vendor_payments
  ─ audit_log                ─ gold_internal_billing
  ─ user_library             ─ gold_data_products
        │
  AI/BI Dashboard · Genie Space · Knowledge Assistant
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Node.js, Express.js |
| Database (OLTP) | Lakebase (managed Postgres on `vibe-coding-demo`) |
| Data / Governance | Unity Catalog (Delta tables, RBAC) |
| Hosting | Databricks Apps (serverless, Entra ID auth) |
| AI Features | Genie Space, Knowledge Assistant, AI/BI Dashboards |

---

## Project Structure

```
src/app/
├── app.js              # Express server — Lakebase API routes
├── app.yaml            # Databricks Apps config
├── package.json        # Dependencies (pg, express, compression, cors, helmet)
├── src/
│   ├── App.jsx         # Root router and layout
│   ├── context/
│   │   └── PersonaContext.jsx   # RBAC persona state + API calls
│   ├── pages/
│   │   ├── LACESHomePage.jsx
│   │   ├── LACESCatalogPage.jsx
│   │   ├── LACESProductDetailPage.jsx
│   │   ├── LACESLibraryPage.jsx
│   │   ├── LACESRegisterPage.jsx
│   │   ├── LACESAdminPage.jsx
│   │   ├── AIExplorerPage.jsx
│   │   ├── BudgetFinancePage.jsx
│   │   ├── InternalBillingPage.jsx
│   │   └── DocumentsPage.jsx
│   └── components/
│       └── layout/
│           └── LACESLayout.jsx  # Top-nav shell with persona switcher
docs/
└── consumption_model.md         # DBU projection model
```

---

## Lakebase Schema (`laces_portal`)

| Table | Purpose |
|---|---|
| `users` | Portal users — email, role, department |
| `data_products` | Catalog entries with UC full names |
| `access_requests` | Requests with status, reason, UC grant SQL |
| `audit_log` | Every submit/approve/deny action |
| `user_library` | Per-user pinned and approved products |

UC-queryable at: `lac_infohub_lakebase.laces_portal.*`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portal/products` | List data products (filterable) |
| `GET` | `/api/portal/requests?email=` | Requests for a user |
| `GET` | `/api/portal/requests/pending` | Admin approval queue |
| `POST` | `/api/portal/requests` | Submit new access request |
| `PUT` | `/api/portal/requests/:id/approve` | Approve + log UC grant |
| `PUT` | `/api/portal/requests/:id/deny` | Deny with reason |
| `GET` | `/api/portal/library?email=` | User's approved + pinned products |
| `GET` | `/api/portal/audit` | Recent audit log entries |

---

## Deployed Resources

| Resource | ID |
|---|---|
| Databricks App | `lac-dna-portal` |
| AI/BI Dashboard | `01f11210160c1964ba70f998f8be5a1f` |
| Genie Space | `01f1120fc3f810f5bcc1e77f35ad1231` |
| Knowledge Assistant | `08cf3e93-eb7a-4b34-b84d-081c9dff8c0b` |
| Lakebase Instance | `vibe-coding-demo` |

---

## Local Development

```bash
cd src/app
npm install
npm run dev          # Vite dev server on :5173
node app.js          # Express API on :3000
```

Set these env vars for Lakebase connectivity:
```
DATABRICKS_HOST=https://your-workspace.azuredatabricks.net
DATABRICKS_TOKEN=your-pat-token
DATABRICKS_USER=you@databricks.com
```
