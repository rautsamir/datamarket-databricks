import { query, getSetting } from '../db.js';
import { getUcAuth } from '../databricks.js';
import { httpsJsonRequest } from '../auth.js';

// Ask AI calls a Databricks serving endpoint. Which endpoint is configurable so a
// deployment can point at one governed by Mosaic AI Gateway — rate limits, usage
// tracking, payload logging, guardrails, and fallbacks are configured on the
// endpoint itself, so there is no separate gateway URL to call. This also lets a
// workspace that has not enabled pay-per-token FMAPI use a provisioned throughput
// or external-model endpoint instead.
export const DEFAULT_ASK_AI_ENDPOINT = 'databricks-meta-llama-3-3-70b-instruct';

/**
 * The endpoint name is interpolated into a URL path, so restrict it to the
 * characters Databricks actually permits. Without this, a settings value could
 * escape the path segment and address an arbitrary API route.
 */
export function sanitizeEndpointName(name) {
  const trimmed = String(name ?? '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,126}$/.test(trimmed) ? trimmed : null;
}

/**
 * Configured Ask AI endpoint: admin setting, then env var, then the default.
 * An empty setting means "unset" — clearing the field in the UI reverts to the
 * deployment default rather than breaking Ask AI.
 */
export function askAiEndpoint() {
  const configured = String(getSetting('ask_ai_endpoint', '') || '').trim();
  return configured || process.env.ASK_AI_ENDPOINT || DEFAULT_ASK_AI_ENDPOINT;
}

export function registerRoutes(app) {
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

      const configured = askAiEndpoint();
      const endpoint = sanitizeEndpointName(configured);
      if (!endpoint) {
        return res.status(500).json({
          error: 'Ask AI serving endpoint is not a valid endpoint name.',
          detail: 'Set a valid endpoint under Manage → Settings → Ask AI serving endpoint.',
        });
      }

      const { host, token } = await getUcAuth();
      const fmResp = await httpsJsonRequest({
        hostname: host.replace(/^https?:\/\//, ''),
        path: `/serving-endpoints/${endpoint}/invocations`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
          temperature: 0.1
        }),
        timeoutMs: 25000
      });

      // A misconfigured endpoint used to fall through as "no matches", which is
      // indistinguishable from a genuinely empty result. Report it instead.
      if (fmResp.status >= 400) {
        const detail = fmResp.data?.message || fmResp.data?.error_code || `HTTP ${fmResp.status}`;
        console.warn(`[ask-catalog] endpoint "${endpoint}" returned ${fmResp.status}: ${detail}`);
        return res.status(502).json({
          error: `Ask AI endpoint "${endpoint}" is not reachable.`,
          detail: fmResp.status === 404
            ? 'No serving endpoint with that name exists in this workspace, or the app service principal lacks CAN_QUERY on it.'
            : detail,
        });
      }

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
}
