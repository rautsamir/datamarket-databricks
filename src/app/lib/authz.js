/**
 * Server-side authorization for the DataMarket API.
 *
 * Two rules drive everything here:
 *
 *   1. Identity comes from the Databricks Apps proxy headers, never from the
 *      request body. A caller must not be able to assert who they are.
 *   2. Access is default-deny. A route with no entry in POLICY below requires
 *      admin, so forgetting to classify a new route fails closed rather than
 *      open.
 *
 * The policy lives in one table instead of being scattered across handlers so
 * the whole access model can be read at once and audited against the route list.
 */
import { query, DEMO_MODE } from '../db.js';
import { isAdminRole } from './roles.js';

export const ACCESS = { PUBLIC: 'public', USER: 'user', ADMIN: 'admin' };

const ANY = '*';

/**
 * First match wins, so more specific patterns come first. Paths are matched
 * against req.path, which carries the resolved :params (e.g. /products/DP-001).
 */
export const POLICY = [
  // ── Public: needed before or without an established identity ──────────────
  ['GET',    /^\/api\/health$/,                                   ACCESS.PUBLIC],
  ['GET',    /^\/api\/portal\/config$/,                           ACCESS.PUBLIC],
  ['GET',    /^\/api\/portal\/identity$/,                         ACCESS.PUBLIC],

  // ── Admin: governance, configuration, and anything touching Unity Catalog ─
  [ANY,      /^\/api\/portal\/admin\//,                           ACCESS.ADMIN],
  ['PUT',    /^\/api\/portal\/settings$/,                         ACCESS.ADMIN],
  ['GET',    /^\/api\/portal\/audit$/,                            ACCESS.ADMIN],
  ['GET',    /^\/api\/portal\/requests\/pending$/,                ACCESS.ADMIN],
  ['PUT',    /^\/api\/portal\/requests\/[^/]+\/(approve|deny|revoke)$/, ACCESS.ADMIN],
  ['GET',    /^\/api\/portal\/products\/pending$/,                ACCESS.ADMIN],
  ['GET',    /^\/api\/portal\/products\/debug$/,                  ACCESS.ADMIN],
  ['PUT',    /^\/api\/portal\/products\/[^/]+\/(publish|reject)$/, ACCESS.ADMIN],
  ['PUT',    /^\/api\/portal\/products\/[^/]+$/,                  ACCESS.ADMIN],
  ['DELETE', /^\/api\/portal\/products\/[^/]+$/,                  ACCESS.ADMIN],
  ['PUT',    /^\/api\/portal\/feature-requests\/[^/]+\/status$/,  ACCESS.ADMIN],
  ['POST',   /^\/api\/portal\/demo-(seed|reset)$/,                ACCESS.ADMIN],

  // ── Signed-in users: discovery, requesting access, own activity ───────────
  ['GET',    /^\/api\/portal\/products$/,                         ACCESS.USER],
  ['POST',   /^\/api\/portal\/products$/,                         ACCESS.USER], // self-service registration; lands as Pending
  ['GET',    /^\/api\/portal\/products\/[^/]+\/(schema|preview|granted-access)$/, ACCESS.USER],
  ['GET',    /^\/api\/portal\/requests$/,                         ACCESS.USER],
  ['POST',   /^\/api\/portal\/requests$/,                         ACCESS.USER],
  ['POST',   /^\/api\/portal\/requests\/[^/]+\/nudge$/,           ACCESS.USER],
  ['GET',    /^\/api\/portal\/notifications$/,                    ACCESS.USER],
  ['GET',    /^\/api\/portal\/library$/,                          ACCESS.USER],
  ['GET',    /^\/api\/portal\/settings$/,                         ACCESS.USER],
  ['GET',    /^\/api\/kpis$/,                                     ACCESS.USER],
  ['POST',   /^\/api\/portal\/ask-catalog$/,                      ACCESS.USER],
  ['GET',    /^\/api\/portal\/feature-requests$/,                 ACCESS.USER],
  ['POST',   /^\/api\/portal\/feature-requests$/,                 ACCESS.USER],
  ['POST',   /^\/api\/portal\/feature-requests\/[^/]+\/vote$/,    ACCESS.USER],
];

/** The matching policy entry, or null when a route is unclassified. */
export function findPolicy(method, path) {
  for (const entry of POLICY) {
    const [m, pattern] = entry;
    if ((m === ANY || m === method) && pattern.test(path)) return entry;
  }
  return null;
}

/** Access level required for a request. Unclassified API routes require admin. */
export function levelFor(method, path) {
  return findPolicy(method, path)?.[2] ?? ACCESS.ADMIN;
}

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * In demo mode the persona switcher is the identity system by design, so the
 * client is allowed to assert who it is. This is only safe because demo mode
 * also disables real UC grants.
 */
const DEMO_PERSONA = { email: 'demo@datamarket.local', displayName: 'Demo User', role: 'admin' };

function adminEmails() {
  return (process.env.ADMIN_EMAIL || process.env.DATABRICKS_USER || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/** The only trusted identity source in production. */
function ssoEmail(req) {
  const raw = req.headers['x-forwarded-email'] || req.headers['x-forwarded-user'] || '';
  const email = String(raw).trim().toLowerCase();
  return email && email !== 'anonymous' ? email : null;
}

function assertedEmail(req) {
  const raw = req.body?.requester_email || req.body?.adminEmail || req.query?.email || '';
  const email = String(raw).trim().toLowerCase();
  return email && email !== 'anonymous' ? email : null;
}

// Roles change rarely but are read on every request, so cache them briefly.
const ROLE_TTL_MS = 30_000;
const roleCache = new Map();

export function invalidateUserCache(email) {
  if (email) roleCache.delete(String(email).trim().toLowerCase());
  else roleCache.clear();
}

async function resolveUser(email) {
  const cached = roleCache.get(email);
  if (cached && cached.expires > Date.now()) return cached.user;

  const bootstrapAdmin = adminEmails().includes(email);
  let user = { email, displayName: null, role: bootstrapAdmin ? 'admin' : 'analyst', userId: null };

  try {
    const { rows: [row] } = await query(
      `SELECT user_id, email, display_name, role FROM users WHERE email = $1`, [email]);
    if (row) {
      user = {
        email,
        displayName: row.display_name || null,
        // ADMIN_EMAIL is a bootstrap floor so the deployer can always reach Settings.
        role: bootstrapAdmin ? 'admin' : row.role,
        userId: row.user_id,
      };
    }
  } catch (e) {
    // An unreachable database must not silently grant access. ADMIN_EMAIL still
    // applies so the deployer can reach the setup screens.
    console.warn('[authz] role lookup failed:', e.message);
  }

  roleCache.set(email, { user, expires: Date.now() + ROLE_TTL_MS });
  return user;
}

/** Populates req.user. Never rejects — enforcement is enforcePolicy's job. */
export async function attachUser(req, res, next) {
  try {
    const email = ssoEmail(req) || (DEMO_MODE ? assertedEmail(req) : null);

    if (!email) {
      req.user = DEMO_MODE
        ? { ...DEMO_PERSONA, isAdmin: true, userId: null, source: 'demo' }
        : null;
      return next();
    }

    const user = await resolveUser(email);
    req.user = { ...user, isAdmin: isAdminRole(user.role), source: ssoEmail(req) ? 'sso' : 'demo' };
  } catch (e) {
    console.warn('[authz] attachUser failed:', e.message);
    req.user = null;
  }
  next();
}

/** Enforces POLICY. Mount once, before any route registration. */
export function enforcePolicy(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();

  const level = levelFor(req.method, req.path);
  if (level === ACCESS.PUBLIC) return next();

  if (!req.user) {
    return res.status(401).json({
      error: 'Not signed in.',
      detail: 'This app expects a Databricks workspace identity. Open it through the Databricks Apps URL.',
    });
  }

  if (level === ACCESS.ADMIN && !req.user.isAdmin) {
    console.warn(`[authz] denied ${req.method} ${req.path} for ${req.user.email} (role=${req.user.role})`);
    return res.status(403).json({ error: 'Administrator access is required for this action.' });
  }

  return next();
}

/** Identity for handlers and audit records. Always prefer this over req.body. */
export function actor(req) {
  return req.user?.email || 'anonymous';
}
