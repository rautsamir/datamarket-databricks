#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DataMarket deploy.sh
# Deploys DataMarket to your Databricks workspace from scratch.
# Usage: ./deploy.sh [options]
#
# Options:
#   --profile     PROFILE        Databricks CLI profile (default: DEFAULT)
#   --admin-email EMAIL          Your email — gets admin role on first login (required)
#   --lakebase-project NAME      Lakebase autoscaling project name (default: datamarket)
#   --app-name    NAME           Databricks App name (default: datamarket)
#   --demo-mode   true|false     Enable persona switcher (default: false)
#   --help                       Show this help
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}▸${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗ ERROR:${NC} $*"; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"; }

TOTAL_STEPS=7

# ── Defaults ─────────────────────────────────────────────────────────────────
PROFILE="DEFAULT"
ADMIN_EMAIL=""
LAKEBASE_PROJECT="datamarket"
APP_NAME="datamarket"
DEMO_MODE="false"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)        PROFILE="$2";         shift 2 ;;
    --admin-email)    ADMIN_EMAIL="$2";     shift 2 ;;
    --lakebase-project) LAKEBASE_PROJECT="$2"; shift 2 ;;
    --app-name)       APP_NAME="$2";        shift 2 ;;
    --demo-mode)      DEMO_MODE="$2";       shift 2 ;;
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

# ── Detect Lakebase ───────────────────────────────────────────────────────────
step 3 "Detecting Lakebase configuration"

LAKEBASE_ENDPOINT="projects/${LAKEBASE_PROJECT}/branches/production/endpoints/primary"
LAKEBASE_HOST=""

info "Looking up Lakebase endpoint: ${LAKEBASE_ENDPOINT}"

# Try to get hostname from the endpoint API
ENDPOINT_JSON=$(databricks api get "2.0/postgres/endpoints/${LAKEBASE_ENDPOINT}" \
  --profile "$PROFILE" 2>/dev/null || echo '{}')
LAKEBASE_HOST=$(echo "$ENDPOINT_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('read_write_dns','') or d.get('dns','') or d.get('hostname',''))" \
  2>/dev/null || true)

if [[ -z "$LAKEBASE_HOST" ]]; then
  warn "Could not auto-detect Lakebase hostname."
  warn "Go to: Compute → Lakebase → ${LAKEBASE_PROJECT} → hostname"
  echo ""
  read -rp "  Paste your Lakebase hostname: " LAKEBASE_HOST
  [[ -z "$LAKEBASE_HOST" ]] && fail "Lakebase hostname is required."
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
    PG_SQL="
CREATE SCHEMA IF NOT EXISTS ${APP_NAME};
GRANT USAGE  ON SCHEMA ${APP_NAME} TO \"${SP_UUID}\";
GRANT CREATE ON SCHEMA ${APP_NAME} TO \"${SP_UUID}\";
DO \$\$
BEGIN
  EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${APP_NAME} TO \"${SP_UUID}\"';
EXCEPTION WHEN others THEN NULL;
END \$\$;
"
    PGPASSWORD="$PG_TOKEN" psql \
      "host=${LAKEBASE_HOST} port=5432 dbname=databricks_postgres sslmode=require user=${DATABRICKS_USER:-${ADMIN_EMAIL}}" \
      -c "$PG_SQL" 2>&1 | grep -v "^$" || warn "psql encountered warnings (may be safe to ignore)"

    ok "Schema grants applied"

    # Redeploy so the app picks up the new permissions and re-runs migrations
    info "Restarting app to apply schema grants..."
    databricks apps deploy "$APP_NAME" \
      --source-code-path "$WORKSPACE_PATH" \
      --profile "$PROFILE" 2>&1 | tail -3
    ok "App restarted"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
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
echo -e "  3. Click Manage → Settings → set your SQL Warehouse ID"
echo ""
