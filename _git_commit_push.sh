#!/usr/bin/env bash
set -euo pipefail
REPO="/home/jeffery/company-portfolio/apps/villa-valencia-portal"
cd "$REPO"
OUT="$REPO/_commit_push_result.txt"
{
  echo "=== status (before) ==="
  git status -sb
  echo "=== add ==="
  git add aproviva-suite/js/modules/gemba.js \
    e2e/tests/gemba-supervisor-conserje.spec.ts \
    e2e/tests/inventory-apics.spec.ts \
    e2e/tests/suite-routes.spec.ts
  echo "=== status (staged) ==="
  git status -sb
  echo "=== commit ==="
  git commit -m "fix(e2e): stabilize suite tests; close gemba modal on round error" || true
  echo "=== log -1 ==="
  git log -1 --oneline
  echo "=== push ==="
  git push origin master
} >"$OUT" 2>&1
echo "Wrote $OUT"
cat "$OUT"
