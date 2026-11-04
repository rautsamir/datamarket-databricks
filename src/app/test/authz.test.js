/**
 * Authorization policy tests. Run with: npm test
 *
 * The coverage test is the important one: it reads every route actually
 * registered in routes/*.js and asserts each has an explicit entry in POLICY.
 * Adding a route without classifying it fails the build rather than silently
 * inheriting the default-deny fallback.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACCESS, POLICY, findPolicy, levelFor } from '../lib/authz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.join(__dirname, '..', 'routes');

/** Turn an Express path into a concrete one: /products/:ref -> /products/DP-001 */
function concrete(routePath) {
  return routePath.replace(/:[^/]+/g, 'sample-id');
}

function registeredRoutes() {
  const routes = [];
  for (const file of fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    const re = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      routes.push({ method: m[1].toUpperCase(), path: m[2], file });
    }
  }
  return routes;
}

test('every registered route has an explicit policy entry', () => {
  const routes = registeredRoutes();
  assert.ok(routes.length > 0, 'expected to discover routes');

  const unclassified = routes.filter(r => findPolicy(r.method, concrete(r.path)) === null);

  assert.deepEqual(
    unclassified.map(r => `${r.method} ${r.path} (${r.file})`),
    [],
    'unclassified routes default to admin — add them to POLICY in lib/authz.js'
  );
});

test('unknown API routes fail closed to admin', () => {
  assert.equal(levelFor('GET', '/api/portal/something-new'), ACCESS.ADMIN);
  assert.equal(levelFor('POST', '/api/portal/admin/anything'), ACCESS.ADMIN);
});

test('governance actions require admin', () => {
  const adminRoutes = [
    ['PUT', '/api/portal/requests/REQ-001/approve'],
    ['PUT', '/api/portal/requests/REQ-001/deny'],
    ['PUT', '/api/portal/requests/REQ-001/revoke'],
    ['POST', '/api/portal/admin/users'],
    ['PUT', '/api/portal/admin/users/abc'],
    ['PUT', '/api/portal/settings'],
    ['GET', '/api/portal/audit'],
    ['DELETE', '/api/portal/products/DP-001'],
    ['PUT', '/api/portal/products/DP-001'],
    ['POST', '/api/portal/admin/uc-run-grants'],
  ];
  for (const [method, p] of adminRoutes) {
    assert.equal(levelFor(method, p), ACCESS.ADMIN, `${method} ${p} should be admin-only`);
  }
});

test('discovery and self-service stay open to signed-in analysts', () => {
  const userRoutes = [
    ['GET', '/api/portal/products'],
    ['POST', '/api/portal/products'],
    ['GET', '/api/portal/products/DP-001/schema'],
    ['GET', '/api/portal/products/DP-001/preview'],
    ['POST', '/api/portal/requests'],
    ['POST', '/api/portal/ask-catalog'],
    ['GET', '/api/portal/library'],
  ];
  for (const [method, p] of userRoutes) {
    assert.equal(levelFor(method, p), ACCESS.USER, `${method} ${p} should be user-level`);
  }
});

test('only identity, config, and health are public', () => {
  const publicEntries = POLICY.filter(([, , level]) => level === ACCESS.PUBLIC);
  assert.equal(publicEntries.length, 3);
  assert.equal(levelFor('GET', '/api/health'), ACCESS.PUBLIC);
  assert.equal(levelFor('GET', '/api/portal/identity'), ACCESS.PUBLIC);
  assert.equal(levelFor('GET', '/api/portal/config'), ACCESS.PUBLIC);
});

test('admin product writes are not shadowed by user read patterns', () => {
  // /products/:ref/schema is user-readable, but the bare :ref write must stay admin.
  assert.equal(levelFor('GET', '/api/portal/products/DP-001/schema'), ACCESS.USER);
  assert.equal(levelFor('PUT', '/api/portal/products/DP-001/publish'), ACCESS.ADMIN);
  assert.equal(levelFor('GET', '/api/portal/products/pending'), ACCESS.ADMIN);
});
