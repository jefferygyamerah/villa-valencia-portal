#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
git add README.md js/proveedores.js proveedores.html \
  .github/workflows/e2e-playwright.yml \
  e2e/.gitignore e2e/package-lock.json e2e/package.json e2e/playwright.config.js \
  e2e/tests/helpers.ts e2e/tests/legacy-pages.spec.ts e2e/tests/mapa-pqrs.spec.ts \
  e2e/tests/portal-home.spec.ts e2e/tests/portal-proveedores.spec.ts e2e/tests/suite-routes.spec.ts \
  e2e/tsconfig.json
git status -sb
git commit -m "feat(e2e): Playwright suite, CI workflow, fix proveedores search"
git push origin master
git log -1 --oneline > _git_last_commit.txt
echo "OK" >> _git_last_commit.txt
