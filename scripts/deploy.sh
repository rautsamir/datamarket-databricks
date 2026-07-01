#!/usr/bin/env bash
# =============================================================================
# DataMarket — One-Step Deployment Script
# =============================================================================
# Deploys the DataMarket portal to any Databricks workspace (Lakebase Autoscaling).
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
# Flags:
#   --profile         Databricks CLI profile (from ~/.databrickscfg)
#   --host            Workspace URL (auto-detected from profile)
#   --email           Your Databricks login email (Postgres username)
#   --lakebase-instance  Lakebase instance name to look up or create (Provisioned)
#   --lakebase-host      Direct hostname override, e.g. ep-foo.database.eastus2.azuredatabricks.net
#                        Use this for Autoscaling instances — skips instance lookup entirely
#   --lakebase-endpoint  Autoscaling endpoint resource name (required for Databricks Apps), e.g.
#                        projects/my-project/branches/production/endpoints/ep-my-project-abc123
#   --db              Postgres database name (default: databricks_postgres)
#   --schema          Postgres schema name (default: datamarket)
#   --app-slug        App name / workspace folder (default: datamarket)
#   --workspace-path  Workspace folder (default: /Workspace/Users/<email>/<app-slug>)
#   --seed            "demo" | "schema" | "skip" (default: demo)
#   --demo-mode       "true" | "false" (default: true)
#   --verbose / -v    Show full output of every command (default: off)
#   --log-file PATH   Where to write the full deployment log (default: /tmp/datamarket-deploy-<ts>.log)
#
# Branding (portal name, tagline, logo) is configured via Admin → Settings in the
# app itself — no flags needed here and no redeploy required when you change them.
# =============================================================================
set -euo pipefail

# Strip Windows-style carriage returns from any variable value
strip_cr() { echo "${1//$'\r'/}"; }

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
OPT_LAKEBASE_HOST=""    # Direct hostname override — skips instance lookup entirely
OPT_LAKEBASE_ENDPOINT="" # Autoscaling endpoint resource name for Apps auth
OPT_DB="databricks_postgres"
OPT_SCHEMA="datamarket"
OPT_APP_SLUG=""
OPT_WORKSPACE_PATH=""
OPT_SEED="demo"
OPT_DEMO_MODE=""   # Will prompt in interactive mode; defaults to "true" if unset
OPT_PAT=""
VERBOSE="false"
LOG_FILE="/tmp/datamarket-deploy-$(date +%Y%m%d-%H%M%S).log"

# Detect interactive mode (stdin is a real TTY)
INTERACTIVE=false
[[ -t 0 ]] && INTERACTIVE=true || true

# ─── Arg parsing ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)           OPT_PROFILE="$2";           shift 2 ;;
    --host)              OPT_HOST="$2";               shift 2 ;;
    --email)             OPT_EMAIL="$2";              shift 2 ;;
    --lakebase-instance) OPT_LAKEBASE_INSTANCE="$2"; shift 2 ;;
    --lakebase-host)     OPT_LAKEBASE_HOST="$2";     shift 2 ;;
    --lakebase-endpoint) OPT_LAKEBASE_ENDPOINT="$2"; shift 2 ;;
    --db)                OPT_DB="$2";                 shift 2 ;;
    --schema)            OPT_SCHEMA="$2";             shift 2 ;;
    --app-slug)          OPT_APP_SLUG="$2";           shift 2 ;;
    --workspace-path)    OPT_WORKSPACE_PATH="$2";     shift 2 ;;
    --seed)              OPT_SEED="$2";               shift 2 ;;
    --demo-mode)         OPT_DEMO_MODE="$2";          shift 2 ;;
    --pat)               OPT_PAT="$2";                shift 2 ;;
    --verbose|-v)        VERBOSE="true";              shift ;;
    --log-file)          LOG_FILE="$2";               shift 2 ;;
    --help|-h)
      sed -n '/^# Usage/,/^# Branding/p' "$0" | head -30
      exit 0 ;;
    # Compatibility shims — silently ignore deprecated flags
    --lakebase-type|--app-name|--app-subtitle) shift 2 ;;
    *) error "Unknown flag: $1. Run with --help for usage." ;;
  esac
done

# Strip accidental user@ / password@ prefix copied from Lakebase connection strings
if [[ -n "$OPT_LAKEBASE_HOST" && "$OPT_LAKEBASE_HOST" == *@* ]]; then
  warn "Stripping prefix from --lakebase-host (use hostname only, e.g. ep-....database....azuredatabricks.net)"
  OPT_LAKEBASE_HOST="${OPT_LAKEBASE_HOST##*@}"
fi

# ─── Logging helper ──────────────────────────────────────────────────────────
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
  error "Databricks CLI not found. Install: brew tap databricks/tap && brew install databricks"
fi
CLI_VERSION=$(databricks version 2>/dev/null | head -1)
success "Databricks CLI: $CLI_VERSION"

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install: brew install node"
fi
success "Node.js: $(node --version)"

if ! command -v npm &>/dev/null; then
  error "npm not found. Install Node.js: brew install node"
fi

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
  warn "psql not found — database seeding will be skipped. Install: brew install postgresql@16"
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
  if [[ "$INTERACTIVE" == "true" ]]; then
    PROFILES=$(grep '^\[' ~/.databrickscfg 2>/dev/null | tr -d '[]' | grep -v 'DEFAULT' || true)
    if [[ -n "$PROFILES" ]]; then
      echo -e "${BOLD}Available Databricks CLI profiles:${RESET}"
      echo "$PROFILES" | nl -w2 -s'. '
      echo ""
    fi
    read -rp "$(prompt 'Databricks CLI profile [DEFAULT]: ')" OPT_PROFILE
    OPT_PROFILE="$(strip_cr "$OPT_PROFILE")"
  fi
  OPT_PROFILE="${OPT_PROFILE:-DEFAULT}"
fi
debug "Profile: $OPT_PROFILE"

# Validate profile / get token
info "Validating authentication (profile: $OPT_PROFILE)..."
TOKEN_JSON=$(databricks auth token --profile "$OPT_PROFILE" 2>&1) || {
  error "Could not get token for profile '$OPT_PROFILE'. Run: databricks auth login --profile $OPT_PROFILE"
}
DATABRICKS_TOKEN=$(echo "$TOKEN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) || {
  error "Failed to parse token. Re-authenticate: databricks auth login --profile $OPT_PROFILE"
}
success "Auth OK (profile: $OPT_PROFILE)"

# Host
if [[ -z "$OPT_HOST" ]]; then
  OPT_HOST=$(grep -A5 "^\[${OPT_PROFILE}\]" ~/.databrickscfg 2>/dev/null | grep '^host' | head -1 | awk '{print $3}' || true)
fi
if [[ -z "$OPT_HOST" ]]; then
  if [[ "$INTERACTIVE" == "true" ]]; then
    read -rp "$(prompt 'Databricks workspace URL (e.g. https://adb-xxx.azuredatabricks.net): ')" OPT_HOST
    OPT_HOST="$(strip_cr "$OPT_HOST")"
  fi
  [[ -z "$OPT_HOST" ]] && error "Could not detect workspace URL. Pass --host explicitly."
fi
OPT_HOST="${OPT_HOST%/}"
success "Workspace: $OPT_HOST"

# Email (auto-detect)
if [[ -z "$OPT_EMAIL" ]]; then
  DETECTED_EMAIL=$(databricks auth env --profile "$OPT_PROFILE" 2>/dev/null | grep 'DATABRICKS_USERNAME' | cut -d= -f2 | tr -d '"' || true)
  if [[ -z "$DETECTED_EMAIL" ]]; then
    SCIM_RESPONSE=$(curl -s -H "Authorization: Bearer $DATABRICKS_TOKEN" \
      "$OPT_HOST/api/2.0/preview/scim/v2/Me" 2>/dev/null || true)
    DETECTED_EMAIL=$(echo "$SCIM_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('userName',''))" 2>/dev/null || true)
  fi
  if [[ "$INTERACTIVE" == "true" ]]; then
    read -rp "$(prompt "Your Databricks email [${DETECTED_EMAIL:-you@company.com}]: ")" OPT_EMAIL
    OPT_EMAIL="$(strip_cr "$OPT_EMAIL")"
  fi
  OPT_EMAIL="${OPT_EMAIL:-$DETECTED_EMAIL}"
fi
[[ -z "$OPT_EMAIL" ]] && error "Email is required (used as Postgres username)."
success "Email: $OPT_EMAIL"

# App slug
if [[ -z "$OPT_APP_SLUG" ]]; then
  if [[ "$INTERACTIVE" == "true" ]]; then
    read -rp "$(prompt 'App name / slug (e.g. datamarket) [datamarket]: ')" INPUT_SLUG
    INPUT_SLUG="$(strip_cr "$INPUT_SLUG")"
  fi
  OPT_APP_SLUG="${INPUT_SLUG:-datamarket}"
fi
OPT_APP_SLUG=$(echo "$OPT_APP_SLUG" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
success "App slug: $OPT_APP_SLUG"

# Workspace path
if [[ -z "$OPT_WORKSPACE_PATH" ]]; then
  DEFAULT_PATH="/Workspace/Users/${OPT_EMAIL}/${OPT_APP_SLUG}"
  if [[ "$INTERACTIVE" == "true" ]]; then
    read -rp "$(prompt "Workspace upload path [${DEFAULT_PATH}]: ")" INPUT_PATH
    INPUT_PATH="$(strip_cr "$INPUT_PATH")"
  fi
  OPT_WORKSPACE_PATH="${INPUT_PATH:-$DEFAULT_PATH}"
fi
success "Workspace path: $OPT_WORKSPACE_PATH"

# Deployment mode
if [[ -z "$OPT_DEMO_MODE" ]]; then
  if [[ "$INTERACTIVE" == "true" ]]; then
    read -rp "$(prompt 'Deployment mode — demo (persona switcher) or production (real SSO)? [demo]: ')" INPUT_MODE
    INPUT_MODE="$(strip_cr "$INPUT_MODE")"
    [[ "$INPUT_MODE" =~ ^[Pp]rod ]] && OPT_DEMO_MODE="false" || OPT_DEMO_MODE="true"
  else
    OPT_DEMO_MODE="true"
    warn "DEMO_MODE defaulting to 'true'. Pass --demo-mode false for a production deployment."
  fi
fi
success "Mode: $([ "$OPT_DEMO_MODE" = "true" ] && echo 'Demo (persona switcher)' || echo 'Production (real SSO + UC grants)')"

echo ""

# ─── STEP 2: Lakebase setup ───────────────────────────────────────────────────
info "Setting up Lakebase..."

LAKEBASE_HOST=""

# ── Fast path: hostname provided directly ──────────────────────────────────
if [[ -n "$OPT_LAKEBASE_HOST" ]]; then
  LAKEBASE_HOST="$OPT_LAKEBASE_HOST"
  success "Using provided Lakebase host: $LAKEBASE_HOST"
else
  # ── Discover via CLI (Provisioned instances only) ──────────────────────────
  debug "Listing database instances..."
  INSTANCES_JSON=$(databricks database list-database-instances --profile "$OPT_PROFILE" 2>/dev/null || echo "[]")

  INSTANCE_NAMES=$(echo "$INSTANCES_JSON" | python3 -c "
import sys,json
items = json.load(sys.stdin)
if isinstance(items, list):
    for i in items: print(i.get('name',''))
" 2>/dev/null || true)

  if [[ -z "$OPT_LAKEBASE_INSTANCE" ]]; then
    if [[ "$INTERACTIVE" == "true" ]]; then
      if [[ -n "$INSTANCE_NAMES" ]]; then
        echo -e "${BOLD}Existing Lakebase instances:${RESET}"
        echo "$INSTANCE_NAMES" | nl -w2 -s'. '
        echo ""
        echo "  Enter a name from the list above, or a new name to create one."
        echo "  TIP: For Autoscaling instances (ep-*), use --lakebase-host <hostname> instead."
      fi
      read -rp "$(prompt 'Lakebase instance name [datamarket-lakebase]: ')" OPT_LAKEBASE_INSTANCE
      OPT_LAKEBASE_INSTANCE="$(strip_cr "$OPT_LAKEBASE_INSTANCE")"
    fi
    OPT_LAKEBASE_INSTANCE="${OPT_LAKEBASE_INSTANCE:-datamarket-lakebase}"
  fi
  debug "Target instance: $OPT_LAKEBASE_INSTANCE"

  # Find instance in list
  INSTANCE_INFO=$(echo "$INSTANCES_JSON" | python3 -c "
import sys,json
items=json.load(sys.stdin)
if not isinstance(items, list): items=[]
for i in items:
    if i.get('name') == '${OPT_LAKEBASE_INSTANCE}':
        print(json.dumps(i))
" 2>/dev/null || true)

  if [[ -n "$INSTANCE_INFO" ]]; then
    LAKEBASE_HOST=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('read_write_dns',''))" 2>/dev/null || true)
    INSTANCE_STATE=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('state','unknown'))" 2>/dev/null || true)
    IS_STOPPED=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('effective_stopped',False)).lower())" 2>/dev/null || true)
    debug "Instance state: $INSTANCE_STATE | stopped: $IS_STOPPED"
    if [[ "$IS_STOPPED" == "true" ]]; then
      warn "Instance '$OPT_LAKEBASE_INSTANCE' is stopped. Attempting to start..."
      run_cmd_tolerant "Start instance" databricks database update-database-instance \
        "$OPT_LAKEBASE_INSTANCE" --json '{"stopped": false}' --profile "$OPT_PROFILE"
      sleep 10
    fi
    success "Using existing instance: $OPT_LAKEBASE_INSTANCE ($LAKEBASE_HOST)"
  else
    warn "Instance '$OPT_LAKEBASE_INSTANCE' not found — creating it..."
    CREATE_CONFIRM="Y"
    if [[ "$INTERACTIVE" == "true" ]]; then
      read -rp "$(prompt "Create it? [Y/n]: ")" CREATE_CONFIRM
      CREATE_CONFIRM="$(strip_cr "${CREATE_CONFIRM:-Y}")"
    fi
    if [[ "$CREATE_CONFIRM" =~ ^[Yy] ]]; then
      info "Creating Lakebase Autoscaling instance '$OPT_LAKEBASE_INSTANCE'..."
      run_cmd_tolerant "Create instance (positional)" \
        databricks database create-database-instance "$OPT_LAKEBASE_INSTANCE" \
          --json '{}' --profile "$OPT_PROFILE"
      run_cmd_tolerant "Create instance (JSON body)" \
        databricks database create-database-instance \
          --json "{\"name\": \"${OPT_LAKEBASE_INSTANCE}\"}" \
          --profile "$OPT_PROFILE"

      info "Waiting for instance to become available (up to 3 minutes)..."
      for i in $(seq 1 36); do
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
        debug "Poll $i/36: state=$STATE"
        if [[ "$STATE" == "AVAILABLE" ]]; then
          LAKEBASE_HOST=$(echo "$POLL_JSON" | python3 -c "
import sys,json
items=json.load(sys.stdin)
for i in items:
    if i.get('name')=='${OPT_LAKEBASE_INSTANCE}':
        print(i.get('read_write_dns',''))
        break
" 2>/dev/null || true)
          break
        fi
        echo -n "."
      done
      echo ""
      [[ -z "$LAKEBASE_HOST" ]] && error "Instance did not become available. Check the Databricks UI and re-run."
      success "Instance created: $LAKEBASE_HOST"
    else
      if [[ "$INTERACTIVE" == "true" ]]; then
        read -rp "$(prompt 'Lakebase hostname: ')" LAKEBASE_HOST
        LAKEBASE_HOST="$(strip_cr "$LAKEBASE_HOST")"
      fi
      [[ -z "$LAKEBASE_HOST" ]] && error "Lakebase hostname required. Pass --lakebase-host <ep-...> or --lakebase-instance <name>."
    fi
  fi
fi

# Auto-discover Autoscaling endpoint resource name (required for Databricks Apps runtime auth)
if [[ -n "$LAKEBASE_HOST" && -z "$OPT_LAKEBASE_ENDPOINT" && "$LAKEBASE_HOST" == ep-* ]]; then
  info "Looking up LAKEBASE_ENDPOINT for Apps auth..."
  OPT_LAKEBASE_ENDPOINT=$(python3 - "$LAKEBASE_HOST" "$OPT_PROFILE" <<'PY' 2>/dev/null || true
import json, subprocess, sys
target = sys.argv[1]
profile = sys.argv[2]

def run(*args):
    return subprocess.check_output(
        list(args) + ["-o", "json", "--profile", profile],
        text=True,
        stderr=subprocess.DEVNULL,
    )

try:
    projects = json.loads(run("databricks", "postgres", "list-projects"))
except Exception:
    sys.exit(0)
if not isinstance(projects, list):
    sys.exit(0)

for proj in projects:
    project_name = proj.get("name") or ""
    if not project_name:
        continue
    try:
        branches = json.loads(run("databricks", "postgres", "list-branches", project_name))
    except Exception:
        continue
    if not isinstance(branches, list):
        continue
    for branch in branches:
        branch_name = branch.get("name") or ""
        if not branch_name:
            continue
        try:
            endpoints = json.loads(run("databricks", "postgres", "list-endpoints", branch_name))
        except Exception:
            continue
        if not isinstance(endpoints, list):
            continue
        for ep in endpoints:
            ep_name = ep.get("name") or ""
            if not ep_name:
                continue
            try:
                detail = json.loads(run("databricks", "postgres", "get-endpoint", ep_name))
            except Exception:
                continue
            host = ((detail.get("status") or {}).get("hosts") or {}).get("host") or ""
            if host == target:
                print(ep_name)
                sys.exit(0)
PY
  )
  if [[ -n "$OPT_LAKEBASE_ENDPOINT" ]]; then
    success "Resolved LAKEBASE_ENDPOINT: $OPT_LAKEBASE_ENDPOINT"
  else
    warn "Could not auto-resolve LAKEBASE_ENDPOINT — pass --lakebase-endpoint for Databricks Apps Lakebase auth"
    warn "  databricks postgres list-endpoints projects/<project>/branches/production --profile $OPT_PROFILE"
  fi
fi

debug "Final Lakebase: host=$LAKEBASE_HOST endpoint=${OPT_LAKEBASE_ENDPOINT:-<none>} db=$OPT_DB schema=$OPT_SCHEMA"

# ─── STEP 3: Database schema + seed ──────────────────────────────────────────
if [[ "$OPT_SEED" != "skip" ]] && [[ -n "$PSQL" ]]; then
  info "Seeding database (mode: $OPT_SEED)..."

  # Autoscaling: use token directly as Postgres password
  PG_PASSWORD="$DATABRICKS_TOKEN"

  CONN="host=$LAKEBASE_HOST port=5432 dbname=$OPT_DB user=$OPT_EMAIL sslmode=require"

  info "Creating schema '$OPT_SCHEMA'..."
  SCHEMA_OUT=$(PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -c "CREATE SCHEMA IF NOT EXISTS ${OPT_SCHEMA};" 2>&1 || true)
  echo "$SCHEMA_OUT" >> "$LOG_FILE"
  debug "Schema create: $SCHEMA_OUT"

  if [[ "$OPT_SEED" == "demo" ]]; then
    SQL_FILE="$SCHEMA_DIR/seed.sql"
    info "Running seed.sql (demo data)..."
  else
    SQL_FILE="$SCHEMA_DIR/schema.sql"
    info "Running schema.sql (empty tables)..."
  fi

  if [[ "$OPT_SCHEMA" != "datamarket" ]]; then
    TEMP_SQL=$(mktemp /tmp/datamarket_deploy_XXXXXX.sql)
    sed "s/SET search_path TO datamarket/SET search_path TO ${OPT_SCHEMA}/g" "$SQL_FILE" > "$TEMP_SQL"
    SQL_FILE="$TEMP_SQL"
    trap "rm -f $TEMP_SQL" EXIT
  fi

  if [[ "$VERBOSE" == "true" ]]; then
    PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -f "$SQL_FILE" 2>&1 | tee -a "$LOG_FILE" \
      && success "Database seeded" \
      || warn "Seed returned warnings — app will run migrations on first start"
  else
    SEED_OUT=$(PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -f "$SQL_FILE" 2>&1 || true)
    echo "$SEED_OUT" >> "$LOG_FILE"
    if echo "$SEED_OUT" | grep -qi "error"; then
      warn "Seed script had errors (see log). App migrations will attempt on first start."
    else
      success "Database seeded"
    fi
  fi
else
  [[ "$OPT_SEED" == "skip" ]] && warn "Skipping database seed. Tables auto-created when app first starts."
fi

echo ""

# ─── STEP 4: Build frontend ───────────────────────────────────────────────────
info "Building frontend..."
cd "$APP_DIR"

if [[ ! -x node_modules/.bin/vite ]]; then
  info "Installing npm dependencies..."
  run_cmd "npm install" npm install --silent
fi

if [[ ! -d dist ]]; then
  info "Building frontend..."
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
  fi
fi

echo ""

# ─── STEP 5: Generate app.yaml ────────────────────────────────────────────────
info "Generating app.yaml..."

cat > "$APP_DIR/app.yaml" <<YAML
command:
  - "node"
  - "app.js"
env:
  # ── Databricks Identity ──────────────────────────────────────────────────────
  # DATABRICKS_TOKEN is auto-injected by Databricks Apps at runtime (OAuth JWT).
  # For UC Import on Azure, pass --pat (stored as DATABRICKS_API_TOKEN — not used for Lakebase).
  - name: DATABRICKS_HOST
    value: "${OPT_HOST}"
  - name: DATABRICKS_USER
    value: "${OPT_EMAIL}"
  # ── Admin — deployer gets admin role on first SSO login ─────────────────────
  # Comma-separated list of emails. Add more admins without redeploying via Admin → Users.
  - name: ADMIN_EMAIL
    value: "${OPT_EMAIL}"
$(if [[ -n "$OPT_PAT" ]]; then printf "  - name: DATABRICKS_API_TOKEN\n    value: \"%s\"\n" "$OPT_PAT"; fi)
  # ── Lakebase Connection ──────────────────────────────────────────────────────
  - name: LAKEBASE_HOST
    value: "${LAKEBASE_HOST}"
  - name: LAKEBASE_DB
    value: "${OPT_DB}"
  - name: LAKEBASE_SCHEMA
    value: "${OPT_SCHEMA}"
$(if [[ -n "$OPT_LAKEBASE_ENDPOINT" ]]; then
  printf "  - name: LAKEBASE_ENDPOINT\n    value: \"%s\"\n" "$OPT_LAKEBASE_ENDPOINT"
fi)
$(if [[ "$LAKEBASE_HOST" == instance-* ]]; then
  printf "  # Provisioned instance — app generates short-lived DB credentials via REST API.\n"
  printf "  - name: LAKEBASE_INSTANCE_NAME\n    value: \"%s\"\n" "$OPT_LAKEBASE_INSTANCE"
else
  printf "  # Autoscaling — Apps use LAKEBASE_ENDPOINT + service principal credential API.\n"
fi)
  # ── Mode ────────────────────────────────────────────────────────────────────
  # "true"  = persona switcher (demo/POC)
  # "false" = real SSO identity + UC GRANT execution
  - name: DEMO_MODE
    value: "${OPT_DEMO_MODE}"
  # ── Branding & integrations are configured via Admin → Settings in the app ──
  # (portal name, tagline, logo, Genie Space ID, SQL Warehouse ID, RFA toggle)
YAML

debug "Generated app.yaml"
success "app.yaml generated"
echo ""

# ─── STEP 6: Upload to workspace ─────────────────────────────────────────────
info "Uploading to workspace: $OPT_WORKSPACE_PATH ..."

run_cmd "mkdirs root" databricks workspace mkdirs "$OPT_WORKSPACE_PATH" --profile "$OPT_PROFILE"
run_cmd "mkdirs dist" databricks workspace mkdirs "${OPT_WORKSPACE_PATH}/dist" --profile "$OPT_PROFILE"
run_cmd "mkdirs assets" databricks workspace mkdirs "${OPT_WORKSPACE_PATH}/dist/assets" --profile "$OPT_PROFILE"

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

APP_EXISTS=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)

if [[ -z "$APP_EXISTS" ]]; then
  info "App does not exist yet — creating (waits ~2 min for compute)..."
  run_cmd "Create app" databricks apps create "$OPT_APP_SLUG" --profile "$OPT_PROFILE"
  success "App created"
fi

info "Waiting for app compute to be ready..."
for i in $(seq 1 36); do
  COMPUTE_STATE=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('compute_status',{}).get('state',''))" 2>/dev/null || true)
  debug "Compute poll $i/36: $COMPUTE_STATE"
  if [[ "$COMPUTE_STATE" == "ACTIVE" ]]; then
    success "Compute ready"
    break
  fi
  if [[ $i -eq 36 ]]; then
    warn "Compute still '$COMPUTE_STATE' after 3 min — attempting deploy anyway..."
  fi
  echo -n "."
  sleep 5
done
echo ""

info "Deploying (this takes ~30–60s)..."
run_cmd "Deploy app" databricks apps deploy "$OPT_APP_SLUG" \
  --source-code-path "$OPT_WORKSPACE_PATH" \
  --profile "$OPT_PROFILE"

APP_JSON=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" 2>/dev/null || true)

echo ""

# ─── STEP 7b: Lakebase Postgres role for the app's service principal ───────────
# Databricks Apps authenticate to Autoscaling Lakebase as the app SP (UUID username).
# Each app gets its own SP — resolved dynamically from databricks apps get (never hardcoded).
# The SP needs a Postgres OAuth role on the branch + DML grants on the portal schema.
# DDL (CREATE/ALTER TABLE) is applied by deploy.sh as the deploying user via schema/*.sql.
if [[ -n "$OPT_LAKEBASE_ENDPOINT" && "$LAKEBASE_HOST" == ep-* ]]; then
  LAKEBASE_BRANCH="${OPT_LAKEBASE_ENDPOINT%/endpoints/*}"
  APP_SP_ID=$(echo "$APP_JSON" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('service_principal_client_id',''))" 2>/dev/null || true)
  if [[ -z "$APP_SP_ID" ]]; then
    APP_SP_ID=$(databricks apps get "$OPT_APP_SLUG" --profile "$OPT_PROFILE" -o json 2>/dev/null | \
      python3 -c "import sys,json; print(json.load(sys.stdin).get('service_principal_client_id',''))" 2>/dev/null || true)
  fi

  if [[ -n "$APP_SP_ID" && -n "$LAKEBASE_BRANCH" ]]; then
    # Postgres role names must start with a lowercase letter — prefix UUID with "sp-" if needed
    if [[ "$APP_SP_ID" =~ ^[0-9] ]]; then
      APP_SP_ROLE="sp-${APP_SP_ID}"
    else
      APP_SP_ROLE="$APP_SP_ID"
    fi

    info "Ensuring Lakebase Postgres role for app service principal ($APP_SP_ID → role: $APP_SP_ROLE)..."
    ROLE_EXISTS=$(databricks postgres list-roles "$LAKEBASE_BRANCH" --profile "$OPT_PROFILE" -o json 2>/dev/null | \
      python3 -c "import sys,json; sp='${APP_SP_ROLE}'; roles=json.load(sys.stdin); print('yes' if any(r.get('status',{}).get('postgres_role')==sp for r in (roles if isinstance(roles,list) else [])) else 'no')" 2>/dev/null || echo "no")

    if [[ "$ROLE_EXISTS" != "yes" ]]; then
      info "Creating Postgres OAuth role for app SP..."
      run_cmd_tolerant "Create app SP Postgres role" \
        databricks postgres create-role "$LAKEBASE_BRANCH" \
          --role-id "$APP_SP_ROLE" \
          --json "{\"spec\": {\"identity_type\": \"SERVICE_PRINCIPAL\", \"postgres_role\": \"${APP_SP_ROLE}\", \"auth_method\": \"LAKEBASE_OAUTH_V1\"}}" \
          --profile "$OPT_PROFILE"
    else
      success "Postgres role already exists for app SP"
    fi

    if [[ -n "$PSQL" ]]; then
      info "Granting schema '$OPT_SCHEMA' to app SP..."
      PG_PASSWORD="$DATABRICKS_TOKEN"
      CONN="host=$LAKEBASE_HOST port=5432 dbname=$OPT_DB user=$OPT_EMAIL sslmode=require"
      GRANT_SQL="
GRANT CONNECT ON DATABASE ${OPT_DB} TO \"${APP_SP_ROLE}\";
GRANT USAGE ON SCHEMA ${OPT_SCHEMA} TO \"${APP_SP_ROLE}\";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${OPT_SCHEMA} TO \"${APP_SP_ROLE}\";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${OPT_SCHEMA} TO \"${APP_SP_ROLE}\";
ALTER DEFAULT PRIVILEGES IN SCHEMA ${OPT_SCHEMA} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO \"${APP_SP_ROLE}\";
ALTER DEFAULT PRIVILEGES IN SCHEMA ${OPT_SCHEMA} GRANT USAGE, SELECT ON SEQUENCES TO \"${APP_SP_ROLE}\";
"
      GRANT_OUT=$(PGPASSWORD="$PG_PASSWORD" "$PSQL" "$CONN" -c "$GRANT_SQL" 2>&1 || true)
      echo "$GRANT_OUT" >> "$LOG_FILE"
      if echo "$GRANT_OUT" | grep -qi "error"; then
        warn "Could not grant schema to app SP (see log). Run deploy again or grant manually."
      else
        success "App SP granted DML access to schema '$OPT_SCHEMA'"
      fi
    else
      warn "psql not available — Postgres role created but schema grants skipped. Install psql and redeploy."
    fi
  else
    warn "Could not resolve app service principal — Lakebase may fail until Postgres role is created"
  fi
fi

echo ""

# ─── STEP 8: Done ─────────────────────────────────────────────────────────────
APP_URL=$(echo "$APP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || true)
APP_STATE=$(echo "$APP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('app_status',{}).get('state','unknown'))" 2>/dev/null || true)

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  ✅  DataMarket deployed successfully!${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
[[ -n "$APP_URL" ]] && echo -e "  ${BOLD}App URL:${RESET}    $APP_URL"
echo -e "  ${BOLD}Status:${RESET}     $APP_STATE"
echo -e "  ${DIM}Full log:${RESET}   $LOG_FILE"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo "  1. Open the app URL and log in"
echo "  2. Switch to the Admin persona (top-right dropdown)"
echo "  3. Go to Manage → Settings to set your portal name, logo, and Genie Space"
echo "  4. Go to Discover → 'Import from Unity Catalog' to populate your catalog"
echo ""

if [[ -z "$OPT_PAT" ]]; then
  warn "If UC Import fails on Azure, generate a PAT and redeploy with --pat (stored as DATABRICKS_API_TOKEN; Lakebase auth is unaffected)."
  warn "  ./scripts/deploy.sh ... --pat dapi<your-token>"
  echo ""
fi
if [[ -n "$LAKEBASE_HOST" && "$LAKEBASE_HOST" == ep-* && -z "$OPT_LAKEBASE_ENDPOINT" ]]; then
  warn "LAKEBASE_ENDPOINT was not set — Discover/Insights will fail in Databricks Apps until you redeploy with --lakebase-endpoint."
  echo ""
fi
