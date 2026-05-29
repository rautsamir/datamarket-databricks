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
#   --verbose / -v    Show full output of every command (default: off)
#   --log-file PATH   Where to write the full deployment log (default: /tmp/datamarket-deploy-<ts>.log)
# =============================================================================
set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"; RESET="\033[0m"; DIM="\033[2m"
RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; MAGENTA="\033[35m"

info()    { echo -e "${CYAN}${BOLD}[•]${RESET} $*" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}${BOLD}[✓]${RESET} $*" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}${BOLD}[!]${RESET} $*" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}${BOLD}[✗]${RESET} $*" | tee -a "$LOG_FILE" >&2; exit 1; }
prompt()  { echo -e "${BOLD}${1}${RESET}"; }
debug()   {
  if [[ "$VERBOSE" == "true" ]]; then
    echo -e "${DIM}${MAGENTA}    [dbg] $*${RESET}" | tee -a "$LOG_FILE"
  else
    echo "    [dbg] $*" >> "$LOG_FILE"
  fi
}

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
VERBOSE="false"
LOG_FILE="/tmp/datamarket-deploy-$(date +%Y%m%d-%H%M%S).log"

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
    --verbose|-v)        VERBOSE="true";              shift ;;
    --log-file)          LOG_FILE="$2";               shift 2 ;;
    --help|-h)
      sed -n '/^# Usage/,/^# ===/p' "$0" | head -45
      exit 0 ;;
    *) error "Unknown flag: $1. Run with --help for usage." ;;
  esac
done

# ─── Logging helper ──────────────────────────────────────────────────────────
# run_cmd CMD [ARGS...]
#   Normal mode  — runs CMD, captures output to log, shows nothing on success,
#                  shows captured output only on failure.
#   Verbose mode — runs CMD, tees output to both terminal and log in real time.
run_cmd() {
  local label="${1}"; shift
  debug "Running: $*"
  if [[ "$VERBOSE" == "true" ]]; then
    echo -e "${DIM}    ┌─ output ────────────────────────────────${RESET}"
    "$@" 2>&1 | sed 's/^/    │ /' | tee -a "$LOG_FILE" || {
      echo -e "${DIM}    └─────────────────────────────────────────${RESET}"
      error "$label failed. See $LOG_FILE"
    }
    echo -e "${DIM}    └─────────────────────────────────────────${RESET}"
  else
    local tmp_out
    tmp_out=$(mktemp)
    if ! "$@" >"$tmp_out" 2>&1; then
      cat "$tmp_out" >> "$LOG_FILE"
      echo -e "${RED}${BOLD}[✗]${RESET} $label failed. Output:" | tee -a "$LOG_FILE"
      cat "$tmp_out" | tee -a "$LOG_FILE"
      rm -f "$tmp_out"
      error "See full log: $LOG_FILE"
    fi
    cat "$tmp_out" >> "$LOG_FILE"
    rm -f "$tmp_out"
  fi
}

# run_cmd_tolerant — like run_cmd but non-fatal on failure (returns exit code)
run_cmd_tolerant() {
  local label="${1}"; shift
  debug "Running (tolerant): $*"
  if [[ "$VERBOSE" == "true" ]]; then
    "$@" 2>&1 | sed 's/^/    │ /' | tee -a "$LOG_FILE" || true
  else
    "$@" >> "$LOG_FILE" 2>&1 || true
  fi
}

# ─── Error trap ───────────────────────────────────────────────────────────────
trap 'echo -e "\n${RED}${BOLD}[✗] Deploy failed at line $LINENO.${RESET}\n    Full log: ${LOG_FILE}\n    Share this file when reporting issues." >&2' ERR

# ─── Init log file ────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG_FILE")"
{
  echo "DataMarket deploy log — $(date)"
  echo "Script: $0"
  echo "Args: $*"
  echo "Verbose: $VERBOSE"
  echo "─────────────────────────────────────────"
} > "$LOG_FILE"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  🗂  DataMarket — One-Step Deployment${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
if [[ "$VERBOSE" == "true" ]]; then
  echo -e "  ${MAGENTA}${BOLD}verbose mode on${RESET} — all command output will be shown"
fi
echo -e "  ${DIM}Full log: $LOG_FILE${RESET}"
echo ""

# ─── STEP 0: Prerequisites ────────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v databricks &>/dev/null; then
  error "Databricks CLI not found. Install from https://docs.databricks.com/en/dev-tools/cli/install.html"
fi
CLI_VERSION=$(databricks version 2>/dev/null | head -1)
success "Databricks CLI: $CLI_VERSION"
debug "CLI path: $(command -v databricks)"

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org (>=18)"
fi
NODE_VERSION=$(node --version)
success "Node.js: $NODE_VERSION"
debug "Node path: $(command -v node)"

if ! command -v npm &>/dev/null; then
  error "npm not found. Install Node.js from https://nodejs.org"
fi
debug "npm: $(npm --version)"

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
  debug "psql version: $("$PSQL" --version 2>/dev/null)"
fi

echo ""

# ─── STEP 1: Gather config ────────────────────────────────────────────────────
info "Gathering deployment configuration..."
echo ""

# Profile
if [[ -z "$OPT_PROFILE" ]]; then
  PROFILES=$(grep '^\[' ~/.databrickscfg 2>/dev/null | tr -d '[]' | grep -v 'DEFAULT' || true)
  if [[ -n "$PROFILES" ]]; then
    echo -e "${BOLD}Available Databricks CLI profiles:${RESET}"
    echo "$PROFILES" | nl -w2 -s'. '
    echo ""
  fi
  read -rp "$(prompt 'Databricks CLI profile [DEFAULT]: ')" OPT_PROFILE
  OPT_PROFILE="${OPT_PROFILE:-DEFAULT}"
fi
debug "Profile: $OPT_PROFILE"

# Validate profile / get token
info "Validating authentication (profile: $OPT_PROFILE)..."
TOKEN_JSON=$(databricks auth token --profile "$OPT_PROFILE" 2>&1) || {
  error "Could not get token for profile '$OPT_PROFILE'. Run: databricks auth login --profile $OPT_PROFILE"
}
debug "Token response length: ${#TOKEN_JSON} chars"
DATABRICKS_TOKEN=$(echo "$TOKEN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) || {
  debug "Raw token response: $TOKEN_JSON"
  error "Failed to parse token. Re-authenticate: databricks auth login --profile $OPT_PROFILE"
}
TOKEN_EXPIRY=$(echo "$TOKEN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expiry','unknown'))" 2>/dev/null || true)
success "Auth OK (profile: $OPT_PROFILE)"
debug "Token expires: $TOKEN_EXPIRY"

# Host
if [[ -z "$OPT_HOST" ]]; then
  OPT_HOST=$(grep -A5 "^\[${OPT_PROFILE}\]" ~/.databrickscfg 2>/dev/null | grep '^host' | head -1 | awk '{print $3}' || true)
fi
if [[ -z "$OPT_HOST" ]]; then
  read -rp "$(prompt 'Databricks workspace URL (e.g. https://adb-xxx.azuredatabricks.net): ')" OPT_HOST
fi
OPT_HOST="${OPT_HOST%/}"
success "Workspace: $OPT_HOST"

# Email (auto-detect via SCIM /Me)
if [[ -z "$OPT_EMAIL" ]]; then
  debug "Detecting email via SCIM /Me..."
  DETECTED_EMAIL=$(databricks auth env --profile "$OPT_PROFILE" 2>/dev/null | grep 'DATABRICKS_USERNAME' | cut -d= -f2 | tr -d '"' || true)
  if [[ -z "$DETECTED_EMAIL" ]]; then
    SCIM_RESPONSE=$(curl -s -H "Authorization: Bearer $DATABRICKS_TOKEN" \
      "$OPT_HOST/api/2.0/preview/scim/v2/Me" 2>/dev/null || true)
    debug "SCIM /Me response: $SCIM_RESPONSE"
    DETECTED_EMAIL=$(echo "$SCIM_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('userName',''))" 2>/dev/null || true)
  fi
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

debug "Listing database instances..."
INSTANCES_JSON=$(databricks database list-database-instances --profile "$OPT_PROFILE" 2>/dev/null || echo "[]")
debug "Instances response: $INSTANCES_JSON"

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
debug "Target instance: $OPT_LAKEBASE_INSTANCE"

# Find instance in list
INSTANCE_INFO=$(echo "$INSTANCES_JSON" | python3 -c "
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
  debug "Instance found: $INSTANCE_INFO"
  LAKEBASE_HOST=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('read_write_dns',''))" 2>/dev/null || true)
  IS_STOPPED=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('effective_stopped',False)).lower())" 2>/dev/null || true)
  INSTANCE_STATE=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('state','unknown'))" 2>/dev/null || true)
  IS_PROVISIONED="true"
  debug "Instance state: $INSTANCE_STATE | stopped: $IS_STOPPED | host: $LAKEBASE_HOST"
  if [[ "$IS_STOPPED" == "true" ]]; then
    warn "Instance '$OPT_LAKEBASE_INSTANCE' is stopped. Attempting to start..."
    run_cmd_tolerant "Start instance" databricks database update-database-instance \
      "$OPT_LAKEBASE_INSTANCE" --json '{"stopped": false}' --profile "$OPT_PROFILE"
    sleep 10
  fi
  success "Using existing instance: $OPT_LAKEBASE_INSTANCE"
  debug "Lakebase host: $LAKEBASE_HOST"
else
  debug "Instance '$OPT_LAKEBASE_INSTANCE' not found in list"
  echo ""
  warn "Instance '$OPT_LAKEBASE_INSTANCE' not found."
  read -rp "$(prompt "Create it? [Y/n]: ")" CREATE_CONFIRM
  CREATE_CONFIRM="${CREATE_CONFIRM:-Y}"
  if [[ "$CREATE_CONFIRM" =~ ^[Yy] ]]; then
    info "Creating Lakebase instance '$OPT_LAKEBASE_INSTANCE' (CU_1 provisioned)..."
    debug "Trying: databricks database create-database-instance $OPT_LAKEBASE_INSTANCE --json {capacity:CU_1}"
    run_cmd_tolerant "Create instance (form 1)" \
      databricks database create-database-instance "$OPT_LAKEBASE_INSTANCE" \
        --json '{"capacity": "CU_1"}' --profile "$OPT_PROFILE"
    # Fallback form if CLI expects name in JSON
    run_cmd_tolerant "Create instance (form 2)" \
      databricks database create-database-instance \
        --json "{\"name\": \"${OPT_LAKEBASE_INSTANCE}\", \"capacity\": \"CU_1\"}" \
        --profile "$OPT_PROFILE"

    info "Waiting for instance to become available (up to 2 minutes)..."
    for i in $(seq 1 24); do
      sleep 5
      POLL_JSON=$(databricks database list-database-instances --profile "$OPT_PROFILE" 2>/dev/null || echo "[]")
      STATE=$(echo "$POLL_JSON" | python3 -c "
import sys,json
items=json.load(sys.stdin)
for i in items:
    if i.get('name')=='${OPT_LAKEBASE_INSTANCE}':
        print(i.get('state',''))
        break
" 2>/dev/null || true)
      debug "Poll $i/24: state=$STATE"
      if [[ "$STATE" == "AVAILABLE" ]]; then
        LAKEBASE_HOST=$(echo "$POLL_JSON" | python3 -c "
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
    [[ -z "$LAKEBASE_HOST" ]] && error "Instance did not become available. Check the Databricks UI and re-run."
    success "Instance created: $LAKEBASE_HOST"
  else
    echo ""
    warn "Provide the Lakebase hostname from your Databricks UI (Compute → Lakebase)."
    read -rp "$(prompt 'Lakebase hostname: ')" LAKEBASE_HOST
    [[ -z "$LAKEBASE_HOST" ]] && error "Lakebase hostname is required."
    IS_PROVISIONED="false"
  fi
fi

debug "Final Lakebase: host=$LAKEBASE_HOST db=$OPT_DB schema=$OPT_SCHEMA provisioned=$IS_PROVISIONED"
echo ""

# ─── STEP 3: Database schema + seed ──────────────────────────────────────────
if [[ "$OPT_SEED" != "skip" ]] && [[ -n "$PSQL" ]]; then
  info "Seeding database (mode: $OPT_SEED)..."

  PG_PASSWORD=""
  if [[ "$IS_PROVISIONED" == "true" ]]; then
    info "Generating database credential for provisioned instance..."
    CRED_JSON=$(databricks database generate-database-credential \
      --profile "$OPT_PROFILE" \
      --json "{\"instance_names\": [\"${OPT_LAKEBASE_INSTANCE}\"], \"request_id\": \"deploy-$(date +%s)\"}" \
      2>&1 || true)
    debug "Credential response length: ${#CRED_JSON} chars"
    PG_PASSWORD=$(echo "$CRED_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || true)
    if [[ -z "$PG_PASSWORD" ]]; then
      debug "Credential generation failed: $CRED_JSON"
      warn "Could not generate DB credential — falling back to OAuth token"
    else
      debug "DB credential obtained (length: ${#PG_PASSWORD})"
    fi
  fi
  [[ -z "$PG_PASSWORD" ]] && PG_PASSWORD="$DATABRICKS_TOKEN"

  CONN="host=$LAKEBASE_HOST port=5432 dbname=$OPT_DB user=$OPT_EMAIL sslmode=require"
  debug "Postgres connection: $CONN"

  info "Creating schema '$OPT_SCHEMA'..."
  SCHEMA_OUT=$(PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -c "CREATE SCHEMA IF NOT EXISTS ${OPT_SCHEMA};" 2>&1 || true)
  debug "Schema create output: $SCHEMA_OUT"
  echo "$SCHEMA_OUT" >> "$LOG_FILE"

  if [[ "$OPT_SEED" == "demo" ]]; then
    SQL_FILE="$SCHEMA_DIR/seed.sql"
    info "Running seed.sql (demo data)..."
  else
    SQL_FILE="$SCHEMA_DIR/schema.sql"
    info "Running schema.sql (empty tables)..."
  fi
  debug "SQL file: $SQL_FILE"

  if [[ "$OPT_SCHEMA" != "datamarket" ]]; then
    TEMP_SQL=$(mktemp /tmp/datamarket_deploy_XXXXXX.sql)
    sed "s/SET search_path TO datamarket/SET search_path TO ${OPT_SCHEMA}/g" "$SQL_FILE" > "$TEMP_SQL"
    SQL_FILE="$TEMP_SQL"
    trap "rm -f $TEMP_SQL" EXIT
    debug "Rewrote search_path to $OPT_SCHEMA in temp file: $TEMP_SQL"
  fi

  if [[ "$VERBOSE" == "true" ]]; then
    PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -f "$SQL_FILE" 2>&1 | tee -a "$LOG_FILE" \
      && success "Database seeded" \
      || warn "Seed returned warnings — app will run migrations on first start"
  else
    SEED_OUT=$(PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -f "$SQL_FILE" 2>&1 || true)
    echo "$SEED_OUT" >> "$LOG_FILE"
    debug "Seed output: $SEED_OUT"
    if echo "$SEED_OUT" | grep -qi "error"; then
      warn "Seed script had errors (see log). App migrations will attempt on first start."
      warn "Log: $LOG_FILE"
    else
      success "Database seeded"
    fi
  fi
else
  if [[ "$OPT_SEED" == "skip" ]]; then
    warn "Skipping database seed. Tables will be auto-created when the app first starts."
  fi
fi

echo ""

# ─── STEP 4: Build frontend ───────────────────────────────────────────────────
info "Building frontend..."
cd "$APP_DIR"
debug "App dir: $APP_DIR"

if [[ ! -d dist ]]; then
  info "Running npm install..."
  run_cmd "npm install" npm install --silent
  info "Running vite build..."
  run_cmd "npm build" npm run build:local
  success "Frontend built"
else
  NEWEST_SRC=$(find src -name "*.jsx" -o -name "*.js" -o -name "*.css" 2>/dev/null | \
    xargs stat -f "%m" 2>/dev/null | sort -n | tail -1 || \
    find src -name "*.jsx" -newer dist/index.html 2>/dev/null | head -1)
  if [[ -n "$NEWEST_SRC" ]]; then
    info "Source files changed — rebuilding..."
    run_cmd "npm build" npm run build:local
    success "Frontend rebuilt"
  else
    success "Frontend dist is up to date (skipping rebuild)"
    debug "dist/ is newer than all src/ files"
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

debug "Generated app.yaml:"
cat "$APP_DIR/app.yaml" >> "$LOG_FILE"
success "app.yaml generated"
echo ""

# ─── STEP 6: Upload to workspace ─────────────────────────────────────────────
info "Uploading to workspace: $OPT_WORKSPACE_PATH ..."

for f in app.js app.yaml package.json; do
  [[ -f "$f" ]] || continue
  debug "Uploading $f..."
  run_cmd "Upload $f" databricks workspace import "${OPT_WORKSPACE_PATH}/${f}" \
    --file "$f" --format RAW --overwrite --profile "$OPT_PROFILE"
done
success "Server files uploaded (app.js, app.yaml, package.json)"

DIST_COUNT=0
DIST_ERRORS=0
while IFS= read -r -d '' filepath; do
  relpath="${filepath#./}"
  debug "Uploading $relpath..."
  if ! databricks workspace import "${OPT_WORKSPACE_PATH}/${relpath}" \
      --file "$filepath" --format RAW --overwrite \
      --profile "$OPT_PROFILE" >> "$LOG_FILE" 2>&1; then
    DIST_ERRORS=$((DIST_ERRORS + 1))
    debug "Upload failed for $relpath"
  fi
  DIST_COUNT=$((DIST_COUNT + 1))
done < <(find dist -type f -print0)

if [[ "$DIST_ERRORS" -gt 0 ]]; then
  warn "Frontend assets: $DIST_COUNT files, $DIST_ERRORS upload errors (see $LOG_FILE)"
else
  success "Frontend assets uploaded ($DIST_COUNT files)"
fi
echo ""

# ─── STEP 7: Create or update the Databricks App ─────────────────────────────
info "Deploying Databricks App '$OPT_APP_SLUG'..."

debug "Checking if app '$OPT_APP_SLUG' already exists..."
APP_EXISTS=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)
debug "App exists: '${APP_EXISTS}'"

if [[ -z "$APP_EXISTS" ]]; then
  info "App does not exist yet — creating..."
  run_cmd_tolerant "Create app" databricks apps create "$OPT_APP_SLUG" \
    --source-code-path "$OPT_WORKSPACE_PATH" \
    --profile "$OPT_PROFILE"
fi

info "Running apps deploy (this takes ~30s)..."
databricks apps deploy "$OPT_APP_SLUG" \
  --source-code-path "$OPT_WORKSPACE_PATH" \
  --profile "$OPT_PROFILE" 2>&1 | tee -a "$LOG_FILE"

echo ""

# ─── STEP 8: Done ─────────────────────────────────────────────────────────────
APP_JSON=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" 2>/dev/null || true)
APP_URL=$(echo "$APP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || true)
APP_STATE=$(echo "$APP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('app_status',{}).get('state','unknown'))" 2>/dev/null || true)
debug "App final state: $APP_STATE | url: $APP_URL"

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  ✅  DataMarket deployed successfully!${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
if [[ -n "$APP_URL" ]]; then
  echo -e "  ${BOLD}App URL:${RESET}      $APP_URL"
fi
echo -e "  ${BOLD}App status:${RESET}   $APP_STATE"
echo -e "  ${DIM}Full log:${RESET}     $LOG_FILE"
echo ""
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
