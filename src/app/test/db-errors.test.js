import { test } from 'node:test';
import assert from 'node:assert/strict';

// The schema defaults to the app name, which routinely contains a hyphen
// ("datamarket-v3"). Set it before importing so the module picks it up.
process.env.LAKEBASE_SCHEMA = 'datamarket-v3';
process.env.DATABRICKS_CLIENT_ID = '664887ec-8c37-4450-8747-04cde151084c';

const { classifyDbError } = await import('../db.js');

const denied = classifyDbError(new Error('permission denied for database "databricks_postgres"'));

test('a database permission error is classified as a permission problem', () => {
  assert.equal(denied.status, 'no_permission');
});

// This screen's whole value is that an operator can copy the SQL and run it.
// Unquoted, Postgres parses "datamarket-v3" as a subtraction and the remediation
// fails with a syntax error.
test('remediation SQL quotes a hyphenated schema name', () => {
  assert.match(denied.hint, /CREATE SCHEMA IF NOT EXISTS "datamarket-v3";/);
  assert.match(denied.hint, /ON SCHEMA "datamarket-v3"/);
});

test('remediation SQL quotes the service principal UUID', () => {
  assert.match(denied.hint, /TO "664887ec-8c37-4450-8747-04cde151084c";/);
});

test('no bare hyphenated identifier survives anywhere in the hint', () => {
  assert.ok(!/(?<!")\bdatamarket-v3\b(?!")/.test(denied.hint),
    `unquoted schema name in hint: ${denied.hint}`);
});
