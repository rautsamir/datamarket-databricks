import {
  query,
  loadSettings,
  getSetting,
  invalidateSettingsCache,
  DEMO_MODE,
  SQL_WAREHOUSE_ID,
  RFA_ENABLED,
  APP_NAME,
  APP_SUBTITLE,
  APP_LOGO_URL,
} from '../db.js';
import { getUcAuth, ucApiRequest } from '../databricks.js';

export function registerRoutes(app) {
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

  // ─── App Config (branding + mode) ────────────────────────────────────────────
  app.get('/api/portal/config', async (req, res) => {
    await loadSettings();
    res.json({
      appName:    getSetting('app_name',    APP_NAME),
      appSubtitle:getSetting('app_subtitle', APP_SUBTITLE),
      appLogoUrl: getSetting('app_logo_url', APP_LOGO_URL),
      demoMode:   DEMO_MODE,
      sqlWarehouseId:   getSetting('sql_warehouse_id', SQL_WAREHOUSE_ID),
      askAiEnabled:            getSetting('ask_ai_enabled',            'true') !== 'false',
      insightsEnabled:         getSetting('insights_enabled',         'true') !== 'false',
      featureRequestsEnabled:  getSetting('feature_requests_enabled', 'false') === 'true',
      contributeUrl:           getSetting('contribute_url',           ''),
      searchChips: (() => {
        const raw = getSetting('search_chips', '');
        if (raw) { try { return JSON.parse(raw); } catch (_) {} }
        return [];
      })(),
      rfaEnabled:       getSetting('rfa_enabled', String(RFA_ENABLED)) === 'true',
      setupComplete:    getSetting('setup_complete', '') === 'true',
      autoDiscoverEnabled: getSetting('auto_discover_enabled', 'false') === 'true',
      autoDiscoverPrefix:  getSetting('auto_discover_prefix', ''),
      databricksHost:      process.env.DATABRICKS_HOST || '',
      navLinks: (() => {
        const raw = getSetting('nav_links', '');
        if (raw) { try { return JSON.parse(raw); } catch (_) {} }
        return [
          { label: 'About',   visible: true },
          { label: 'FAQ',     visible: true },
          { label: 'Contact', visible: true },
        ];
      })(),
      aboutText:    getSetting('about_text', ''),
      contactName:  getSetting('contact_name', ''),
      contactEmail: getSetting('contact_email', process.env.ADMIN_EMAIL || process.env.DATABRICKS_USER || ''),
      contactNote:  getSetting('contact_note', ''),
      faqItems: (() => {
        const raw = getSetting('faq_items', '');
        if (raw) { try { return JSON.parse(raw); } catch (_) {} }
        return [];
      })(),
    });
  });

  // ─── Portal Settings (admin CRUD) ────────────────────────────────────────────
  app.get('/api/portal/settings', async (req, res) => {
    try {
      const s = await loadSettings();
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
      invalidateSettingsCache();
      await loadSettings();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── UC Access Check — catalog visibility for the app SP ─────────────────────
  // Used by the onboarding wizard to surface grant gaps and generate fix SQL.
  app.get('/api/portal/admin/uc-access-check', async (req, res) => {
    try {
      const spId = process.env.DATABRICKS_CLIENT_ID || '';
      const databricksHost = (process.env.DATABRICKS_HOST || '').replace(/\/$/, '');

      const { host, token } = await getUcAuth();
      const catalogData = await ucApiRequest(host, token, '/api/2.1/unity-catalog/catalogs');
      const catalogs = (catalogData.catalogs || [])
        .filter(c => !['system', '__databricks_internal', 'hive_metastore'].includes(c.name));

      // For each catalog, check if the SP can see any schemas (beyond information_schema).
      const results = await Promise.all(catalogs.map(async (cat) => {
        try {
          const d = await ucApiRequest(host, token,
            `/api/2.1/unity-catalog/schemas?catalog_name=${encodeURIComponent(cat.name)}`);
          const schemas = (d.schemas || []).filter(s => s.name !== 'information_schema');
          return { name: cat.name, accessible: schemas.length > 0, schemaCount: schemas.length };
        } catch {
          return { name: cat.name, accessible: false, schemaCount: 0 };
        }
      }));

      const needsGrant = results.filter(c => !c.accessible);
      const grantSql = needsGrant.length > 0 && spId
        ? needsGrant.map(c =>
            `GRANT USE CATALOG ON CATALOG \`${c.name}\` TO \`${spId}\`;\n` +
            `GRANT USE SCHEMA ON CATALOG \`${c.name}\` TO \`${spId}\`;\n` +
            `GRANT BROWSE ON CATALOG \`${c.name}\` TO \`${spId}\`;`
          ).join('\n\n')
        : '';

      const sqlEditorUrl = databricksHost ? `${databricksHost}/sql/editor` : '';

      res.json({
        spId,
        catalogs: results,
        needsGrant: needsGrant.map(c => c.name),
        grantSql,
        sqlEditorUrl,
        allAccessible: needsGrant.length === 0,
      });
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
}
