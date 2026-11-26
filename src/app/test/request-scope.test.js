import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readScopeFor, filingFor } from '../lib/request-scope.js';

test('analysts only read their own records, whatever email they pass', () => {
  assert.equal(readScopeFor({ isAdmin: false, actorEmail: 'Ana@Corp.com', requestedEmail: 'boss@corp.com' }), 'ana@corp.com');
  assert.equal(readScopeFor({ isAdmin: false, actorEmail: 'ana@corp.com', requestedEmail: '' }), 'ana@corp.com');
});

test('admins may view another user or everything', () => {
  assert.equal(readScopeFor({ isAdmin: true, actorEmail: 'admin@corp.com', requestedEmail: 'Ana@Corp.com' }), 'ana@corp.com');
  assert.equal(readScopeFor({ isAdmin: true, actorEmail: 'admin@corp.com', requestedEmail: undefined }), null);
});

test('analysts cannot file a request for someone else', () => {
  const r = filingFor({ isAdmin: false, actorEmail: 'ana@corp.com', bodyRequesterEmail: 'boss@corp.com' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_admin');
});

test('analysts filing with a matching or missing email are fine', () => {
  const same = filingFor({ isAdmin: false, actorEmail: 'ana@corp.com', bodyRequesterEmail: 'ANA@corp.com' });
  assert.equal(same.ok, true);
  assert.equal(same.requester, 'ana@corp.com');
  assert.equal(same.onBehalfOf, false);

  const none = filingFor({ isAdmin: false, actorEmail: 'ana@corp.com', bodyRequesterEmail: undefined });
  assert.equal(none.requester, 'ana@corp.com');
});

test('admin preview can file on behalf of an analyst and the filer is recorded', () => {
  const r = filingFor({ isAdmin: true, actorEmail: 'admin@corp.com', bodyRequesterEmail: 'analyst@corp.com' });
  assert.equal(r.ok, true);
  assert.equal(r.requester, 'analyst@corp.com');
  assert.equal(r.filedBy, 'admin@corp.com');
  assert.equal(r.onBehalfOf, true);
});

test('no identity at all is rejected', () => {
  const none = filingFor({ isAdmin: false, actorEmail: '', bodyRequesterEmail: '' });
  assert.equal(none.ok, false);
  assert.equal(none.reason, 'no_identity');
});
