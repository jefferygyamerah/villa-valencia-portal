#!/usr/bin/env bash
# Helper to publish the suite to here.now from inside WSL.
set -euo pipefail
cd "$(dirname "$0")/.."
SCRIPT="${HERE_NOW_SCRIPT:-$HOME/.claude/skills/here-now/scripts/publish.sh}"
if [ ! -x "$SCRIPT" ]; then
  echo "ERROR: here.now script not found at $SCRIPT" >&2
  exit 1
fi
SLUG_ARG=""
if [ -n "${HERE_NOW_SLUG:-}" ]; then
  SLUG_ARG="--slug $HERE_NOW_SLUG"
fi
exec "$SCRIPT" aproviva-suite $SLUG_ARG --client cursor --spa
