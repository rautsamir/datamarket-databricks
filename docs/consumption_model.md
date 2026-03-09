# DataMarket — Consumption Architecture

## Databricks Services Used

This solution is built entirely on Databricks platform services. Every interaction drives Databricks compute consumption — there is no leakage to external proprietary tools.

| Component | Databricks Service | Notes |
|---|---|---|
| **Application Hosting** | Databricks Apps (serverless) | Zero infra management, scales to zero |
| **Data Governance** | Unity Catalog | RBAC, lineage, tagging, Delta tables |
| **OLTP Workflows** | Lakebase (managed Postgres) | Access requests, approvals, audit log |
| **Natural Language Analytics** | Genie Spaces | NL → SQL on Gold layer tables |
| **Document Q&A** | Knowledge Assistant (RAG) | Answers from docs stored in UC Volumes |
| **Dashboards** | AI/BI Dashboards (Lakeview) | Serverless SQL Warehouse backed |
| **AI Metadata** | Foundation Model APIs (`ai_gen`) | AI-generated descriptions on data products |

## Architecture Principles

1. **All compute stays on Databricks** — no external API calls for analytics
2. **Unity Catalog is the governance layer** — RBAC enforced at the data layer, not just the app
3. **Lakebase bridges OLTP + Lakehouse** — transactional workflows (approvals) sync back into Delta
4. **Self-service scales naturally** — more users = more SQL Warehouse, Genie, and model serving DBUs

## Deployment Notes

- Databricks Apps supports OAuth SSO with your IdP (Entra ID, Okta, etc.)
- Lakebase credentials are auto-generated via Databricks token — no static passwords
- All secrets pass via environment variables at deploy time
- `DATABRICKS_HOST` drives workspace targeting — no hardcoded endpoints
