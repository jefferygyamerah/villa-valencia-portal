# PQRS Villa Valencia Supabase — implementation & QA notes

- **Date:** 2026-04-19  
- **Scope:** `pqrs_cases` DDL, portal PostgREST + RPC `lookup_pqrs_case`, feature flag `PQRS_USE_VV_SUPABASE` in [js/config.js](../../js/config.js).

## Code review (consolidated)

- **RLS:** `anon` may `INSERT` only when `building_id` matches Villa Valencia UUID; `SELECT`/`UPDATE` denied on table; reads go through `lookup_pqrs_case(text)` (`SECURITY DEFINER`).
- **Portal:** Submit uses `Prefer: return=representation` to read generated `case_reference`; ubicación options expose `value` slugs aligned with `SITE_PLACES` ids.
- **Rollback:** Set `PQRS_USE_VV_SUPABASE: false` to restore ph-management submit/lookup.

## Preconditions for manual / browser QA

1. Run [aproviva-suite/supabase/migrations/20260422120000_pqrs_cases.sql](../../aproviva-suite/supabase/migrations/20260422120000_pqrs_cases.sql) in Supabase SQL Editor (project `tgoitmwdpdkhlpqpwrvs`).
2. Set `PQRS_USE_VV_SUPABASE: true` in [js/config.js](../../js/config.js) (local or preview only until smoke-tested).
3. Submit a test PQRS from the portal; confirm row in `pqrs_cases` and lookup by reference on the status panel.

## Findings (P0–P2)

| ID | Severity | Finding |
|----|----------|---------|
| — | — | **Not executed against live Supabase in this session** — SQL must be applied before toggling the flag. No P0/P1 observed in static review. |

## Deploy

- Push to `origin/master` triggers Vercel for `villavalencia.vercel.app`. Optional preview: `here.now` per `AGENTS.md`.
