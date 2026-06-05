-- DataMarket — Schema + Generic Demo Data
-- Runs schema.sql first, then inserts generic sample data for demos.
-- For production deployments with an empty catalog, use schema.sql only.
--
-- Usage:
--   PGPASSWORD="$TOKEN" psql \
--     -h YOUR_LAKEBASE_HOST -p 5432 \
--     -U YOUR_EMAIL -d databricks_postgres \
--     --set=sslmode=require \
--     -c "CREATE SCHEMA IF NOT EXISTS datamarket;" \
--     -f schema/seed.sql

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

-- ─── Settings ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Demo Users ─────────────────────────────────────────────────────────────────
INSERT INTO users (email, display_name, role, department) VALUES
    ('analyst@example.org',      'Alex Analyst',     'analyst',       'Finance'),
    ('manager@example.org',      'Morgan Manager',   'manager',       'Operations'),
    ('datasteward@example.org',  'Dana Steward',     'data_steward',  'Data Governance')
ON CONFLICT (email) DO NOTHING;

-- ─── Demo Data Products ─────────────────────────────────────────────────────────
-- Replace uc_full_name values with your own Unity Catalog table paths.
INSERT INTO data_products (product_ref, uc_full_name, display_name, description, type, domain, tags, source_system, refresh_frequency, owner_email, classification, last_refreshed) VALUES
    ('DP-001', 'your_catalog.your_schema.revenue_summary',
     'Revenue Summary', 'Monthly revenue aggregations by business unit and region.',
     'Dataset', 'Finance', ARRAY['revenue','monthly','kpi'], 'ERP', 'Monthly', 'datasteward@example.org', 'Internal', NOW() - INTERVAL '5 days'),
    ('DP-002', 'your_catalog.your_schema.customer_360',
     'Customer 360', 'Unified customer profile combining CRM, support, and usage data.',
     'Dataset', 'Operations', ARRAY['customer','crm','unified'], 'CRM', 'Daily', 'datasteward@example.org', 'Confidential', NOW() - INTERVAL '1 day'),
    ('DP-003', 'your_catalog.your_schema.vendor_payments',
     'Vendor Payments', 'All vendor payment transactions with contract and PO references.',
     'Dataset', 'Finance', ARRAY['vendor','payments','procurement'], 'AP System', 'Weekly', 'datasteward@example.org', 'Confidential', NOW() - INTERVAL '3 days'),
    ('DP-004', NULL,
     'Operational KPI Dashboard', 'Executive dashboard showing service delivery metrics across all departments.',
     'Dashboard', 'Operations', ARRAY['dashboard','kpi','executive'], 'Databricks', 'Daily', 'datasteward@example.org', 'Internal', NOW() - INTERVAL '1 day'),
    ('DP-005', 'your_catalog.your_schema.employee_headcount',
     'Employee Headcount', 'Active employee counts by department, location, and classification.',
     'Dataset', 'HR', ARRAY['hr','headcount','workforce'], 'HRIS', 'Monthly', 'datasteward@example.org', 'Confidential', NOW() - INTERVAL '15 days'),
    ('DP-006', 'your_catalog.your_schema.service_requests',
     'Service Requests', 'Citizen and internal service requests with status tracking and SLA metrics.',
     'Dataset', 'Operations', ARRAY['service','requests','sla'], 'ServiceNow', 'Daily', 'datasteward@example.org', 'Internal', NOW() - INTERVAL '1 day'),
    ('DP-007', NULL,
     'Budget vs. Actuals Report', 'Automated report comparing approved budget to actual expenditure by quarter.',
     'Report', 'Finance', ARRAY['budget','report','quarterly'], 'ERP', 'Quarterly', 'datasteward@example.org', 'Internal', NOW() - INTERVAL '45 days'),
    ('DP-008', 'your_catalog.your_schema.it_asset_inventory',
     'IT Asset Inventory', 'Complete inventory of hardware, software, and cloud assets with lifecycle status.',
     'Dataset', 'IT', ARRAY['assets','inventory','it'], 'CMDB', 'Weekly', 'datasteward@example.org', 'Internal', NOW() - INTERVAL '4 days')
ON CONFLICT (product_ref) DO NOTHING;

-- ─── Demo access request ─────────────────────────────────────────────────────────
INSERT INTO access_requests (request_ref, product_id, requester_id, requester_team, business_reason, access_level, status)
SELECT 'REQ-001',
       (SELECT product_id FROM data_products WHERE product_ref = 'DP-002'),
       (SELECT user_id FROM users WHERE email = 'analyst@example.org'),
       'Finance',
       'Need customer data for quarterly churn analysis report.',
       'Read Only',
       'Pending'
WHERE NOT EXISTS (SELECT 1 FROM access_requests WHERE request_ref = 'REQ-001');

-- ─── Demo audit log ──────────────────────────────────────────────────────────────
INSERT INTO audit_log (event_type, actor_email, target_name, metadata) VALUES
    ('REQUEST_SUBMITTED', 'analyst@example.org', 'REQ-001', '{"productRef":"DP-002","reason":"Quarterly churn analysis"}')
ON CONFLICT DO NOTHING;

SELECT 'DataMarket schema seeded successfully.' AS status;
