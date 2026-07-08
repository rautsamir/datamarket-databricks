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

TOTAL_STEPS=9

# ── Defaults ─────────────────────────────────────────────────────────────────
PROFILE="DEFAULT"
ADMIN_EMAIL=""
LAKEBASE_PROJECT="datamarket"
APP_NAME="datamarket"
DEMO_MODE="false"
WAREHOUSE_ID=""
GRANT_CATALOGS="true"
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
    --warehouse-id)     WAREHOUSE_ID="$2";     shift 2 ;;
    --grant-catalogs)   GRANT_CATALOGS="$2";   shift 2 ;;
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

command -v databricks >/dev/null 2>&1 || fail "Databricks CLI not found. Install: pip install databricks-cli"
command -v node        >/dev/null 2>&1 || fail "Node.js not found. Install from nodejs.org"
command -v npm         >/dev/null 2>&1 || fail "npm not found."
command -v psql        >/dev/null 2>&1 || fail "psql not found. Install postgresql-client: brew install postgresql"
command -v python3     >/dev/null 2>&1 || fail "python3 not found."
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
  echo ""
  read -rp "  Your email address (becomes the first admin): " ADMIN_EMAIL
  [[ -z "$ADMIN_EMAIL" ]] && fail "ADMIN_EMAIL is required."
fi
ok "Admin: $ADMIN_EMAIL"

# Workspace path — derive from user email or use default
WS_USER="${DATABRICKS_USER:-$ADMIN_EMAIL}"
WS_USER_PATH="${WS_USER//@/%40}"  # URL-encode @ for workspace path display
WORKSPACE_PATH="/Workspace/Users/${WS_USER}/${APP_NAME}"
info "Workspace path: ${WORKSPACE_PATH}"

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

  # Build frontend first (DAB doesn't know how to build Node apps)
  step 3 "Building frontend"
  (cd "$SCRIPT_DIR" && npm install --silent 2>/dev/null && npm run build:local 2>&1 | tail -4)
  ok "Build complete"

  # Ensure app.yaml exists (required in source dir before bundle deploy)
  step 4 "Checking app.yaml"
  if [[ ! -f "${SCRIPT_DIR}/app.yaml" ]]; then
    info "app.yaml not found — generating from values provided..."
    # Discover Lakebase hostname for app.yaml (needed even in bundle mode)
    LAKEBASE_HOST=""
    LAKEBASE_CACHE_FILE="${SCRIPT_DIR}/.lakebase-${APP_NAME}.cache"
    BRANCH_NAME=$(databricks api get "2.0/postgres/autoscaling/projects/${LAKEBASE_PROJECT}/branches" \
      --profile "$PROFILE" 2>/dev/null \
      | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    branches = d.get('branches', d.get('items', []))
    prod = next((b.get('name','') for b in branches if b.get('name','') == 'production'), '')
    first = branches[0].get('name','') if branches else ''
    print(prod or first)
except: print('')
" 2>/dev/null || true)
    if [[ -n "$BRANCH_NAME" ]]; then
      LAKEBASE_ENDPOINT_PATH="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}/endpoints/primary"
      LAKEBASE_HOST=$(databricks api get "2.0/postgres/endpoints/${LAKEBASE_ENDPOINT_PATH}" \
        --profile "$PROFILE" 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('read_write_dns','') or d.get('dns','') or '')" 2>/dev/null || true)
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
    value: "databricks_postgres"
  - name: LAKEBASE_SCHEMA
    value: "${APP_NAME}"
  - name: LAKEBASE_ENDPOINT
    value: "${LAKEBASE_ENDPOINT}"
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
  BRANCH_NAME=$(databricks api get "2.0/postgres/autoscaling/projects/${LAKEBASE_PROJECT}/branches" \
    --profile "$PROFILE" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    branches = d.get('branches', d.get('items', []))
    prod = next((b.get('name','') for b in branches if b.get('name','') == 'production'), '')
    first = branches[0].get('name','') if branches else ''
    print(prod or first)
except: print('')
" 2>/dev/null || true)
  if [[ -n "$BRANCH_NAME" ]]; then
    LAKEBASE_ENDPOINT="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}/endpoints/primary"
    LAKEBASE_HOST=$(databricks api get "2.0/postgres/endpoints/${LAKEBASE_ENDPOINT}" \
      --profile "$PROFILE" 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('read_write_dns','') or d.get('dns','') or '')" 2>/dev/null || true)
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

  # Skip to grants — app is already deployed via bundle
  TOTAL_STEPS=9
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

LAKEBASE_HOST=""
LAKEBASE_ENDPOINT=""
LAKEBASE_CACHE_FILE="${SCRIPT_DIR}/.lakebase-${APP_NAME}.cache"

# Step 1: Try to discover the branch name dynamically (Lakebase uses auto-generated names)
info "Looking up Lakebase project: ${LAKEBASE_PROJECT}"

BRANCH_NAME=$(databricks api get "2.0/postgres/autoscaling/projects/${LAKEBASE_PROJECT}/branches" \
  --profile "$PROFILE" 2>/dev/null \
  | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    branches = d.get('branches', d.get('items', []))
    # Prefer 'production' if it exists, otherwise take the first branch
    prod = next((b.get('name','') for b in branches if b.get('name','') == 'production'), '')
    first = branches[0].get('name','') if branches else ''
    print(prod or first)
except: print('')
" 2>/dev/null || true)

# Step 2: Build endpoint path and try to fetch hostname from API
if [[ -n "$BRANCH_NAME" ]]; then
  LAKEBASE_ENDPOINT="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME}/endpoints/primary"
  info "Found branch: ${BRANCH_NAME} — trying endpoint: ${LAKEBASE_ENDPOINT}"
  ENDPOINT_JSON=$(databricks api get "2.0/postgres/endpoints/${LAKEBASE_ENDPOINT}" \
    --profile "$PROFILE" 2>/dev/null || echo '{}')
  LAKEBASE_HOST=$(echo "$ENDPOINT_JSON" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('read_write_dns','') or d.get('dns','') or d.get('hostname',''))" \
    2>/dev/null || true)
fi

# Step 3: Check local cache (written on first manual entry)
if [[ -z "$LAKEBASE_HOST" && -f "$LAKEBASE_CACHE_FILE" ]]; then
  CACHED_HOST=$(cat "$LAKEBASE_CACHE_FILE" 2>/dev/null || true)
  if [[ -n "$CACHED_HOST" ]]; then
    LAKEBASE_HOST="$CACHED_HOST"
    ok "Lakebase hostname loaded from cache."
  fi
fi

# Step 4: Fallback — prompt the user once and cache the answer
if [[ -z "$LAKEBASE_HOST" ]]; then
  warn "Could not auto-detect Lakebase hostname."
  warn "Go to: Compute → Lakebase → ${LAKEBASE_PROJECT} → Overview → Connection details"
  warn "The hostname looks like: ep-your-project.database.region.azuredatabricks.net"
  echo ""
  read -rp "  Paste your Lakebase hostname: " LAKEBASE_HOST
  [[ -z "$LAKEBASE_HOST" ]] && fail "Lakebase hostname is required."
  # Cache for next run
  echo "$LAKEBASE_HOST" > "$LAKEBASE_CACHE_FILE"
  ok "Hostname saved to cache — won't be asked again."
fi

# If we still don't have the endpoint path, construct a best-guess one for app.yaml
if [[ -z "$LAKEBASE_ENDPOINT" ]]; then
  LAKEBASE_ENDPOINT="projects/${LAKEBASE_PROJECT}/branches/${BRANCH_NAME:-production}/endpoints/primary"
fi

ok "Lakebase host:     $LAKEBASE_HOST"
ok "Lakebase endpoint: $LAKEBASE_ENDPOINT"

# ── Generate app.yaml ─────────────────────────────────────────────────────────
step 4 "Generating app.yaml"

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
    value: "databricks_postgres"
  - name: LAKEBASE_SCHEMA
    value: "${APP_NAME}"
  - name: LAKEBASE_ENDPOINT
    value: "${LAKEBASE_ENDPOINT}"

  # ── Mode ──────────────────────────────────────────────────────────────────
  # false = real SSO identity + UC grants. true = persona switcher (demos only)
  - name: DEMO_MODE
    value: "${DEMO_MODE}"
YAML

ok "app.yaml written to ${APP_YAML_PATH}"

# ── Build frontend ────────────────────────────────────────────────────────────
step 5 "Building frontend"

(cd "$SCRIPT_DIR" && npm install --silent 2>/dev/null && npm run build:local 2>&1 | tail -4)
ok "Build complete"

# ── Upload and deploy ─────────────────────────────────────────────────────────
step 6 "Uploading and deploying to Databricks"

info "Uploading dist/..."
databricks workspace import-dir "${SCRIPT_DIR}/dist" "${WORKSPACE_PATH}/dist" \
  --overwrite --profile "$PROFILE" 2>&1 | tail -2

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

# Upload remaining config files
for f in package.json manifest.yaml app.yaml; do
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

DEPLOY_OUT=$(databricks apps deploy "$APP_NAME" \
  --source-code-path "$WORKSPACE_PATH" \
  --profile "$PROFILE" 2>&1)

if echo "$DEPLOY_OUT" | grep -q '"state":"SUCCEEDED"'; then
  ok "App deployed successfully"
else
  warn "Deploy output:"
  echo "$DEPLOY_OUT" | tail -10
  fail "Deploy did not reach SUCCEEDED state. Check the output above."
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
  echo "  GRANT USAGE  ON SCHEMA ${APP_NAME} TO \"<your-sp-uuid>\";"
  echo "  GRANT CREATE ON SCHEMA ${APP_NAME} TO \"<your-sp-uuid>\";"
  echo ""
  warn "Until this is done, the app will start but data will not persist."
else
  info "Granting schema access to SP: ${SP_UUID}"

  # Generate a short-lived Lakebase token
  PG_TOKEN=$(databricks auth token --profile "$PROFILE" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)

  if [[ -z "$PG_TOKEN" ]]; then
    warn "Could not generate a Lakebase token. Grants skipped — run manually."
  else
    # Step 1: Create schema + run schema.sql (creates all core tables with correct types)
    SCHEMA_SQL="${SCRIPT_DIR}/../../schema/schema.sql"
    PGPASSWORD="$PG_TOKEN" psql \
      "host=${LAKEBASE_HOST} port=5432 dbname=databricks_postgres sslmode=require user=${DATABRICKS_USER:-${ADMIN_EMAIL}}" \
      -c "CREATE SCHEMA IF NOT EXISTS ${APP_NAME};" \
      $( [[ -f "$SCHEMA_SQL" ]] && echo "-f \"$SCHEMA_SQL\"" || true ) \
      2>&1 | grep -v "^$" | grep -v "^NOTICE" || true

    # Step 2: Grant the SP full access
    PGPASSWORD="$PG_TOKEN" psql \
      "host=${LAKEBASE_HOST} port=5432 dbname=databricks_postgres sslmode=require user=${DATABRICKS_USER:-${ADMIN_EMAIL}}" \
      -c "
        GRANT USAGE  ON SCHEMA ${APP_NAME} TO \"${SP_UUID}\";
        GRANT CREATE ON SCHEMA ${APP_NAME} TO \"${SP_UUID}\";
        GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA ${APP_NAME} TO \"${SP_UUID}\";
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${APP_NAME} TO \"${SP_UUID}\";
        ALTER DEFAULT PRIVILEGES IN SCHEMA ${APP_NAME} GRANT ALL ON TABLES    TO \"${SP_UUID}\";
        ALTER DEFAULT PRIVILEGES IN SCHEMA ${APP_NAME} GRANT ALL ON SEQUENCES TO \"${SP_UUID}\";
      " 2>&1 | grep -v "^$" || warn "psql encountered warnings (may be safe to ignore)"

    ok "Schema initialized and grants applied"

    # Step 3: Redeploy so the app starts with a ready database
    info "Restarting app..."
    databricks apps deploy "$APP_NAME" \
      --source-code-path "$WORKSPACE_PATH" \
      --profile "$PROFILE" 2>&1 | tail -3
    ok "App restarted"
  fi
fi

# ── Warehouse SP permission ───────────────────────────────────────────────────
step 8 "Granting SQL Warehouse 'Can use' to app service principal"

if [[ -z "$WAREHOUSE_ID" ]]; then
  warn "No --warehouse-id provided. Skipping warehouse permission grant."
  warn "To automate this, re-run with: --warehouse-id YOUR_WAREHOUSE_ID"
  warn "Or grant manually: SQL Warehouses → your warehouse → Permissions → Add SP"
elif [[ -z "$SP_UUID" ]]; then
  warn "SP UUID not detected — skipping warehouse grant. Grant manually in the UI."
else
  WAREHOUSE_PERM_PAYLOAD="{\"access_control_list\":[{\"service_principal_name\":\"${SP_UUID}\",\"permission_level\":\"CAN_USE\"}]}"
  WAREHOUSE_PERM_RESULT=$(databricks api patch "2.0/permissions/warehouses/${WAREHOUSE_ID}" \
    --profile "$PROFILE" \
    --body "$WAREHOUSE_PERM_PAYLOAD" 2>&1 || echo "error")

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

  CATALOGS=$(databricks api get "2.1/unity-catalog/catalogs" \
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
      # Grant USE CATALOG + USE SCHEMA via SQL warehouse
      GRANT_SQL="GRANT USE CATALOG ON CATALOG \`${CATALOG}\` TO \`${SP_UUID}\`; GRANT USE SCHEMA ON ALL SCHEMAS IN CATALOG \`${CATALOG}\` TO \`${SP_UUID}\`;"
      GRANT_RESULT=$(databricks api post "2.0/sql/statements" \
        --profile "$PROFILE" \
        --body "{\"warehouse_id\":\"${WAREHOUSE_ID}\",\"statement\":\"GRANT USE CATALOG ON CATALOG \`${CATALOG}\` TO \`${SP_UUID}\`\",\"wait_timeout\":\"10s\"}" \
        2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',{}).get('state','UNKNOWN'))" 2>/dev/null || echo "ERROR")

      GRANT_SCHEMA_RESULT=$(databricks api post "2.0/sql/statements" \
        --profile "$PROFILE" \
        --body "{\"warehouse_id\":\"${WAREHOUSE_ID}\",\"statement\":\"GRANT USE SCHEMA ON ALL SCHEMAS IN CATALOG \`${CATALOG}\` TO \`${SP_UUID}\`\",\"wait_timeout\":\"10s\"}" \
        2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',{}).get('state','UNKNOWN'))" 2>/dev/null || echo "ERROR")

      if [[ "$GRANT_RESULT" == "SUCCEEDED" && "$GRANT_SCHEMA_RESULT" == "SUCCEEDED" ]]; then
        ok "  ✓ ${CATALOG} — USE CATALOG + USE SCHEMA granted"
      else
        warn "  ⚠ ${CATALOG} — grant may have failed (${GRANT_RESULT} / ${GRANT_SCHEMA_RESULT}). May lack privileges on this catalog."
        GRANT_ERRORS=$((GRANT_ERRORS + 1))
      fi
    done
    [[ $GRANT_ERRORS -eq 0 ]] && ok "UC catalog grants complete" || warn "${GRANT_ERRORS} catalog(s) could not be granted — check above. These may be restricted catalogs."
  fi
fi


APP_URL=$(databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))" 2>/dev/null || true)

echo ""
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
echo -e "  2. Click Manage → Data Products → Import from UC"
if [[ -z "$WAREHOUSE_ID" ]]; then
  echo -e "  3. Click Manage → Settings → set your SQL Warehouse ID"
  echo -e "     Then: SQL Warehouses → your warehouse → Permissions → add app SP with 'Can use'"
else
  echo -e "  3. Warehouse permission already granted ✓"
fi
echo ""
