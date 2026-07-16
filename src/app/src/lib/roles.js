/** Portal roles — two tiers: analyst (consumer) and admin (governance). */
export const ROLES = { ANALYST: 'analyst', ADMIN: 'admin' };

const ADMIN_ALIASES = new Set(['admin', 'steward', 'data_steward', 'data steward']);

export function normalizeRole(role) {
  if (!role) return ROLES.ANALYST;
  const r = String(role).toLowerCase().trim();
  return ADMIN_ALIASES.has(r) ? ROLES.ADMIN : ROLES.ANALYST;
}

export function isAdminRole(role) {
  return normalizeRole(role) === ROLES.ADMIN;
}

export function roleDisplayName(role) {
  return isAdminRole(role) ? 'Data Steward' : 'Data Analyst';
}

export function roleBadgeLabel(role) {
  return isAdminRole(role) ? 'Admin' : 'Analyst';
}
