/**
 * Validation for "Import from file": bulk-registering reports and dashboards
 * that live outside Unity Catalog (Power BI, Tableau, Looker, anything with a link).
 *
 * Pure functions only, so they're unit-tested without a database. The route in
 * routes/products.js calls validateRows() for both the preview (dryRun) and the
 * real import, so what a steward previews is exactly what gets written.
 */

export const MAX_ROWS = 500;

export const CLASSIFICATIONS = ['Public', 'Internal', 'Confidential', 'Restricted'];
export const REFRESH_FREQUENCIES = ['Real-time', 'Hourly', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual'];
const REFRESH_SYNONYMS = { realtime: 'Real-time', 'real time': 'Real-time', yearly: 'Annual', annually: 'Annual', daily: 'Daily' };

/**
 * Column names we accept, mapped to the canonical field. Lets a steward paste
 * the raw output of a vendor API or script (for example Power BI's `webUrl` or
 * `configuredBy`) without renaming columns first.
 */
const HEADER_ALIASES = {
  name:              ['name', 'report_name', 'title', 'display_name', 'dashboard_name', 'workbook_name'],
  description:       ['description', 'desc', 'summary'],
  report_url:        ['report_url', 'url', 'link', 'weburl', 'web_url', 'report_link', 'link_url', 'content_url'],
  owner_email:       ['owner_email', 'owner', 'email', 'configuredby', 'configured_by', 'owner_upn'],
  source_type:       ['source_type', 'source', 'system', 'tool', 'platform'],
  workspace:         ['workspace', 'workspace_name', 'group', 'group_name', 'project', 'site'],
  domain:            ['domain', 'category', 'subject_area', 'area'],
  tags:              ['tags', 'keywords', 'labels'],
  classification:    ['classification', 'sensitivity', 'data_classification'],
  refresh_frequency: ['refresh_frequency', 'refresh', 'frequency', 'refresh_schedule'],
  upstream_table:    ['upstream_table', 'uc_table', 'source_table', 'upstream', 'databricks_table'],
};

export const TEMPLATE_COLUMNS = Object.keys(HEADER_ALIASES);

export function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const ALIAS_LOOKUP = (() => {
  const m = new Map();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    aliases.forEach((a, i) => { if (!m.has(a)) m.set(a, { field, rank: i }); });
  }
  return m;
})();

/** Map a raw row (any recognized header spelling) to canonical fields, all trimmed strings. */
export function canonicalizeRow(raw) {
  const out = {};
  const rank = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const hit = ALIAS_LOOKUP.get(normalizeHeader(key));
    if (!hit) continue;
    const text = Array.isArray(value) ? value.join(';') : String(value ?? '').trim();
    // When two columns map to the same field, the better-ranked alias wins, and a non-empty value beats an empty one.
    if (rank[hit.field] === undefined || (text && (!out[hit.field] || hit.rank < rank[hit.field]))) {
      out[hit.field] = text;
      rank[hit.field] = hit.rank;
    }
  }
  return out;
}

/**
 * Stable identity for a report link, so re-uploading the same export updates
 * instead of duplicating. Ignores scheme, query string, trailing slash and case.
 * Keeps the #/ part: Tableau puts the view path there.
 */
export function urlKey(url) {
  try {
    const u = new URL(String(url).trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    // Tableau keeps view parameters (?:iid=1) after the #, so cut the query from the hash too.
    const hash = u.hash.startsWith('#/') ? u.hash.split('?')[0] : '';
    return `${u.hostname}${u.pathname.replace(/\/+$/, '')}${hash.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Best guess at the tool from the link's host, used when source_type is blank. */
export function inferSourceType(url) {
  let host = '';
  try { host = new URL(String(url).trim()).hostname.toLowerCase(); } catch { return 'Other'; }
  if (/powerbi\.com$|powerbigov\.us$|powerbi\.cn$|fabric\.microsoft\.com$|powerbi\.microsoft\.us$/.test(host)) return 'Power BI';
  if (host.includes('tableau')) return 'Tableau';
  if (/looker\.com$|lookerstudio\.google\.com$|datastudio\.google\.com$/.test(host)) return 'Looker';
  if (host.includes('qlik')) return 'Qlik';
  return 'Other';
}

/** The catalog's type filter knows Power BI and Tableau by name; everything else is a generic Report. */
export function typeFor(sourceType) {
  if (sourceType === 'Power BI' || sourceType === 'Tableau') return sourceType;
  return 'Report';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseTags(value) {
  const seen = new Set();
  const tags = [];
  for (const t of String(value || '').split(/[;|,]/).map(s => s.trim()).filter(Boolean)) {
    const k = t.toLowerCase();
    if (!seen.has(k)) { seen.add(k); tags.push(t); }
  }
  return tags;
}

function matchCanonical(value, list, synonyms = {}) {
  const v = String(value || '').trim();
  if (!v) return null;
  const hit = list.find(x => x.toLowerCase() === v.toLowerCase());
  return hit || synonyms[v.toLowerCase()] || null;
}

/**
 * Check every row and decide what an import would do with it.
 *
 * @param {object[]} rawRows
 * @param {{ existing?: Map<string, {product_ref: string, status?: string}>, knownDomains?: string[] }} ctx
 *        existing: urlKey -> product already in the catalog with that link.
 * @returns {{ rows: object[], summary: { total: number, create: number, update: number, skip: number, warnings: number } }}
 */
export function validateRows(rawRows, { existing = new Map(), knownDomains = [] } = {}) {
  const seenInFile = new Map();
  const rows = (rawRows || []).map((raw, i) => {
    const rowNumber = i + 1;
    const f = canonicalizeRow(raw);
    const problems = [];
    const warnings = [];

    const name = f.name || '';
    if (!name) problems.push('Name is required');
    else if (name.length > 255) problems.push('Name is longer than 255 characters');

    const link = f.report_url || '';
    const key = link ? urlKey(link) : null;
    if (!link) problems.push('Link is required');
    else if (!key) problems.push('Link must be a full http(s) URL');
    else if (link.length > 2000) problems.push('Link is longer than 2000 characters');

    const ownerEmail = (f.owner_email || '').toLowerCase();
    if (ownerEmail && !EMAIL_RE.test(ownerEmail)) problems.push('Owner is not a valid email address');
    else if (!ownerEmail) warnings.push('No owner: access requests will have no one to ask');

    let description = f.description || '';
    if (description.length > 2000) { description = description.slice(0, 2000); warnings.push('Description cut to 2000 characters'); }
    if (!description) warnings.push('No description');

    const sourceType = (f.source_type || (key ? inferSourceType(link) : 'Other')).trim();
    if (sourceType.length > 20) problems.push('Source type is longer than 20 characters');

    let classification = 'Internal';
    if (f.classification) {
      const c = matchCanonical(f.classification, CLASSIFICATIONS);
      if (c) classification = c;
      else problems.push(`Classification must be one of ${CLASSIFICATIONS.join(', ')}`);
    }

    let refreshFrequency = 'Daily';
    if (f.refresh_frequency) {
      const r = matchCanonical(f.refresh_frequency, REFRESH_FREQUENCIES, REFRESH_SYNONYMS);
      if (r) refreshFrequency = r;
      else warnings.push(`Refresh "${f.refresh_frequency}" not recognized, using Daily`);
    }

    const domainRaw = (f.domain || '').trim();
    let domain = domainRaw ? (knownDomains.find(d => d.toLowerCase() === domainRaw.toLowerCase()) || domainRaw) : 'Other';
    if (domain.length > 100) problems.push('Domain is longer than 100 characters');

    const workspace = f.workspace || '';
    const upstream = f.upstream_table || '';
    if (upstream && !/^[^.\s]+\.[^.\s]+\.[^.\s]+$/.test(upstream)) {
      warnings.push('Upstream table is not in catalog.schema.table form');
    }

    // Workspace and upstream table become tags, so they're searchable and need no new columns.
    // The upstream table is deliberately NOT stored as uc_full_name: that field drives GRANT SELECT on approval.
    const tagList = parseTags(f.tags);
    const extra = [sourceType, workspace && `Workspace: ${workspace}`, upstream && `Upstream: ${upstream}`].filter(Boolean);
    const have = new Set(tagList.map(t => t.toLowerCase()));
    for (const t of extra) if (!have.has(t.toLowerCase())) { tagList.push(t); have.add(t.toLowerCase()); }
    if (tagList.length > 20) problems.push('More than 20 tags');
    if (tagList.some(t => t.length > 50)) problems.push('A tag is longer than 50 characters');

    let matchRef = null;
    if (key && !problems.length) {
      if (seenInFile.has(key)) problems.push(`Same link as row ${seenInFile.get(key)}`);
      else seenInFile.set(key, rowNumber);
    }
    if (key && existing.has(key)) matchRef = existing.get(key).product_ref;

    const ok = problems.length === 0;
    return {
      rowNumber,
      name,
      link,
      sourceType,
      action: !ok ? 'skip' : matchRef ? 'update' : 'create',
      matchRef,
      problems,
      warnings: ok ? warnings : [],
      product: ok ? {
        name, description, link, ownerEmail, sourceType, type: typeFor(sourceType),
        domain, tags: tagList, classification, refreshFrequency,
        // What the file actually said, as opposed to defaults. An update must only touch these,
        // or a blank classification column would quietly reset a Confidential product to Internal.
        provided: {
          description: !!description,
          ownerEmail: !!ownerEmail,
          domain: !!domainRaw,
          classification: !!f.classification,
          refreshFrequency: !!f.refresh_frequency,
        },
      } : null,
    };
  });

  const count = a => rows.filter(r => r.action === a).length;
  return {
    rows,
    summary: {
      total: rows.length,
      create: count('create'),
      update: count('update'),
      skip: count('skip'),
      warnings: rows.filter(r => r.warnings.length).length,
    },
  };
}
