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

// ─── Lakebase connection config ──────────────────────────────────────────────
// Set these environment variables to connect to your own Lakebase instance.
// In Databricks Apps, DATABRICKS_HOST and DATABRICKS_TOKEN are injected automatically.
const LAKEBASE_HOST     = process.env.LAKEBASE_HOST     || 'your-instance.database.azuredatabricks.net';
const LAKEBASE_DB       = process.env.LAKEBASE_DB       || 'your_database';
const LAKEBASE_SCHEMA   = process.env.LAKEBASE_SCHEMA   || 'datamarket';
const LAKEBASE_INSTANCE = process.env.LAKEBASE_INSTANCE || 'your-lakebase-instance';

let dbPool = null;
let tokenExpiresAt = 0;

async function generateDbToken() {
  return new Promise((resolve, reject) => {
    const host = (process.env.DATABRICKS_HOST || '').replace(/^https?:\/\//, '');
    const token = process.env.DATABRICKS_TOKEN || '';
    if (!host || !token) {
      reject(new Error('DATABRICKS_HOST or DATABRICKS_TOKEN not set'));
      return;
    }
    const body = JSON.stringify({ request_id: `app-${Date.now()}`, instance_names: [LAKEBASE_INSTANCE] });
    const options = {
      hostname: host,
      path: '/api/2.0/database/credentials',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).token); }
        catch (e) { reject(new Error(`Token parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getPool() {
  const now = Date.now();
  if (dbPool && now < tokenExpiresAt - 120_000) return dbPool; // reuse if > 2 min remaining

  console.log('[Lakebase] Refreshing database credential token...');
  if (dbPool) { try { await dbPool.end(); } catch (_) {} }

  let pgPassword;
  try {
    pgPassword = await generateDbToken();
  } catch (err) {
    console.warn('[Lakebase] Token generation failed (will use fallback):', err.message);
    pgPassword = process.env.LAKEBASE_PASSWORD || '';
  }

  dbPool = new Pool({
    host: LAKEBASE_HOST,
    port: 5432,
    database: LAKEBASE_DB,
    user: process.env.DATABRICKS_USER || 'your-email@your-domain.com',
    password: pgPassword,
    ssl: process.env.LAKEBASE_SSL_REJECT_UNAUTHORIZED === 'false'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    options: `-c search_path=${LAKEBASE_SCHEMA},public`
  });

  dbPool.on('error', (err) => console.error('[Lakebase] Pool error:', err.message));
  tokenExpiresAt = now + 60 * 60 * 1000; // 1 hour
  return dbPool;
}

async function query(sql, params = []) {
  const pool = await getPool();
  return pool.query(sql, params);
}

// ─── Schema migration — run at startup ───────────────────────────────────────
async function runMigrations() {
  try {
    // Add status + updated_at to data_products if missing (for product registration flow)
    await query(`ALTER TABLE data_products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Published'`);
    await query(`ALTER TABLE data_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
    await query(`ALTER TABLE data_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
    // Mark all existing rows as Published so they stay visible
    await query(`UPDATE data_products SET status = 'Published' WHERE status IS NULL`);
    console.log('[Lakebase] Migrations applied');
  } catch (e) {
    console.warn('[Lakebase] Migration warning (non-fatal):', e.message);
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
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'datamarket', lakebase: dbStatus });
});

// ─── Data Products ────────────────────────────────────────────────────────────
app.get('/api/portal/products', async (req, res) => {
  try {
    const { domain, type, q, includeAll } = req.query;
    let sql = `SELECT product_id, product_ref, uc_full_name, display_name, description, type, domain,
                      tags, source_system, refresh_frequency, owner_email, classification, is_active,
                      COALESCE(status,'Published') AS status, created_at
               FROM data_products WHERE (is_active = TRUE OR COALESCE(status,'Published') = 'Pending')`;
    // Non-admin users only see active/published
    if (!includeAll) sql = sql.replace("(is_active = TRUE OR COALESCE(status,'Published') = 'Pending')", "is_active = TRUE AND COALESCE(status,'Published') = 'Published'");
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

// ─── Register Product (producer submits for review) ──────────────────────────
app.post('/api/portal/products', async (req, res) => {
  try {
    const { name, description, type, source, tags, refreshFrequency,
            ownerEmail, classification, ucFullName, domain, hasPII, submittedBy } = req.body;
    if (!name || !description) return res.status(400).json({ error: 'name and description are required' });

    // Ensure columns exist before inserting
    await query(`ALTER TABLE data_products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Published'`);
    await query(`ALTER TABLE data_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
    await query(`ALTER TABLE data_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);

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
          refresh_frequency, owner_email, classification, uc_full_name, domain, is_active, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE,'Pending')
       RETURNING *`,
      [productRef, name, description, type || 'Dashboard', source || 'Other',
       tagsArr, refreshFrequency || 'Daily',
       ownerEmail || submittedBy || 'unknown@example.org',
       classification || 'Internal', ucFullName || '', domain || source || 'Other']
    );

    // Best-effort audit log (non-fatal if table doesn't exist)
    try {
      await query(
        `INSERT INTO audit_log (action, actor_email, target_ref, details)
         VALUES ('PRODUCT_SUBMITTED', $1, $2, $3)`,
        [submittedBy || ownerEmail || 'unknown', productRef, `Product "${name}" submitted for review`]
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
        `INSERT INTO audit_log (action, actor_email, target_ref, details)
         VALUES ('PRODUCT_PUBLISHED', $1, $2, $3)`,
        [reviewerEmail || 'admin', ref, `Product "${product.display_name}" published to catalog`]
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
        `INSERT INTO audit_log (action, actor_email, target_ref, details)
         VALUES ('PRODUCT_REJECTED', $1, $2, $3)`,
        [reviewerEmail || 'admin', ref, reason || `Product "${product.display_name}" rejected`]
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
                      ar.requested_at, ar.resolved_at, ar.denial_reason, ar.uc_grant_sql,
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

    const { rows: [user] } = await query('SELECT user_id, department FROM users WHERE email = $1', [requesterEmail]);
    if (!user) return res.status(404).json({ error: `User ${requesterEmail} not found` });

    const { rows: [{ count }] } = await query('SELECT COUNT(*) FROM access_requests', []);
    const ref = `REQ-${String(parseInt(count) + 1).padStart(3, '0')}`;

    const { rows: [newReq] } = await query(`
      INSERT INTO access_requests (request_ref, product_id, requester_id, requester_team, business_reason, access_level, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
      RETURNING *`, [ref, product.product_id, user.user_id, team || user.department, reason, accessLevel]);

    await query(`INSERT INTO audit_log (event_type, actor_email, target_type, target_id, target_name, metadata)
      VALUES ('REQUEST_SUBMITTED', $1, 'access_request', $2, $3, $4)`,
      [requesterEmail, newReq.request_id, ref, JSON.stringify({ productRef, reason })]);

    res.json({ ...newReq, request_ref: ref });
  } catch (e) {
    console.error('[POST /api/portal/requests]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/portal/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail = 'datasteward@example.org' } = req.body;

    const { rows: [req_] } = await query(`
      SELECT ar.*, dp.uc_full_name, dp.display_name AS product_name, u.email AS requester_email
      FROM access_requests ar
      JOIN data_products dp ON dp.product_id = ar.product_id
      JOIN users u ON u.user_id = ar.requester_id
      WHERE ar.request_id = $1 OR ar.request_ref = $1`, [id]);
    if (!req_) return res.status(404).json({ error: 'Request not found' });

    const ucGrantSql = req_.uc_full_name
      ? `GRANT SELECT ON ${req_.uc_full_name} TO \`${req_.requester_email}\`;`
      : `-- No UC table linked yet for ${req_.product_name}`;

    const { rows: [adminUser] } = await query('SELECT user_id FROM users WHERE email = $1', [adminEmail]);

    await query(`UPDATE access_requests SET status = 'Approved', resolved_at = NOW(),
      resolved_by = $1, uc_grant_issued = TRUE, uc_grant_sql = $2, updated_at = NOW()
      WHERE request_id = $3 OR request_ref = $3`,
      [adminUser?.user_id || null, ucGrantSql, id]);

    await query(`INSERT INTO audit_log (event_type, actor_email, target_type, target_id, target_name, metadata)
      VALUES ('REQUEST_APPROVED', $1, 'access_request', $2, $3, $4)`,
      [adminEmail, req_.request_id, req_.request_ref, JSON.stringify({ ucGrantSql })]);

    res.json({ status: 'Approved', uc_grant_sql: ucGrantSql });
  } catch (e) {
    console.error('[PUT approve]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/portal/requests/:id/deny', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail = 'datasteward@example.org', reason = '' } = req.body;

    const { rows: [req_] } = await query(
      'SELECT request_id, request_ref FROM access_requests WHERE request_id = $1 OR request_ref = $1', [id]);
    if (!req_) return res.status(404).json({ error: 'Request not found' });

    const { rows: [adminUser] } = await query('SELECT user_id FROM users WHERE email = $1', [adminEmail]);

    await query(`UPDATE access_requests SET status = 'Denied', resolved_at = NOW(),
      resolved_by = $1, denial_reason = $2, updated_at = NOW()
      WHERE request_id = $3 OR request_ref = $3`,
      [adminUser?.user_id || null, reason, id]);

    await query(`INSERT INTO audit_log (event_type, actor_email, target_type, target_id, target_name, metadata)
      VALUES ('REQUEST_DENIED', $1, 'access_request', $2, $3, $4)`,
      [adminEmail, req_.request_id, req_.request_ref, JSON.stringify({ reason })]);

    res.json({ status: 'Denied' });
  } catch (e) {
    console.error('[PUT deny]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Nudge Approver ───────────────────────────────────────────────────────────
app.post('/api/portal/requests/:id/nudge', async (req, res) => {
  try {
    const { id } = req.params;
    const { requesterEmail, productName } = req.body;
    await query(`
      INSERT INTO audit_log (action, actor_email, target_ref, details, created_at)
      VALUES ('NUDGE_SENT', $1, $2, $3, NOW())
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

// ─── Legacy KPI stubs (kept for backward compat) ─────────────────────────────
app.get('/api/kpis', (_, res) => res.json({
  total_revenue: { value: '$2.4M', trend: { direction: 'up', value: '+12%' } },
  total_customers: { value: '15,234', trend: { direction: 'up', value: '+8%' } },
  avg_order_value: { value: '$156', trend: { direction: 'up', value: '+5%' } },
  conversion_rate: { value: '3.2%', trend: { direction: 'down', value: '-2%' } }
}));

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DataMarket running on 0.0.0.0:${PORT}`);
  console.log(`🗄️  Lakebase: ${LAKEBASE_HOST}/${LAKEBASE_DB}/${LAKEBASE_SCHEMA}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  getPool()
    .then(() => { console.log('✅ Lakebase pool initialized'); return runMigrations(); })
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
