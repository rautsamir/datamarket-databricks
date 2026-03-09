# DataMarket — Demo Requirements & Implementation Guide

## Project Overview
**Name:** DataMarket
**Type:** Self-Service Data Product Marketplace
**Platform:** Databricks (Apps, Unity Catalog, Lakebase, Genie, Knowledge Assistant)
**Audience:** Enterprise and public sector customers evaluating Databricks as a full-stack application platform

---

## What This Demo Shows

A governed, self-service data marketplace where business users can discover data products, request access, and get AI-powered analytics — all built natively on Databricks without third-party tooling.

**Business value demonstrated:**
- Data discovery and catalog browsing with access controls
- Self-service access request and approval workflow
- Unity Catalog RBAC enforcement at the data layer
- AI-powered natural language analytics via Genie
- Document Q&A via Knowledge Assistant (RAG)
- Persistent transactional workflows via Lakebase

---

## Customization Variables

| Variable | Default | Description |
|---|---|---|
| `DATABRICKS_HOST` | — | Your workspace URL |
| `LAKEBASE_HOST` | — | Your Lakebase instance DNS |
| `LAKEBASE_INSTANCE` | — | Your Lakebase instance name |
| `LAKEBASE_DB` | `your_database` | PostgreSQL database name |
| `LAKEBASE_SCHEMA` | `datamarket` | PostgreSQL schema name |
| `DATABRICKS_USER` | — | Your email (for Lakebase auth) |
| `VITE_DASHBOARD_URL` | — | Published AI/BI Dashboard URL |

---

## Design Requirements
- Professional enterprise branding (adaptable to customer colors)
- Modern, executive-ready interface
- Interactive visualizations with drill-down capabilities
- Responsive design for presentations
- Real-time data via Lakebase OLTP

---

## Technical Components

### Frontend
- React 18 + Vite + Tailwind CSS + shadcn/ui
- Persona switcher for RBAC demo (no real accounts needed)
- Pages: Home, Catalog, Product Detail, Library, Register, Admin, AI Explorer, Dashboards, Documents

### Backend
- Node.js + Express.js
- Lakebase (Postgres) for requests, approvals, audit log, user library
- OAuth-based credential generation for Lakebase from Databricks token

### Databricks Services Used
- **Databricks Apps** — Serverless hosting with SSO
- **Unity Catalog** — Data governance, RBAC, Delta tables
- **Lakebase** — Managed Postgres for OLTP workflows
- **Genie Space** — Natural language → SQL on your data
- **Knowledge Assistant** — RAG on documentation
- **AI/BI Dashboards** — Lakeview native dashboards

---

## Deployment Checklist

1. Set environment variables (see `.env.example`)
2. Create Lakebase database and run schema migration
3. Register Lakebase database as Unity Catalog catalog
4. Seed data products from your Unity Catalog gold layer
5. Create Genie Space connected to your tables
6. Create Knowledge Assistant connected to your docs volume
7. Deploy app: `databricks apps deploy YOUR_APP_NAME --source-code-path /Workspace/...`

---

## Success Criteria
- **Professional Impact:** Executive-ready presentation quality
- **Business Value:** Clear demonstration of Databricks as a full-stack platform
- **RBAC Story:** Access request → approval → UC grant enforcement shown end-to-end
- **AI Story:** Genie + Knowledge Assistant live and answering questions
- **Deployment:** Under 1 day to customize and deploy for a customer
