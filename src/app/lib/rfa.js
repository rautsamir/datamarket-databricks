// Unity Catalog "Request for Access" (RFA): files an access request on the product's table so the
// destinations configured on it (owner email, Slack, Teams, ...) are notified.
//
// The batch API wants the requester's numeric Databricks ID, not an email address, so the
// requester is looked up through SCIM first. Anything that is not a clean 2xx is a failure here,
// so callers never report a notification that Databricks rejected.

const RFA_PATH = '/api/3.0/rfa/requests';

/** SCIM filter values are quoted strings, so refuse anything that could break out of the quotes. */
function safeFilterValue(v) {
  const s = String(v ?? '').trim();
  return s && !/["\\\n\r]/.test(s) ? s : null;
}

/** Finds the numeric ID of a user (by email) or, failing that, a group (by name). */
export async function findPrincipal(api, requester) {
  const value = safeFilterValue(requester);
  if (!value) return null;
  const lookups = [
    { type: 'USER_PRINCIPAL',  path: `/api/2.0/preview/scim/v2/Users?attributes=id&filter=${encodeURIComponent(`userName eq "${value}"`)}` },
    { type: 'GROUP_PRINCIPAL', path: `/api/2.0/preview/scim/v2/Groups?attributes=id&filter=${encodeURIComponent(`displayName eq "${value}"`)}` },
  ];
  for (const l of lookups) {
    const { status, data } = await api('GET', l.path);
    const id = status >= 200 && status < 300 ? data?.Resources?.[0]?.id : null;
    if (id) return { id: String(id), principal_type: l.type };
  }
  return null;
}

export function buildRfaBody(principal, ucFullName, comment) {
  return {
    requests: [{
      behalf_of: principal,
      comment: comment || 'Access requested via DataMarket',
      securable_permissions: [{
        permissions: ['SELECT'],
        securable: { full_name: ucFullName, type: 'TABLE' },
      }],
    }],
  };
}

/**
 * Files the request. Returns { ok: true, destinations } or { ok: false, reason }.
 * Never throws: a notification problem must not block the access request itself.
 */
export async function fileAccessRequest(api, { ucFullName, requester, comment }) {
  if (!ucFullName || ucFullName.split('.').length !== 3) return { ok: false, reason: 'no_uc_table' };
  try {
    const principal = await findPrincipal(api, requester);
    if (!principal) return { ok: false, reason: `could not find "${requester}" in this workspace` };
    const { status, data } = await api('POST', RFA_PATH, buildRfaBody(principal, ucFullName, comment));
    if (status < 200 || status >= 300) {
      return { ok: false, reason: data?.message || data?.error_code || `HTTP ${status}` };
    }
    const destinations = (data?.responses || [])
      .flatMap(r => r.request_destinations || [])
      .flatMap(d => d.destinations || [])
      .map(d => d.destination_id)
      .filter(Boolean);
    return { ok: true, destinations: [...new Set(destinations)] };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
