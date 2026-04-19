#!/usr/bin/env bash
# Apply all VV migrations using psql (WSL has /usr/bin/psql).
# Usage:
#   export SUPABASE_DB_URL='postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require'
#   bash scripts/apply-wsl.sh
#
# Connection string: Supabase → Project Settings → Database → Connection string (URI), pooler recommended.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Set SUPABASE_DB_URL to your Postgres connection URI (see script header)." >&2
  exit 1
fi
SQL="$ROOT/scripts/ALL_VV_MIGRATIONS_ONE_PASTE.sql"
echo "Applying: $SQL"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "OK."
