import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTableName, buildAccessGrantSql, buildAccessRevokeSql, splitStatements,
} from '../lib/uc-grants.js';

test('parseTableName accepts only catalog.schema.table', () => {
  assert.deepEqual(parseTableName('demo.county_audit_demo.vendor_payments'), {
    catalog: 'demo', schema: 'county_audit_demo', table: 'vendor_payments',
  });
  assert.equal(parseTableName('demo.schema'), null);
  assert.equal(parseTableName(''), null);
});

test('grant covers catalog, schema, and table', () => {
  const sql = buildAccessGrantSql('demo.county_audit_demo.vendor_payments', 'a@b.org');
  assert.match(sql, /GRANT USE CATALOG ON CATALOG `demo` TO `a@b\.org`;/);
  assert.match(sql, /GRANT USE SCHEMA ON SCHEMA `demo`\.`county_audit_demo` TO `a@b\.org`;/);
  assert.match(sql, /GRANT SELECT ON TABLE `demo`\.`county_audit_demo`\.`vendor_payments` TO `a@b\.org`;/);
  assert.equal(splitStatements(sql).length, 3);
});

test('revoke drops only SELECT, never parent USE privileges', () => {
  const sql = buildAccessRevokeSql({
    ucFullName: 'demo.county_audit_demo.vendor_payments',
    principal: 'a@b.org',
  });
  assert.equal(sql, 'REVOKE SELECT ON TABLE `demo`.`county_audit_demo`.`vendor_payments` FROM `a@b.org`;');
  assert.doesNotMatch(sql, /USE CATALOG|USE SCHEMA/);
});

test('revoke falls back to the SELECT line of a stored multi-grant script', () => {
  const grant = buildAccessGrantSql('c.s.t', 'u@x.org');
  const sql = buildAccessRevokeSql({ grantSql: grant });
  assert.equal(sql, 'REVOKE SELECT ON TABLE `c`.`s`.`t` FROM `u@x.org`;');
});

test('legacy single-line GRANT SELECT still revokes cleanly', () => {
  const sql = buildAccessRevokeSql({
    grantSql: 'GRANT SELECT ON demo.county_audit_demo.vendor_payments TO `a@b.org`;',
  });
  assert.equal(sql, 'REVOKE SELECT ON demo.county_audit_demo.vendor_payments FROM `a@b.org`;');
});

test('bad inputs return null', () => {
  assert.equal(buildAccessGrantSql('c.s', 'a@b.org'), null);
  assert.equal(buildAccessGrantSql('c.s.t', ''), null);
  assert.equal(buildAccessRevokeSql({}), null);
});
