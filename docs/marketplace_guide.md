# DataMarket — Marketplace Installation Guide

> This guide is for installing DataMarket from Databricks Marketplace.
> If you prefer a CLI-based installation, see [`docs/deploy_guide.md`](deploy_guide.md) instead.

---

## Overview

DataMarket is a self-service data product marketplace built natively on Databricks. It lets employees discover, explore, and request access to curated data products — governed by Unity Catalog — with a built-in approval workflow and AI-powered data exploration.

When you install DataMarket from Marketplace, Databricks handles the app deployment automatically. You only need to:
1. Create a Lakebase database (one-time)
2. Run the pre-install setup notebook (one-time)
3. Complete the Marketplace install, selecting your Lakebase project
4. Configure branding and integrations via the app's admin UI

---

## Prerequisites

- Workspace admin or app-creator privileges
- A Databricks SQL Warehouse (for UC grant execution in production mode — optional)

---

## Step 1 — Create a Lakebase project

1. In your workspace, go to **Compute → Lakebase**
2. Click **+ Create project** → choose **Autoscaling**
3. Name it `datamarket` (or any name you prefer — you'll reference it in Step 2)
4. Wait for the branch status to show **ACTIVE**

---

## Step 2 — Run the pre-install setup notebook

The setup notebook initializes the DataMarket schema in your Lakebase project. You only need to run it once.

1. Import the notebook into your workspace:
   - Download [`scripts/setup_notebook.py`](../scripts/setup_notebook.py) from the GitHub repo
   - In your workspace: **Workspace → Import → File** → select the downloaded file

2. Open the notebook and set your project name in the first cell:
   ```python
   LAKEBASE_PROJECT = "datamarket"   # your project name from Step 1
   ```

3. Run all cells — the notebook will:
   - Connect to your Lakebase project
   - Create the `datamarket` schema
   - Initialize all required tables (users, data_products, access_requests, audit_log, user_library, settings)
   - Print a confirmation with next steps

4. Verify the final cell shows `✅ All tables present — setup complete`

---

## Step 3 — Install from Marketplace

1. Find **DataMarket** in Databricks Marketplace
2. Click **Install**
3. When prompted to select resources:
   - **Lakebase database (required):** select the project you created in Step 1
   - **SQL Warehouse (optional):** select a warehouse for UC grant execution, or skip to configure later
4. Complete the installation

The platform will deploy the app into your workspace automatically.

---

## Step 4 — First-run configuration

Once installed, open the app URL Databricks provides.

1. **Switch to the Admin persona** using the dropdown in the top-right corner
2. Go to **Manage → Settings** to configure:
   - Portal name and tagline (displayed in the top navigation bar)
   - Logo URL (full URL to an image, or leave blank to hide)
   - Genie Space ID (optional — links a Genie Space as the query interface for approved datasets; Ask AI uses Databricks Foundation Models independently)
   - SQL Warehouse ID (if not set at install — needed for live UC grant execution)
3. Click **Save Settings** — changes take effect immediately, no redeployment needed

---

## Step 5 — Populate your catalog

Go to **Discover → Import from Unity Catalog** to browse your UC catalog in a nested tree (catalog → schema → table) and bulk-register tables as data products. No SQL Warehouse needed for browsing.

Alternatively, use **+ Register Product** to add data products manually with descriptions, tags, classifications, and URLs.

---

## Resources and permissions

DataMarket declares the following resources at install time:

| Resource | Required | Purpose | Permission needed |
|---|---|---|---|
| Lakebase Autoscaling | Yes | Stores the product catalog, access requests, approvals, and audit log | `CAN_CONNECT_AND_CREATE` |
| SQL Warehouse | Optional | Executes UC `GRANT`/`REVOKE` when approving requests (production mode only) | `CAN_USE` |

---

## Authentication model

DataMarket uses the **app service principal** (auto-provisioned by Databricks Apps) for all Lakebase operations. No PATs are stored or required.

For Unity Catalog operations (browse, grant/revoke), the app uses the **OBO (On-Behalf-Of) user token** forwarded by Databricks Apps — ensuring UC row filters, column masks, and table ACLs are enforced per user.

---

## Demo mode vs. production mode

| | Demo mode (`DEMO_MODE=false`, default for Marketplace) | Demo mode (`DEMO_MODE=true`) |
|---|---|---|
| Identity | Real SSO (Entra ID / Okta via Databricks Apps) | Persona switcher (for POCs and demos) |
| UC grants | Executed via SQL Warehouse | Generated but not executed |
| Recommended for | Customer deployments | Internal demos and evaluations |

To switch modes after install, update `DEMO_MODE` in the app's environment configuration and restart the app.

---

## Troubleshooting

**"No data products available" after install**
The Lakebase schema was not initialized before install. Run the setup notebook (Step 2) against your Lakebase project, then restart the app.

**"Lakebase connection failed" in app logs**
Verify the Lakebase project is ACTIVE in **Compute → Lakebase**. Autoscaling projects scale to zero when idle — the first connection after idle wakes them up and may take 15–30 seconds.

**"UC Import shows no catalogs"**
The app service principal needs Unity Catalog read access. Grant `USE CATALOG` on the relevant catalog to the app's service principal. The SP name is visible in **Compute → Apps → DataMarket → Overview**.

**SQL Warehouse not executing grants**
Ensure the app SP has `CAN_USE` on the warehouse, and the warehouse is running. Configure the warehouse ID via **Admin → Settings** if not set at install.

---

## Updating DataMarket

When a new version is published to Marketplace, update your installation from the Marketplace UI. The Lakebase schema and existing data are preserved — the app handles schema migrations automatically on startup.

---

## Uninstalling

1. Delete the app from **Compute → Apps**
2. The Lakebase project and its data are **not** deleted automatically
3. To fully remove: go to **Compute → Lakebase**, select the project, and delete it

---

## Getting help

- GitHub: [rautsamir/datamarket-databricks](https://github.com/rautsamir/datamarket-databricks)
- Open an issue for bugs or feature requests
