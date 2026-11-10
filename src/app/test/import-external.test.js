/**
 * "Import from file" validation tests. Run with: npm test
 * Sample data is synthetic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateRows, urlKey, inferSourceType, typeFor, canonicalizeRow, normalizeHeader,
} from '../lib/import-external.js';

const row = (over = {}) => ({
  name: 'Quarterly Spend', description: 'Spend by department', report_url: 'https://app.powerbi.com/groups/g1/reports/r1',
  owner_email: 'owner@example.org', ...over,
});

test('a complete row becomes a create with sensible defaults', () => {
  const { rows, summary } = validateRows([row()]);
  assert.equal(rows[0].action, 'create');
  assert.deepEqual(rows[0].problems, []);
  assert.equal(rows[0].product.sourceType, 'Power BI');   // inferred from the host
  assert.equal(rows[0].product.type, 'Power BI');
  assert.equal(rows[0].product.classification, 'Internal');
  assert.equal(rows[0].product.refreshFrequency, 'Daily');
  assert.equal(rows[0].product.domain, 'Other');
  assert.deepEqual(summary, { total: 1, create: 1, update: 0, skip: 0, warnings: 0 });
});

test('name, link and owner problems skip the row with a reason', () => {
  const { rows } = validateRows([
    row({ name: '' }),
    row({ report_url: '' }),
    row({ report_url: 'not a url' }),
    row({ report_url: 'ftp://example.org/x' }),
    row({ owner_email: 'not-an-email' }),
  ]);
  assert.deepEqual(rows.map(r => r.action), ['skip', 'skip', 'skip', 'skip', 'skip']);
  assert.match(rows[0].problems[0], /Name is required/);
  assert.match(rows[1].problems[0], /Link is required/);
  assert.match(rows[2].problems[0], /full http/);
  assert.match(rows[3].problems[0], /full http/);
  assert.match(rows[4].problems[0], /valid email/);
});

test('missing owner and description are warnings, not errors', () => {
  const { rows, summary } = validateRows([row({ owner_email: '', description: '' })]);
  assert.equal(rows[0].action, 'create');
  assert.equal(rows[0].warnings.length, 2);
  assert.equal(summary.warnings, 1);
});

test('a repeated link inside the file skips the second row', () => {
  const { rows } = validateRows([
    row({ name: 'A' }),
    row({ name: 'B', report_url: 'https://APP.powerbi.com/groups/g1/reports/r1/?experience=power-bi' }),
  ]);
  assert.equal(rows[0].action, 'create');
  assert.equal(rows[1].action, 'skip');
  assert.match(rows[1].problems[0], /Same link as row 1/);
});

test('a link already in the catalog becomes an update, matched ignoring case, query and trailing slash', () => {
  const existing = new Map([[urlKey('https://app.powerbi.com/groups/g1/reports/r1'), { product_ref: 'DP-040' }]]);
  const { rows, summary } = validateRows([row({ report_url: 'https://app.powerbi.com/Groups/G1/reports/R1/?x=1' })], { existing });
  assert.equal(rows[0].action, 'update');
  assert.equal(rows[0].matchRef, 'DP-040');
  assert.equal(summary.update, 1);
});

test('urlKey keeps the Tableau #/ route and drops query strings', () => {
  assert.equal(
    urlKey('https://10ax.online.tableau.com/#/site/acme/views/Sales/Overview?:iid=1'),
    urlKey('https://10AX.online.tableau.com/#/site/acme/views/Sales/Overview/'),
  );
  assert.notEqual(
    urlKey('https://10ax.online.tableau.com/#/site/acme/views/Sales/Overview'),
    urlKey('https://10ax.online.tableau.com/#/site/acme/views/Sales/Detail'),
  );
  assert.equal(urlKey('mailto:a@b.c'), null);
  assert.equal(urlKey('nope'), null);
});

test('source type is inferred from the host when blank, and honored when given', () => {
  assert.equal(inferSourceType('https://app.powerbigov.us/groups/x'), 'Power BI');
  assert.equal(inferSourceType('https://app.fabric.microsoft.com/groups/x'), 'Power BI');
  assert.equal(inferSourceType('https://us-east-1.online.tableau.com/#/views/a'), 'Tableau');
  assert.equal(inferSourceType('https://lookerstudio.google.com/reporting/1'), 'Looker');
  assert.equal(inferSourceType('https://reports.example.org/a'), 'Other');
  assert.equal(typeFor('Tableau'), 'Tableau');
  assert.equal(typeFor('Looker'), 'Report');
  const { rows } = validateRows([row({ source_type: 'Qlik', report_url: 'https://reports.example.org/a' })]);
  assert.equal(rows[0].product.sourceType, 'Qlik');
  assert.equal(rows[0].product.type, 'Report');
});

test('vendor API column names are understood without renaming', () => {
  const f = canonicalizeRow({ Name: 'R', webUrl: 'https://app.powerbi.com/x', configuredBy: 'o@example.org', 'Workspace Name': 'Finance', ignored: 'zzz' });
  assert.deepEqual(f, { name: 'R', report_url: 'https://app.powerbi.com/x', owner_email: 'o@example.org', workspace: 'Finance' });
  assert.equal(normalizeHeader(' Report Name '), 'report_name');
});

test('tags merge file tags with source, workspace and upstream table; upstream never becomes a grant target', () => {
  const { rows } = validateRows([row({
    tags: 'budget; Finance , budget', workspace: 'Finance Ops', upstream_table: 'main.gold.spend',
  })]);
  assert.deepEqual(rows[0].product.tags, ['budget', 'Finance', 'Power BI', 'Workspace: Finance Ops', 'Upstream: main.gold.spend']);
  assert.equal('ucFullName' in rows[0].product, false);
});

test('classification must be a known value, refresh falls back with a warning, domain keeps the catalog spelling', () => {
  const { rows } = validateRows([
    row({ classification: 'confidential', refresh_frequency: 'hourly', domain: 'finance' }),
    row({ report_url: 'https://app.powerbi.com/b', classification: 'secret' }),
    row({ report_url: 'https://app.powerbi.com/c', refresh_frequency: 'whenever' }),
  ], { knownDomains: ['Finance', 'HR'] });
  assert.equal(rows[0].product.classification, 'Confidential');
  assert.equal(rows[0].product.refreshFrequency, 'Hourly');
  assert.equal(rows[0].product.domain, 'Finance');
  assert.equal(rows[1].action, 'skip');
  assert.match(rows[1].problems[0], /Classification must be one of/);
  assert.equal(rows[2].product.refreshFrequency, 'Daily');
  assert.match(rows[2].warnings.join(' '), /not recognized/);
});

test('field length limits protect the database columns', () => {
  const { rows } = validateRows([
    row({ name: 'x'.repeat(256) }),
    row({ report_url: 'https://app.powerbi.com/b', source_type: 'A very long source type name' }),
    row({ report_url: 'https://app.powerbi.com/c', tags: Array.from({ length: 25 }, (_, i) => `t${i}`).join(';') }),
  ]);
  assert.match(rows[0].problems[0], /255/);
  assert.match(rows[1].problems[0], /20 characters/);
  assert.match(rows[2].problems[0], /20 tags/);
});

test('provided flags separate what the file said from defaults, so updates never overwrite with defaults', () => {
  const { rows } = validateRows([
    row({ owner_email: '', description: '' }),
    row({ report_url: 'https://app.powerbi.com/b', classification: 'Restricted', refresh_frequency: 'Weekly', domain: 'HR' }),
  ]);
  assert.deepEqual(rows[0].product.provided, { description: false, ownerEmail: false, domain: false, classification: false, refreshFrequency: false });
  assert.deepEqual(rows[1].product.provided, { description: true, ownerEmail: true, domain: true, classification: true, refreshFrequency: true });
});

test('an empty or missing file produces an empty, valid result', () => {
  assert.deepEqual(validateRows([]).summary, { total: 0, create: 0, update: 0, skip: 0, warnings: 0 });
  assert.deepEqual(validateRows(undefined).rows, []);
});
