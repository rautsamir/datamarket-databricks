#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DataMarket deploy.sh
# Deploys DataMarket to your Databricks workspace from scratch.
# Usage: ./deploy.sh [options]
#
# Options:
#   --profile        PROFILE        Databricks CLI profile (default: DEFAULT)
#   --admin-email    EMAIL          Your email — gets admin role on first login (required)
#   --lakebase-project NAME         Lakebase autoscaling project name (default: datamarket)
#   --app-name       NAME           Databricks App name (default: datamarket)
#   --warehouse-id   ID             SQL Warehouse ID — auto-grants SP 'Can use' permission
#   --grant-catalogs true|false     Auto-grant SP USE CATALOG/SCHEMA on all UC catalogs (default: true)
#   --demo-mode      true|false     Enable persona switcher (default: false)
#   --seed           true|false     Apply schema/seed.sql after schema init — loads demo data products,
#                                   users, and requests (default: true when --demo-mode true, else false)
#   --ask-ai-gateway CATALOG.SCHEMA|auto|off
#                                   Give Ask AI its own AI Gateway model service, CATALOG.SCHEMA.ask_ai
#                                   (payload logging to ask_ai_payload), grant the
#                                   app EXECUTE on it, and point Ask AI at it. The schema is created if
#                                   missing; catalogs never are. auto (default) uses datamarket.datamarket_ops
#                                   if a datamarket catalog exists, else <workspace default catalog>.datamarket_ops,
#                                   and leaves an endpoint already chosen in Settings alone. off = shared endpoint
#   --ask-ai-model   MODEL          Foundation model behind that service
#                                   (default: system.ai.llama_v3_3_70b_instruct)
#   --use-bundle     true|false     Use Databricks Asset Bundle (DAB) for Lakebase+app deploy (default: false)
#   --bundle-target  TARGET         DAB target to deploy: dev or prod (default: prod)
#   --help                          Show this help
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}▸${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗ ERROR:${NC} $*"; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"; }

TOTAL_STEPS=11

# ── Defaults ─────────────────────────────────────────────────────────────────
PROFILE="DEFAULT"
ADMIN_EMAIL=""
LAKEBASE_PROJECT="datamarket"
LAKEBASE_DB_NAME="databricks_postgres"   # the database inside the Lakebase project
LAKEBASE_SCHEMA="datamarket"             # fixed: schema/schema.sql and seed.sql set this search_path themselves
APP_NAME="datamarket"
DEMO_MODE="false"
SEED_DATA=""          # empty = auto (true when demo-mode, false otherwise)
WAREHOUSE_ID=""
GRANT_CATALOGS="true"
ASK_AI_GATEWAY="auto"
ASK_AI_MODEL="system.ai.llama_v3_3_70b_instruct"
USE_BUNDLE="false"
BUNDLE_TARGET="prod"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)          PROFILE="$2";          shift 2 ;;
    --admin-email)      ADMIN_EMAIL="$2";      shift 2 ;;
    --lakebase-project) LAKEBASE_PROJECT="$2"; shift 2 ;;
    --app-name)         APP_NAME="$2";         shift 2 ;;
    --demo-mode)        DEMO_MODE="$2";        shift 2 ;;
    --seed)             SEED_DATA="$2";        shift 2 ;;
    --warehouse-id)     WAREHOUSE_ID="$2";     shift 2 ;;
    --grant-catalogs)   GRANT_CATALOGS="$2";   shift 2 ;;
    --ask-ai-gateway)   ASK_AI_GATEWAY="$2";   shift 2 ;;
    --ask-ai-model)     ASK_AI_MODEL="$2";     shift 2 ;;
    --use-bundle)       USE_BUNDLE="$2";       shift 2 ;;
    --bundle-target)    BUNDLE_TARGET="$2";    shift 2 ;;
    --help|-h)
      sed -n '/^# /p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) fail "Unknown option: $1. Run with --help for usage." ;;
  esac
done

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}DataMarket — Automated Deploy${NC}"
echo "────────────────────────────────"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────
step 1 "Checking prerequisites"

command -v databricks >/dev/null 2>&1 || fail "Databricks CLI not found. Install: brew tap databricks/tap && brew install databricks"
command -v node        >/dev/null 2>&1 || fail "Node.js not found. Install: brew install node"
command -v npm         >/dev/null 2>&1 || fail "npm not found."
command -v python3     >/dev/null 2>&1 || fail "python3 not found."
PSQL_BIN=$(command -v psql 2>/dev/null || true)
if [[ -z "$PSQL_BIN" ]]; then
  warn "psql not found — schema init and SP grants will be skipped."
  warn "Install with: brew install postgresql@16"
  warn "The app will auto-create tables on first start, but you must grant schema access manually."
fi
ok "All prerequisites met"

# ── Validate CLI auth ─────────────────────────────────────────────────────────
step 2 "Reading Databricks profile"

AUTH_JSON=$(databricks auth describe --profile "$PROFILE" --output json 2>/dev/null) \
  || fail "Cannot authenticate with profile '${PROFILE}'. Run: databricks configure --profile ${PROFILE}"

DATABRICKS_HOST=$(echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('details',{}).get('host','') or d.get('host',''))" 2>/dev/null || true)
DATABRICKS_USER=$(echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('details',{}).get('user','') or d.get('user',''))" 2>/dev/null || true)

# Fallback: parse from profile config
if [[ -z "$DATABRICKS_HOST" ]]; then
  DATABRICKS_HOST=$(databricks auth describe --profile "$PROFILE" 2>&1 | grep -i "Host:" | head -1 | awk '{print $2}' || true)
fi
if [[ -z "$DATABRICKS_USER" ]]; then
  DATABRICKS_USER=$(databricks auth describe --profile "$PROFILE" 2>&1 | grep -i "User:" | head -1 | awk '{print $2}' || true)
fi

[[ -z "$DATABRICKS_HOST" ]] && fail "Could not detect DATABRICKS_HOST from profile. Set it manually in the generated app.yaml after this script runs."
DATABRICKS_HOST="${DATABRICKS_HOST%/}"  # strip trailing slash
ok "Host:  $DATABRICKS_HOST"
ok "User:  ${DATABRICKS_USER:-<service-principal>}"

# ── Prompt for required values ────────────────────────────────────────────────
if [[ -z "$ADMIN_EMAIL" ]]; then
  # Auto-detect from profile first
  ADMIN_EMAIL="${DATABRICKS_USER:-}"
  if [[ -z "$ADMIN_EMAIL" ]]; then
    echo ""
    read -rp "  Your email address (becomes the first admin): " ADMIN_EMAIL
    [[ -z "$ADMIN_EMAIL" ]] && fail "ADMIN_EMAIL is required."
  else
    info "Admin email auto-detected from profile: ${ADMIN_EMAIL}"
  fi
fi
ok "Admin: $ADMIN_EMAIL"

# Workspace path — derive from user email or use default
WS_USER="${DATABRICKS_USER:-$ADMIN_EMAIL}"
WS_USER_PATH="${WS_USER//@/%40}"  # URL-encode @ for workspace path display
WORKSPACE_PATH="/Workspace/Users/${WS_USER}/${APP_NAME}"
info "Workspace path: ${WORKSPACE_PATH}"

# ── Helper: get the first/production branch name for a project ────────────────
_get_branch() {
  databricks postgres list-branches "projects/${LAKEBASE_PROJECT}" \
    --profile "$PROFILE" -o json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    items = json.load(sys.stdin)
    if not isinstance(items, list): items = []
    # resource names look like 'projects/foo/branches/bar' — extract short name
    names = [b.get('name','').split('/')[-1] for b in items if b.get('name','')]
    prod = next((n for n in names if n == 'production'), '')
    print(prod or (names[0] if names else ''))
except: print('')
" 2>/dev/null || true
}

# ── Helper: get endpoint hostname for a branch ────────────────────────────────
_get_host() {
  local branch="$1"
  databricks postgres list-endpoints "projects/${LAKEBASE_PROJECT}/branches/${branch}" \
    --profile "$PROFILE" -o json 2>/dev/null \
  | python3 -c "
import sys, json
try:
    items = json.load(sys.stdin)
    if not isinstance(items, list): items = []
    for ep in items:
        host = ep.get('status', {}).get('hosts', {}).get('host', '')
        if host:
            print(host)
            break
except: print('')
" 2>/dev/null || true
}

# ── Helper: pick a SQL Warehouse when the operator did not name one ──────────
# Runs before app.yaml is generated so the chosen id can be baked into the app's
# environment. That is what lets the setup wizard pre-fill the field for
# confirmation rather than sending the operator off to find an id the deploy
# already knows. Granting on the warehouse still happens later, because that
# needs the app's service principal, which does not exist yet at this point.
#
# Idempotent, since the grant step calls it again: the guard covers the case
# where detection ran and found nothing, so it is not retried on every call.
WAREHOUSE_DETECTED="false"
detect_warehouse() {
  [[ -n "$WAREHOUSE_ID" || "$WAREHOUSE_DETECTED" == "true" ]] && return 0
  WAREHOUSE_DETECTED="true"

  info "No --warehouse-id provided — auto-detecting..."
  WAREHOUSE_ID=$(databricks warehouses list --profile "$PROFILE" -o json 2>/dev/null \
    | python3 -c "
import sys, json

data = json.load(sys.stdin)
warehouses = data if isinstance(data, list) else data.get('warehouses', data.get('items', []))

def score(w):
    name  = (w.get('name') or '').lower()
    state = (w.get('state') or '').upper()
    wtype = (w.get('warehouse_type') or '').upper()
    s = 0
    if state == 'RUNNING':   s += 10
    if 'starter' in name:    s += 4
    if 'serverless' in name: s += 3
    if wtype == 'PRO':       s += 2
    return s

best = sorted(warehouses, key=score, reverse=True)
if best:
    w = best[0]
    print(w.get('id',''))
    print(f'  Selected: {w.get(\"name\")} ({w.get(\"warehouse_type\")}, {w.get(\"state\")})', file=sys.stderr)
" 2>/tmp/wh_detect_log.txt || true)
  [[ -f /tmp/wh_detect_log.txt ]] && cat /tmp/wh_detect_log.txt >&2 || true
  rm -f /tmp/wh_detect_log.txt
  if [[ -n "$WAREHOUSE_ID" ]]; then
    ok "Auto-detected warehouse: ${WAREHOUSE_ID}"
    info "Pass --warehouse-id ${WAREHOUSE_ID} to skip detection on future runs."
  else
    warn "Could not auto-detect a SQL Warehouse. UC GRANTs won't execute until one is set."
    warn "After deploy: Manage → Settings → SQL Warehouse ID"
  fi
}

# ── Helper: is a Lakebase project actually present? ──────────────────────────
# list-projects is the only authoritative check. Branch lookups conflate three
# different states — absent, still provisioning, and slug-tombstoned — which is
# what made stuck projects so hard to diagnose.
_project_exists() {
  databricks postgres list-projects --profile "$PROFILE" -o json 2>/dev/null \
  | WANT="projects/$1" python3 -c "
import sys, json, os
try:
    items = json.load(sys.stdin)
    if not isinstance(items, list): items = []
except Exception:
    sys.exit(2)
sys.exit(0 if any(p.get('name') == os.environ['WANT'] for p in items) else 1)
" 2>/dev/null
}

# ── Helper: resolve a usable Lakebase project name ───────────────────────────
# Deleted Lakebase projects keep their slug. The tombstone is invisible —
# list-projects does not show it and delete-project reports "not found" — but
# it still blocks create-project with "already exists", which used to dead-end
# the deploy. When that happens, fall forward to the next candidate name.
#
# Candidates are checked reuse-first and are deterministic on purpose. If a run
# lands on "<base>-new", every later run finds that project already present and
# reuses it. A random suffix would mint a fresh empty database on every deploy
# and silently strand the previous one's data.
_resolve_lakebase_project() {
  local base="$1" candidate out
  for candidate in "$base" "${base}-new" "${base}-new-2" "${base}-new-3"; do
    if _project_exists "$candidate"; then
      if [[ "$candidate" != "$base" ]]; then
        warn "Reusing Lakebase project '${candidate}' — the slug '${base}' is taken"
        warn "by a deleted project and cannot be reused."
      fi
      LAKEBASE_PROJECT="$candidate"
      return 0
    fi

    info "Project '${candidate}' not found — creating Lakebase Autoscaling project..."
    info "(This takes ~2–3 minutes on first deploy — the CLI will wait automatically)"
    out=$(databricks postgres create-project "$candidate" \
      --profile "$PROFILE" -o json 2>&1 || true)

    if printf '%s' "$out" | python3 -c "import sys,json; json.load(sys.stdin)" &>/dev/null; then
      ok "Project '${candidate}' created"
      LAKEBASE_PROJECT="$candidate"
      return 0
    fi

    if printf '%s' "$out" | grep -qiE "already exists|slug"; then
      warn "The name '${candidate}' is held by a deleted Lakebase project — trying the next name."
      continue
    fi

    # Anything else is a real failure (permissions, quota, service error) and
    # renaming will not help, so surface it rather than churning through names.
    warn "create-project failed for '${candidate}': ${out:0:200}"
    LAKEBASE_PROJECT="$candidate"
    return 0
  done

  fail "Could not find or create a Lakebase project. Tried: ${base}, ${base}-new, ${base}-new-2, ${base}-new-3.
Pick an unused name explicitly:  ./deploy.sh --lakebase-project <name>"
}

# ── Lakebase resource binding ────────────────────────────────────────────────
# Creating a Postgres role by hand only lets the SP *authenticate*. What grants
# it CREATE on the database is binding the database as an app resource. Binding
# it does both: Databricks creates the SP's Postgres role (named after its
# client ID, reusing one that already exists) and grants CONNECT + CREATE.
# Without the binding the app connects successfully and then fails with
# "permission denied for database" the moment it tries to create its schema.
#
# Every path that produces an app must call this, so it lives in one function
# rather than inline in the standard path: `databricks bundle deploy` creates
# the app with no resources too, and the notebook path shells out to deploy.sh.
#
# DataMarket provisions Lakebase *Autoscaling* (projects and branches), whose
# resource type is `postgres` and which is addressed by branch resource path.
# The `database` type with instance_name is Lakebase Provisioned — a different
# type that mints a *separate* Postgres role. Databricks documents that
# switching an app between the two orphans the data owned by the old role, so
# this never rewrites an existing binding of either type; it only adds one when
# the app has none.
LAKEBASE_BINDING_CHANGED="false"
ensure_lakebase_binding() {
  info "Binding Lakebase database to the app..."
  local plan out
  LAKEBASE_BINDING_CHANGED="false"

  # BRANCH_NAME is only assigned inside branch-detection conditionals, so under
  # `set -u` an unresolved branch would abort the whole deploy on an unbound
  # variable. Degrade to a warning instead — a missing binding is recoverable
  # from the app's Settings, a dead deploy script is not.
  if [[ -z "${BRANCH_NAME:-}" ]]; then
    warn "Lakebase branch could not be resolved — skipping the database binding."
    warn "Add the database under the app's Settings with 'Can connect and create',"
    warn "or re-run deploy once the Lakebase project is ready."
    return 0
  fi

  # The binding needs the database's *resource path*, not the Postgres database
  # name. Note the two differ by a character: the resource id is
  # "databricks-postgres" while the database itself is "databricks_postgres".
  local branch_path db_path
  branch_path="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}"
  db_path=$(databricks api get "/api/2.0/postgres/${branch_path}/databases" \
    --profile "$PROFILE" 2>/dev/null \
    | PG_DB="$LAKEBASE_DB_NAME" python3 -c "
import json, os, sys
try:
    dbs = json.load(sys.stdin).get('databases') or []
except Exception:
    sys.exit(1)
# Match on the real Postgres database name, falling back to the first database
# in the branch so a non-default name still binds to something usable.
want = os.environ['PG_DB']
hit = next((d for d in dbs if (d.get('status') or {}).get('postgres_database') == want), None)
print((hit or (dbs[0] if dbs else {})).get('name', ''))
" 2>/dev/null || true)

  if [[ -z "$db_path" ]]; then
    warn "Could not resolve the Lakebase database path — skipping the binding."
    warn "Add the database under the app's Settings with 'Can connect and create'."
    return 0
  fi

  plan=$(databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
    | LB_BRANCH="$branch_path" LB_DB="$db_path" python3 -c "
import json, os, sys
try:
    app = json.load(sys.stdin)
except Exception:
    sys.exit(1)
current = app.get('resources') or []

# Treat either Lakebase type as 'already bound'. The name check matters because
# the CLI does not always serialize the 'postgres' sub-object back to us, so a
# bound app can look bare apart from its resource key.
def is_db_binding(r):
    return 'postgres' in r or 'database' in r or r.get('name') in ('postgres', 'database')

if any(is_db_binding(r) for r in current):
    print('ALREADY_BOUND')
    sys.exit(0)

want = {
    'name': 'postgres',   # the conventional key for Lakebase Autoscaling
    'description': 'Lakebase database holding DataMarket catalog, requests, and audit metadata.',
    'postgres': {
        # Both fields are required. The API rejects a branch-only binding even
        # though the docs describe the database as optional.
        'branch': os.environ['LB_BRANCH'],
        'database': os.environ['LB_DB'],
        'permission': 'CAN_CONNECT_AND_CREATE',
    },
}
# Everything else the operator attached (warehouse, endpoints, secrets) is
# preserved verbatim — the update replaces the whole resource list, so anything
# omitted here is what gets dropped.
payload = {'resources': current + [want]}
if app.get('description'):
    payload['description'] = app['description']
print(json.dumps(payload))
" 2>/dev/null || true)

  if [[ "$plan" == "ALREADY_BOUND" ]]; then
    ok "Lakebase already bound to the app"
  elif [[ -z "$plan" ]]; then
    warn "Could not read the app's resources — skipping the Lakebase binding."
    warn "If the app reports insufficient database permissions, add the database"
    warn "under the app's Settings with 'Can connect and create'."
  else
    # `databricks apps update` validates the body against the CLI's own typed
    # model, which as of v0.288.0 does not know the `postgres` resource type and
    # rejects it with "unknown field: postgres" before the request is ever sent.
    # The REST API accepts it, so go straight there.
    printf '%s' "$plan" > "${TMPDIR:-/tmp}/datamarket-bind-$$.json"
    out=$(databricks api patch "/api/2.0/apps/${APP_NAME}" \
      --json "@${TMPDIR:-/tmp}/datamarket-bind-$$.json" \
      --profile "$PROFILE" 2>&1 || true)
    rm -f "${TMPDIR:-/tmp}/datamarket-bind-$$.json"
    if printf '%s' "$out" | grep -qE "CAN_CONNECT_AND_CREATE"; then
      LAKEBASE_BINDING_CHANGED="true"
      ok "Lakebase bound — Databricks created the SP role and granted CONNECT + CREATE"
    else
      warn "Could not bind the Lakebase database: ${out:0:180}"
      warn "The app may fail with 'permission denied for database'. Add the database"
      warn "under the app's Settings with 'Can connect and create', then restart."
    fi
  fi
}

# ── Bundle path ───────────────────────────────────────────────────────────────
# When --use-bundle true, the DAB handles Lakebase provisioning + app deploy.
# deploy.sh then picks up from Step 7 (Lakebase schema grants) onwards.
if [[ "$USE_BUNDLE" == "true" ]]; then
  BUNDLE_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"  # repo root (3 levels up from src/app)
  if [[ ! -f "${BUNDLE_ROOT}/databricks.yml" ]]; then
    fail "databricks.yml not found at ${BUNDLE_ROOT}. Run from the repo root or check --use-bundle."
  fi

  info "─── Bundle mode (DAB) — steps 3–6 handled by databricks bundle deploy ───"
  info "Bundle root: ${BUNDLE_ROOT}"
  info "Target: ${BUNDLE_TARGET}"

  # Validate CLI version (postgres_projects needs >= 0.287.0)
  CLI_VERSION=$(databricks -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
  info "Databricks CLI version: ${CLI_VERSION:-unknown}"

  # Pre-flight check — Databricks rebuilds from source after the bundle syncs.
  step 3 "Verifying frontend builds"
  if (cd "$SCRIPT_DIR" && npm install --silent 2>/dev/null && npm run build 2>&1 | tail -4); then
    ok "Frontend compiles cleanly"
  else
    fail "Frontend build failed — fix the errors above before deploying."
  fi

  # Ensure app.yaml exists (required in source dir before bundle deploy)
  step 4 "Checking app.yaml"
  if [[ ! -f "${SCRIPT_DIR}/app.yaml" ]]; then
    info "app.yaml not found — generating from values provided..."
    detect_warehouse
    # Discover Lakebase hostname for app.yaml (needed even in bundle mode)
    LAKEBASE_HOST=""
    LAKEBASE_CACHE_FILE="${SCRIPT_DIR}/.lakebase-${APP_NAME}.cache"
    BRANCH_NAME=$(_get_branch)
    if [[ -n "$BRANCH_NAME" ]]; then
      LAKEBASE_ENDPOINT_PATH="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}/endpoints/primary"
      LAKEBASE_HOST=$(_get_host "$BRANCH_NAME")
    fi
    if [[ -z "$LAKEBASE_HOST" && -f "$LAKEBASE_CACHE_FILE" ]]; then
      LAKEBASE_HOST=$(cat "$LAKEBASE_CACHE_FILE" 2>/dev/null || true)
    fi
    if [[ -z "$LAKEBASE_HOST" ]]; then
      warn "Lakebase hostname not yet discoverable (project may not exist yet)."
      warn "The DAB will provision Lakebase. After 'databricks bundle deploy' completes, re-run this script to finalize app.yaml."
      info "Proceeding with bundle deploy — app.yaml will be created after Lakebase is up."
    fi
    LAKEBASE_ENDPOINT="${LAKEBASE_ENDPOINT_PATH:-projects/${LAKEBASE_PROJECT}/branches/production/endpoints/primary}"
    cat > "${SCRIPT_DIR}/app.yaml" << YAML
command:
  - "node"
  - "app.js"
env:
  - name: DATABRICKS_HOST
    value: "${DATABRICKS_HOST}"
  - name: ADMIN_EMAIL
    value: "${ADMIN_EMAIL}"
  - name: LAKEBASE_HOST
    value: "${LAKEBASE_HOST}"
  - name: LAKEBASE_DB
    value: "${LAKEBASE_DB_NAME}"
  - name: LAKEBASE_SCHEMA
    value: "${LAKEBASE_SCHEMA}"
  - name: LAKEBASE_ENDPOINT
    value: "${LAKEBASE_ENDPOINT}"
  - name: SQL_WAREHOUSE_ID
    value: "${WAREHOUSE_ID}"
  - name: DEMO_MODE
    value: "${DEMO_MODE}"
YAML
    ok "app.yaml written"
  else
    ok "app.yaml already exists — using as-is"
  fi

  step 5 "Running databricks bundle deploy (Lakebase + App)"
  cd "$BUNDLE_ROOT"
  databricks bundle deploy -t "$BUNDLE_TARGET" \
    --var "admin_email=${ADMIN_EMAIL}" \
    --var "demo_mode=${DEMO_MODE}" \
    --var "lakebase_project=${LAKEBASE_PROJECT}" \
    --var "app_name=${APP_NAME}" \
    --profile "$PROFILE" 2>&1 | tail -10
  ok "Bundle deployed"
  cd "$SCRIPT_DIR"

  # After bundle deploy, update app.yaml with discovered Lakebase hostname if missing
  step 6 "Refreshing app.yaml with Lakebase hostname"
  LAKEBASE_CACHE_FILE="${SCRIPT_DIR}/.lakebase-${APP_NAME}.cache"
  BRANCH_NAME=$(_get_branch)
  if [[ -n "$BRANCH_NAME" ]]; then
    LAKEBASE_ENDPOINT="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}/endpoints/primary"
    LAKEBASE_HOST=$(_get_host "$BRANCH_NAME")
    if [[ -n "$LAKEBASE_HOST" ]]; then
      echo "$LAKEBASE_HOST" > "$LAKEBASE_CACHE_FILE"
      # Patch app.yaml with real hostname
      python3 -c "
import re, sys
with open('${SCRIPT_DIR}/app.yaml', 'r') as f: content = f.read()
content = re.sub(r'(name: LAKEBASE_HOST\n\s+value: \")[^\"]*\"', r'\1${LAKEBASE_HOST}\"', content)
with open('${SCRIPT_DIR}/app.yaml', 'w') as f: f.write(content)
print('app.yaml patched with real Lakebase hostname')
"
      # Redeploy app with correct Lakebase host
      info "Redeploying app with correct Lakebase hostname..."
      databricks apps deploy "$APP_NAME" \
        --source-code-path "${WORKSPACE_PATH}" \
        --profile "$PROFILE" 2>&1 | tail -3 || true
      ok "app.yaml updated: ${LAKEBASE_HOST}"
    fi
  fi

  # `databricks bundle deploy` creates the app without any resource bindings, so
  # the SP has no CREATE on the database. Unlike the standard path, the app has
  # already started by this point, so a new binding needs a restart to reach it.
  ensure_lakebase_binding
  if [[ "$LAKEBASE_BINDING_CHANGED" == "true" ]]; then
    info "Restarting the app so the database binding takes effect..."
    databricks apps stop "$APP_NAME" --profile "$PROFILE" >/dev/null 2>&1 || true
    databricks apps start "$APP_NAME" --profile "$PROFILE" >/dev/null 2>&1 || true
    ok "App restarted"
  fi

  # Skip to grants — app is already deployed via bundle
  TOTAL_STEPS=11
  SP_UUID=$(databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
    | python3 -c "
import sys, json
d = json.load(sys.stdin)
candidates = [
  d.get('service_principal_client_id'),
  d.get('service_principal', {}).get('client_id'),
]
print(next((c for c in candidates if c), ''))
" 2>/dev/null || true)

  # Jump straight to step 7 (grants)
  # shellcheck disable=SC2034
  BUNDLE_DEPLOY_DONE=true
fi

# ── Standard path: Lakebase detection, app.yaml gen, build, upload, deploy ───
if [[ "${BUNDLE_DEPLOY_DONE:-false}" != "true" ]]; then

step 3 "Detecting Lakebase configuration"

# ── Pre-flight: verify token is fresh before the long Lakebase operation ──────
# Lakebase creation takes 2–3 min. An expired token mid-way leaves the project
# in a broken state. Fail fast here rather than halfway through provisioning.
TOKEN_CHECK=$(databricks auth token --profile "$PROFILE" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
if [[ -z "$TOKEN_CHECK" ]]; then
  fail "$(cat <<MSG
CLI auth token is expired or invalid for profile '${PROFILE}'.
Re-authenticate first, then re-run deploy:

  databricks auth login --host ${DATABRICKS_HOST} --profile ${PROFILE}
  ./deploy.sh --profile ${PROFILE}
MSG
)"
fi
ok "Auth token is valid"

LAKEBASE_HOST=""
LAKEBASE_ENDPOINT=""
LAKEBASE_CACHE_FILE="${SCRIPT_DIR}/.lakebase-${APP_NAME}.cache"

info "Looking up Lakebase project: ${LAKEBASE_PROJECT}"
# May change LAKEBASE_PROJECT if the requested slug is held by a deleted project.
_resolve_lakebase_project "$LAKEBASE_PROJECT"
BRANCH_NAME=$(_get_branch)

# ── Branch not up yet — wait for it ───────────────────────────────────────────
if [[ -z "$BRANCH_NAME" ]]; then
  # Poll for branch (provisioned after project creation)
  info "Waiting for Lakebase branch to be ready..."
  for i in $(seq 1 36); do
    BRANCH_NAME=$(_get_branch)
    [[ -n "$BRANCH_NAME" ]] && { ok "Branch ready: ${BRANCH_NAME}"; break; }
    echo -n "."; sleep 5
  done
  echo ""
  if [[ -z "$BRANCH_NAME" ]]; then
    warn "Lakebase branch not ready after 3 min — project '${LAKEBASE_PROJECT}' is stuck."
    warn "This usually means a previous deploy was interrupted (e.g. auth token expired)."
    info "Auto-recovering: deleting stuck project and recreating..."

    DEL_OUT=$(databricks postgres delete-project "projects/${LAKEBASE_PROJECT}" \
      --profile "$PROFILE" 2>&1 || true)
    if echo "$DEL_OUT" | grep -qi "error\|INTERNAL\|not found"; then
      warn "Could not auto-delete stuck project: ${DEL_OUT:0:150}"
      warn "Delete manually: Compute → Lakebase → ${LAKEBASE_PROJECT} → Settings → Delete project"
      warn "Then re-run: ./deploy.sh --profile ${PROFILE}"
      fail "Lakebase branch unavailable and auto-recovery failed. See above."
    fi
    ok "Stuck project deleted — recreating..."
    sleep 5

    databricks postgres create-project "$LAKEBASE_PROJECT" \
      --profile "$PROFILE" -o json 2>&1 | head -3 || true

    info "Waiting for Lakebase branch to be ready (attempt 2)..."
    for i in $(seq 1 36); do
      BRANCH_NAME=$(_get_branch)
      [[ -n "$BRANCH_NAME" ]] && { ok "Branch ready: ${BRANCH_NAME}"; break; }
      echo -n "."; sleep 5
    done
    echo ""
    [[ -z "$BRANCH_NAME" ]] && fail "Lakebase branch still unavailable after recreation. Check Compute → Lakebase in the UI."
  fi
fi

# ── Resolve endpoint hostname ─────────────────────────────────────────────────
LAKEBASE_ENDPOINT="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}/endpoints/primary"
LAKEBASE_HOST=$(_get_host "$BRANCH_NAME")

# Fall back to cache if API doesn't return a hostname yet (endpoint still provisioning)
if [[ -z "$LAKEBASE_HOST" && -f "$LAKEBASE_CACHE_FILE" ]]; then
  LAKEBASE_HOST=$(cat "$LAKEBASE_CACHE_FILE" 2>/dev/null || true)
  [[ -n "$LAKEBASE_HOST" ]] && ok "Lakebase hostname loaded from cache."
fi

# Last resort — ask once, cache the answer
if [[ -z "$LAKEBASE_HOST" ]]; then
  warn "Could not resolve Lakebase hostname from API (endpoint may still be provisioning)."
  warn "Go to: Compute → Lakebase → ${LAKEBASE_PROJECT} → Overview → Connection details"
  echo ""
  read -rp "  Paste your Lakebase hostname (ep-...): " LAKEBASE_HOST
  [[ -z "$LAKEBASE_HOST" ]] && fail "Lakebase hostname is required."
fi

# Always cache the resolved hostname for future runs
echo "$LAKEBASE_HOST" > "$LAKEBASE_CACHE_FILE"

ok "Lakebase host:     ${LAKEBASE_HOST}"
ok "Lakebase endpoint: ${LAKEBASE_ENDPOINT}"

# ── Generate app.yaml ─────────────────────────────────────────────────────────
step 4 "Generating app.yaml"

# Detect before writing app.yaml so the id is part of the app's environment.
detect_warehouse

APP_YAML_PATH="${SCRIPT_DIR}/app.yaml"

cat > "$APP_YAML_PATH" << YAML
command:
  - "node"
  - "app.js"
env:
  # ── Databricks Identity ────────────────────────────────────────────────────
  - name: DATABRICKS_HOST
    value: "${DATABRICKS_HOST}"

  # ── Admin bootstrap ────────────────────────────────────────────────────────
  # On first SSO login the app auto-promotes this email to admin.
  - name: ADMIN_EMAIL
    value: "${ADMIN_EMAIL}"

  # ── Lakebase Connection ────────────────────────────────────────────────────
  - name: LAKEBASE_HOST
    value: "${LAKEBASE_HOST}"
  - name: LAKEBASE_DB
    value: "${LAKEBASE_DB_NAME}"
  - name: LAKEBASE_SCHEMA
    value: "${LAKEBASE_SCHEMA}"
  - name: LAKEBASE_ENDPOINT
    value: "${LAKEBASE_ENDPOINT}"

  # ── SQL Warehouse ─────────────────────────────────────────────────────────
  # Used to run Unity Catalog GRANTs when an access request is approved. Acts as
  # the default only — the value saved in Settings wins, so an admin can change
  # warehouses in the UI without redeploying.
  - name: SQL_WAREHOUSE_ID
    value: "${WAREHOUSE_ID}"

  # ── Mode ──────────────────────────────────────────────────────────────────
  # false = real SSO identity + UC grants. true = persona switcher (demos only)
  - name: DEMO_MODE
    value: "${DEMO_MODE}"
YAML

ok "app.yaml written to ${APP_YAML_PATH}"

# ── Verify the frontend compiles ──────────────────────────────────────────────
# This is a pre-flight check only. The bundle that actually ships is the one
# Databricks builds from the uploaded source, not the dist/ produced here.
step 5 "Verifying frontend builds"

if command -v npm >/dev/null 2>&1; then
  if (cd "$SCRIPT_DIR" && npm install --silent 2>/dev/null && npm run build 2>&1 | tail -4); then
    ok "Frontend compiles cleanly"
  else
    fail "Frontend build failed — fix the errors above before deploying."
  fi
else
  warn "npm not found — skipping pre-flight check; Databricks will build from source."
fi

# ── Upload source ─────────────────────────────────────────────────────────────
step 6 "Uploading source to Databricks"

# The frontend is compiled on Databricks from the source uploaded here, not from
# a dist/ built on this machine. Shipping a prebuilt dist/ meant the UI a customer
# saw depended on whichever working copy happened to run the deploy — deployments
# were not reproducible from the repo. dist/ is deliberately NOT uploaded.

info "Uploading frontend source..."
for d in src public; do
  if [[ -d "${SCRIPT_DIR}/${d}" ]]; then
    databricks workspace import-dir "${SCRIPT_DIR}/${d}" "${WORKSPACE_PATH}/${d}" \
      --overwrite --profile "$PROFILE" 2>&1 | tail -2
  fi
done

# Build inputs — without these the Databricks-side `npm run build` cannot run.
for f in index.html vite.config.js tailwind.config.js postcss.config.js jsconfig.json components.json; do
  [[ -f "${SCRIPT_DIR}/${f}" ]] && \
    databricks workspace import "${WORKSPACE_PATH}/${f}" \
      --file "${SCRIPT_DIR}/${f}" --format AUTO --overwrite \
      --profile "$PROFILE" 2>/dev/null || true
done

# Remove build artifacts left behind by an earlier deploy, so a stale bundle can
# never shadow the freshly built one.
#
# node_modules matters more than it looks. This script never uploads it, but
# other deploy paths have, and nothing removed it. Native binaries built for the
# deploying machine (a macOS esbuild, say) then land in a Linux build container,
# and because the tree looks complete npm reports "up to date" and installs
# nothing — so the build runs against dependencies compiled for the wrong OS and
# fails with an unreadable error from esbuild. Always start from a clean tree and
# let the platform install for its own architecture.
for stale in dist node_modules; do
  databricks workspace delete "${WORKSPACE_PATH}/${stale}" --recursive \
    --profile "$PROFILE" 2>/dev/null || true
done

info "Uploading backend modules..."
for f in app.js db.js auth.js databricks.js; do
  databricks workspace import "${WORKSPACE_PATH}/${f}" \
    --file "${SCRIPT_DIR}/${f}" --format AUTO --overwrite \
    --profile "$PROFILE" 2>/dev/null
done

if [[ -d "${SCRIPT_DIR}/routes" ]]; then
  databricks workspace import-dir "${SCRIPT_DIR}/routes" "${WORKSPACE_PATH}/routes" \
    --overwrite --profile "$PROFILE" 2>&1 | tail -2
fi

if [[ -d "${SCRIPT_DIR}/lib" ]]; then
  databricks workspace import-dir "${SCRIPT_DIR}/lib" "${WORKSPACE_PATH}/lib" \
    --overwrite --profile "$PROFILE" 2>&1 | tail -2
fi

# package-lock.json pins the exact dependency tree so the Databricks-side install
# resolves to the same versions this was tested against.
for f in package.json package-lock.json app.yaml; do
  [[ -f "${SCRIPT_DIR}/${f}" ]] && \
    databricks workspace import "${WORKSPACE_PATH}/${f}" \
      --file "${SCRIPT_DIR}/${f}" --format AUTO --overwrite \
      --profile "$PROFILE" 2>/dev/null || true
done

info "Deploying app (this takes ~2 minutes)..."

# Create the app first if it doesn't exist yet
if ! databricks apps get "$APP_NAME" --profile "$PROFILE" --output json >/dev/null 2>&1; then
  info "App does not exist yet — creating..."
  databricks apps create "$APP_NAME" --profile "$PROFILE" 2>&1 | tail -3
fi

# The app exists now but has not been deployed, so bind the database before it
# ever starts — the first thing it does on boot is create its schema.
ensure_lakebase_binding

# ── Ensure the app SP has a Lakebase role BEFORE the app starts ───────────────
# The app creates its own schema and tables on first start, but it cannot create
# its own Postgres role — that is a chicken-and-egg problem. Do it here: the app
# exists (so it has a service principal) but has not yet been deployed.
#
# This deliberately runs before `apps deploy` so that a failed deploy still
# leaves a correctly provisioned database behind.
info "Ensuring app service principal has a Lakebase role..."
PRE_SP_UUID=""
for _attempt in 1 2 3; do
  PRE_SP_UUID=$(databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
    | python3 -c "
import sys, json
d = json.load(sys.stdin)
candidates = [
  d.get('service_principal_client_id'),
  d.get('service_principal', {}).get('client_id'),
]
print(next((c for c in candidates if c), ''))
" 2>/dev/null || true)
  [[ -n "$PRE_SP_UUID" ]] && break
  sleep 3
done

if [[ -z "$PRE_SP_UUID" ]]; then
  warn "Could not resolve the app service principal yet — retrying in step 7."
else
  PRE_ROLE_AUTH=$(databricks postgres list-roles \
    "projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}" \
    --profile "$PROFILE" -o json 2>/dev/null \
    | python3 -c "
import sys, json
try:
    roles = json.load(sys.stdin)
    m = next((r for r in roles if r.get('status',{}).get('postgres_role','') == '${PRE_SP_UUID}'), None)
    print(m.get('status',{}).get('auth_method','') if m else '')
except: print('')
" 2>/dev/null || true)

  if [[ "$PRE_ROLE_AUTH" == "LAKEBASE_OAUTH_V1" ]]; then
    ok "SP Lakebase role already present"
  else
    PRE_ROLE_OUT=$(databricks postgres create-role \
      "projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}" \
      --json "{\"spec\": {\"identity_type\": \"SERVICE_PRINCIPAL\", \"postgres_role\": \"${PRE_SP_UUID}\"}}" \
      --profile "$PROFILE" -o json 2>&1 || true)
    if echo "$PRE_ROLE_OUT" | grep -q "LAKEBASE_OAUTH_V1"; then
      ok "SP Lakebase role created — app will initialize its own schema on first start"
    else
      warn "Could not create the SP Lakebase role: ${PRE_ROLE_OUT:0:180}"
      warn "The app will start but cannot reach the database. It will display a"
      warn "setup error page with the exact command to run."
    fi
  fi
fi

DEPLOY_OUT=$(databricks apps deploy "$APP_NAME" \
  --source-code-path "$WORKSPACE_PATH" \
  --profile "$PROFILE" 2>&1)

# The CLI's output shape differs between versions and between text and JSON modes,
# so matching on stdout alone reported a failure for deploys that had actually
# succeeded. Confirm against the API before believing the deploy failed.
# Report the deployment's own state, not the app's.
#
# compute_status is deliberately ignored: it reports whether the app container is
# running, and it stays ACTIVE while a new deployment's build fails. Reading it as
# success is what let a failed build print "App deployed successfully". The build
# is also asynchronous — the deploy command returns before it finishes — so poll
# until the deployment reaches a terminal state instead of sampling once.
deployment_state() {
  databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
    | python3 -c "
import json, sys
try:
    app = json.load(sys.stdin)
except Exception:
    print('|'); sys.exit(0)
dep = app.get('pending_deployment') or app.get('active_deployment') or {}
st = dep.get('status') or {}
# '|' rather than a tab: bash collapses repeated whitespace separators, which
# would shift the message into the state when one field is empty.
print((st.get('state') or '') + '|' + (st.get('message') or ''))
" 2>/dev/null || echo '|'
}

DEPLOY_STATE=""; DEPLOY_MSG=""
for _ in $(seq 1 60); do
  IFS='|' read -r DEPLOY_STATE DEPLOY_MSG <<< "$(deployment_state)"
  case "$DEPLOY_STATE" in
    SUCCEEDED|FAILED|CANCELLED|ERROR) break ;;
  esac
  sleep 5
done

if [[ "$DEPLOY_STATE" == "SUCCEEDED" ]]; then
  ok "App deployed successfully"
else
  warn "App deployment did not succeed — state: ${DEPLOY_STATE:-unknown}"
  [[ -n "$DEPLOY_MSG" ]] && warn "  ${DEPLOY_MSG}"
  echo ""
  warn "See the build log for the cause:"
  warn "  databricks apps logs ${APP_NAME} --tail-lines 100 --profile ${PROFILE}"
  echo ""
  warn "Continuing with the remaining setup steps so the workspace is left in a"
  warn "usable state. Fix the error above and re-run deploy — the database and"
  warn "grants configured below do not need to be redone."
  echo ""
  DEPLOY_FAILED=1
fi

fi  # end standard path (not bundle mode)

# ── Lakebase schema grants ────────────────────────────────────────────────────
step 7 "Granting Lakebase schema permissions to the app service principal"

# Get the SP UUID from the running app
SP_UUID=$(databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
# Try several paths where the SP UUID might live
candidates = [
  d.get('service_principal_client_id'),
  d.get('service_principal', {}).get('client_id'),
  d.get('pending_deployment', {}).get('creator', {}).get('client_id'),
]
print(next((c for c in candidates if c), ''))
" 2>/dev/null || true)

# Fallback: scrape from app logs
if [[ -z "$SP_UUID" ]]; then
  SP_UUID=$(databricks apps logs "$APP_NAME" --profile "$PROFILE" 2>&1 \
    | grep -oE "Apps SP [0-9a-f-]{8}" | head -1 | awk '{print $3}' || true)
  # Logs show truncated UUID — try to get full UUID via SCIM if we have a prefix
fi

if [[ -z "$SP_UUID" ]]; then
  warn "Could not auto-detect the app service principal UUID."
  warn "Find it in: Apps → ${APP_NAME} → Service Principal"
  echo ""
  read -rp "  Paste the SP client UUID (or press Enter to skip): " SP_UUID
fi

if [[ -z "$SP_UUID" ]]; then
  warn "Skipping Lakebase grants — you will need to run these manually:"
  echo ""
  echo "  GRANT USAGE  ON SCHEMA datamarket TO \"<your-sp-uuid>\";"
  echo "  GRANT CREATE ON SCHEMA datamarket TO \"<your-sp-uuid>\";"
  echo ""
  warn "Until this is done, the app will start but data will not persist."
else
  info "Granting schema access to SP: ${SP_UUID}"

  # Generate a short-lived Lakebase token
  PG_TOKEN=$(databricks auth token --profile "$PROFILE" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)

  if [[ -z "$PSQL_BIN" ]]; then
    warn "psql not available — skipping schema init and grants. Run deploy again after installing psql."
    warn "  brew install postgresql@16"
  elif [[ -z "$PG_TOKEN" ]]; then
    warn "Could not generate a Lakebase token. Grants skipped — run manually."
  else
    # Step 1: Create schema + apply schema.sql (creates all core tables)
    SCHEMA_SQL="${SCRIPT_DIR}/../../schema/schema.sql"
    PG_CONN="host=${LAKEBASE_HOST} port=5432 dbname=${LAKEBASE_DB_NAME} sslmode=require user=${DATABRICKS_USER:-${ADMIN_EMAIL}}"

    SCHEMA_OUT=$(PGPASSWORD="$PG_TOKEN" psql "$PG_CONN" \
      -c "CREATE SCHEMA IF NOT EXISTS datamarket; SET search_path TO datamarket;" \
      2>&1 || true)
    if echo "$SCHEMA_OUT" | grep -qi "FATAL\|error:"; then
      warn "Lakebase connection failed during schema create:"
      echo "$SCHEMA_OUT" | grep -i "FATAL\|error:" | head -3
      warn "The app will try to auto-create tables on first start."
      warn "If this persists, ensure your CLI profile uses OAuth (not PAT):"
      warn "  databricks auth login --profile ${PROFILE} --host ${DATABRICKS_HOST}"
    fi

    if [[ -f "$SCHEMA_SQL" ]]; then
      SQL_OUT=$(PGPASSWORD="$PG_TOKEN" psql "$PG_CONN" \
        -v ON_ERROR_STOP=0 \
        -c "SET search_path TO ${LAKEBASE_SCHEMA};" \
        -f "$SCHEMA_SQL" \
        2>&1 || true)
      if echo "$SQL_OUT" | grep -qi "FATAL\|error:"; then
        warn "schema.sql could not be applied — connection issue (see above)"
      else
        echo "$SQL_OUT" | grep -v "^$" | grep -v "^NOTICE" | grep -v "already exists" || true
        ok "schema.sql applied"
      fi
    else
      warn "schema.sql not found at ${SCHEMA_SQL} — tables will be auto-created by the app on first start"
    fi

    # ── Seed data ────────────────────────────────────────────────────────────
    # Auto-seed when demo-mode is on; can be forced with --seed true|false
    if [[ -z "$SEED_DATA" ]]; then
      [[ "$DEMO_MODE" == "true" ]] && SEED_DATA="true" || SEED_DATA="false"
    fi

    SEED_SQL="${SCRIPT_DIR}/../../schema/seed.sql"
    if [[ "$SEED_DATA" == "true" ]]; then
      if [[ -f "$SEED_SQL" ]]; then
        info "Applying seed data (schema/seed.sql)..."
        PGPASSWORD="$PG_TOKEN" psql "$PG_CONN" \
          -v ON_ERROR_STOP=0 \
          -c "SET search_path TO ${LAKEBASE_SCHEMA};" \
          -f "$SEED_SQL" \
          2>&1 | grep -v "^$" | grep -v "^NOTICE" | grep -v "already exists" || true
        ok "Seed data applied — demo products + users loaded"
      else
        warn "seed.sql not found at ${SEED_SQL} — skipping seed"
      fi
    else
      info "Seed data skipped (production mode). Pass --seed true to load demo data."
    fi

    # Step 2: Create the SP OAuth role in Lakebase (required before app can authenticate)
    # Lakebase uses LAKEBASE_OAUTH_V1 auth — the SP role must be pre-registered via the API,
    # not via psql CREATE ROLE (which creates a native password role that won't accept OAuth tokens).
    info "Registering SP as OAuth role in Lakebase..."
    EXISTING_LAKEBASE_ROLE=$(databricks postgres list-roles \
      "projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}" \
      --profile "$PROFILE" -o json 2>/dev/null \
      | python3 -c "
import sys, json
try:
    roles = json.load(sys.stdin)
    match = next((r for r in roles if r.get('status',{}).get('postgres_role','') == '${SP_UUID}'), None)
    if match:
        method = match.get('status',{}).get('auth_method','')
        print(method)
    else:
        print('')
except: print('')
" 2>/dev/null || true)

    if [[ "$EXISTING_LAKEBASE_ROLE" == "LAKEBASE_OAUTH_V1" ]]; then
      ok "SP OAuth role already registered in Lakebase."
    else
      if [[ -n "$EXISTING_LAKEBASE_ROLE" ]]; then
        # Wrong auth method — find and delete the existing role first
        WRONG_ROLE_NAME=$(databricks postgres list-roles \
          "projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}" \
          --profile "$PROFILE" -o json 2>/dev/null \
          | python3 -c "
import sys, json
try:
    roles = json.load(sys.stdin)
    match = next((r for r in roles if r.get('status',{}).get('postgres_role','') == '${SP_UUID}'), None)
    print(match.get('name','') if match else '')
except: print('')
" 2>/dev/null || true)
        [[ -n "$WRONG_ROLE_NAME" ]] && \
          databricks postgres delete-role "$WRONG_ROLE_NAME" --profile "$PROFILE" 2>/dev/null || true
        # Also clean up the manually-created postgres role if it exists
        PGPASSWORD="$PG_TOKEN" psql "$PG_CONN" \
          -c "REVOKE ALL ON ALL TABLES IN SCHEMA datamarket FROM \"${SP_UUID}\"; \
              REVOKE ALL ON ALL SEQUENCES IN SCHEMA datamarket FROM \"${SP_UUID}\"; \
              REVOKE ALL ON SCHEMA datamarket FROM \"${SP_UUID}\"; \
              DROP ROLE IF EXISTS \"${SP_UUID}\";" \
          2>/dev/null || true
      fi

      CREATE_ROLE_OUT=$(databricks postgres create-role \
        "projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}" \
        --json "{\"spec\": {\"identity_type\": \"SERVICE_PRINCIPAL\", \"postgres_role\": \"${SP_UUID}\"}}" \
        --profile "$PROFILE" -o json 2>&1 || true)

      if echo "$CREATE_ROLE_OUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',{}).get('auth_method',''))" 2>/dev/null | grep -q "LAKEBASE_OAUTH_V1"; then
        ok "SP OAuth role created in Lakebase"
      else
        warn "Could not create SP OAuth role: ${CREATE_ROLE_OUT:0:150}"
        warn "App may fall back to demo mode. Re-run deploy to retry."
      fi
    fi

    # Step 3: Grant the SP schema access
    GRANT_OUT=$(PGPASSWORD="$PG_TOKEN" psql \
      "host=${LAKEBASE_HOST} port=5432 dbname=${LAKEBASE_DB_NAME} sslmode=require user=${DATABRICKS_USER:-${ADMIN_EMAIL}}" \
      -c "
        GRANT CONNECT ON DATABASE ${LAKEBASE_DB_NAME} TO \"${SP_UUID}\";
        GRANT USAGE  ON SCHEMA datamarket TO \"${SP_UUID}\";
        GRANT CREATE ON SCHEMA datamarket TO \"${SP_UUID}\";
        GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA datamarket TO \"${SP_UUID}\";
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA datamarket TO \"${SP_UUID}\";
        ALTER DEFAULT PRIVILEGES IN SCHEMA datamarket GRANT ALL ON TABLES    TO \"${SP_UUID}\";
        ALTER DEFAULT PRIVILEGES IN SCHEMA datamarket GRANT ALL ON SEQUENCES TO \"${SP_UUID}\";
      " 2>&1 || true)

    if echo "$GRANT_OUT" | grep -qi "FATAL\|error:"; then
      warn "SP grants failed:"
      echo "$GRANT_OUT" | grep -i "FATAL\|error:" | head -3
    else
      ok "Schema grants applied to SP"
    fi

    # Step 4: Restart app with role + grants in place
    info "Restarting app..."
    databricks apps deploy "$APP_NAME" \
      --source-code-path "$WORKSPACE_PATH" \
      --profile "$PROFILE" 2>&1 | tail -3
    ok "App restarted"
  fi
fi

# ── Warehouse SP permission ───────────────────────────────────────────────────
step 8 "Granting SQL Warehouse 'Can use' to app service principal"

# Detection already ran before app.yaml was generated, so the id could be baked
# into the app's environment. Granting still has to happen here, because it
# needs the service principal, which does not exist until the app is created.
detect_warehouse

if [[ -z "$WAREHOUSE_ID" ]]; then
  : # skip silently — warned above
elif [[ -z "$SP_UUID" ]]; then
  warn "SP UUID not detected — skipping warehouse grant. Grant manually in the UI."
else
  WAREHOUSE_PERM_PAYLOAD="{\"access_control_list\":[{\"service_principal_name\":\"${SP_UUID}\",\"permission_level\":\"CAN_USE\"}]}"
  WAREHOUSE_PERM_RESULT=$(databricks api patch "/api/2.0/permissions/warehouses/${WAREHOUSE_ID}" \
    --profile "$PROFILE" \
    --json "$WAREHOUSE_PERM_PAYLOAD" 2>&1 || echo "error")

  if echo "$WAREHOUSE_PERM_RESULT" | grep -qi "error\|Error\|INTERNAL"; then
    warn "Warehouse permission grant returned a warning (may already be set or partial):"
    echo "$WAREHOUSE_PERM_RESULT" | head -3
  else
    ok "SP '${SP_UUID}' granted CAN_USE on warehouse ${WAREHOUSE_ID}"
  fi
fi

# ── UC Catalog / Schema grants ────────────────────────────────────────────────
step 9 "Granting SP USE CATALOG + USE SCHEMA on all Unity Catalog catalogs"

if [[ "$GRANT_CATALOGS" != "true" ]]; then
  warn "UC catalog grants skipped (--grant-catalogs false)."
elif [[ -z "$SP_UUID" ]]; then
  warn "SP UUID not detected — skipping UC grants. Run the SQL below manually:"
  echo "  GRANT USE CATALOG ON CATALOG <catalog> TO \`<sp-uuid>\`;"
elif [[ -z "$WAREHOUSE_ID" ]]; then
  warn "No warehouse ID available — cannot execute UC GRANTs. Pass --warehouse-id to automate."
else
  info "Listing UC catalogs visible to this profile..."

  CATALOGS=$(databricks api get "/api/2.1/unity-catalog/catalogs" \
    --profile "$PROFILE" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cats = [c.get('name','') for c in d.get('catalogs',[])
            if c.get('name','') not in ('system','__databricks_internal','hive_metastore')]
    print(' '.join(cats))
except: print('')
" 2>/dev/null || true)

  if [[ -z "$CATALOGS" ]]; then
    warn "No catalogs found or insufficient permissions to list catalogs."
  else
    info "Found catalogs: ${CATALOGS}"
    GRANT_ERRORS=0
    for CATALOG in $CATALOGS; do
      # USE CATALOG — required to enter the catalog
      GRANT_RESULT=$(databricks api post "/api/2.0/sql/statements" \
        --profile "$PROFILE" \
        --json "{\"warehouse_id\":\"${WAREHOUSE_ID}\",\"statement\":\"GRANT USE CATALOG ON CATALOG \`${CATALOG}\` TO \`${SP_UUID}\`\",\"wait_timeout\":\"10s\"}" \
        2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',{}).get('state','UNKNOWN'))" 2>/dev/null || echo "ERROR")

      # USE SCHEMA ON CATALOG — cascades USE SCHEMA to all current and future schemas.
      # Required for the SP to enumerate schemas and tables via the UC REST API.
      databricks api post "/api/2.0/sql/statements" \
        --profile "$PROFILE" \
        --json "{\"warehouse_id\":\"${WAREHOUSE_ID}\",\"statement\":\"GRANT USE SCHEMA ON CATALOG \`${CATALOG}\` TO \`${SP_UUID}\`\",\"wait_timeout\":\"10s\"}" \
        2>/dev/null >/dev/null || true

      # SELECT ON CATALOG — cascades read access to all current and future schemas/tables.
      SELECT_RESULT=$(databricks api post "/api/2.0/sql/statements" \
        --profile "$PROFILE" \
        --json "{\"warehouse_id\":\"${WAREHOUSE_ID}\",\"statement\":\"GRANT SELECT ON CATALOG \`${CATALOG}\` TO \`${SP_UUID}\`\",\"wait_timeout\":\"10s\"}" \
        2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',{}).get('state','UNKNOWN'))" 2>/dev/null || echo "ERROR")

      if [[ "$GRANT_RESULT" == "SUCCEEDED" && "$SELECT_RESULT" == "SUCCEEDED" ]]; then
        ok "  ✓ ${CATALOG} — USE CATALOG + USE SCHEMA + SELECT granted (covers all schemas, now and future)"
      elif [[ "$GRANT_RESULT" == "SUCCEEDED" ]]; then
        ok "  ✓ ${CATALOG} — USE CATALOG granted"
        warn "  ⚠ ${CATALOG} — SELECT grant failed (catalog may be owned by another user — run manually)"
      else
        warn "  ⚠ ${CATALOG} — grant failed. Use the onboarding wizard to generate the correct SQL."
        GRANT_ERRORS=$((GRANT_ERRORS + 1))
      fi
    done
    [[ $GRANT_ERRORS -eq 0 ]] && ok "UC catalog grants complete" || warn "${GRANT_ERRORS} catalog(s) could not be granted — the onboarding wizard will show the exact SQL to run."
  fi
fi

# ── Spend observability ──────────────────────────────────────────────────────
step 10 "Spend observability"

# No tagging: the SQL warehouse is usually shared, so an app=datamarket tag would
# label everyone's spend on it as DataMarket's, and it isn't ours to edit.
# system.billing.usage already identifies each DataMarket resource precisely:
# app compute by app name, Lakebase by project id, Ask AI by the app's service
# principal (run_as) whether it calls a model service or the shared endpoint.
# The table is account-wide, so the workspace filter matters.
WORKSPACE_ID=$(databricks metastores current --profile "$PROFILE" -o json 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('workspace_id',''))" 2>/dev/null || true)
LAKEBASE_UID=$(databricks postgres get-project "projects/${LAKEBASE_PROJECT}" --profile "$PROFILE" -o json 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('uid',''))" 2>/dev/null || true)

info "DataMarket's cost, at list price, from system.billing.usage."
info "New usage takes a few hours to appear there."
cat <<QUERY

  SELECT u.usage_date,
         CASE u.billing_origin_product
           WHEN 'APPS'     THEN 'App compute'
           WHEN 'LAKEBASE' THEN 'Lakebase'
           ELSE 'Ask AI'
         END AS resource,
         ROUND(SUM(u.usage_quantity), 3)                                   AS dbus,
         ROUND(SUM(u.usage_quantity * p.pricing.effective_list.default), 2) AS usd_list
  FROM system.billing.usage u
  JOIN system.billing.list_prices p
    ON u.sku_name = p.sku_name AND u.cloud = p.cloud AND u.usage_unit = p.usage_unit
   AND u.usage_end_time >= p.price_start_time
   AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
  WHERE u.workspace_id = '${WORKSPACE_ID:-<workspace id>}'
    AND u.usage_date >= current_date() - 30
    AND (u.usage_metadata.app_name = '${APP_NAME}'
         OR u.usage_metadata.project_id = '${LAKEBASE_UID:-<Lakebase project uid>}'
         OR (u.billing_origin_product = 'MODEL_SERVING'
             AND u.identity_metadata.run_as = '${SP_UUID:-<app service principal id>}'))
  GROUP BY ALL
  ORDER BY u.usage_date DESC, dbus DESC;

QUERY
info "Not included: the SQL warehouse, which is shared. DataMarket only runs GRANT/REVOKE"
info "and schema lookups there — see system.query.history WHERE executed_by = the app's service principal."

# ── Ask AI endpoint verification ──────────────────────────────────────────────
step 11 "Setting up Ask AI"

# Optional: give Ask AI its own AI Gateway model service, so its traffic gets
# usage tracking and payload logging separate from everyone else
# using the shared foundation model endpoint. This runs as the deploying admin on
# purpose: creating a service needs CREATE SERVICE, CREATE TABLE and EXECUTE on
# the model, and a model service queries its destination with its owner's
# privileges, so the owner should be a person or admin group, not the app.
# Rate limits and guardrail policies are left to the customer's governance team:
# the right limits depend on their users and budget, and a wrong default throttles
# real users or hides a policy decision inside an install script.
#
# Catalogs are never created: that usually needs metastore admin and, on older
# metastores, a managed storage location. The schema is, since it only needs
# CREATE SCHEMA on a catalog the deployer already uses.
if [[ "$ASK_AI_GATEWAY" == "off" ]]; then
  ASK_AI_GATEWAY=""
  info "Ask AI model service skipped (--ask-ai-gateway off)."
elif [[ "$ASK_AI_GATEWAY" == "auto" ]]; then
  ASK_AI_GATEWAY=""
  EXISTING_ASK_AI=""
  if [[ -n "${PG_CONN:-}" && -n "${PG_TOKEN:-}" && -n "$PSQL_BIN" ]]; then
    EXISTING_ASK_AI=$(PGPASSWORD="$PG_TOKEN" psql "$PG_CONN" -tAX -c \
      "SELECT value FROM \"${LAKEBASE_SCHEMA}\".settings WHERE key = 'ask_ai_endpoint'" 2>/dev/null || true)
  fi
  if [[ -n "$EXISTING_ASK_AI" ]]; then
    info "Ask AI is already set to '${EXISTING_ASK_AI}' in app Settings — leaving it as is."
  else
    ASK_AI_CATALOG=""
    if databricks catalogs get datamarket --profile "$PROFILE" >/dev/null 2>&1; then
      ASK_AI_CATALOG="datamarket"
    else
      ASK_AI_CATALOG=$(databricks api get /api/2.0/settings/types/default_namespace_ws/names/default \
        --profile "$PROFILE" 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('namespace',{}).get('value',''))" 2>/dev/null || true)
      if [[ -z "$ASK_AI_CATALOG" || "$ASK_AI_CATALOG" == "hive_metastore" ]]; then
        ASK_AI_CATALOG=""
        for c in workspace main; do
          if databricks catalogs get "$c" --profile "$PROFILE" >/dev/null 2>&1; then ASK_AI_CATALOG="$c"; break; fi
        done
      fi
    fi
    if [[ -n "$ASK_AI_CATALOG" ]]; then
      ASK_AI_GATEWAY="${ASK_AI_CATALOG}.datamarket_ops"
    else
      warn "No Unity Catalog catalog found for Ask AI's model service — Ask AI uses the shared endpoint."
      info "  Choose one with --ask-ai-gateway CATALOG.SCHEMA, or silence this with --ask-ai-gateway off."
    fi
  fi
fi

if [[ -n "$ASK_AI_GATEWAY" ]]; then
  if [[ ! "$ASK_AI_GATEWAY" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
    warn "--ask-ai-gateway expects CATALOG.SCHEMA, auto or off (got '${ASK_AI_GATEWAY}') — skipping model service setup."
  else
    ASK_AI_SERVICE="${ASK_AI_GATEWAY}.ask_ai"
    ASK_AI_SCHEMA_CREATED=0
    if databricks api get "/api/2.1/unity-catalog/model-services/${ASK_AI_SERVICE}" \
         --profile "$PROFILE" >/dev/null 2>&1; then
      ok "Model service ${ASK_AI_SERVICE} already exists — keeping its current configuration"
      ASK_AI_NEEDS_CREATE=0
    else
      ASK_AI_NEEDS_CREATE=1
      if ! databricks schemas get "$ASK_AI_GATEWAY" --profile "$PROFILE" >/dev/null 2>&1; then
        if databricks schemas create "${ASK_AI_GATEWAY#*.}" "${ASK_AI_GATEWAY%%.*}" --profile "$PROFILE" \
             --comment "DataMarket operational objects: Ask AI model service and its payload logs" >/dev/null 2>&1; then
          ASK_AI_SCHEMA_CREATED=1
          ok "Created schema ${ASK_AI_GATEWAY}"
        else
          warn "Could not create schema ${ASK_AI_GATEWAY} (needs USE CATALOG and CREATE SCHEMA on ${ASK_AI_GATEWAY%%.*})."
          info "  Ask AI uses the shared endpoint. Choose another schema with --ask-ai-gateway CATALOG.SCHEMA."
          ASK_AI_SERVICE=""
          ASK_AI_NEEDS_CREATE=0
        fi
      fi
    fi

    if [[ $ASK_AI_NEEDS_CREATE -eq 1 ]]; then
      info "Creating AI Gateway model service ${ASK_AI_SERVICE} → ${ASK_AI_MODEL}"
      MS_BODY=$(cat <<JSON
{
  "comment": "DataMarket Ask AI: natural-language search over catalog metadata",
  "config": {
    "routing": {"destinations": [{
      "name": "primary",
      "destination_type": "DESTINATION_TYPE_PAY_PER_TOKEN_FOUNDATION_MODEL",
      "pay_per_token_config": {"model": "models/${ASK_AI_MODEL}"},
      "traffic_percentage": 100
    }]},
    "inference_table": {"parent": "schemas/${ASK_AI_GATEWAY}", "table_name_prefix": "ask_ai"}
  }
}
JSON
)
      if MS_OUT=$(databricks api post \
           "/api/2.1/unity-catalog/model-services?parent=schemas/${ASK_AI_GATEWAY}&model_service_id=ask_ai" \
           --profile "$PROFILE" --json "$MS_BODY" 2>&1); then
        ok "Created ${ASK_AI_SERVICE} (payload logging → ${ASK_AI_GATEWAY}.ask_ai_payload)"
        info "  Rate limits and guardrail policies are your governance team's call: Catalog Explorer → the service."
        info "  You own it, and a model service calls the model with its owner's privileges."
        info "  Transfer it to an admin group so Ask AI keeps working if your access changes:"
        info "  Catalog Explorer → ${ASK_AI_SERVICE} → Owner → edit."
      else
        warn "Could not create the model service. Ask AI uses the shared endpoint."
        echo "$MS_OUT" | tail -3 | sed 's/^/    /'
        info "  Needs USE CATALOG, USE SCHEMA, CREATE SERVICE and CREATE TABLE on ${ASK_AI_GATEWAY},"
        info "  and EXECUTE on ${ASK_AI_MODEL}. Model services may also not be available in this workspace."
        info "  Use --ask-ai-gateway off to skip this on future deploys."
        if [[ $ASK_AI_SCHEMA_CREATED -eq 1 ]]; then
          databricks schemas delete "$ASK_AI_GATEWAY" --profile "$PROFILE" >/dev/null 2>&1 \
            && info "  Removed the empty schema ${ASK_AI_GATEWAY} created for it."
        fi
        ASK_AI_SERVICE=""
      fi
    fi

    if [[ -n "$ASK_AI_SERVICE" && -n "$SP_UUID" ]]; then
      GRANT_FAILED=0
      databricks grants update catalog "${ASK_AI_GATEWAY%%.*}" --profile "$PROFILE" \
        --json "{\"changes\":[{\"principal\":\"${SP_UUID}\",\"add\":[\"USE_CATALOG\"]}]}" >/dev/null 2>&1 || GRANT_FAILED=1
      databricks grants update schema "$ASK_AI_GATEWAY" --profile "$PROFILE" \
        --json "{\"changes\":[{\"principal\":\"${SP_UUID}\",\"add\":[\"USE_SCHEMA\"]}]}" >/dev/null 2>&1 || GRANT_FAILED=1
      databricks grants update model_service "$ASK_AI_SERVICE" --profile "$PROFILE" \
        --json "{\"changes\":[{\"principal\":\"${SP_UUID}\",\"add\":[\"EXECUTE\"]}]}" >/dev/null 2>&1 || GRANT_FAILED=1
      [[ $GRANT_FAILED -eq 0 ]] && ok "App service principal granted EXECUTE on ${ASK_AI_SERVICE}" \
        || warn "Some Ask AI grants failed — the check below shows what is missing."
    fi

    if [[ -n "$ASK_AI_SERVICE" ]]; then
      if [[ -n "${PG_CONN:-}" && -n "${PG_TOKEN:-}" && -n "$PSQL_BIN" ]] && \
         PGPASSWORD="$PG_TOKEN" psql "$PG_CONN" -qtAX -c \
           "INSERT INTO \"${LAKEBASE_SCHEMA}\".settings (key, value, updated_at) VALUES ('ask_ai_endpoint', '${ASK_AI_SERVICE}', NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()" >/dev/null 2>&1; then
        ok "Ask AI now points at ${ASK_AI_SERVICE}"
      else
        warn "Could not save the endpoint to app Settings. Set it in the app:"
        info "  Manage → Settings → Ask AI serving endpoint → ${ASK_AI_SERVICE}"
      fi
    fi
  fi
fi

# Ask AI is the one app dependency the steps above do not provision. Pay-per-token
# Foundation Model APIs are not enabled in every workspace or region, so the
# default endpoint can be genuinely absent — surface that here instead of letting
# the first user discover it as an error in the UI. This never fails the deploy:
# Ask AI is optional and the endpoint is changeable in Settings without redeploy.

# On a re-deploy an admin may already have pointed Ask AI at a gateway endpoint,
# which is stored in Lakebase. Probe what the app will actually use, otherwise
# this step would warn about an endpoint the app no longer calls.
ASK_AI_TARGET=""
if [[ -n "${PG_CONN:-}" && -n "${PG_TOKEN:-}" && -n "$PSQL_BIN" ]]; then
  ASK_AI_TARGET=$(PGPASSWORD="$PG_TOKEN" psql "$PG_CONN" -tAX -c \
    "SELECT value FROM \"${LAKEBASE_SCHEMA}\".settings WHERE key = 'ask_ai_endpoint'" 2>/dev/null \
    | tr -d '[:space:]' || true)
  [[ -n "$ASK_AI_TARGET" ]] && info "Using endpoint configured in app Settings: ${ASK_AI_TARGET}"
fi
ASK_AI_TARGET="${ASK_AI_TARGET:-${ASK_AI_SERVICE:-${ASK_AI_ENDPOINT:-databricks-meta-llama-3-3-70b-instruct}}}"

if [[ "$ASK_AI_TARGET" =~ ^[^.]+\.[^.]+\.[^.]+$ ]]; then
  # catalog.schema.service is an AI Gateway model service, a Unity Catalog
  # securable: it is read through the UC API and access is an EXECUTE grant.
  MS_INFO=$(databricks api get "/api/2.1/unity-catalog/model-services/${ASK_AI_TARGET}" \
    --profile "$PROFILE" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
c = d.get('config') or {}
it = c.get('inference_table') or {}
table = (it.get('table') or '').replace('tables/', '') if not it.get('disabled') else ''
policies = [p.get('name', '') for p in c.get('service_policies') or [] if not p.get('is_deleted')]
limits = ', '.join(f\"{r.get('requests')}/{(r.get('renewal_period') or '').rsplit('_', 1)[-1].lower()}\" for r in c.get('rate_limits') or [])
print('\x1f'.join([d.get('name') or '', table, limits, ', '.join(policies)]))
" 2>/dev/null || true)
  IFS=$'\037' read -r MS_NAME MS_TABLE MS_LIMITS MS_POLICIES <<< "$MS_INFO"

  if [[ -z "$MS_NAME" ]]; then
    warn "Ask AI model service '${ASK_AI_TARGET}' was not found, or this profile cannot read it."
    warn "Ask AI will return an error until this is fixed — everything else works."
    info "  Re-run with --ask-ai-gateway CATALOG.SCHEMA to create it, or change"
    info "  Manage → Settings → Ask AI serving endpoint."
  else
    ok "Ask AI uses AI Gateway model service '${ASK_AI_TARGET}'"
    [[ -n "$MS_TABLE"  ]] && ok "Payload logging → ${MS_TABLE}"   || info "Payload logging is off (Catalog Explorer → ${ASK_AI_TARGET} → Inference table)."
    [[ -n "$MS_LIMITS" ]] && ok "Rate limit: ${MS_LIMITS}"        || info "No rate limit configured."
    if [[ -n "$MS_POLICIES" ]]; then
      ok "Guardrail policies: ${MS_POLICIES}"
    else
      info "No guardrail policies yet. Your governance team can add one (for example,"
      info "  block or mask sensitive data) in Catalog Explorer → ${ASK_AI_TARGET} → Policies."
    fi

    SP_EXECUTE=$(databricks grants get model_service "$ASK_AI_TARGET" \
      --profile "$PROFILE" --output json 2>/dev/null \
      | python3 -c "
import sys, json
sp = '''${SP_UUID}'''.strip()
try:
    rows = json.load(sys.stdin).get('privilege_assignments', [])
except Exception:
    rows = []
print('yes' if sp and any(r.get('principal') == sp and 'EXECUTE' in r.get('privileges', []) for r in rows) else 'no')
" 2>/dev/null || echo "no")
    if [[ "$SP_EXECUTE" == "yes" ]]; then
      ok "App service principal has EXECUTE on the model service"
    else
      warn "App service principal does not have a direct EXECUTE grant on '${ASK_AI_TARGET}'."
      warn "Ask AI will likely fail with a permission error. Grant access with:"
      cat <<GRANT

  databricks grants update model_service ${ASK_AI_TARGET} --profile ${PROFILE} \\
    --json '{"changes":[{"principal":"${SP_UUID}","add":["EXECUTE"]}]}'

GRANT
    fi
  fi
else
  # Foundation Model API endpoints are system-managed and carry no "id" — only
  # custom endpoints (including gateway/external-model ones) do. Key off "name"
  # for existence, and treat a missing id as "no per-endpoint ACL to check".
  EP_INFO=$(databricks api get "/api/2.0/serving-endpoints/${ASK_AI_TARGET}" \
    --profile "$PROFILE" 2>/dev/null \
    | python3 -c "
  import sys, json
  try:
      d = json.load(sys.stdin)
  except Exception:
      d = {}
  gw = d.get('ai_gateway') or {}
  feats = [k.replace('_config', '').replace('_', ' ') for k, v in gw.items() if v]
  # Unit separator, not tab: tab is IFS whitespace, so bash would collapse the
  # empty 'id' field of a system endpoint and shift every field after it.
  print('\x1f'.join([
      d.get('name') or '',
      (d.get('state') or {}).get('ready') or '',
      d.get('id') or '',
      ', '.join(sorted(feats)),
  ]))
  " 2>/dev/null || true)
  IFS=$'\037' read -r EP_NAME EP_READY ASK_AI_EP_ID EP_GATEWAY <<< "$EP_INFO"

  if [[ -z "$EP_NAME" ]]; then
    warn "Ask AI endpoint '${ASK_AI_TARGET}' was not found in this workspace."
    warn "Ask AI will return an error until this is changed — everything else works."
    info "  Most likely cause: pay-per-token Foundation Model APIs are not enabled"
    info "  in this workspace or region."
    info "  Fix in the app (no redeploy): Manage → Settings → Ask AI serving endpoint."
    info "  Point it at a Mosaic AI Gateway, provisioned throughput, or external model"
    info "  endpoint. To see what is available here:"
    info "    databricks serving-endpoints list --profile ${PROFILE}"
  else
    if [[ "$EP_READY" == "READY" ]]; then
      ok "Ask AI endpoint '${ASK_AI_TARGET}' exists and is READY"
    else
      warn "Ask AI endpoint '${ASK_AI_TARGET}' exists but is not ready (state: ${EP_READY:-unknown})."
      warn "Ask AI may error until it finishes starting."
    fi

    # Governance visibility: AI Gateway features are configured on the endpoint, so
    # this is the only place the deploy can confirm whether Ask AI traffic is
    # actually governed.
    if [[ -n "$EP_GATEWAY" ]]; then
      ok "Mosaic AI Gateway active on this endpoint: ${EP_GATEWAY}"
    else
      info "No AI Gateway features configured on this endpoint."
      info "  To centrally govern Ask AI traffic (rate limits, payload logging,"
      info "  guardrails), configure AI Gateway on the endpoint in Serving, or point"
      info "  Ask AI at a governed endpoint in Manage → Settings."
    fi

    if [[ -z "$ASK_AI_EP_ID" ]]; then
      # System FMAPI endpoints expose no per-endpoint ACL; access follows workspace
      # entitlements, so there is nothing to verify or grant here.
      info "System-managed endpoint — no per-endpoint permissions to check."
    else
      SP_CAN_QUERY=$(databricks api get "/api/2.0/permissions/serving-endpoints/${ASK_AI_EP_ID}" \
        --profile "$PROFILE" 2>/dev/null \
        | python3 -c "
  import sys, json
  sp = '''${SP_UUID}'''.strip()
  try:
      acl = json.load(sys.stdin).get('access_control_list', [])
  except Exception:
      acl = []
  granted = sp and any(
      e.get('service_principal_name') == sp
      and any(p.get('permission_level') in ('CAN_QUERY', 'CAN_MANAGE', 'IS_OWNER')
              for p in e.get('all_permissions', []))
      for e in acl
  )
  print('yes' if granted else 'no')
  " 2>/dev/null || echo "no")

      if [[ "$SP_CAN_QUERY" == "yes" ]]; then
        ok "App service principal has query access on the endpoint"
      else
        # An inherited or group-based grant can still make this work, so report it
        # as a note with a fix rather than an error — a false alarm on every deploy
        # would teach people to ignore this step.
        warn "App service principal is not listed on this endpoint's permissions."
        warn "Ask AI will likely fail with a permission error. Grant access with:"
        cat <<GRANT

    databricks api patch /api/2.0/permissions/serving-endpoints/${ASK_AI_EP_ID} \\
      --profile ${PROFILE} \\
      --json '{"access_control_list":[{"service_principal_name":"${SP_UUID}","permission_level":"CAN_QUERY"}]}'

GRANT
      fi
    fi
  fi
fi


# The Lakebase binding is the app's lifeline: without it the SP has no Postgres
# role, every query fails, and the UI quietly falls back to the demo persona
# instead of showing an error. It is also easy to destroy by accident, because
# the Apps update API replaces the whole spec — any later call that omits
# `resources` unbinds the database. Re-assert it last, after every step that
# touches the app, so a deploy never ends with a silently broken app.
ensure_lakebase_binding
if [[ "${LAKEBASE_BINDING_CHANGED}" == "true" ]]; then
  warn "The Lakebase binding had been lost and was restored — restarting the app"
  warn "so it picks up a working database credential."
  databricks apps stop  "$APP_NAME" --profile "$PROFILE" >/dev/null 2>&1 || true
  databricks apps start "$APP_NAME" --profile "$PROFILE" >/dev/null 2>&1 || true
fi

APP_URL=$(databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))" 2>/dev/null || true)

echo ""
if [[ "${DEPLOY_FAILED:-0}" == "1" ]]; then
  echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}${BOLD}  Setup complete — but the app deploy FAILED${NC}"
  echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  Lakebase, grants, and permissions are configured. Only the app"
  echo -e "  deployment itself failed — scroll up for the build error, fix it,"
  echo -e "  then re-run this script."
  echo ""
  exit 1
fi
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  DataMarket is live!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
if [[ -n "$APP_URL" ]]; then
  echo -e "  ${BOLD}URL:${NC}   $APP_URL"
fi
echo -e "  ${BOLD}Admin:${NC} $ADMIN_EMAIL"
echo ""
echo -e "  ${YELLOW}Next steps in the app (2 minutes):${NC}"
echo -e "  1. Open the URL and log in"
echo -e "  2. Follow the setup wizard: warehouse, catalog access, import data, Ask AI check"
if [[ -z "$WAREHOUSE_ID" ]]; then
  echo -e "     No warehouse was detected — after setting one in the wizard:"
  echo -e "     SQL Warehouses → your warehouse → Permissions → add the app SP with 'Can use'"
fi
echo ""
