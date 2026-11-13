// Unity Catalog grants issued when a steward approves access to a table-backed product.
//
// SELECT alone is not enough: without USE CATALOG and USE SCHEMA the analyst gets
// "table not found". RFA grants the parents too; DataMarket does the same here.
//
// On revoke/expiry we only drop SELECT. Leaving the parent USE privileges alone
// means a second approved product in the same schema keeps working.

function quoteIdent(name) {
  return `\`${String(name).replace(/`/g, '')}\``;
}

function quotePrincipal(principal) {
  return `\`${String(principal).replace(/`/g, '')}\``;
}

/** Returns null when the name is not catalog.schema.table. */
export function parseTableName(ucFullName) {
  const parts = String(ucFullName || '').split('.').filter(Boolean);
  if (parts.length !== 3) return null;
  return { catalog: parts[0], schema: parts[1], table: parts[2] };
}

/** Three GRANT statements that make a table readable end to end. */
export function buildAccessGrantSql(ucFullName, principal) {
  const t = parseTableName(ucFullName);
  if (!t || !principal) return null;
  const p = quotePrincipal(principal);
  return [
    `GRANT USE CATALOG ON CATALOG ${quoteIdent(t.catalog)} TO ${p};`,
    `GRANT USE SCHEMA ON SCHEMA ${quoteIdent(t.catalog)}.${quoteIdent(t.schema)} TO ${p};`,
    `GRANT SELECT ON TABLE ${quoteIdent(t.catalog)}.${quoteIdent(t.schema)}.${quoteIdent(t.table)} TO ${p};`,
  ].join('\n');
}

/**
 * Matching revoke for a previous grant. Prefer the table name + principal when we
 * have them; fall back to turning stored GRANT lines into REVOKE lines, and keep
 * only the SELECT (never revoke parent USE privileges).
 */
export function buildAccessRevokeSql({ ucFullName, principal, grantSql } = {}) {
  const t = parseTableName(ucFullName);
  if (t && principal) {
    return `REVOKE SELECT ON TABLE ${quoteIdent(t.catalog)}.${quoteIdent(t.schema)}.${quoteIdent(t.table)} FROM ${quotePrincipal(principal)};`;
  }
  if (!grantSql) return null;
  const lines = String(grantSql).split(/\n|;/).map(s => s.trim()).filter(Boolean);
  const select = lines.find(l => /^GRANT\s+SELECT\b/i.test(l));
  if (!select) return null;
  return select.replace(/^GRANT/i, 'REVOKE').replace(/\s+TO\s+/i, ' FROM ') +
    (select.endsWith(';') ? '' : ';');
}

/** Split a multi-statement script into individual statements for the SQL API. */
export function splitStatements(sql) {
  return String(sql || '')
    .split(';')
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean)
    .map(s => s + ';');
}
