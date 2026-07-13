#!/usr/bin/env bash
# DataMarket — deploy entry point
# Delegates to src/app/deploy.sh — see there for all flags and documentation.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/src/app/deploy.sh" "$@"
