#!/usr/bin/env bash
# ── DEPRECATED ────────────────────────────────────────────────────────────────
# This script has been superseded by the simpler deploy at the repo root:
#
#   ./deploy.sh --profile my-profile
#
# All flags from this script are also accepted by the new one.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "⚠️  scripts/deploy.sh is deprecated."
echo "   Use: ./deploy.sh --profile my-profile"
echo ""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/../deploy.sh" "$@"
