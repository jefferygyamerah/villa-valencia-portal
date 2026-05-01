# Villa Valencia Ship Report

Date: 2026-04-29

## Scope

Inspected the static resident portal and APROVIVA operations suite for revenue-blocking production issues only: broken links, auth handoff confusion, PQRS submit/lookup reliability, backend config mismatch, stale/demo copy, mobile-facing obvious issues, and test failures.

No deploy, push, or external messages were sent.

## Local Changes Made

- Cut local resident PQRS runtime over to Villa Valencia Supabase in `js/config.js` with `PQRS_USE_VV_SUPABASE: true`.
- Removed the resident card handoff to the external `vv-auth-app` surface. Residents now stay in the working Villa Valencia portal and are scrolled to the resident action area instead of being sent to an unrelated login.
- Updated the alternate shipped `aproviva-portal.html` resident lane so it no longer sends residents to `vv-auth-app`; it routes back to `index.html#pqrs`.
- Hardened PQRS lookup in `js/app.js`: if the VV Supabase RPC returns a row whose `case_reference` does not match the requested reference, the portal shows "not found" instead of displaying the wrong case.
- Fixed the local Supabase SQL for `lookup_pqrs_case` in both migration files and `scripts/ALL_VV_MIGRATIONS_ONE_PASTE.sql` by renaming the function argument from `case_ref` to `p_case_ref`. This avoids ambiguity with the existing `pqrs_cases.case_ref` column.
- Updated PQRS migration docs/test findings to reflect the 2026-04-29 local cutover state and the remaining DB RPC apply requirement.

## Production Findings

### 2026-04-30 post-deploy update

Waves 3/4 were merged, pushed, and deployed to production. The production Villa Valencia Supabase RPC fix was applied live as `public.lookup_pqrs_case(p_case_ref text)`, and the read-only fake-reference smoke passed with zero rows. `js/config.js` is now deployed with `PQRS_USE_VV_SUPABASE: true`; `PH_MANAGEMENT_API_BASE` remains as rollback config.

Remaining production validation should be non-mutating first:

- `node scripts/production-smoke.mjs`
- `node scripts/pqrs-rpc-smoke.mjs --live`
- `node scripts/pqrs-rpc-smoke.mjs --live --known-ref VV-PQRS-YYYYMMDD-XXXXXX` if Jeff provides a known real reference
- `node scripts/pqrs-backfill-validate.mjs --file /tmp/vv-pqrs-backfill.csv` after a private ph-management export is staged
- `node scripts/recorridos-md04-preflight.mjs --live` for read-only MD04 prerequisite checks; the approved MD04/data-backbone migration was applied on 2026-04-30

Jeff approved a clearly labeled production PQRS smoke row on 2026-04-30; case `VV-PQRS-20260430-SMOKE8299` was inserted and lookup returned itself. Do not create additional production smoke rows without fresh approval.

### Superseded: production PQRS was not cut over yet

At the time of the original 2026-04-29 report, `https://villavalencia.vercel.app/js/config.js` had:

- `PQRS_USE_VV_SUPABASE: false`
- `PH_MANAGEMENT_API_BASE: 'https://ph-management.vercel.app'`

That meant production resident PQRS submit/lookup still used the legacy `ph-management` runtime. This conflicted with the current Villa Valencia operational ownership direction.

This is superseded by the 2026-04-30 deployment with `PQRS_USE_VV_SUPABASE: true`.

### Superseded: Production VV Supabase lookup RPC returned a false positive

Smoke command:

```sh
POST https://tgoitmwdpdkhlpqpwrvs.supabase.co/rest/v1/rpc/lookup_pqrs_case
body: {"case_ref":"VV-PQRS-NOTREAL-SMOKE"}
```

Result: HTTP 200 with an existing case `VV-PQRS-20260419-855099` instead of zero rows.

Cause found locally: SQL function argument `case_ref` collides with an existing table column, so the predicate can evaluate against the row column instead of the input parameter.

This is superseded by the 2026-04-30 production RPC fix and fake-reference smoke. Keep the client-side guard as defense in depth.

### Auth Handoff Confusion

Current production resident access card can send users toward a separate `vv-auth-app` resident login. That is confusing because the current resident portal itself is the live resident surface. Local fix keeps residents on `villavalencia.vercel.app`.

Admin/junta handoff to `aproviva-suite/index.html#/login` is appropriate for this static portal.

## Verification

Passed:

- `node --check js/app.js`
- `node --check js/config.js`
- `node --check aproviva-suite/js/config.js`
- `node --check aproviva-suite/js/supabase.js`
- Production HTTP smoke:
  - `/` -> 200
  - `/js/config.js` -> 200
  - `/aproviva-suite/index.html` -> 200
  - `/aproviva-suite/mapa-pqrs.html` -> 200
  - `/proveedores.html` -> 200
- Supabase CORS preflight for `POST /rest/v1/pqrs_cases` from `https://villavalencia.vercel.app` -> 200 with expected `access-control-allow-*` headers.
- Installed E2E npm dependencies with `npm ci` successfully; 0 vulnerabilities reported.

Blocked:

- `npm test` under `e2e/` initially failed because Playwright Chromium was not installed.
- `npx playwright install chromium` downloaded Chromium successfully, but reported missing host libraries.
- `npx playwright install-deps chromium` failed because it requires sudo/password in this environment.
- Therefore local and production browser E2E could not be completed here. The application tests did not fail on app behavior; they were blocked by browser runtime dependencies.

Not run:

- I did not submit a new production PQRS case to avoid polluting live resident data. Existing production RPC smoke was enough to prove the lookup blocker.

## Remaining Blockers / Next Manual Steps

1. Run a known-reference production RPC check when Jeff provides a real reference:

```sql
SELECT * FROM public.lookup_pqrs_case('VV-PQRS-YYYYMMDD-XXXXXX');
```

Expected: exactly one row and the returned reference matches the requested reference.

2. Execute `docs/PQRS-HISTORICAL-BACKFILL-RUNBOOK.md` after a private ph-management export/import file or access is available.
3. Run Playwright E2E in an environment with browser dependencies installed.
4. Build the MD04-lite UI consumption layer on top of the now-applied `get_md04_lite_exceptions(uuid)` function if desired.

## Deploy Recommendation

The prior "do not deploy yet" warning is superseded by the 2026-04-30 production deploy and live RPC fix. Keep the client-side false-positive guard and use non-mutating smokes before any manual production test-row smoke.

Recommended release order:

1. Apply the SQL RPC fix in VV Supabase.
2. Confirm fake lookup returns zero rows and known lookup returns the correct row.
3. Deploy this repo.
4. Run production smoke for resident home, PQRS modal, submit, lookup, suite login, map, and proveedores.
