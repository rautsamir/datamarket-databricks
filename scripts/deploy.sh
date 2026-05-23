#!/usr/bin/env bash
# =============================================================================
# DataMarket — One-Step Deployment Script
# =============================================================================
# Deploys the DataMarket portal to any Databricks workspace.
# Handles Lakebase setup, database seeding, frontend build, and app deploy.
#
# Usage (interactive):
#   ./scripts/deploy.sh
#
# Usage (non-interactive / CI):
#   ./scripts/deploy.sh \
#     --profile my-profile \
#     --email you@company.com \
#     --lakebase-instance my-lakebase \
#     --app-slug datamarket \
#     --seed demo
#
# All flags (every flag has an interactive fallback if omitted):
#   --profile         Databricks CLI profile (from ~/.databrickscfg)
#   --host            Databricks workspace URL (auto-detected from profile)
#   --email           Your Databricks login email (Postgres username)
#   --lakebase-instance  Lakebase instance name (will be created if missing)
#   --lakebase-type   "autoscaling" or "provisioned" (default: autoscaling)
#   --db              Postgres database name (default: databricks_postgres)
#   --schema          Postgres schema name (default: datamarket)
#   --app-slug        App name / workspace folder (default: datamarket)
#   --app-name        Portal display name (default: DataMarket)
#   --app-subtitle    Portal tagline (default: "Data Discovery & Access")
#   --workspace-path  Workspace folder (default: /Workspace/Users/<email>/<app-slug>)
#   --seed            "demo" | "schema" | "skip" (default: demo)
#   --demo-mode       "true" | "false" (default: true)
# =============================================================================
set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"; RESET="\033[0m"
RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"

info()    { echo -e "${CYAN}${BOLD}[•]${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[!]${RESET} $*"; }
error()   { echo -e "${RED}${BOLD}[✗]${RESET} $*" >&2; exit 1; }
prompt()  { echo -e "${BOLD}${1}${RESET}"; }

# ─── Script location ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/src/app"
SCHEMA_DIR="$REPO_ROOT/schema"

# ─── Defaults ─────────────────────────────────────────────────────────────────
OPT_PROFILE=""
OPT_HOST=""
OPT_EMAIL=""
OPT_LAKEBASE_INSTANCE=""
OPT_LAKEBASE_TYPE="autoscaling"
OPT_DB="databricks_postgres"
OPT_SCHEMA="datamarket"
OPT_APP_SLUG="datamarket"
OPT_APP_NAME="DataMarket"
OPT_APP_SUBTITLE="Data Discovery & Access"
OPT_WORKSPACE_PATH=""
OPT_SEED="demo"
OPT_DEMO_MODE="true"

# ─── Arg parsing ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)           OPT_PROFILE="$2";           shift 2 ;;
    --host)              OPT_HOST="$2";               shift 2 ;;
    --email)             OPT_EMAIL="$2";              shift 2 ;;
    --lakebase-instance) OPT_LAKEBASE_INSTANCE="$2"; shift 2 ;;
    --lakebase-type)     OPT_LAKEBASE_TYPE="$2";     shift 2 ;;
    --db)                OPT_DB="$2";                 shift 2 ;;
    --schema)            OPT_SCHEMA="$2";             shift 2 ;;
    --app-slug)          OPT_APP_SLUG="$2";           shift 2 ;;
    --app-name)          OPT_APP_NAME="$2";           shift 2 ;;
    --app-subtitle)      OPT_APP_SUBTITLE="$2";       shift 2 ;;
    --workspace-path)    OPT_WORKSPACE_PATH="$2";     shift 2 ;;
    --seed)              OPT_SEED="$2";               shift 2 ;;
    --demo-mode)         OPT_DEMO_MODE="$2";          shift 2 ;;
    --help|-h)
      sed -n '/^# Usage/,/^# ===/p' "$0" | head -40
      exit 0 ;;
    *) error "Unknown flag: $1. Run with --help for usage." ;;
  esac
done

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  🗂  DataMarket — One-Step Deployment${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ─── STEP 0: Prerequisites ────────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v databricks &>/dev/null; then
  error "Databricks CLI not found. Install from https://docs.databricks.com/en/dev-tools/cli/install.html"
fi
success "Databricks CLI: $(databricks version 2>/dev/null | head -1)"

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org (>=18)"
fi
success "Node.js: $(node --version)"

if ! command -v npm &>/dev/null; then
  error "npm not found. Install Node.js from https://nodejs.org"
fi

# Find psql (optional — needed only for seeding)
PSQL=""
for candidate in \
    "$(command -v psql 2>/dev/null)" \
    "/opt/homebrew/opt/postgresql@16/bin/psql" \
    "/opt/homebrew/opt/postgresql@15/bin/psql" \
    "/opt/homebrew/opt/postgresql@14/bin/psql" \
    "/opt/homebrew/bin/psql" \
    "/usr/bin/psql" \
    "/usr/local/bin/psql"; do
  if [[ -x "$candidate" ]]; then
    PSQL="$candidate"
    break
  fi
done

if [[ -z "$PSQL" ]]; then
  warn "psql not found — database seeding will be skipped (tables auto-created on app start)."
  warn "Install with: brew install postgresql@16"
  OPT_SEED="skip"
else
  success "psql: $PSQL"
fi

echo ""

# ─── STEP 1: Gather config ────────────────────────────────────────────────────
info "Gathering deployment configuration..."
echo ""

# Profile
if [[ -z "$OPT_PROFILE" ]]; then
  # List available profiles
  PROFILES=$(grep '^\[' ~/.databrickscfg 2>/dev/null | tr -d '[]' | grep -v 'DEFAULT' || true)
  if [[ -n "$PROFILES" ]]; then
    echo -e "${BOLD}Available Databricks CLI profiles:${RESET}"
    echo "$PROFILES" | nl -w2 -s'. '
    echo ""
  fi
  read -rp "$(prompt 'Databricks CLI profile [DEFAULT]: ')" OPT_PROFILE
  OPT_PROFILE="${OPT_PROFILE:-DEFAULT}"
fi

# Validate profile / get token
info "Validating authentication (profile: $OPT_PROFILE)..."
TOKEN_JSON=$(databricks auth token --profile "$OPT_PROFILE" 2>&1) || {
  error "Could not get token for profile '$OPT_PROFILE'. Run: databricks auth login --profile $OPT_PROFILE"
}
DATABRICKS_TOKEN=$(echo "$TOKEN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) || {
  error "Failed to parse token response. Re-authenticate: databricks auth login --profile $OPT_PROFILE"
}
success "Auth OK (profile: $OPT_PROFILE)"

# Host
if [[ -z "$OPT_HOST" ]]; then
  OPT_HOST=$(grep -A5 "^\[${OPT_PROFILE}\]" ~/.databrickscfg 2>/dev/null | grep '^host' | head -1 | awk '{print $3}' || true)
fi
if [[ -z "$OPT_HOST" ]]; then
  read -rp "$(prompt 'Databricks workspace URL (e.g. https://adb-xxx.azuredatabricks.net): ')" OPT_HOST
fi
OPT_HOST="${OPT_HOST%/}"  # strip trailing slash
success "Workspace: $OPT_HOST"

# Email
if [[ -z "$OPT_EMAIL" ]]; then
  DETECTED_EMAIL=$(databricks auth env --profile "$OPT_PROFILE" 2>/dev/null | grep 'DATABRICKS_USERNAME' | cut -d= -f2 | tr -d '"' || true)
  [[ -z "$DETECTED_EMAIL" ]] && DETECTED_EMAIL=$(curl -s -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    "$OPT_HOST/api/2.0/preview/scim/v2/Me" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('userName',''))" 2>/dev/null || true)
  read -rp "$(prompt "Your Databricks email [${DETECTED_EMAIL:-you@company.com}]: ")" OPT_EMAIL
  OPT_EMAIL="${OPT_EMAIL:-$DETECTED_EMAIL}"
fi
[[ -z "$OPT_EMAIL" ]] && error "Email is required (used as Postgres username)."
success "Email: $OPT_EMAIL"

# App slug
if [[ -z "$OPT_APP_SLUG" ]] || [[ "$OPT_APP_SLUG" == "datamarket" ]]; then
  read -rp "$(prompt 'App name / slug (e.g. datamarket) [datamarket]: ')" INPUT_SLUG
  OPT_APP_SLUG="${INPUT_SLUG:-datamarket}"
fi
OPT_APP_SLUG=$(echo "$OPT_APP_SLUG" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
success "App slug: $OPT_APP_SLUG"

# Branding
if [[ "$OPT_APP_NAME" == "DataMarket" ]]; then
  read -rp "$(prompt 'Portal display name [DataMarket]: ')" INPUT_NAME
  OPT_APP_NAME="${INPUT_NAME:-DataMarket}"
fi
if [[ "$OPT_APP_SUBTITLE" == "Data Discovery & Access" ]]; then
  read -rp "$(prompt 'Portal tagline [Data Discovery & Access]: ')" INPUT_SUB
  OPT_APP_SUBTITLE="${INPUT_SUB:-Data Discovery & Access}"
fi

# Workspace path
if [[ -z "$OPT_WORKSPACE_PATH" ]]; then
  DEFAULT_PATH="/Workspace/Users/${OPT_EMAIL}/${OPT_APP_SLUG}"
  read -rp "$(prompt "Workspace upload path [${DEFAULT_PATH}]: ")" INPUT_PATH
  OPT_WORKSPACE_PATH="${INPUT_PATH:-$DEFAULT_PATH}"
fi
success "Workspace path: $OPT_WORKSPACE_PATH"

echo ""

# ─── STEP 2: Lakebase setup ───────────────────────────────────────────────────
info "Setting up Lakebase..."

# List instances
INSTANCES_JSON=$(databricks database list-database-instances --profile "$OPT_PROFILE" 2>/dev/null || echo "[]")
INSTANCE_NAMES=$(echo "$INSTANCES_JSON" | python3 -c "
import sys,json
items = json.load(sys.stdin)
if isinstance(items, list):
    for i in items: print(i.get('name',''))
" 2>/dev/null || true)

if [[ -z "$OPT_LAKEBASE_INSTANCE" ]]; then
  if [[ -n "$INSTANCE_NAMES" ]]; then
    echo -e "${BOLD}Existing Lakebase instances:${RESET}"
    echo "$INSTANCE_NAMES" | nl -w2 -s'. '
    echo ""
    echo "  Enter a name from the list above, or a new name to create one."
  fi
  read -rp "$(prompt 'Lakebase instance name [datamarket-lakebase]: ')" OPT_LAKEBASE_INSTANCE
  OPT_LAKEBASE_INSTANCE="${OPT_LAKEBASE_INSTANCE:-datamarket-lakebase}"
fi

# Check if instance exists
INSTANCE_INFO=$(echo "$INSTANCES_JSON" | python3 -c "
import sys,json
items = json.load(sys.stdin) if isinstance(json.load(open('/dev/stdin')), list) else []
" 2>/dev/null || echo "$INSTANCES_JSON" | python3 -c "
import sys,json
data=sys.stdin.read()
items=json.loads(data) if data.strip().startswith('[') else []
for i in items:
    if i.get('name') == '${OPT_LAKEBASE_INSTANCE}':
        print(json.dumps(i))
" 2>/dev/null || true)

LAKEBASE_HOST=""
IS_PROVISIONED="false"

if [[ -n "$INSTANCE_INFO" ]]; then
  LAKEBASE_HOST=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('read_write_dns',''))" 2>/dev/null || true)
  IS_STOPPED=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('effective_stopped',False)).lower())" 2>/dev/null || true)
  IS_PROVISIONED="true"
  if [[ "$IS_STOPPED" == "true" ]]; then
    warn "Instance '$OPT_LAKEBASE_INSTANCE' is stopped. Attempting to start..."
    databricks database update-database-instance "$OPT_LAKEBASE_INSTANCE" \
      --json '{"stopped": false}' --profile "$OPT_PROFILE" &>/dev/null || true
    sleep 10
  fi
  success "Using existing provisioned instance: $OPT_LAKEBASE_INSTANCE ($LAKEBASE_HOST)"
else
  # Instance not found — offer to create
  echo ""
  warn "Instance '$OPT_LAKEBASE_INSTANCE' not found."
  read -rp "$(prompt "Create it? [Y/n]: ")" CREATE_CONFIRM
  CREATE_CONFIRM="${CREATE_CONFIRM:-Y}"
  if [[ "$CREATE_CONFIRM" =~ ^[Yy] ]]; then
    info "Creating Lakebase instance '$OPT_LAKEBASE_INSTANCE' (CU_1 provisioned)..."
    databricks database create-database-instance "$OPT_LAKEBASE_INSTANCE" \
      --json '{"capacity": "CU_1"}' --profile "$OPT_PROFILE" &>/dev/null || \
    databricks database create-database-instance \
      --json "{\"name\": \"${OPT_LAKEBASE_INSTANCE}\", \"capacity\": \"CU_1\"}" \
      --profile "$OPT_PROFILE" &>/dev/null || true

    info "Waiting for instance to become available (up to 2 minutes)..."
    for i in $(seq 1 24); do
      sleep 5
      STATE=$(databricks database list-database-instances --profile "$OPT_PROFILE" 2>/dev/null | \
        python3 -c "
import sys,json
items=json.load(sys.stdin)
for i in items:
    if i.get('name')=='${OPT_LAKEBASE_INSTANCE}':
        print(i.get('state',''))
        break
" 2>/dev/null || true)
      if [[ "$STATE" == "AVAILABLE" ]]; then
        LAKEBASE_HOST=$(databricks database list-database-instances --profile "$OPT_PROFILE" 2>/dev/null | \
          python3 -c "
import sys,json
items=json.load(sys.stdin)
for i in items:
    if i.get('name')=='${OPT_LAKEBASE_INSTANCE}':
        print(i.get('read_write_dns',''))
        break
" 2>/dev/null || true)
        IS_PROVISIONED="true"
        break
      fi
      echo -n "."
    done
    echo ""
    [[ -z "$LAKEBASE_HOST" ]] && error "Instance did not become available. Check the Databricks UI."
    success "Instance created: $LAKEBASE_HOST"
  else
    # Autoscaling path — user must provide host manually
    echo ""
    warn "Provide the Lakebase hostname from your Databricks UI (Compute → Lakebase)."
    read -rp "$(prompt 'Lakebase hostname: ')" LAKEBASE_HOST
    [[ -z "$LAKEBASE_HOST" ]] && error "Lakebase hostname is required."
    IS_PROVISIONED="false"
  fi
fi

echo ""

# ─── STEP 3: Database schema + seed ──────────────────────────────────────────
if [[ "$OPT_SEED" != "skip" ]] && [[ -n "$PSQL" ]]; then
  info "Seeding database (mode: $OPT_SEED)..."

  # Get a DB credential (works for both provisioned and autoscaling)
  PG_PASSWORD=""
  if [[ "$IS_PROVISIONED" == "true" ]]; then
    info "Generating database credential for provisioned instance..."
    PG_PASSWORD=$(databricks database generate-database-credential \
      --profile "$OPT_PROFILE" \
      --json "{\"instance_names\": [\"${OPT_LAKEBASE_INSTANCE}\"], \"request_id\": \"deploy-$(date +%s)\"}" \
      2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || true)
  fi
  # Fall back to OAuth token for autoscaling
  [[ -z "$PG_PASSWORD" ]] && PG_PASSWORD="$DATABRICKS_TOKEN"

  CONN="host=$LAKEBASE_HOST port=5432 dbname=$OPT_DB user=$OPT_EMAIL sslmode=require"

  # Create schema
  info "Creating schema '$OPT_SCHEMA'..."
  PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" \
    -c "CREATE SCHEMA IF NOT EXISTS ${OPT_SCHEMA};" &>/dev/null \
    || warn "Schema creation returned a warning (may already exist — continuing)"

  # Run SQL file
  if [[ "$OPT_SEED" == "demo" ]]; then
    SQL_FILE="$SCHEMA_DIR/seed.sql"
    info "Running seed.sql (demo data)..."
  else
    SQL_FILE="$SCHEMA_DIR/schema.sql"
    info "Running schema.sql (empty tables)..."
  fi

  # Replace search_path placeholder if schema is not 'datamarket'
  if [[ "$OPT_SCHEMA" != "datamarket" ]]; then
    TEMP_SQL=$(mktemp /tmp/datamarket_deploy_XXXXXX.sql)
    sed "s/SET search_path TO datamarket/SET search_path TO ${OPT_SCHEMA}/g" "$SQL_FILE" > "$TEMP_SQL"
    SQL_FILE="$TEMP_SQL"
    trap "rm -f $TEMP_SQL" EXIT
  fi

  PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -f "$SQL_FILE" &>/dev/null \
    && success "Database seeded" \
    || warn "Seed script returned warnings (tables may already exist — app will run migrations on start)"
else
  if [[ "$OPT_SEED" == "skip" ]]; then
    warn "Skipping database seed. Tables will be auto-created when the app first starts."
  fi
fi

echo ""

# ─── STEP 4: Build frontend ───────────────────────────────────────────────────
info "Building frontend..."
cd "$APP_DIR"

if [[ ! -d dist ]]; then
  info "Running npm install..."
  npm install --silent
  info "Running vite build..."
  npm run build:local
  success "Frontend built"
else
  # Check if dist is up to date
  NEWEST_SRC=$(find src -name "*.jsx" -o -name "*.js" -o -name "*.css" 2>/dev/null | \
    xargs stat -f "%m" 2>/dev/null | sort -n | tail -1 || \
    find src -name "*.jsx" -newer dist/index.html 2>/dev/null | head -1)
  if [[ -n "$NEWEST_SRC" ]]; then
    info "Source files changed — rebuilding..."
    npm run build:local
    success "Frontend rebuilt"
  else
    success "Frontend dist is up to date (skipping rebuild)"
  fi
fi

echo ""

# ─── STEP 5: Generate app.yaml ────────────────────────────────────────────────
info "Generating app.yaml..."

LAKEBASE_INSTANCE_LINE=""
if [[ "$IS_PROVISIONED" == "true" ]]; then
  LAKEBASE_INSTANCE_LINE="  - name: LAKEBASE_INSTANCE_NAME
    value: \"${OPT_LAKEBASE_INSTANCE}\""
fi

cat > "$APP_DIR/app.yaml" <<YAML
command:
  - "node"
  - "app.js"
env:
  # ── Databricks Identity ─────────────────────────────────────────────────────
  # DATABRICKS_HOST and DATABRICKS_TOKEN are auto-injected by Databricks Apps.
  - name: DATABRICKS_USER
    value: "${OPT_EMAIL}"
  # ── Lakebase Connection ─────────────────────────────────────────────────────
  - name: LAKEBASE_HOST
    value: "${LAKEBASE_HOST}"
  - name: LAKEBASE_DB
    value: "${OPT_DB}"
  - name: LAKEBASE_SCHEMA
    value: "${OPT_SCHEMA}"
${LAKEBASE_INSTANCE_LINE}
  # ── Branding ────────────────────────────────────────────────────────────────
  - name: APP_NAME
    value: "${OPT_APP_NAME}"
  - name: APP_SUBTITLE
    value: "${OPT_APP_SUBTITLE}"
  - name: APP_LOGO_URL
    value: ""
  # ── Deployment Mode ─────────────────────────────────────────────────────────
  # "true"  = persona switcher (demo/POC)
  # "false" = real SSO identity + UC GRANT execution
  - name: DEMO_MODE
    value: "${OPT_DEMO_MODE}"
  # ── Optional: enable real UC GRANT/REVOKE ───────────────────────────────────
  # - name: SQL_WAREHOUSE_ID
  #   value: "your-warehouse-id"
  # ── Optional: enable RFA email/Slack notifications ──────────────────────────
  # - name: RFA_ENABLED
  #   value: "true"
YAML

success "app.yaml generated"
echo ""

# ─── STEP 6: Upload to workspace ─────────────────────────────────────────────
info "Uploading to workspace: $OPT_WORKSPACE_PATH ..."

# Upload app.js and app.yaml
for f in app.js app.yaml package.json; do
  [[ -f "$f" ]] || continue
  databricks workspace import "${OPT_WORKSPACE_PATH}/${f}" \
    --file "$f" --format RAW --overwrite --profile "$OPT_PROFILE" &>/dev/null
done
success "Server files uploaded (app.js, app.yaml, package.json)"

# Upload dist assets
DIST_COUNT=0
while IFS= read -r -d '' filepath; do
  relpath="${filepath#./}"
  databricks workspace import "${OPT_WORKSPACE_PATH}/${relpath}" \
    --file "$filepath" --format RAW --overwrite --profile "$OPT_PROFILE" &>/dev/null || true
  DIST_COUNT=$((DIST_COUNT + 1))
done < <(find dist -type f -print0)
success "Frontend assets uploaded ($DIST_COUNT files)"
echo ""

# ─── STEP 7: Create or update the Databricks App ─────────────────────────────
info "Deploying Databricks App '$OPT_APP_SLUG'..."

# Check if app exists
APP_EXISTS=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)

if [[ -z "$APP_EXISTS" ]]; then
  info "App does not exist yet — creating..."
  databricks apps create "$OPT_APP_SLUG" \
    --source-code-path "$OPT_WORKSPACE_PATH" \
    --profile "$OPT_PROFILE" &>/dev/null \
    || warn "App create returned a warning — proceeding to deploy"
fi

# Deploy
databricks apps deploy "$OPT_APP_SLUG" \
  --source-code-path "$OPT_WORKSPACE_PATH" \
  --profile "$OPT_PROFILE"

echo ""

# ─── STEP 8: Done ─────────────────────────────────────────────────────────────
APP_URL=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || true)

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  ✅  DataMarket deployed successfully!${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
if [[ -n "$APP_URL" ]]; then
  echo -e "  ${BOLD}App URL:${RESET} $APP_URL"
  echo ""
fi
echo -e "  ${BOLD}Next steps:${RESET}"
echo "  1. Open the app URL above and log in"
echo "  2. Switch to the Admin persona (top-right dropdown)"
echo "  3. Go to Discover → click 'Import from Unity Catalog' to populate"
echo "     your catalog, or click 'Register a Product' to add manually"
echo ""
echo -e "  ${BOLD}Optional customizations (src/app/app.yaml):${RESET}"
echo "  • SQL_WAREHOUSE_ID   → enable real UC GRANT/REVOKE"
echo "  • RFA_ENABLED=true   → enable access request email/Slack notifications"
echo "  • DEMO_MODE=false    → use real SSO identity instead of persona switcher"
echo ""
