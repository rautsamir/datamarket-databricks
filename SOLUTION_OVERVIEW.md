# DataMarket — Governed Data Product Marketplace on Databricks

> *Inspired by a real SLED customer who spent $1M+ and 6 months on a third-party portal — and still didn't get self-service.*

Business users can't find the data they need — and when they do, getting access takes weeks. DataMarket solves this with a governed, self-service data product marketplace built entirely on Databricks. No new vendors. No new infrastructure. Deployed in under a day.

---

## What It Shows

### Access Request Workflow
Self-service requests with approval queue and full audit trail stored in Lakebase (managed Postgres). Requesters submit a business justification; stewards approve or deny from a dedicated queue.

### Governance Enforcement
Each approval auto-generates a Unity Catalog `GRANT SELECT` statement with configurable expiry (30 / 60 / 90 / 180 days) and one-click revocation. Governance is enforced at the data layer — not just on paper.

### Role-Based Access Control
Analyst, Manager, and Data Steward roles with differentiated UI and governed approval authority. Production-ready via Databricks SSO — user identity flows from Entra ID / Okta automatically with zero app-level auth code.

### ABAC — Column-Level Sensitivity
Every data product exposes its Unity Catalog column schema with sensitivity labels (Public, Internal, Confidential, PII). Columns marked as sensitive are masked via UC ABAC column policies until access is granted — enforced at the query engine, not just the UI. Applies across SQL, Genie, Excel, and all connected tools.

### AI-Powered Discovery
Natural language data exploration via Genie Space. Typing *"Show me headcount by department"* routes directly to the relevant data product — and if access is restricted, surfaces a one-click request flow.

### Document Assistant
RAG-powered governance Q&A via Knowledge Assistant. Users can ask policy and compliance questions and get answers grounded in uploaded governance documents.

### Embedded Analytics
AI/BI Lakeview Dashboards embedded per data product — visible to users with approved access.

### Data Product Registration
Governed contribution workflow. Any qualified user can register a data product with metadata, tags, and a UC table link. Data Stewards review and publish to the catalog. The data ecosystem grows bottom-up, not just top-down.

### Data Freshness Indicators
Visual freshness badges (Fresh / Recent / Stale / Outdated) on every catalog card, computed from `last_refreshed` against the product's stated refresh cadence.

### Full Audit Trail
Every access decision — request, approval, denial, revocation — logged in Lakebase and queryable via SQL for compliance reporting.

---

## The Paradigm Shift

| Today ("Push" Motion) | DataMarket ("Pull" Motion) |
|---|---|
| Data platform teams decide what users see | Users explore the full universe of data products |
| Interface designed for data engineers | Business-friendly catalog with AI-powered search |
| Access via IT ticket or Slack message | Self-service request with business justification |
| Manual GRANT/REVOKE in a notebook | Auto-generated UC GRANT with expiry and revocation |
| No audit trail | Full audit log, queryable via SQL |
| $1M+ third-party portal | Built natively on Databricks in days |

---

## Why It Matters

Replaces $1M+ third-party data portal investments with a solution built natively on Databricks in days. Fully governed, zero vendor lock-in, and every user interaction — browsing, requesting, approving, querying — drives DBU consumption across Apps, Lakebase, SQL Warehouse, and Genie.

**Applicable across:** Public Sector · Financial Services · Healthcare · Any enterprise with data governance requirements

---

## Production Architecture

```
Entra ID / Okta
      ↓  (SSO — user identity injected automatically by Databricks Apps)
DataMarket App  (RBAC: Analyst / Manager / Data Steward UI roles)
      ↓  (approved GRANT)
Unity Catalog   (RBAC: table-level access + ABAC: row filters & column masks)
      ↓
Delta Tables on Databricks
```

- **App layer** controls the workflow experience (who sees the approval queue, who can register products)
- **UC GRANT** controls which tables a user can query — enforced at the engine regardless of access path
- **UC ABAC** controls which rows/columns are visible within a table — enforced at query time for SQL, Genie, Excel, notebooks, and BI tools

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Databricks workspace | Unity Catalog enabled |
| SQL Warehouse | For Genie and embedded dashboards |
| Lakebase instance | Managed Postgres, provisioned in ~5 min |
| Genie Space | Linked to your UC tables |
| Knowledge Assistant | Optional, for Document Assistant feature |

**Estimated setup time: under 4 hours**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js / Express |
| Frontend | React + Vite (served as static assets) |
| Platform | Databricks Apps (serverless, SSO via Entra ID / Okta) |
| Transactional store | Lakebase (managed Postgres) |
| Governance | Unity Catalog (GRANT/REVOKE + ABAC column policies) |
| AI / NL Query | Genie Space |
| Document Q&A | Knowledge Assistant |
| Analytics | AI/BI Lakeview Dashboards |

> Every interaction drives DBU consumption across the full Databricks platform stack.

---

## Solution Accelerator | Field Engineering IP

**Author:** Samir Raut | SLED | Databricks Field Engineering  
**Date:** March 2026  
**Repo:** [databricks-field-eng/datamarket](https://github.com/databricks-field-eng/datamarket)
