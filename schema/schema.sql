-- DataMarket — DDL Only (no demo data)
-- Use this file for production deployments that start with an empty catalog.
-- The data steward can then import data products from Unity Catalog via the app UI.
--
-- Usage:
--   PGPASSWORD="$TOKEN" psql \
--     -h YOUR_LAKEBASE_HOST -p 5432 \
--     -U YOUR_EMAIL -d databricks_postgres \
--     --set=sslmode=require \
--     -c "CREATE SCHEMA IF NOT EXISTS datamarket;" \
--     -f schema/schema.sql

SET search_path TO datamarket, public;

-- ─── Users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255),
    role          VARCHAR(50) DEFAULT 'analyst',
    department    VARCHAR(100) DEFAULT 'General',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Data Products ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_products (
    product_id        SERIAL PRIMARY KEY,
    product_ref       VARCHAR(20) NOT NULL UNIQUE,
    uc_full_name      VARCHAR(500),
    display_name      VARCHAR(255) NOT NULL,
    description       TEXT,
    type              VARCHAR(50) DEFAULT 'Dataset',
    domain            VARCHAR(100),
    tags              TEXT[],
    source_system     VARCHAR(100),
    refresh_frequency VARCHAR(50),
    owner_email       VARCHAR(255),
    classification    VARCHAR(50) DEFAULT 'Internal',
    is_active         BOOLEAN DEFAULT TRUE,
    status            VARCHAR(20) DEFAULT 'Published',
    source_type       VARCHAR(20) DEFAULT 'Databricks',
    product_url       TEXT,
    report_url        TEXT,
    last_refreshed    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Access Requests ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_requests (
    request_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_ref     VARCHAR(20) NOT NULL UNIQUE,
    product_id      INTEGER REFERENCES data_products(product_id),
    requester_id    UUID REFERENCES users(user_id),
    requester_team  VARCHAR(100),
    business_reason TEXT NOT NULL,
    access_level    VARCHAR(50) DEFAULT 'Read Only',
    status          VARCHAR(20) DEFAULT 'Pending',
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID REFERENCES users(user_id),
    denial_reason   TEXT,
    uc_grant_issued BOOLEAN DEFAULT FALSE,
    uc_grant_sql    TEXT,
    expires_at      TIMESTAMPTZ,
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit Log ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    log_id       SERIAL PRIMARY KEY,
    event_type   VARCHAR(50) NOT NULL,
    actor_email  VARCHAR(255),
    target_type  VARCHAR(50),
    target_id    UUID,
    target_name  VARCHAR(255),
    metadata     JSONB,
    occurred_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Library ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_library (
    library_id  SERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(user_id),
    product_id  INTEGER REFERENCES data_products(product_id),
    added_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

SELECT 'DataMarket schema initialized (no demo data).' AS status;
