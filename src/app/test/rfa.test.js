import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPrincipal, buildRfaBody, fileAccessRequest } from '../lib/rfa.js';

// Minimal fake of databricksApi: routes by method + path substring.
function fakeApi(routes) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    for (const [key, res] of Object.entries(routes)) {
      if (`${method} ${path}`.includes(key)) return typeof res === 'function' ? res(body) : res;
    }
    return { status: 404, data: {} };
  };
  api.calls = calls;
  return api;
}

const ok = (data) => ({ status: 200, data });

test('findPrincipal prefers a user, with the numeric ID', async () => {
  const api = fakeApi({ 'GET /api/2.0/preview/scim/v2/Users': ok({ Resources: [{ id: 123 }] }) });
  assert.deepEqual(await findPrincipal(api, 'a@b.org'), { id: '123', principal_type: 'USER_PRINCIPAL' });
});

test('findPrincipal falls back to a group', async () => {
  const api = fakeApi({
    'GET /api/2.0/preview/scim/v2/Users': ok({ Resources: [] }),
    'GET /api/2.0/preview/scim/v2/Groups': ok({ Resources: [{ id: '77' }] }),
  });
  assert.deepEqual(await findPrincipal(api, 'my_group'), { id: '77', principal_type: 'GROUP_PRINCIPAL' });
});

test('findPrincipal refuses values that could break out of the SCIM filter', async () => {
  const api = fakeApi({});
  assert.equal(await findPrincipal(api, 'x" or userName pr or "'), null);
  assert.equal(api.calls.length, 0);
});

test('request body is a table SELECT on behalf of the principal', () => {
  const body = buildRfaBody({ id: '1', principal_type: 'USER_PRINCIPAL' }, 'c.s.t', 'need it');
  assert.deepEqual(body.requests[0].behalf_of, { id: '1', principal_type: 'USER_PRINCIPAL' });
  assert.equal(body.requests[0].comment, 'need it');
  assert.deepEqual(body.requests[0].securable_permissions[0], {
    permissions: ['SELECT'], securable: { full_name: 'c.s.t', type: 'TABLE' },
  });
});

test('success reports the destinations Databricks returned', async () => {
  const api = fakeApi({
    'GET /api/2.0/preview/scim/v2/Users': ok({ Resources: [{ id: 5 }] }),
    'POST /api/3.0/rfa/requests': ok({ responses: [{ request_destinations: [
      { destinations: [{ destination_id: 'owner@x.org' }] }, { destinations: [{ destination_id: 'owner@x.org' }] },
    ] }] }),
  });
  const r = await fileAccessRequest(api, { ucFullName: 'c.s.t', requester: 'a@b.org', comment: 'why' });
  assert.deepEqual(r, { ok: true, destinations: ['owner@x.org'] });
});

test('a rejected call is a failure, never a sent notification', async () => {
  const api = fakeApi({
    'GET /api/2.0/preview/scim/v2/Users': ok({ Resources: [{ id: 5 }] }),
    'POST /api/3.0/rfa/requests': { status: 404, data: { message: 'not found' } },
  });
  const r = await fileAccessRequest(api, { ucFullName: 'c.s.t', requester: 'a@b.org' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not found/);
});

test('unknown requester and missing tables fail without calling the RFA API', async () => {
  const api = fakeApi({ 'GET /api/2.0/preview/scim/v2': ok({ Resources: [] }) });
  assert.equal((await fileAccessRequest(api, { ucFullName: 'c.s.t', requester: 'ghost@x.org' })).ok, false);
  assert.equal((await fileAccessRequest(api, { ucFullName: '', requester: 'a@b.org' })).ok, false);
  assert.equal((await fileAccessRequest(api, { ucFullName: 'c.s', requester: 'a@b.org' })).ok, false);
  assert.ok(!api.calls.some(c => c.path.includes('/rfa/')));
});

test('a thrown error is contained', async () => {
  const api = async () => { throw new Error('boom'); };
  assert.deepEqual(await fileAccessRequest(api, { ucFullName: 'c.s.t', requester: 'a@b.org' }), { ok: false, reason: 'boom' });
});
