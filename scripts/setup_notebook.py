# Databricks notebook source
# MAGIC %md
# # DataMarket — Pre-Install Setup
# 
# Run this notebook **once** in your workspace before installing DataMarket
# from Databricks Marketplace. It will:
# 
# 1. Connect to your Lakebase Autoscaling project
# 2. Create the `datamarket` schema
# 3. Initialize all required tables
# 
# **Prerequisites:**
# - A Lakebase Autoscaling project already created in your workspace
#   (Compute → Lakebase → + Create project → Autoscaling)
# - The project must have an active production branch
# 
# Once this notebook completes, return to Marketplace and complete the
# DataMarket installation by selecting your Lakebase project when prompted.

# COMMAND ----------

# MAGIC %md
# ## Step 1 — Set your Lakebase project name

# Replace with the name of your Lakebase Autoscaling project
LAKEBASE_PROJECT = "datamarket"          # e.g. "datamarket" or "my-company-datamarket"
LAKEBASE_SCHEMA  = "datamarket"          # schema within the project's default database
LAKEBASE_BRANCH  = "production"          # branch name (default: "production")

# COMMAND ----------

# MAGIC %md
# ## Step 2 — Discover connection details

import subprocess, json

def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)

# Resolve the branch resource name
projects = run(["databricks", "postgres", "list-projects", "-o", "json"])
project  = next((p for p in projects if p["name"] == LAKEBASE_PROJECT), None)

if not project:
    raise ValueError(
        f"Lakebase project '{LAKEBASE_PROJECT}' not found. "
        f"Available projects: {[p['name'] for p in projects]}"
    )

project_name = project["name"]
branches     = run(["databricks", "postgres", "list-branches", project_name, "-o", "json"])
branch       = next((b for b in branches if b["name"].endswith(LAKEBASE_BRANCH)), None)

if not branch:
    raise ValueError(
        f"Branch '{LAKEBASE_BRANCH}' not found in project '{LAKEBASE_PROJECT}'. "
        f"Available branches: {[b['name'] for b in branches]}"
    )

branch_name = branch["name"]

# Get the endpoint hostname
endpoints = run(["databricks", "postgres", "list-endpoints", branch_name, "-o", "json"])
if not endpoints:
    raise ValueError(f"No endpoints found for branch '{branch_name}'.")

ep_detail  = run(["databricks", "postgres", "get-endpoint", endpoints[0]["name"], "-o", "json"])
pg_host    = ep_detail.get("status", {}).get("hosts", {}).get("host", "")
pg_db      = "databricks_postgres"

print(f"✅ Project  : {project_name}")
print(f"✅ Branch   : {branch_name}")
print(f"✅ Host     : {pg_host}")
print(f"✅ Database : {pg_db}")
print(f"✅ Schema   : {LAKEBASE_SCHEMA}")

# COMMAND ----------

# MAGIC %md
# ## Step 3 — Initialize the schema

from databricks.sdk import WorkspaceClient

w   = WorkspaceClient()
tok = w.config.token  # workspace OAuth token — used as Postgres password

import psycopg2

DDL = f"""
CREATE SCHEMA IF NOT EXISTS {LAKEBASE_SCHEMA};

SET search_path TO {LAKEBASE_SCHEMA}, public;

CREATE TABLE IF NOT EXISTS users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255),
    role          VARCHAR(50)  DEFAULT 'analyst',
    department    VARCHAR(100) DEFAULT 'General',
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_products (
    product_id        SERIAL PRIMARY KEY,
    product_ref       VARCHAR(20)  NOT NULL UNIQUE,
    uc_full_name      VARCHAR(500),
    display_name      VARCHAR(255) NOT NULL,
    description       TEXT,
    type              VARCHAR(50)  DEFAULT 'Dataset',
    domain            VARCHAR(100),
    tags              TEXT[],
    source_system     VARCHAR(100),
    refresh_frequency VARCHAR(50),
    owner_email       VARCHAR(255),
    classification    VARCHAR(50)  DEFAULT 'Internal',
    is_active         BOOLEAN      DEFAULT TRUE,
    status            VARCHAR(20)  DEFAULT 'Published',
    source_type       VARCHAR(20)  DEFAULT 'Databricks',
    product_url       TEXT,
    report_url        TEXT,
    last_refreshed    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_requests (
    request_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_ref     VARCHAR(20)  NOT NULL UNIQUE,
    product_id      INTEGER REFERENCES data_products(product_id),
    requester_id    UUID REFERENCES users(user_id),
    requester_team  VARCHAR(100),
    business_reason TEXT NOT NULL,
    access_level    VARCHAR(50)  DEFAULT 'Read Only',
    status          VARCHAR(20)  DEFAULT 'Pending',
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID REFERENCES users(user_id),
    denial_reason   TEXT,
    uc_grant_issued BOOLEAN      DEFAULT FALSE,
    uc_grant_sql    TEXT,
    expires_at      TIMESTAMPTZ,
    requested_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id      SERIAL PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    actor_email VARCHAR(255),
    target_type VARCHAR(50),
    target_id   UUID,
    target_name VARCHAR(255),
    metadata    JSONB,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_library (
    library_id SERIAL PRIMARY KEY,
    user_id    UUID    REFERENCES users(user_id),
    product_id INTEGER REFERENCES data_products(product_id),
    added_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
"""

with psycopg2.connect(
    host=pg_host,
    port=5432,
    dbname=pg_db,
    user=w.config.username,
    password=tok,
    sslmode="require",
) as conn:
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(DDL)

print(f"✅ Schema '{LAKEBASE_SCHEMA}' initialized in project '{LAKEBASE_PROJECT}'.")
print()
print("Next steps:")
print("  1. Return to Databricks Marketplace")
print("  2. Complete the DataMarket installation")
print(f"  3. Select the '{LAKEBASE_PROJECT}' Lakebase project when prompted")
print("  4. After install, open the app and go to Admin → Settings to configure branding and integrations")

# COMMAND ----------

# MAGIC %md
# ## Optional — Verify the schema

with psycopg2.connect(
    host=pg_host, port=5432, dbname=pg_db,
    user=w.config.username, password=tok, sslmode="require",
) as conn:
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = '{LAKEBASE_SCHEMA}'
            ORDER BY table_name
        """)
        tables = [row[0] for row in cur.fetchall()]

print(f"Tables in schema '{LAKEBASE_SCHEMA}':")
for t in tables:
    print(f"  ✓ {t}")

expected = {"users", "data_products", "access_requests", "audit_log", "user_library", "settings"}
missing  = expected - set(tables)
if missing:
    print(f"\n⚠️  Missing tables: {missing} — re-run this notebook to retry")
else:
    print("\n✅ All tables present — setup complete")
