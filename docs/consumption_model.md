# Data Portal Consumption Model
## Databricks-Native vs. a vendor platform — DBU Projection

### Executive Summary
The Databricks-native Data Portal drives **3-5x more Databricks consumption** compared to a systems integrator's vendor platform platform, which routes compute through proprietary tools resulting in flat or negative DBU growth.

---

### Current State: a vendor platform (Flat Consumption)

| Component | Databricks Usage | DBU Impact |
|-----------|-----------------|------------|
| vendor platform Data Marketplace | Proprietary portal — no Databricks compute | 0 DBU |
| Power BI Dashboards | Direct Query to warehouse (minimal) | ~50 DBU/month |
| Data Ingestion (Lakeflow) | Bronze/Silver/Gold pipeline | ~200 DBU/month |
| Metadata Management | vendor platform-managed (external) | 0 DBU |
| Search & Discovery | vendor platform search engine | 0 DBU |
| **Total Estimated** | | **~250 DBU/month** |

### Proposed State: Databricks-Native Data Portal

| Component | Databricks Service | Est. DBU/Month | Notes |
|-----------|-------------------|----------------|-------|
| **AI/BI Dashboards** | SQL Warehouse (Serverless) | 400-600 | Replaces Power BI; 15 depts × daily use |
| **Genie Spaces (AI Explorer)** | SQL Warehouse + Foundation Models | 300-500 | NL queries from ~200 analysts |
| **Data Product Catalog App** | Databricks Apps + SQL Warehouse | 150-250 | Metadata queries, search, browsing |
| **Vector Search (Semantic Search)** | Vector Search Endpoints | 100-150 | Embedding generation + similarity search |
| **Knowledge Assistant** | Model Serving + Vector Search | 200-300 | RAG over documentation, ~100 queries/day |
| **Data Ingestion (Lakeflow)** | Serverless Pipelines | 200-300 | Same bronze/silver/gold + metadata extraction |
| **Fraud Detection ML** | Model Serving + Training | 150-250 | Daily scoring + monthly retraining |
| **Foundation Model APIs** | Pay-per-token | 100-200 | AI-generated descriptions, summaries |
| **Unity Catalog Governance** | Platform (included) | — | RBAC, lineage, tagging |
| **Total Estimated** | | **1,600-2,550 DBU/month** |

### Consumption Growth Trajectory

```
Month 1-3 (Release 1): ~800 DBU/month
  - AI/BI Dashboards: 400 DBU
  - Data Pipeline: 200 DBU  
  - Catalog App: 200 DBU

Month 4-6 (Release 2): ~1,500 DBU/month
  - + Genie Spaces: 400 DBU
  - + Vector Search: 150 DBU
  - + Knowledge Assistant: 250 DBU

Month 7-12 (Release 3): ~2,200 DBU/month
  - + Fraud Detection ML: 200 DBU
  - + Foundation Model APIs: 150 DBU
  - + Expanded user base: 350 DBU
```

### Key Multipliers

| Factor | Impact |
|--------|--------|
| **User adoption** | 200+ analysts across 15 departments |
| **AI/BI over Power BI** | Every dashboard view = SQL Warehouse DBUs |
| **Genie queries** | Every NL question = SQL execution + LLM tokens |
| **Vector Search** | Continuous embedding sync + query serving |
| **Model Serving** | Always-on endpoints for KA + fraud detection |
| **Self-service analytics** | Users write ad-hoc queries (no vendor platform gatekeeping) |

### ROI Summary

| Metric | vendor platform Approach | Databricks-Native |
|--------|----------------|-------------------|
| Monthly DBU | ~250 | ~1,600-2,550 |
| Annual DBU | ~3,000 | ~19,200-30,600 |
| **DBU Growth** | Flat | **6-10x increase** |
| Vendor Lock-in | High (vendor platform proprietary) | None (open standards) |
| Time to Value | 12-18 months | 3-6 months |
| Ongoing License | a systems integrator + vendor platform fees | Databricks platform only |
| Data Governance | External metadata store | Unity Catalog native |
| AI Capabilities | Limited/custom build | Built-in (Genie, FMAPI, VS) |

### Strategic Advantages
1. **Every user interaction drives DBU consumption** — no compute leakage to proprietary tools
2. **AI features are Databricks-native** — Genie, Foundation Models, Vector Search all consume DBUs
3. **Self-service model** scales consumption with adoption, not just data volume
4. **No vendor lock-in** — County owns all code, data stays in Unity Catalog
5. **Faster delivery** — 3 releases over 12 months vs. vendor platform's 18-month timeline
