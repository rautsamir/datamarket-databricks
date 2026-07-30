import pg from 'pg';
import {
  getWorkspaceOAuthToken,
  generateProvisionedDbCredential,
  resolveAutoscaleLakebaseAuth,
} from './auth.js';

const { Pool } = pg;

// ─── Lakebase connection config ───────────────────────────────────────────────
// Three deployment modes — detected by which env vars are present:
//
// 1. Marketplace install (recommended):
//    app.yaml uses `valueFrom: lakebase-db` → platform injects LAKEBASE_ENDPOINT,
//    PGHOST, PGDATABASE, PGPORT, PGSSLMODE. App SP (DATABRICKS_CLIENT_ID/SECRET)
//    authenticates via M2M OAuth + /api/2.0/postgres/credentials.
//
// 2. CLI deploy (deploy.sh):
//    LAKEBASE_HOST + LAKEBASE_ENDPOINT set explicitly for Autoscaling, or
//    LAKEBASE_HOST + LAKEBASE_INSTANCE_NAME for Provisioned instances.
//
// 3. Legacy / local dev:
//    DATABRICKS_TOKEN (user OAuth JWT) used directly as Postgres password.
//
// PGHOST / PGDATABASE / PGPORT are the Marketplace-injected equivalents of
// LAKEBASE_HOST / LAKEBASE_DB — checked as fallbacks so one app binary works
// for both paths without modification.
export const LAKEBASE_HOST          = process.env.LAKEBASE_HOST || process.env.PGHOST || 'your-project.database.azuredatabricks.net';
export const LAKEBASE_DB            = process.env.LAKEBASE_DB   || process.env.PGDATABASE || 'databricks_postgres';
export const LAKEBASE_SCHEMA        = process.env.LAKEBASE_SCHEMA || 'datamarket';
export const LAKEBASE_INSTANCE_NAME = process.env.LAKEBASE_INSTANCE_NAME || '';

export const DEMO_MODE        = (process.env.DEMO_MODE || 'true').toLowerCase() === 'true';
export const SQL_WAREHOUSE_ID = process.env.SQL_WAREHOUSE_ID || '';
export const RFA_ENABLED      = (process.env.RFA_ENABLED || 'false').toLowerCase() === 'true';

// ─── App branding (customize via env vars in app.yaml) ────────────────────────
export const APP_NAME     = process.env.APP_NAME     || 'DataMarket';
export const APP_SUBTITLE = process.env.APP_SUBTITLE || 'Data Discovery & Access';
export const APP_LOGO_URL = process.env.APP_LOGO_URL || '/datamarket-logo.svg';

let dbPool = null;
let poolCreatedAt = 0;
const POOL_TTL_MS = 55 * 60 * 1000; // recreate pool every 55 min (token TTL is 1h)

export async function getPool() {
  const now = Date.now();
  // Recreate pool before token expires so in-flight queries aren't dropped
  if (dbPool && now < poolCreatedAt + POOL_TTL_MS) return dbPool;

  if (dbPool) { try { await dbPool.end(); } catch (_) {} }

  let pgPassword;
  let pgUser;
  if (LAKEBASE_INSTANCE_NAME) {
    console.log(`[Lakebase] Generating DB credential for provisioned instance "${LAKEBASE_INSTANCE_NAME}"...`);
    const oauthToken = await getWorkspaceOAuthToken();
    pgPassword = await generateProvisionedDbCredential(oauthToken);
    pgUser = process.env.LAKEBASE_PGUSER || process.env.DATABRICKS_USER;
    if (!pgUser) throw new Error('DATABRICKS_USER env var is required');
    console.log('[Lakebase] Creating connection pool (Provisioned)...');
  } else {
    const auth = await resolveAutoscaleLakebaseAuth();
    pgPassword = auth.pgPassword;
    pgUser = auth.pgUser;
    console.log(`[Lakebase] Creating connection pool (${auth.mode})...`);
  }

  dbPool = new Pool({
    host:     LAKEBASE_HOST,
    port:     parseInt(process.env.PGPORT || '5432', 10),
    database: LAKEBASE_DB,
    user:     pgUser,
    password: pgPassword,
    ssl:      { rejectUnauthorized: true },
    max:      5,
    idleTimeoutMillis:      30000,
    connectionTimeoutMillis: 8000,
    options: `-c search_path=${LAKEBASE_SCHEMA},public`,
  });

  dbPool.on('error', (err) => console.error('[Lakebase] Pool error:', err.message));
  poolCreatedAt = now;
  return dbPool;
}

export async function query(sql, params = []) {
  const pool = await getPool();
  return pool.query(sql, params);
}

export async function closePool() {
  if (dbPool) await dbPool.end().catch(() => {});
}

// ─── Database health ──────────────────────────────────────────────────────────
// Tracks whether the app was able to reach and initialize Lakebase. Surfaced via
// /api/portal/config so the UI can show a real diagnostic instead of rendering
// empty/fallback content when the database is unreachable.
//
//   ok            — connected, schema and tables present
//   auth_failed   — connected to host but the SP has no Postgres role
//   no_permission — authenticated but cannot create the schema
//   unreachable   — could not reach the Lakebase host at all
//   error         — anything else
const dbHealth = { status: 'starting', message: 'Connecting to Lakebase…', hint: '' };

export function getDbHealth() { return { ...dbHealth }; }

function setDbHealth(status, message, hint = '') {
  dbHealth.status  = status;
  dbHealth.message = message;
  dbHealth.hint    = hint;
}

// Classify a Postgres/driver error into an actionable health state.
function classifyDbError(err) {
  const msg = err?.message || String(err);
  if (/password authentication failed/i.test(msg)) {
    return {
      status: 'auth_failed',
      message: 'The app service principal has no Lakebase database role.',
      hint: 'Create the role, then restart the app: databricks postgres create-role '
          + `"projects/<project>/branches/production" --json '{"spec":{"identity_type":"SERVICE_PRINCIPAL","postgres_role":"${process.env.DATABRICKS_CLIENT_ID || '<sp-uuid>'}"}}'`,
    };
  }
  if (/permission denied (to )?(create|for schema)/i.test(msg)) {
    return {
      status: 'no_permission',
      message: `The service principal cannot create the "${LAKEBASE_SCHEMA}" schema.`,
      hint: `Grant it CREATE on the database, or pre-create the schema and grant USAGE + CREATE on it to ${process.env.DATABRICKS_CLIENT_ID || 'the app SP'}.`,
    };
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|timeout expired/i.test(msg)) {
    return {
      status: 'unreachable',
      message: `Could not reach the Lakebase host ${LAKEBASE_HOST}.`,
      hint: 'Check LAKEBASE_HOST / LAKEBASE_ENDPOINT in app.yaml, and that the Lakebase endpoint is running.',
    };
  }
  return { status: 'error', message: msg, hint: '' };
}

// Quote an identifier so schema names containing hyphens (e.g. "datamarket-dev")
// are handled correctly.
const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

// Core DDL — kept in sync with schema/schema.sql. Applied by the app itself on
// first start so that whichever deployment path is used (deploy.sh, bundle,
// Marketplace, notebook) converges on the same initialized database.
//
// Because this runs as the app service principal, the SP *owns* the schema and
// its tables — which means no follow-up GRANT step is required.
const CORE_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255),
    role          VARCHAR(50) DEFAULT 'analyst',
    department    VARCHAR(100) DEFAULT 'General',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

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
    data_classification VARCHAR(50) DEFAULT 'Internal',
    last_refreshed    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS user_library (
    library_id  SERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(user_id),
    product_id  INTEGER REFERENCES data_products(product_id),
    added_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ─── Schema bootstrap — run at startup, before migrations ─────────────────────
// Creates the schema and core tables if they are missing. Idempotent, so it is
// safe when deploy.sh or the setup notebook has already initialized the database.
// Throws on failure so the caller can surface a diagnostic.
export async function bootstrapSchema() {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(LAKEBASE_SCHEMA)}`);
    await client.query(`SET search_path TO ${quoteIdent(LAKEBASE_SCHEMA)}, public`);
    await client.query(CORE_SCHEMA_DDL);
    setDbHealth('ok', 'Lakebase connected and initialized.');
  } catch (e) {
    const { status, message, hint } = classifyDbError(e);
    setDbHealth(status, message, hint);
    throw e;
  } finally {
    client.release();
  }
}

// ─── Product column cache ─────────────────────────────────────────────────────
// Cache which optional columns exist — populated once on first products query
let _productCols = null;
export async function getProductCols() {
  if (_productCols) return _productCols;
  try {
    const { rows } = await query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'datamarket' AND table_name = 'data_products'
         AND column_name IN ('source_type','product_url','report_url')`
    );
    _productCols = new Set(rows.map(r => r.column_name));
  } catch (_) {
    _productCols = new Set();
  }
  return _productCols;
}
export function resetProductColsCache() { _productCols = null; }

// ─── Settings cache ───────────────────────────────────────────────────────────
// In-memory cache so /api/portal/config stays fast (refreshed on PUT).
let settingsCache = null;

export async function loadSettings() {
  try {
    const { rows } = await query('SELECT key, value FROM settings');
    settingsCache = Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch (_) {
    // Settings table may not exist yet on first boot — that's fine.
    settingsCache = {};
  }
  return settingsCache;
}

export function getSetting(key, envFallback) {
  if (settingsCache && settingsCache[key] !== undefined && settingsCache[key] !== '') {
    return settingsCache[key];
  }
  return envFallback;
}

export function invalidateSettingsCache() { settingsCache = null; }

// ─── Schema migration — run at startup, after bootstrapSchema() ──────────────
// Incremental changes on top of the core DDL. Table ownership depends on which
// path created the tables: the app owns them when bootstrapSchema() ran first,
// but deploy.sh and the setup notebook create them as the deployer. ALTER TABLE
// is therefore attempted but never assumed — each one is individually guarded.
export async function runMigrations() {
  try {
    // ── Add any columns that may be missing from older schemas ────────────────
    // These run as the table owner (via the schema-owner role), not the app SP.
    // We use individual try/catch so one failure doesn't abort the rest.
    const addColumnIfMissing = async (col, definition) => {
      try {
        await query(`ALTER TABLE data_products ADD COLUMN IF NOT EXISTS ${col} ${definition}`);
      } catch (_) { /* column may already exist or SP lacks DDL — safe to ignore */ }
    };
    await addColumnIfMissing('source_type',  "VARCHAR(20) DEFAULT 'Databricks'");
    await addColumnIfMissing('product_url',  'TEXT');
    await addColumnIfMissing('report_url',   'TEXT');
    await addColumnIfMissing('data_classification', "VARCHAR(50) DEFAULT 'Internal'");

    // Mark all existing rows as Published so they stay visible
    await query(`UPDATE data_products SET status = 'Published' WHERE status IS NULL`);
    // Seed last_refreshed with plausible values based on refresh_frequency
    await query(`UPDATE data_products SET last_refreshed =
      CASE refresh_frequency
        WHEN 'Daily'   THEN NOW() - (RANDOM() * INTERVAL '1 day')
        WHEN 'Weekly'  THEN NOW() - (RANDOM() * INTERVAL '7 days')
        WHEN 'Monthly' THEN NOW() - (RANDOM() * INTERVAL '30 days')
        ELSE                NOW() - (RANDOM() * INTERVAL '365 days')
      END
      WHERE last_refreshed IS NULL AND refresh_frequency IS NOT NULL`);
    await query(`UPDATE data_products SET source_system = 'Databricks' WHERE source_system IS NULL`);
    // Always ensure the three core demo users exist — safe upsert, never overwrites existing rows
    await query(`
      INSERT INTO users (email, display_name, role, department) VALUES
        ('analyst@example.org',     'Alex Analyst',   'analyst', 'Finance'),
        ('datasteward@example.org', 'Dana Steward',   'admin',   'Data Governance')
      ON CONFLICT (email) DO NOTHING
    `);

    // Create settings table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      VARCHAR(4096),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create portal_groups table if it doesn't exist (group-based role assignment)
    await query(`
      CREATE TABLE IF NOT EXISTS portal_groups (
        group_id    SERIAL PRIMARY KEY,
        group_name  VARCHAR(255) NOT NULL,
        scim_id     VARCHAR(100),
        role        VARCHAR(50) DEFAULT 'analyst',
        department  VARCHAR(100) DEFAULT 'General',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(group_name)
      )
    `);

    // Migrate legacy role values → analyst | admin
    await query(`UPDATE users SET role = 'admin' WHERE role IN ('steward', 'data_steward')`);
    await query(`UPDATE users SET role = 'analyst' WHERE role IN ('manager')`);
    await query(`UPDATE portal_groups SET role = 'admin' WHERE role IN ('steward', 'data_steward', 'manager')`);

    // Feature requests + votes
    await query(`
      CREATE TABLE IF NOT EXISTS feature_requests (
        request_id       SERIAL PRIMARY KEY,
        title            VARCHAR(500) NOT NULL,
        description      TEXT,
        requester_email  VARCHAR(255),
        requester_name   VARCHAR(255),
        status           VARCHAR(50) DEFAULT 'open',
        upvotes          INTEGER DEFAULT 1,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS feature_request_votes (
        vote_id      SERIAL PRIMARY KEY,
        request_id   INTEGER REFERENCES feature_requests(request_id) ON DELETE CASCADE,
        voter_email  VARCHAR(255) NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(request_id, voter_email)
      )
    `);

    // When running in production mode, remove any leftover demo placeholder products
    // (products seeded with fake uc_full_name like 'your_catalog.your_schema.*')
    if (!DEMO_MODE) {
      // Delete access_requests first (FK constraint)
      await query(
        `DELETE FROM access_requests WHERE product_id IN (
           SELECT product_id FROM data_products WHERE uc_full_name LIKE 'your_catalog.your_schema.%'
         )`
      );
      const { rowCount } = await query(
        `DELETE FROM data_products WHERE uc_full_name LIKE 'your_catalog.your_schema.%'`
      );
      if (rowCount > 0) console.log(`[Lakebase] Removed ${rowCount} demo placeholder product(s) (DEMO_MODE=false)`);
    }

    // Auto-seed demo data products if catalog is empty and DEMO_MODE is on
    if (DEMO_MODE) {
      const { rows: [{ cnt }] } = await query(`SELECT COUNT(*)::int AS cnt FROM data_products`);
      if (cnt === 0) {
        console.log('[Lakebase] Empty catalog detected in DEMO_MODE — seeding demo products...');
        await query(`
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
          ON CONFLICT (product_ref) DO NOTHING
        `);
        console.log('[Lakebase] Demo products seeded');
      }
    }

    console.log('[Lakebase] Migrations applied');
  } catch (e) {
    console.warn('[Lakebase] Migration warning (non-fatal):', e.message);
  }
}
