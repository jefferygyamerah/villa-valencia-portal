# PQRS Villa Valencia Supabase — implementation & QA notes

- **Date:** 2026-04-19  
- **Scope:** `pqrs_cases` DDL, portal PostgREST + RPC `lookup_pqrs_case`, feature flag `PQRS_USE_VV_SUPABASE` in [js/config.js](../../js/config.js).

## Code review (consolidated)

- **RLS:** `anon` may `INSERT` only when `building_id` matches Villa Valencia UUID; `SELECT`/`UPDATE` denied on table; reads go through `lookup_pqrs_case(text)` (`SECURITY DEFINER`).
- **Portal:** Submit uses `Prefer: return=representation` to read generated `case_reference`; ubicación options expose `value` slugs aligned with `SITE_PLACES` ids.
- **Rollback:** Set `PQRS_USE_VV_SUPABASE: false` to restore ph-management submit/lookup.

## Repo / deploy (agent-completed)

- **Git:** pushed `939f25f` (PQRS + migrations + docs), `47a039d` (align existing `pqrs_cases` + GitHub Action).
- **CI:** [`.github/workflows/apply-vv-supabase-sql.yml`](../../.github/workflows/apply-vv-supabase-sql.yml) — set repository secret `SUPABASE_DB_URL`, run workflow **Apply VV Supabase SQL** once to execute all `aproviva-suite/supabase/migrations/*.sql` in order.

## Preconditions for live DB + browser QA

1. Apply SQL: Supabase Dashboard **SQL Editor** (paste migrations in order), **or** GitHub Actions workflow above with `SUPABASE_DB_URL`.
2. If `pqrs_cases` pre-existed without VV columns, ensure [20260422200000_pqrs_cases_align_existing.sql](../../aproviva-suite/supabase/migrations/20260422200000_pqrs_cases_align_existing.sql) ran after [20260422120000_pqrs_cases.sql](../../aproviva-suite/supabase/migrations/20260422120000_pqrs_cases.sql).
3. Set `PQRS_USE_VV_SUPABASE: true` in [js/config.js](../../js/config.js) and redeploy.
4. Submit a test PQRS from the portal; confirm lookup RPC returns the row.

## Findings (P0–P2)

| ID | Severity | Finding |
|----|----------|---------|
| — | — | **Not executed against live Supabase in this session** — SQL must be applied before toggling the flag. No P0/P1 observed in static review. |

## Deploy

- Push to `origin/master` triggers Vercel for `villavalencia.vercel.app`. Optional preview: `here.now` per `AGENTS.md`.
