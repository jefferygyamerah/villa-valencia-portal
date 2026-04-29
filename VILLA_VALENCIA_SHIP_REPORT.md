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

### P0/P1: Production PQRS is not cut over yet

`https://villavalencia.vercel.app/js/config.js` currently has:

- `PQRS_USE_VV_SUPABASE: false`
- `PH_MANAGEMENT_API_BASE: 'https://ph-management.vercel.app'`

That means production resident PQRS submit/lookup still uses the legacy `ph-management` runtime. This conflicts with the current Villa Valencia operational ownership direction.

Local fix is ready, but production is unchanged until deployed.

### P0/P1: Production VV Supabase lookup RPC returns a false positive

Smoke command:

```sh
POST https://tgoitmwdpdkhlpqpwrvs.supabase.co/rest/v1/rpc/lookup_pqrs_case
body: {"case_ref":"VV-PQRS-NOTREAL-SMOKE"}
```

Result: HTTP 200 with an existing case `VV-PQRS-20260419-855099` instead of zero rows.

Cause found locally: SQL function argument `case_ref` collides with an existing table column, so the predicate can evaluate against the row column instead of the input parameter.

Local SQL fix is ready. This must be applied to the Villa Valencia Supabase project before deploy, or at minimum deploy the client-side guard with clear awareness that the server RPC is still wrong.

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

## Remaining Blockers Before Deploy

1. Apply the updated `lookup_pqrs_case(p_case_ref text)` SQL to the Villa Valencia Supabase project `tgoitmwdpdkhlpqpwrvs`.
2. Re-run a production RPC check:

```sql
SELECT * FROM public.lookup_pqrs_case('VV-PQRS-NOTREAL-SMOKE');
```

Expected: zero rows.

3. Run one controlled PQRS submit + lookup after the SQL fix, preferably with a clearly labeled admin smoke case.
4. Run Playwright E2E in an environment with browser dependencies installed.

## Deploy Recommendation

Do not deploy yet if the Supabase RPC fix cannot be applied first. The local portal code is directionally correct and includes a client-side false-positive guard, but shipping the cutover while the server lookup function is known-bad leaves production in a fragile state.

Recommended release order:

1. Apply the SQL RPC fix in VV Supabase.
2. Confirm fake lookup returns zero rows and known lookup returns the correct row.
3. Deploy this repo.
4. Run production smoke for resident home, PQRS modal, submit, lookup, suite login, map, and proveedores.
