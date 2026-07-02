import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import https from 'https';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DATABRICKS_APP_PORT || process.env.PORT || 3000;

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
const LAKEBASE_HOST          = process.env.LAKEBASE_HOST || process.env.PGHOST || 'your-project.database.azuredatabricks.net';
const LAKEBASE_DB            = process.env.LAKEBASE_DB   || process.env.PGDATABASE || 'databricks_postgres';
const LAKEBASE_SCHEMA        = process.env.LAKEBASE_SCHEMA || 'datamarket';
const LAKEBASE_INSTANCE_NAME = process.env.LAKEBASE_INSTANCE_NAME || '';
const LAKEBASE_ENDPOINT      = process.env.LAKEBASE_ENDPOINT || '';

const DEMO_MODE        = (process.env.DEMO_MODE || 'true').toLowerCase() === 'true';
const SQL_WAREHOUSE_ID = process.env.SQL_WAREHOUSE_ID || '';
const RFA_ENABLED      = (process.env.RFA_ENABLED || 'false').toLowerCase() === 'true';

// ─── App branding (customize via env vars in app.yaml) ────────────────────────
const APP_NAME     = process.env.APP_NAME     || 'DataMarket';
const APP_SUBTITLE = process.env.APP_SUBTITLE || 'Data Discovery & Access';
const APP_LOGO_URL = process.env.APP_LOGO_URL || '/la-county-seal.png';

let dbPool = null;
let poolCreatedAt = 0;
const POOL_TTL_MS = 55 * 60 * 1000; // recreate pool every 55 min (token TTL is 1h)

function getDatabricksHost() {
  return (process.env.DATABRICKS_HOST || '').replace(/^https?:\/\//, '');
}

function isPat(token) {
  return typeof token === 'string' && token.startsWith('dapi');
}

function httpsJsonRequest({ hostname, path, method = 'GET', headers = {}, body = null, timeoutMs = 12000 }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (_) {
          reject(new Error(`Bad JSON response from ${path}`));
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request to ${path} timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchM2MToken() {
  const clientId = process.env.DATABRICKS_CLIENT_ID || '';
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET || '';
  const host = getDatabricksHost();
  if (!clientId || !clientSecret || !host) {
    throw new Error('DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST are required');
  }
  const body = 'grant_type=client_credentials&scope=all-apis';
  const { status, data } = await httpsJsonRequest({
    hostname: host,
    path: '/oidc/v1/token',
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });
  if (status !== 200 || !data.access_token) {
    throw new Error(`OAuth token request failed (${status}): ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Workspace auth for Databricks REST APIs (UC import, SQL, RFA).
async function getWorkspaceOAuthToken() {
  const envToken = process.env.DATABRICKS_TOKEN || process.env.DATABRICKS_RUNTIME_TOKEN || '';
  if (envToken && !isPat(envToken)) return envToken;

  const apiPat = process.env.DATABRICKS_API_TOKEN || (isPat(envToken) ? envToken : '');
  if (apiPat) return apiPat;

  return fetchM2MToken();
}

async function generateProvisionedDbCredential(oauthToken) {
  const host = getDatabricksHost();
  const payload = JSON.stringify({
    instance_names: [LAKEBASE_INSTANCE_NAME],
    request_id: `dm-${Date.now()}`,
  });
  const { status, data } = await httpsJsonRequest({
    hostname: host,
    path: '/api/2.0/database/credentials',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oauthToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    body: payload,
  });
  if (!data.token) {
    throw new Error(`DB credential generation failed (${status}): ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function generateAutoscaleDbCredential(oauthToken, endpoint) {
  const host = getDatabricksHost();
  const payload = JSON.stringify({ endpoint });
  const { status, data } = await httpsJsonRequest({
    hostname: host,
    path: '/api/2.0/postgres/credentials',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oauthToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    body: payload,
  });
  if (!data.token) {
    throw new Error(`Autoscale DB credential failed (${status}): ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function resolveAutoscaleLakebaseAuth() {
  const userToken = process.env.DATABRICKS_TOKEN || process.env.DATABRICKS_RUNTIME_TOKEN
    || process.env.LAKEBASE_PASSWORD || '';

  // Legacy/user path: OAuth JWT used directly as Postgres password (local deploy + some Apps).
  if (userToken && !isPat(userToken) && !LAKEBASE_ENDPOINT) {
    const pgUser = process.env.LAKEBASE_PGUSER || process.env.DATABRICKS_USER;
    if (!pgUser) throw new Error('DATABRICKS_USER env var is required');
    return { pgPassword: userToken, pgUser, mode: 'Autoscaling (user OAuth token)' };
  }

  if (isPat(userToken)) {
    throw new Error(
      'A PAT cannot be used as the Lakebase Postgres password. ' +
      'Remove DATABRICKS_TOKEN from app.yaml (use DATABRICKS_API_TOKEN for UC Import via --pat).'
    );
  }

  const endpoint = LAKEBASE_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      'LAKEBASE_ENDPOINT is required for Lakebase Autoscaling in Databricks Apps. ' +
      'Find it with: databricks postgres list-endpoints projects/<project>/branches/production ' +
      '— then redeploy with --lakebase-endpoint.'
    );
  }

  const oauthToken = await fetchM2MToken();
  const pgPassword = await generateAutoscaleDbCredential(oauthToken, endpoint);
  // Apps connect as the app service principal (UUID). deploy.sh creates this Postgres role + schema grants.
  const pgUser = process.env.LAKEBASE_PGUSER
    || process.env.DATABRICKS_CLIENT_ID
    || process.env.DATABRICKS_USER;
  if (!pgUser) {
    throw new Error('LAKEBASE_PGUSER, DATABRICKS_CLIENT_ID, or DATABRICKS_USER is required');
  }
  return { pgPassword, pgUser, mode: `Autoscaling (Apps SP ${pgUser.slice(0, 8)}… + credential API)` };
}

async function getPool() {
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

async function query(sql, params = []) {
  const pool = await getPool();
  return pool.query(sql, params);
}

// ─── Databricks REST API helper ──────────────────────────────────────────────
async function databricksApi(method, apiPath, body = null) {
  const host = getDatabricksHost();
  const token = await getWorkspaceOAuthToken();
  if (!host || !token) throw new Error('DATABRICKS_HOST or workspace credentials not set');

  const payload = body ? JSON.stringify(body) : null;
  const { status, data } = await httpsJsonRequest({
    hostname: host,
    path: apiPath,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    },
    body: payload,
  });
  return { status, data };
}

// ─── RFA: Send access request notification to configured destinations ────────
async function rfaNotify(ucFullName, requesterEmail, comment) {
  if (!RFA_ENABLED || !ucFullName) return null;
  try {
    const parts = ucFullName.split('.');
    if (parts.length < 3) return null;
    const securableType = parts.length === 3 ? 'TABLE' : 'CATALOG';
    const result = await databricksApi('POST', '/api/3.0/rfa/access-requests', {
      requests: [{
        comment: comment || `Access requested via DataMarket`,
        securable_permissions: [{
          permissions: ['SELECT'],
          securable: { full_name: ucFullName, type: securableType }
        }]
      }]
    });
    console.log(`[RFA] Notification sent for ${ucFullName} → status ${result.status}`);
    return result;
  } catch (e) {
    console.warn('[RFA] Notification failed (non-fatal):', e.message);
    return null;
  }
}

// ─── UC: Execute GRANT/REVOKE via SQL Statement Execution API ────────────────
async function executeUcStatement(sql) {
  if (DEMO_MODE || !SQL_WAREHOUSE_ID) return { executed: false, reason: DEMO_MODE ? 'demo_mode' : 'no_warehouse' };
  try {
    const result = await databricksApi('POST', '/api/2.0/sql/statements', {
      warehouse_id: SQL_WAREHOUSE_ID,
      statement: sql,
      wait_timeout: '10s'
    });
    const status = result.data?.status?.state || 'UNKNOWN';
    console.log(`[UC] Executed: ${sql.substring(0, 80)}... → ${status}`);
    return { executed: true, status, result: result.data };
  } catch (e) {
    console.warn('[UC] Statement execution failed (non-fatal):', e.message);
    return { executed: false, reason: e.message };
  }
}

// ─── UC: Fetch column schema + tags for a table ─────────────────────────────
async function fetchUcSchema(ucFullName) {
  if (!SQL_WAREHOUSE_ID || !ucFullName) return null;
  const parts = ucFullName.split('.');
  if (parts.length !== 3) return null;
  const [catalog, schema, table] = parts;
  try {
    const colResult = await databricksApi('POST', '/api/2.0/sql/statements', {
      warehouse_id: SQL_WAREHOUSE_ID,
      statement: `SELECT column_name, data_type, comment FROM system.information_schema.columns
                  WHERE table_catalog = '${catalog}' AND table_schema = '${schema}' AND table_name = '${table}'
                  ORDER BY ordinal_position`,
      wait_timeout: '10s'
    });
    if (colResult.data?.status?.state !== 'SUCCEEDED') return null;
    const columns = (colResult.data.result?.data_array || []).map(row => ({
      name: row[0], type: (row[1] || 'STRING').toUpperCase(), description: row[2] || ''
    }));

    let tagMap = {};
    try {
      const tagResult = await databricksApi('POST', '/api/2.0/sql/statements', {
        warehouse_id: SQL_WAREHOUSE_ID,
        statement: `SELECT column_name, tag_name, tag_value FROM system.information_schema.column_tags
                    WHERE table_catalog = '${catalog}' AND table_schema = '${schema}' AND table_name = '${table}'`,
        wait_timeout: '10s'
      });
      if (tagResult.data?.status?.state === 'SUCCEEDED') {
        for (const row of (tagResult.data.result?.data_array || [])) {
          if (!tagMap[row[0]]) tagMap[row[0]] = {};
          tagMap[row[0]][row[1]] = row[2];
        }
      }
    } catch (_) {}

    const piiPatterns = /^(ssn|social_security|dob|date_of_birth|birth_date|email|phone|address|bank_account|credit_card|salary|compensation|wage)/i;
    const confPatterns = /^(cost_center|approver|budget_code|account_number|internal_id)/i;

    return columns.map(col => {
      const tags = tagMap[col.name] || {};
      let sensitivity = (tags.sensitivity_level || tags.sensitivity || '').toUpperCase();
      if (!sensitivity) {
        if (piiPatterns.test(col.name)) sensitivity = 'PII';
        else if (confPatterns.test(col.name)) sensitivity = 'CONFIDENTIAL';
        else sensitivity = 'INTERNAL';
      }
      const masked = sensitivity === 'PII' || sensitivity === 'CONFIDENTIAL';
      const elevatedPII = sensitivity === 'PII' && piiPatterns.test(col.name) && /ssn|dob|date_of_birth|birth|bank|credit_card/i.test(col.name);
      return { ...col, sensitivity, masked, elevatedPII };
    });
  } catch (e) {
    console.warn(`[UC] Schema fetch failed for ${ucFullName}:`, e.message);
    return null;
  }
}

// ─── Schema migration — run at startup ───────────────────────────────────────
// DDL lives in schema/schema.sql (applied by deploy.sh). The app SP has DML grants
// but not table ownership, so avoid ALTER TABLE here — use UPDATE/INSERT only.

// Cache which optional columns exist — populated once on first products query
let _productCols = null;
async function getProductCols() {
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
async function runMigrations() {
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
        ('analyst@example.org',     'Alex Analyst',   'analyst',      'Finance'),
        ('manager@example.org',     'Morgan Manager', 'manager',      'Operations'),
        ('datasteward@example.org', 'Dana Steward',   'data_steward', 'Data Governance')
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

// ─── Background auto-discover (runs once after startup if enabled) ────────────
async function maybeAutoDiscover() {
  try {
    await loadSettings();
    if (getSetting('auto_discover_enabled', 'false') !== 'true') return;
    const prefix = getSetting('auto_discover_prefix', '');
    if (!prefix) return;
    const parts = prefix.split('.');
    if (parts.length < 2) return;
    const [catalog, schema] = parts;
    const { host, token } = await getUcAuth();
    const listData = await ucApiRequest(host, token,
      `/api/2.0/unity-catalog/tables?catalog_name=${encodeURIComponent(catalog)}&schema_name=${encodeURIComponent(schema)}&max_results=200`);
    const ucTables = (listData?.tables || []).filter(t =>
      parts[2] ? t.name?.toLowerCase().startsWith(parts[2].toLowerCase()) : true);
    const { rows: existing } = await query(`SELECT uc_full_name FROM data_products WHERE uc_full_name IS NOT NULL`);
    const existingSet = new Set(existing.map(r => r.uc_full_name.toLowerCase()));
    const newTables = ucTables.filter(t => !existingSet.has(`${catalog}.${schema}.${t.name}`.toLowerCase()));
    if (!newTables.length) return;
    const { rows: [maxRow] } = await query(`SELECT MAX(CAST(SUBSTRING(product_ref FROM 4) AS INTEGER)) AS max_id FROM data_products`);
    let nextId = (maxRow.max_id || 0) + 1;
    for (const t of newTables) {
      const fullName = `${catalog}.${schema}.${t.name}`;
      const ref = `DP-${String(nextId++).padStart(3, '0')}`;
      const displayName = t.name.replace(/_/g, ' ').replace(/\bgold\b/i, '').trim().replace(/\b\w/g, c => c.toUpperCase());
      await query(
        `INSERT INTO data_products (product_ref, display_name, description, type, domain, tags, source_system, refresh_frequency, owner_email, classification, uc_full_name, is_active, status, last_refreshed)
         VALUES ($1,$2,$3,'Dataset','Other','{}','Unity Catalog','Daily','','Internal',$4,FALSE,'Draft',NOW())
         ON CONFLICT (product_ref) DO NOTHING`,
        [ref, displayName, `Auto-discovered from Unity Catalog: ${fullName}`, fullName]);
    }
    console.log(`[auto-discover] Drafted ${newTables.length} new table(s) from ${prefix}`);
  } catch (e) {
    console.warn('[auto-discover] Non-fatal:', e.message);
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://*.azuredatabricks.net"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = `error: ${e.message}`;
  }
  res.json({
    status: 'healthy', timestamp: new Date().toISOString(), service: 'datamarket',
    lakebase: dbStatus, demo_mode: DEMO_MODE, rfa_enabled: RFA_ENABLED,
    uc_grants_enabled: !DEMO_MODE && !!SQL_WAREHOUSE_ID
  });
});

// ─── Settings helpers ─────────────────────────────────────────────────────────
// In-memory cache so /api/portal/config stays fast (refreshed on PUT).
let settingsCache = null;

async function loadSettings() {
  try {
    const { rows } = await query('SELECT key, value FROM settings');
    settingsCache = Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch (_) {
    // Settings table may not exist yet on first boot — that's fine.
    settingsCache = {};
  }
  return settingsCache;
}

function getSetting(key, envFallback) {
  if (settingsCache && settingsCache[key] !== undefined && settingsCache[key] !== '') {
    return settingsCache[key];
  }
  return envFallback;
}

// ─── App Config (branding + mode) ────────────────────────────────────────────
app.get('/api/portal/config', async (req, res) => {
  if (!settingsCache) await loadSettings();
  res.json({
    appName:    getSetting('app_name',    APP_NAME),
    appSubtitle:getSetting('app_subtitle', APP_SUBTITLE),
    appLogoUrl: getSetting('app_logo_url', APP_LOGO_URL),
    demoMode:   DEMO_MODE,
    genieSpaceId:     getSetting('genie_space_id', ''),
    sqlWarehouseId:   getSetting('sql_warehouse_id', SQL_WAREHOUSE_ID),
    rfaEnabled:       getSetting('rfa_enabled', String(RFA_ENABLED)) === 'true',
    setupComplete:    getSetting('setup_complete', '') === 'true',
    autoDiscoverEnabled: getSetting('auto_discover_enabled', 'false') === 'true',
    autoDiscoverPrefix:  getSetting('auto_discover_prefix', ''),
    databricksHost:      process.env.DATABRICKS_HOST || '',
    navLinks: (() => {
      const raw = getSetting('nav_links', '');
      if (raw) { try { return JSON.parse(raw); } catch (_) {} }
      return [
        { label: 'About',   url: '', visible: true },
        { label: 'FAQ',     url: '', visible: true },
        { label: 'Contact', url: '', visible: true },
      ];
    })(),
  });
});

// ─── Portal Settings (admin CRUD) ────────────────────────────────────────────
app.get('/api/portal/settings', async (req, res) => {
  try {
    const s = settingsCache || await loadSettings();
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/portal/settings', async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Body must be a JSON object of {key: value}' });
    for (const [key, value] of Object.entries(updates)) {
      await query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value ?? '']
      );
    }
    settingsCache = null; // bust cache
    await loadSettings();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Data Products ────────────────────────────────────────────────────────────
app.get('/api/portal/products', async (req, res) => {
  try {
    const { domain, type, q, includeAll } = req.query;
    const cols = await getProductCols();

    // Build SELECT — only include optional columns if they exist in this schema
    const optionalCols = [
      cols.has('source_type')  ? "COALESCE(source_type, source_system, 'Databricks') AS source_type"
                               : "COALESCE(source_system,'Databricks') AS source_type",
      cols.has('product_url')  ? "COALESCE(product_url,'')  AS product_url"  : "'' AS product_url",
      cols.has('report_url')   ? "COALESCE(report_url,'')   AS report_url"   : "'' AS report_url",
    ].join(', ');

    let sql = `SELECT product_id, product_ref, uc_full_name, display_name, description, type, domain,
                      tags, source_system, refresh_frequency, owner_email, classification, is_active,
                      COALESCE(status,'Published') AS status, created_at, updated_at, last_refreshed,
                      ${optionalCols}
               FROM data_products WHERE (is_active = TRUE OR COALESCE(status,'Published') = 'Pending')`;

    if (!includeAll) sql = sql.replace(
      "(is_active = TRUE OR COALESCE(status,'Published') = 'Pending')",
      "is_active = TRUE AND COALESCE(status,'Published') = 'Published'"
    );
    // When includeAll=true (admin view), remove all status/active filters — show everything
    if (includeAll) sql = sql.replace(
      "WHERE (is_active = TRUE OR COALESCE(status,'Published') = 'Pending')",
      'WHERE TRUE'
    );
    const params = [];
    if (domain) { params.push(domain); sql += ` AND domain = $${params.length}`; }
    if (type)   { params.push(type);   sql += ` AND type = $${params.length}`; }
    if (q)      { params.push(`%${q}%`); sql += ` AND (display_name ILIKE $${params.length} OR description ILIKE $${params.length})`; }
    sql += ' ORDER BY display_name';

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[/api/portal/products]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Products debug ────────────────────────────────────────────────────────────
app.get('/api/portal/products/debug', async (req, res) => {
  try {
    const cols = await getProductCols();
    const { rows: countRows } = await query('SELECT COUNT(*) as total FROM data_products');
    const { rows: sample } = await query(
      `SELECT product_ref, display_name, is_active, status FROM data_products LIMIT 5`
    );
    res.json({
      detected_optional_cols: [...cols],
      total_products: countRows[0]?.total,
      sample,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/portal/products', async (req, res) => {
  try {
    const { name, description, type, source, tags, refreshFrequency,
            ownerEmail, classification, ucFullName, domain, hasPII, submittedBy, productUrl } = req.body;
    if (!name || !description) return res.status(400).json({ error: 'name and description are required' });

    // Generate a sequential ref after current max
    const { rows: [maxRow] } = await query(
      `SELECT MAX(CAST(SUBSTRING(product_ref FROM 4) AS INTEGER)) AS max_id FROM data_products`
    );
    const nextId = (maxRow.max_id || 12) + 1;
    const productRef = `DP-${String(nextId).padStart(3, '0')}`;

    const tagsArr = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []);

    const { rows: [product] } = await query(
      `INSERT INTO data_products
         (product_ref, display_name, description, type, source_system, tags,
          refresh_frequency, owner_email, classification, uc_full_name, domain, is_active, status, product_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE,'Pending',$12)
       RETURNING *`,
      [productRef, name, description, type || 'Dashboard', source || 'Other',
       tagsArr, refreshFrequency || 'Daily',
       ownerEmail || submittedBy || 'unknown@example.org',
       classification || 'Internal', ucFullName || '', domain || source || 'Other',
       productUrl || null]
    );

    // Best-effort audit log (non-fatal if table doesn't exist)
    try {
      await query(
        `INSERT INTO audit_log (event_type, actor_email, target_name, metadata)
         VALUES ('PRODUCT_SUBMITTED', $1, $2, $3)`,
        [submittedBy || ownerEmail || 'unknown', productRef, JSON.stringify({ name, productRef })]
      );
    } catch (_) {}

    res.status(201).json(product);
  } catch (e) {
    console.error('[POST /api/portal/products]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Get pending products (for admin review) ──────────────────────────────────
app.get('/api/portal/products/pending', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM data_products WHERE is_active = FALSE AND status = 'Pending' ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error('[/api/portal/products/pending]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Publish product (admin approves, makes it live in catalog) ───────────────
app.put('/api/portal/products/:ref/publish', async (req, res) => {
  try {
    const { ref } = req.params;
    const { reviewerEmail } = req.body;
    const { rows: [product] } = await query(
      `UPDATE data_products SET is_active = TRUE, status = 'Published', updated_at = NOW()
       WHERE product_ref = $1 RETURNING *`,
      [ref]
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });

    try {
      await query(
        `INSERT INTO audit_log (event_type, actor_email, target_name, metadata)
         VALUES ('PRODUCT_PUBLISHED', $1, $2, $3)`,
        [reviewerEmail || 'admin', ref, JSON.stringify({ ref, name: product.display_name })]
      );
    } catch (_) {}
    res.json(product);
  } catch (e) {
    console.error('[PUT /api/portal/products/:ref/publish]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Reject product registration ──────────────────────────────────────────────
app.put('/api/portal/products/:ref/reject', async (req, res) => {
  try {
    const { ref } = req.params;
    const { reviewerEmail, reason } = req.body;
    const { rows: [product] } = await query(
      `UPDATE data_products SET status = 'Rejected', updated_at = NOW()
       WHERE product_ref = $1 RETURNING *`,
      [ref]
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });

    try {
      await query(
        `INSERT INTO audit_log (event_type, actor_email, target_name, metadata)
         VALUES ('PRODUCT_REJECTED', $1, $2, $3)`,
        [reviewerEmail || 'admin', ref, JSON.stringify({ ref, reason })]
      );
    } catch (_) {}
    res.json(product);
  } catch (e) {
    console.error('[PUT /api/portal/products/:ref/reject]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Access Requests ──────────────────────────────────────────────────────────
app.get('/api/portal/requests', async (req, res) => {
  try {
    const { email, status } = req.query;
    let sql = `SELECT ar.request_id, ar.request_ref, ar.status, ar.business_reason, ar.access_level,
                      ar.requested_at, ar.resolved_at, ar.expires_at, ar.denial_reason, ar.uc_grant_sql,
                      dp.product_ref, dp.display_name AS product_name, dp.domain, dp.type AS product_type,
                      u.email AS requester_email, u.display_name AS requester_name, u.department AS requester_team
               FROM access_requests ar
               JOIN data_products dp ON dp.product_id = ar.product_id
               JOIN users u ON u.user_id = ar.requester_id`;
    const params = [];
    const where = [];
    if (email)  { params.push(email);  where.push(`u.email = $${params.length}`); }
    if (status) { params.push(status); where.push(`ar.status = $${params.length}`); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY ar.requested_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[/api/portal/requests]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/portal/requests/pending', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT ar.request_id, ar.request_ref, ar.status, ar.business_reason, ar.access_level,
             ar.requested_at, dp.product_ref, dp.display_name AS product_name, dp.domain,
             dp.uc_full_name, u.email AS requester_email, u.display_name AS requester_name,
             u.department AS requester_team
      FROM access_requests ar
      JOIN data_products dp ON dp.product_id = ar.product_id
      JOIN users u ON u.user_id = ar.requester_id
      WHERE ar.status = 'Pending'
      ORDER BY ar.requested_at DESC`);
    res.json(rows);
  } catch (e) {
    console.error('[/api/portal/requests/pending]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/portal/requests', async (req, res) => {
  try {
    const { productRef, requesterEmail, team, reason, accessLevel = 'Read Only' } = req.body;
    if (!productRef || !requesterEmail || !reason) {
      return res.status(400).json({ error: 'productRef, requesterEmail, and reason are required' });
    }

    const { rows: [product] } = await query('SELECT product_id FROM data_products WHERE product_ref = $1', [productRef]);
    if (!product) return res.status(404).json({ error: `Product ${productRef} not found` });

    // Upsert user — creates a row if this email hasn't been seen before
    const { rows: [user] } = await query(`
      INSERT INTO users (email, display_name, role, department)
      VALUES ($1, $2, 'analyst', 'General')
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING user_id, department`,
      [requesterEmail, requesterEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase())]
    );

    const { rows: [{ count }] } = await query('SELECT COUNT(*) FROM access_requests', []);
    const ref = `REQ-${String(parseInt(count) + 1).padStart(3, '0')}`;

    // Default 90-day expiry from approval date (set on approve, not submit)
    const { rows: [newReq] } = await query(`
      INSERT INTO access_requests (request_ref, product_id, requester_id, requester_team, business_reason, access_level, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
      RETURNING *`, [ref, product.product_id, user.user_id, team || user.department, reason, accessLevel]);

    await query(`INSERT INTO audit_log (event_type, actor_email, target_type, target_id, target_name, metadata)
      VALUES ('REQUEST_SUBMITTED', $1, 'access_request', $2, $3, $4)`,
      [requesterEmail, newReq.request_id, ref, JSON.stringify({ productRef, reason })]);

    // Fire RFA notification (best-effort, non-blocking)
    const { rows: [prod] } = await query('SELECT uc_full_name FROM data_products WHERE product_ref = $1', [productRef]);
    const rfaResult = await rfaNotify(prod?.uc_full_name, requesterEmail, reason);

    res.json({ ...newReq, request_ref: ref, rfa_notified: !!rfaResult });
  } catch (e) {
    console.error('[POST /api/portal/requests]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/portal/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail = 'datasteward@example.org' } = req.body;

    // id can be a UUID or a request_ref like "REQ-001" — avoid type mismatch
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    const { rows: [req_] } = await query(`
      SELECT ar.*, dp.uc_full_name, dp.display_name AS product_name, u.email AS requester_email
      FROM access_requests ar
      JOIN data_products dp ON dp.product_id = ar.product_id
      JOIN users u ON u.user_id = ar.requester_id
      WHERE ${isUUID ? 'ar.request_id = $1::uuid' : 'ar.request_ref = $1'}`, [id]);
    if (!req_) return res.status(404).json({ error: 'Request not found' });

    const ucGrantSql = req_.uc_full_name
      ? `GRANT SELECT ON ${req_.uc_full_name} TO \`${req_.requester_email}\`;`
      : `-- No UC table linked for ${req_.product_name} (set uc_full_name on the product to enable automatic grants)`;

    const { rows: [adminUser] } = await query('SELECT user_id FROM users WHERE email = $1', [adminEmail]);

    await query(`UPDATE access_requests SET status = 'Approved', resolved_at = NOW(),
      resolved_by = $1, uc_grant_issued = TRUE, uc_grant_sql = $2, updated_at = NOW(),
      expires_at = NOW() + INTERVAL '90 days'
      WHERE request_ref = $3`,
      [adminUser?.user_id || null, ucGrantSql, req_.request_ref]);

    // Execute the real GRANT in UC (skipped in demo mode)
    const grantResult = await executeUcStatement(ucGrantSql);

    try {
      await query(`INSERT INTO audit_log (event_type, actor_email, target_type, target_id, target_name, metadata)
        VALUES ('REQUEST_APPROVED', $1, 'access_request', $2, $3, $4)`,
        [adminEmail, req_.request_id, req_.request_ref, JSON.stringify({ ucGrantSql, uc_executed: grantResult.executed })]);
    } catch (_) {}

    res.json({ status: 'Approved', uc_grant_sql: ucGrantSql, uc_executed: grantResult.executed });
  } catch (e) {
    console.error('[PUT approve]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/portal/requests/:id/deny', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail = 'datasteward@example.org', reason = '' } = req.body;

    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    const { rows: [req_] } = await query(
      `SELECT request_id, request_ref FROM access_requests WHERE ${isUUID ? 'request_id = $1::uuid' : 'request_ref = $1'}`, [id]);
    if (!req_) return res.status(404).json({ error: 'Request not found' });

    const { rows: [adminUser] } = await query('SELECT user_id FROM users WHERE email = $1', [adminEmail]);

    await query(`UPDATE access_requests SET status = 'Denied', resolved_at = NOW(),
      resolved_by = $1, denial_reason = $2, updated_at = NOW()
      WHERE request_ref = $3`,
      [adminUser?.user_id || null, reason, req_.request_ref]);

    try {
      await query(`INSERT INTO audit_log (event_type, actor_email, target_type, target_id, target_name, metadata)
        VALUES ('REQUEST_DENIED', $1, 'access_request', $2, $3, $4)`,
        [adminEmail, req_.request_id, req_.request_ref, JSON.stringify({ reason })]);
    } catch (_) {}

    res.json({ status: 'Denied' });
  } catch (e) {
    console.error('[PUT deny]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Nudge Approver ───────────────────────────────────────────────────────────
// ─── Revoke access ────────────────────────────────────────────────────────────
app.put('/api/portal/requests/:id/revoke', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail = 'datasteward@example.org', reason = 'Access revoked by administrator' } = req.body;
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    const { rows: [req_] } = await query(
      `SELECT request_id, request_ref, uc_grant_sql FROM access_requests
       WHERE ${isUUID ? 'request_id = $1::uuid' : 'request_ref = $1'}`, [id]);
    if (!req_) return res.status(404).json({ error: 'Request not found' });

    // Generate REVOKE SQL mirroring the original GRANT
    const revokeSql = req_.uc_grant_sql
      ? req_.uc_grant_sql.replace(/^GRANT/, 'REVOKE').replace(/ TO /, ' FROM ')
      : `-- No UC table linked; manual revocation required`;

    await query(`UPDATE access_requests SET status = 'Revoked', resolved_at = NOW(),
      denial_reason = $1, uc_grant_sql = $2, updated_at = NOW()
      WHERE request_ref = $3`,
      [reason, revokeSql, req_.request_ref]);

    // Execute the real REVOKE in UC (skipped in demo mode)
    const revokeResult = await executeUcStatement(revokeSql);

    try {
      await query(`INSERT INTO audit_log (event_type, actor_email, target_name, metadata)
        VALUES ('ACCESS_REVOKED', $1, $2, $3)`,
        [adminEmail, req_.request_ref, JSON.stringify({ reason, revokeSql, uc_executed: revokeResult.executed })]);
    } catch (_) {}

    res.json({ status: 'Revoked', revoke_sql: revokeSql, uc_executed: revokeResult.executed });
  } catch (e) {
    console.error('[PUT revoke]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Get notifications for a user ─────────────────────────────────────────────
app.get('/api/portal/notifications', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.json([]);
    const { rows } = await query(`
      SELECT ar.request_ref, ar.status, ar.resolved_at, ar.expires_at, ar.denial_reason,
             dp.display_name AS product_name, dp.product_ref
      FROM access_requests ar
      JOIN data_products dp ON dp.product_id = ar.product_id
      JOIN users u ON u.user_id = ar.requester_id
      WHERE u.email = $1
        AND ar.status IN ('Approved','Denied','Revoked')
        AND ar.resolved_at > NOW() - INTERVAL '7 days'
      ORDER BY ar.resolved_at DESC
      LIMIT 10`, [email]);
    // Also include requests expiring within 14 days
    const { rows: expiring } = await query(`
      SELECT ar.request_ref, 'Expiring' AS status, ar.expires_at, ar.resolved_at,
             dp.display_name AS product_name, dp.product_ref
      FROM access_requests ar
      JOIN data_products dp ON dp.product_id = ar.product_id
      JOIN users u ON u.user_id = ar.requester_id
      WHERE u.email = $1
        AND ar.status = 'Approved'
        AND ar.expires_at < NOW() + INTERVAL '14 days'
      ORDER BY ar.expires_at ASC
      LIMIT 5`, [email]);
    res.json([...expiring, ...rows]);
  } catch (e) {
    console.error('[/api/portal/notifications]', e.message);
    res.json([]);
  }
});

app.post('/api/portal/requests/:id/nudge', async (req, res) => {
  try {
    const { id } = req.params;
    const { requesterEmail, productName } = req.body;
    await query(`
      INSERT INTO audit_log (event_type, actor_email, target_name, metadata)
      VALUES ('NUDGE_SENT', $1, $2, $3)
    `, [
      requesterEmail || 'unknown',
      id,
      JSON.stringify({ productName, message: 'Requester sent a reminder to approver via DataMarket Assistant' })
    ]);
    res.json({ success: true, message: 'Reminder logged and approver notified' });
  } catch (e) {
    console.error('[POST nudge]', e.message);
    res.json({ success: true }); // best-effort — don't fail the UI
  }
});

// ─── User Library ─────────────────────────────────────────────────────────────
app.get('/api/portal/library', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });

    // Approved requests + pinned library entries
    const { rows } = await query(`
      SELECT dp.product_ref, dp.display_name AS product_name, dp.domain, dp.type AS product_type,
             dp.classification, dp.refresh_frequency, dp.source_system, dp.uc_full_name,
             'approved' AS source, ar.resolved_at AS added_at, ar.request_ref
      FROM access_requests ar
      JOIN data_products dp ON dp.product_id = ar.product_id
      JOIN users u ON u.user_id = ar.requester_id
      WHERE u.email = $1 AND ar.status = 'Approved'
      UNION ALL
      SELECT dp.product_ref, dp.display_name, dp.domain, dp.type,
             dp.classification, dp.refresh_frequency, dp.source_system, dp.uc_full_name,
             'library' AS source, ul.added_at, NULL AS request_ref
      FROM user_library ul
      JOIN data_products dp ON dp.product_id = ul.product_id
      JOIN users u ON u.user_id = ul.user_id
      WHERE u.email = $1
      ORDER BY added_at DESC`, [email]);

    res.json(rows);
  } catch (e) {
    console.error('[/api/portal/library]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
app.get('/api/portal/audit', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM audit_log ORDER BY occurred_at DESC LIMIT 50', []);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── UC Schema — live column metadata with synthetic fallback ────────────────
app.get('/api/portal/products/:ref/schema', async (req, res) => {
  try {
    const { ref } = req.params;
    const { rows: [product] } = await query('SELECT uc_full_name, domain FROM data_products WHERE product_ref = $1', [ref]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Try live UC schema first (requires SQL_WAREHOUSE_ID)
    if (product.uc_full_name) {
      const liveSchema = await fetchUcSchema(product.uc_full_name);
      if (liveSchema) {
        return res.json({ source: 'unity_catalog', uc_full_name: product.uc_full_name, columns: liveSchema });
      }
    }
    // Fall back to signal that frontend should use its synthetic schemas
    res.json({ source: 'synthetic', domain: product.domain, uc_full_name: product.uc_full_name || null });
  } catch (e) {
    console.error('[/api/portal/products/:ref/schema]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Identity — resolve SSO user or return demo mode personas ────────────────
app.get('/api/portal/identity', async (req, res) => {
  if (DEMO_MODE) return res.json({ mode: 'demo' });

  const email = req.headers['x-forwarded-email'] || req.headers['x-forwarded-user'] || '';
  if (!email) return res.json({ mode: 'demo', reason: 'no_sso_header' });

  const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || process.env.DATABRICKS_USER || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isHardcodedAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

  try {
    // Helper: look up user's SCIM groups and resolve role from portal_groups
    const resolveGroupRole = async () => {
      try {
        const { host, token } = await getUcAuth();
        const filter = encodeURIComponent(`userName eq "${email}"`);
        const scimData = await ucApiRequest(host, token,
          `/api/2.0/preview/scim/v2/Users?filter=${filter}&count=1&attributes=groups,displayName`);
        const scimUser = (scimData.Resources || [])[0];
        if (!scimUser?.groups?.length) return null;
        const groupNames = scimUser.groups.map(g => g.display).filter(Boolean);
        const { rows: matched } = await query(
          `SELECT role FROM portal_groups WHERE group_name = ANY($1) ORDER BY
             CASE role WHEN 'admin' THEN 1 WHEN 'steward' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END LIMIT 1`,
          [groupNames]
        );
        return matched[0]?.role || null;
      } catch (_) { return null; }
    };

    const { rows: [user] } = await query(
      `SELECT user_id, email, display_name, role, department FROM users WHERE email = $1`, [email]);

    if (user) {
      if (isHardcodedAdmin && user.role !== 'admin') {
        await query(`UPDATE users SET role = 'admin' WHERE email = $1`, [email]);
        user.role = 'admin';
        console.info(`[identity] Promoted ${email} to admin (ADMIN_EMAIL match)`);
      }
      return res.json({ mode: 'sso', user });
    }

    // New user — resolve role from hardcoded admin list, then group membership
    let role = 'analyst';
    if (isHardcodedAdmin) {
      role = 'admin';
    } else {
      const groupRole = await resolveGroupRole();
      if (groupRole) { role = groupRole; console.info(`[identity] ${email} → role '${role}' via group`); }
    }

    const displayName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const { rows: [newUser] } = await query(
      `INSERT INTO users (email, display_name, role, department)
       VALUES ($1, $2, $3, 'General') RETURNING *`, [email, displayName, role]);
    console.info(`[identity] Auto-registered ${email} as ${role}`);
    return res.json({ mode: 'sso', user: newUser, new_user: true });
  } catch (e) {
    console.warn('[/api/portal/identity]', e.message);
    return res.json({ mode: 'demo', reason: e.message });
  }
});

// ─── Legacy KPI stubs (kept for backward compat) ─────────────────────────────
app.get('/api/kpis', (_, res) => res.json({
  total_revenue: { value: '$2.4M', trend: { direction: 'up', value: '+12%' } },
  total_customers: { value: '15,234', trend: { direction: 'up', value: '+8%' } },
  avg_order_value: { value: '$156', trend: { direction: 'up', value: '+5%' } },
  conversion_rate: { value: '3.2%', trend: { direction: 'down', value: '-2%' } }
}));

// ─── Admin: Users ─────────────────────────────────────────────────────────────
app.get('/api/portal/admin/users', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT user_id, email, display_name, role, department, created_at FROM users ORDER BY display_name`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/portal/admin/users', async (req, res) => {
  try {
    const { email, display_name, role, department } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const { rows: [user] } = await query(
      `INSERT INTO users (email, display_name, role, department)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             role         = EXCLUDED.role,
             department   = EXCLUDED.department
       RETURNING *`,
      [email.trim().toLowerCase(), display_name || '', role || 'analyst', department || '']
    );
    res.status(201).json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SCIM user search — proxies Databricks workspace SCIM API ────────────────
app.get('/api/portal/admin/scim-search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const { host, token } = await getUcAuth();
    const filter = encodeURIComponent(`displayName co "${q}" or userName co "${q}"`);
    const scimData = await ucApiRequest(host, token,
      `/api/2.0/preview/scim/v2/Users?filter=${filter}&count=10&attributes=displayName,userName,emails`);

    const users = (scimData.Resources || []).map(u => ({
      display_name: u.displayName || u.userName,
      email: (u.emails?.find(e => e.primary)?.value) || u.userName,
    })).filter(u => u.email);

    res.json(users);
  } catch (e) {
    console.warn('[SCIM search]', e.message);
    res.json([]);
  }
});

// ─── SCIM Group search ────────────────────────────────────────────────────────
app.get('/api/portal/admin/scim-groups-search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q || q.length < 1) return res.json([]);
    const { host, token } = await getUcAuth();
    const filter = encodeURIComponent(`displayName co "${q}"`);
    const scimData = await ucApiRequest(host, token,
      `/api/2.0/preview/scim/v2/Groups?filter=${filter}&count=20&attributes=displayName,id,members`);
    const groups = (scimData.Resources || []).map(g => ({
      scim_id:    g.id,
      group_name: g.displayName,
      member_count: (g.members || []).length,
    }));
    res.json(groups);
  } catch (e) {
    console.warn('[SCIM groups search]', e.message);
    res.json([]);
  }
});

// ─── Portal Groups CRUD ───────────────────────────────────────────────────────
app.get('/api/portal/admin/groups', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM portal_groups ORDER BY group_name`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/portal/admin/groups', async (req, res) => {
  try {
    const { group_name, scim_id, role, department } = req.body;
    if (!group_name) return res.status(400).json({ error: 'group_name required' });
    const { rows: [g] } = await query(
      `INSERT INTO portal_groups (group_name, scim_id, role, department)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_name) DO UPDATE SET role=$3, department=$4, scim_id=$2
       RETURNING *`,
      [group_name, scim_id || null, role || 'analyst', department || 'General']
    );
    res.json(g);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/portal/admin/groups/:id', async (req, res) => {
  try {
    await query(`DELETE FROM portal_groups WHERE group_id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/portal/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, department, display_name } = req.body;
    const sets = [];
    const params = [];
    if (role)         { params.push(role);         sets.push(`role = $${params.length}`); }
    if (department)   { params.push(department);   sets.push(`department = $${params.length}`); }
    if (display_name) { params.push(display_name); sets.push(`display_name = $${params.length}`); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(id);
    const { rows: [user] } = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${params.length}::uuid RETURNING *`, params);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Admin: Product inline update ─────────────────────────────────────────────
app.put('/api/portal/products/:ref', async (req, res) => {
  try {
    const { ref } = req.params;
    const {
      uc_full_name, source_type, refresh_frequency, report_url, domain,
      description, display_name, owner_email, data_classification, tags
    } = req.body;
    const sets = [];
    const params = [];
    if (uc_full_name !== undefined)        { params.push(uc_full_name);          sets.push(`uc_full_name = $${params.length}`); }
    if (source_type !== undefined)         { params.push(source_type);            sets.push(`source_system = $${params.length}`); }
    if (refresh_frequency !== undefined)   { params.push(refresh_frequency);      sets.push(`refresh_frequency = $${params.length}`); }
    if (report_url !== undefined)          { params.push(report_url);             sets.push(`report_url = $${params.length}`); }
    if (domain !== undefined)              { params.push(domain);                 sets.push(`domain = $${params.length}`); }
    if (description !== undefined)         { params.push(description);            sets.push(`description = $${params.length}`); }
    if (display_name !== undefined)        { params.push(display_name);           sets.push(`display_name = $${params.length}`); }
    if (owner_email !== undefined)         { params.push(owner_email);            sets.push(`owner_email = $${params.length}`); }
    if (data_classification !== undefined) { params.push(data_classification);    sets.push(`data_classification = $${params.length}`); }
    if (tags !== undefined)                { params.push(JSON.stringify(tags));   sets.push(`tags = $${params.length}`); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    sets.push('updated_at = NOW()');
    params.push(ref);
    const { rows: [product] } = await query(
      `UPDATE data_products SET ${sets.join(', ')} WHERE product_ref = $${params.length} RETURNING *`, params);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Admin: UC Table Discovery ────────────────────────────────────────────────
// ─── UC Catalog Browser (lazy, no SQL warehouse needed) ──────────────────────
function ucApiRequest(host, token, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, path, method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (_) { reject(new Error('Bad UC API response')); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getUcAuth() {
  const host = getDatabricksHost();
  const token = await getWorkspaceOAuthToken();
  if (!host || !token) throw new Error('DATABRICKS_HOST and workspace credentials are required');
  return { host, token };
}

app.get('/api/portal/admin/uc-catalogs', async (req, res) => {
  try {
    const { host, token } = await getUcAuth();
    const data = await ucApiRequest(host, token, '/api/2.1/unity-catalog/catalogs');
    const catalogs = (data.catalogs || []).map(c => ({ name: c.name, comment: c.comment }));
    res.json({ catalogs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/portal/admin/uc-schemas', async (req, res) => {
  try {
    const { catalog } = req.query;
    if (!catalog) return res.status(400).json({ error: 'catalog param required' });
    const { host, token } = await getUcAuth();
    const data = await ucApiRequest(host, token,
      `/api/2.1/unity-catalog/schemas?catalog_name=${encodeURIComponent(catalog)}`);
    const schemas = (data.schemas || []).map(s => ({ name: s.name, full_name: s.full_name, comment: s.comment }));
    res.json({ schemas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/portal/admin/uc-tables-browse', async (req, res) => {
  try {
    const { catalog, schema } = req.query;
    if (!catalog || !schema) return res.status(400).json({ error: 'catalog and schema params required' });
    const { host, token } = await getUcAuth();
    const { rows: existing } = await query(
      `SELECT uc_full_name FROM data_products WHERE uc_full_name IS NOT NULL AND uc_full_name != ''`);
    const registered = new Set(existing.map(r => r.uc_full_name));
    const data = await ucApiRequest(host, token,
      `/api/2.1/unity-catalog/tables?catalog_name=${encodeURIComponent(catalog)}&schema_name=${encodeURIComponent(schema)}&omit_columns=true`);
    const tables = (data.tables || []).map(t => ({
      full_name: t.full_name, table_name: t.name,
      schema_name: schema, catalog_name: catalog,
      table_type: t.table_type, comment: t.comment,
      registered: registered.has(t.full_name),
    }));
    res.json({ tables });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/portal/admin/uc-tables', async (req, res) => {
  try {
    // Get already-registered UC table names
    const { rows: existing } = await query(
      `SELECT uc_full_name FROM data_products WHERE uc_full_name IS NOT NULL AND uc_full_name != ''`);
    const registered = new Set(existing.map(r => r.uc_full_name));

    // If a warehouse is configured, always query real UC tables (even in demo mode)
    if (SQL_WAREHOUSE_ID) {
      const schema = await fetchUcSchema('information_schema.tables');
      if (schema) return res.json({ source: 'unity_catalog', tables: schema.filter(t => !registered.has(t.full_name)) });
    }

    // No warehouse configured — return generic placeholder tables so the UI isn't empty
    const demoTables = [
      { full_name: 'your_catalog.your_schema.sales_transactions',    table_name: 'sales_transactions',    schema_name: 'your_schema', catalog_name: 'your_catalog' },
      { full_name: 'your_catalog.your_schema.customer_profiles',     table_name: 'customer_profiles',     schema_name: 'your_schema', catalog_name: 'your_catalog' },
      { full_name: 'your_catalog.your_schema.product_inventory',     table_name: 'product_inventory',     schema_name: 'your_schema', catalog_name: 'your_catalog' },
      { full_name: 'your_catalog.your_schema.employee_records',      table_name: 'employee_records',      schema_name: 'your_schema', catalog_name: 'your_catalog' },
      { full_name: 'your_catalog.your_schema.financial_ledger',      table_name: 'financial_ledger',      schema_name: 'your_schema', catalog_name: 'your_catalog' },
    ];
    res.json({ source: 'demo_placeholder', tables: demoTables.filter(t => !registered.has(t.full_name)), registered: existing.map(r => r.uc_full_name) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/portal/admin/import-uc', async (req, res) => {
  try {
    const { tables } = req.body;
    if (!Array.isArray(tables) || tables.length === 0) return res.status(400).json({ error: 'tables array required' });

    const { rows: [maxRow] } = await query(
      `SELECT MAX(CAST(SUBSTRING(product_ref FROM 4) AS INTEGER)) AS max_id FROM data_products`);
    let nextId = (maxRow.max_id || 16) + 1;

    const imported = [];
    for (const t of tables) {
      const ref = `DP-${String(nextId++).padStart(3, '0')}`;
      const displayName = (t.table_name || t.full_name.split('.').pop())
        .replace(/_/g, ' ').replace(/\bgold\b/i, '').trim()
        .replace(/\b\w/g, c => c.toUpperCase());
      const { rows: [product] } = await query(
        `INSERT INTO data_products
           (product_ref, display_name, description, type, domain, tags, source_system,
            refresh_frequency, owner_email, classification, uc_full_name, is_active, status,
            last_refreshed)
         VALUES ($1, $2, $3, 'Dataset', $4, $5, 'Unity Catalog', 'Daily',
                 $6, 'Internal', $7, TRUE, 'Published', NOW())
         ON CONFLICT (product_ref) DO NOTHING RETURNING *`,
        [ref, t.display_name || displayName, t.description || `Imported from Unity Catalog: ${t.full_name}`,
         t.domain || 'Other', `{${(t.domain || 'UC Import').replace(/'/g, '')}}`,
         t.owner_email || 'datasteward@example.org', t.full_name]);
      if (product) imported.push(product);
    }
    res.json({ imported: imported.length, products: imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Ask Catalog — FMAPI semantic search over product metadata ───────────────
app.post('/api/portal/ask-catalog', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: 'question required' });

    // Fetch published products for context
    const { rows: products } = await query(`
      SELECT product_ref, display_name, description, domain, type, tags,
             source_system, classification, uc_full_name, owner_email
      FROM data_products
      WHERE is_active = TRUE AND COALESCE(status,'Published') = 'Published'
      ORDER BY display_name LIMIT 60
    `);

    if (!products.length) return res.json({ matches: [], question, reason: 'no_products' });

    // Build compact product list for the prompt
    const productList = products.map(p => {
      const tags = Array.isArray(p.tags) ? p.tags.join(', ')
                 : typeof p.tags === 'string' ? p.tags.replace(/[{}"]/g, '') : '';
      return `${p.product_ref} | ${p.display_name} | ${p.domain || 'Other'} | ${p.type || 'Dataset'} | ${(p.description || '').substring(0, 120)} | ${tags}`;
    }).join('\n');

    const prompt = `You are a data catalog assistant. A user is searching for data products.
Given the question below and the catalog of available data products, identify the 3-5 most relevant products.
For each match, write one sentence explaining why it is relevant to the user's question.

User question: "${question}"

Catalog (format: ref | name | domain | type | description | tags):
${productList}

Respond with ONLY a valid JSON array, no other text:
[{"ref":"DP-001","name":"Product Name","reason":"One sentence why relevant."}]
If nothing is relevant, return: []`;

    const { host, token } = await getUcAuth();
    const fmResp = await httpsJsonRequest({
      hostname: host.replace(/^https?:\/\//, ''),
      path: '/serving-endpoints/databricks-meta-llama-3-3-70b-instruct/invocations',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
        temperature: 0.1
      }),
      timeoutMs: 25000
    });

    const raw = fmResp.data?.choices?.[0]?.message?.content || '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    let matches = [];
    try { matches = jsonMatch ? JSON.parse(jsonMatch[0]) : []; } catch (_) {}

    // Enrich matches with full product row
    const enriched = matches
      .map(m => {
        const p = products.find(p => p.product_ref === m.ref);
        if (!p) return null;
        return {
          ref: m.ref,
          name: p.display_name,
          reason: m.reason,
          domain: p.domain,
          type: p.type,
          classification: p.classification,
          uc_full_name: p.uc_full_name,
          source_system: p.source_system,
          tags: Array.isArray(p.tags) ? p.tags
              : typeof p.tags === 'string' ? p.tags.replace(/[{}"]/g,'').split(',').map(t=>t.trim()).filter(Boolean)
              : [],
        };
      })
      .filter(Boolean);

    res.json({ matches: enriched, question });
  } catch (e) {
    console.error('[ask-catalog]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Sync UC metadata (last_refreshed + mark unavailable) ────────────────────
// Fetches updated_at from UC for each product that has a uc_full_name.
// Also marks products whose UC table no longer exists as status='Unavailable'.
app.post('/api/portal/admin/sync-uc-metadata', async (req, res) => {
  try {
    const { host, token } = await getUcAuth();
    const { rows: products } = await query(
      `SELECT product_id, product_ref, uc_full_name FROM data_products
       WHERE uc_full_name IS NOT NULL AND uc_full_name NOT LIKE 'your_catalog.%'`
    );
    if (!products.length) return res.json({ synced: 0, unavailable: 0 });

    let synced = 0, unavailable = 0;
    for (const p of products) {
      try {
        const fullNamePath = p.uc_full_name.replace(/\./g, '/');
        const ucMeta = await ucApiRequest(host, token,
          `/api/2.0/unity-catalog/tables/${encodeURIComponent(p.uc_full_name)}`);

        if (ucMeta?.error_code === 'TABLE_DOES_NOT_EXIST' || ucMeta?.error_code === 'NOT_FOUND') {
          await query(
            `UPDATE data_products SET status = 'Unavailable', updated_at = NOW() WHERE product_id = $1`,
            [p.product_id]);
          unavailable++;
        } else {
          // updated_at from UC is epoch ms
          const updatedAt = ucMeta?.updated_at
            ? new Date(ucMeta.updated_at).toISOString()
            : new Date().toISOString();
          await query(
            `UPDATE data_products SET last_refreshed = $1, updated_at = NOW() WHERE product_id = $2`,
            [updatedAt, p.product_id]);
          synced++;
        }
      } catch (_) { /* skip individual failures */ }
    }
    // Bust product column cache so next fetch rebuilds
    _productCols = null;
    console.log(`[sync-uc] synced=${synced} unavailable=${unavailable}`);
    res.json({ synced, unavailable, total: products.length });
  } catch (e) {
    console.error('[sync-uc-metadata]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Auto-discover new UC tables ─────────────────────────────────────────────
// Scans a catalog/schema prefix from settings (auto_discover_prefix) and imports
// any tables not yet in data_products as status='Draft' for admin review.
app.post('/api/portal/admin/discover-uc', async (req, res) => {
  try {
    const prefix = getSetting('auto_discover_prefix', '') || req.body?.prefix || '';
    if (!prefix) return res.status(400).json({ error: 'auto_discover_prefix not configured in Settings' });

    const parts = prefix.split('.');
    if (parts.length < 2) return res.status(400).json({ error: 'prefix must be catalog.schema or catalog.schema.prefix' });
    const [catalog, schema] = parts;

    const { host, token } = await getUcAuth();
    const listData = await ucApiRequest(host, token,
      `/api/2.0/unity-catalog/tables?catalog_name=${encodeURIComponent(catalog)}&schema_name=${encodeURIComponent(schema)}&max_results=200`);

    const ucTables = (listData?.tables || []).filter(t => {
      if (parts[2]) return t.name?.toLowerCase().startsWith(parts[2].toLowerCase());
      return true;
    });

    // Find which uc_full_names are already in data_products
    const { rows: existing } = await query(
      `SELECT uc_full_name FROM data_products WHERE uc_full_name IS NOT NULL`);
    const existingSet = new Set(existing.map(r => r.uc_full_name.toLowerCase()));

    const newTables = ucTables.filter(t =>
      !existingSet.has(`${catalog}.${schema}.${t.name}`.toLowerCase()));

    if (!newTables.length) return res.json({ discovered: 0, message: 'No new tables found' });

    // Get next product_ref
    const { rows: [maxRow] } = await query(
      `SELECT MAX(CAST(SUBSTRING(product_ref FROM 4) AS INTEGER)) AS max_id FROM data_products`);
    let nextId = (maxRow.max_id || 0) + 1;

    const drafted = [];
    for (const t of newTables) {
      const fullName = `${catalog}.${schema}.${t.name}`;
      const ref = `DP-${String(nextId++).padStart(3, '0')}`;
      const displayName = t.name.replace(/_/g, ' ').replace(/\bgold\b/i, '').trim()
        .replace(/\b\w/g, c => c.toUpperCase());
      const { rows: [product] } = await query(
        `INSERT INTO data_products
           (product_ref, display_name, description, type, domain, tags, source_system,
            refresh_frequency, owner_email, classification, uc_full_name, is_active, status, last_refreshed)
         VALUES ($1, $2, $3, 'Dataset', 'Other', '{}', 'Unity Catalog', 'Daily',
                 '', 'Internal', $4, FALSE, 'Draft', NOW())
         ON CONFLICT (product_ref) DO NOTHING RETURNING *`,
        [ref, displayName,
         `Auto-discovered from Unity Catalog: ${fullName}`, fullName]);
      if (product) drafted.push(product);
    }

    console.log(`[discover-uc] ${drafted.length} new tables drafted from ${prefix}`);
    res.json({ discovered: drafted.length, products: drafted });
  } catch (e) {
    console.error('[discover-uc]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ─── Demo Reset (admin only) ───────────────────────────────────────────────
app.post('/api/portal/demo-seed', async (req, res) => {
  if (!DEMO_MODE) {
    return res.status(403).json({ error: 'Demo seed is disabled in production mode.' });
  }
  try {
    await query(`
      INSERT INTO users (email, display_name, role, department) VALUES
        ('analyst@example.org',     'Alex Analyst',   'analyst',      'Finance'),
        ('manager@example.org',     'Morgan Manager', 'manager',       'Operations'),
        ('datasteward@example.org', 'Dana Steward',   'data_steward', 'Data Governance')
      ON CONFLICT (email) DO NOTHING
    `);

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

    await query(`
      INSERT INTO access_requests (request_ref, product_id, requester_id, requester_team, business_reason, access_level, status)
      SELECT 'REQ-001',
             (SELECT product_id FROM data_products WHERE product_ref = 'DP-002'),
             (SELECT user_id FROM users WHERE email = 'analyst@example.org'),
             'Finance',
             'Need customer data for quarterly churn analysis report.',
             'Read Only', 'Pending'
      WHERE NOT EXISTS (SELECT 1 FROM access_requests WHERE request_ref = 'REQ-001')
    `);

    await query(`
      INSERT INTO audit_log (event_type, actor_email, target_name, metadata) VALUES
        ('REQUEST_SUBMITTED', 'analyst@example.org', 'REQ-001',
         '{"productRef":"DP-002","reason":"Quarterly churn analysis"}')
      ON CONFLICT DO NOTHING
    `);

    const { rows: counts } = await query(`
      SELECT
        (SELECT COUNT(*) FROM data_products) AS products,
        (SELECT COUNT(*) FROM users)         AS users,
        (SELECT COUNT(*) FROM access_requests) AS requests
    `);
    console.log('[demo-seed] Seeded:', counts[0]);
    res.json({ success: true, counts: counts[0] });
  } catch (e) {
    console.error('[demo-seed]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/portal/demo-reset', async (req, res) => {
  if (!DEMO_MODE) {
    return res.status(403).json({ error: 'Demo reset is disabled in production mode (DEMO_MODE=false).' });
  }
  try {
    const SEEDED_REFS = ['DP-001','DP-002','DP-003','DP-004','DP-005','DP-006',
                         'DP-007','DP-008','DP-009','DP-010','DP-011','DP-012'];

    // Clear request history, audit trail, and personal libraries — NOT users or published products
    await query(`DELETE FROM access_requests`);
    await query(`DELETE FROM audit_log`);
    await query(`DELETE FROM user_library`);

    // Remove any pending/rejected products that were added during demos (not seeded refs)
    await query(
      `DELETE FROM data_products
       WHERE COALESCE(status,'Published') IN ('Pending','Rejected')
         AND product_ref != ALL($1::text[])`,
      [SEEDED_REFS]
    );

    // Re-ensure the three seed users always exist (safe upsert — never deletes anyone)
    await query(`
      INSERT INTO users (email, display_name, role, department) VALUES
        ('analyst@example.org',     'Alex Analyst',   'analyst',   'Finance'),
        ('manager@example.org',     'Morgan Manager', 'manager',   'Operations'),
        ('datasteward@example.org', 'Dana Steward',   'steward',   'Data Governance')
      ON CONFLICT (email) DO NOTHING
    `);

    const { rows: counts } = await query(`
      SELECT
        (SELECT COUNT(*) FROM access_requests) AS requests,
        (SELECT COUNT(*) FROM audit_log)       AS audit,
        (SELECT COUNT(*) FROM user_library)    AS library,
        (SELECT COUNT(*) FROM data_products)   AS products,
        (SELECT COUNT(*) FROM users)           AS users
    `);
    console.log('[demo-reset] Demo data cleared:', counts[0]);
    res.json({ success: true, counts: counts[0] });
  } catch (e) {
    console.error('[demo-reset]', e.message);
    res.status(500).json({ error: e.message });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DataMarket running on 0.0.0.0:${PORT}`);
  console.log(`🗄️  Lakebase: ${LAKEBASE_HOST}/${LAKEBASE_DB}/${LAKEBASE_SCHEMA}`);
  console.log(`🔧 Mode: ${DEMO_MODE ? 'DEMO (persona switcher, no real grants)' : 'PRODUCTION (SSO identity, UC grants enabled)'}`);
  console.log(`📡 RFA: ${RFA_ENABLED ? 'ENABLED' : 'disabled'} | UC Grants: ${!DEMO_MODE && SQL_WAREHOUSE_ID ? 'ENABLED' : 'disabled'}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  getPool()
    .then(() => {
      console.log('✅ Lakebase pool initialized');
      // Retry migrations — Autoscaling Lakebase may need a moment to wake from idle
      const tryMigrate = (attempt) => runMigrations().catch(e => {
        if (attempt < 5) {
          console.warn(`⚠️  Migration attempt ${attempt} failed (${e.message}) — retrying in 8s...`);
          setTimeout(() => tryMigrate(attempt + 1), 8000);
        } else {
          console.warn('⚠️  Migrations skipped after 5 attempts:', e.message);
        }
      });
      tryMigrate(1);
      // Run auto-discover after migrations settle (non-blocking)
      setTimeout(() => maybeAutoDiscover(), 15000);
    })
    .catch(e => console.warn('⚠️  Lakebase init deferred:', e.message));
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.close(async () => {
    if (dbPool) await dbPool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 14000);
});
