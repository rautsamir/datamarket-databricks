/**
 * Who a signed-in caller may read and file access requests for.
 *
 * Identity comes from the SSO header (see authz.js `actor`). Request bodies and
 * query strings are untrusted, so they only widen scope for admins.
 */

const normalize = (email) => String(email || '').trim().toLowerCase();

/**
 * Email whose requests / notifications / library a GET may return.
 * Analysts always get their own. Admins may pass ?email= to view someone
 * (used by "Preview as analyst"), or omit it to see everything.
 * Returns null when the caller may see all records.
 */
export function readScopeFor({ isAdmin, actorEmail, requestedEmail }) {
  if (!isAdmin) return normalize(actorEmail);
  const requested = normalize(requestedEmail);
  return requested || null;
}

/**
 * Who a new request is filed for.
 * Analysts can only file for themselves. Admins may file on behalf of another
 * principal (the "Preview as analyst" flow), and the caller is recorded either way.
 * Returns { ok, requester, filedBy, onBehalfOf }.
 */
export function filingFor({ isAdmin, actorEmail, bodyRequesterEmail }) {
  const filedBy = normalize(actorEmail);
  const requester = normalize(bodyRequesterEmail) || filedBy;
  if (!requester) return { ok: false, reason: 'no_identity' };
  const onBehalfOf = requester !== filedBy;
  if (onBehalfOf && !isAdmin) return { ok: false, reason: 'not_admin' };
  return { ok: true, requester, filedBy, onBehalfOf };
}
