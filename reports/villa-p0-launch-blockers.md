# Villa Valencia P0 Launch Blockers

Date: 2026-04-29  
Lane: Villa P0 launch blockers durable lane  
Worktree: `/home/jeffery/Adwen-Tech/apps/villa-valencia-portal`

## Status

Gate status: **HOLD conditional**.

The codebase has a prepared path for Villa Valencia-owned PQRS and the recorridos/MD04-lite data backbone, but production should not be cut over until Jeff approves and applies the required Villa Valencia Supabase SQL in project `tgoitmwdpdkhlpqpwrvs`.

No deploy, push, production SQL, or production toggle change was performed in this pass.

## What I Inspected

- SQL migrations:
  - `aproviva-suite/supabase/migrations/20260420120000_recorrido_map_waypoints.sql`
  - `aproviva-suite/supabase/migrations/20260421120000_site_place_geo_pqrs_map.sql`
  - `aproviva-suite/supabase/migrations/20260421130000_drop_duplicate_pqrs_map_objects.sql`
  - `aproviva-suite/supabase/migrations/20260422120000_pqrs_cases.sql`
  - `aproviva-suite/supabase/migrations/20260422200000_pqrs_cases_align_existing.sql`
  - `aproviva-suite/supabase/migrations/20260423120000_gemba_round_templates.sql`
  - `aproviva-suite/supabase/migrations/20260429120000_inspection_plan_data_backbone.sql`
  - `scripts/ALL_VV_MIGRATIONS_ONE_PASTE.sql`
- Photo upload hooks:
  - Resident portal: `js/app.js` uploads PQRS photos through Apps Script using `text/plain`.
  - Apps Script receiver: `apps-script/Code.gs` handles `_type: "pqrs_photo"` and writes to the configured Drive folder.
  - Suite shared helper: `aproviva-suite/js/ui.js`.
  - Gemba/map consumers: `aproviva-suite/js/modules/gemba.js`, `aproviva-suite/js/modules/mapa.js`.
- MD04/exception board support:
  - SQL view/function: `v_md04_lite_exceptions`, `get_md04_lite_exceptions(uuid)` in `20260429120000_inspection_plan_data_backbone.sql`.
  - Current UI report/junta modules still compute legacy summaries directly from tables; they do not yet consume the MD04-lite RPC.
- Auth/PIN config:
  - Suite PIN gate is POC-grade UI auth in `aproviva-suite/js/auth.js`.
  - Role/PIN matrix lives in `aproviva-suite/js/config.js`.
  - Production security boundary remains Supabase RLS/public keys, not PIN secrecy.
- Smoke scripts/tests:
  - E2E config and local static server under `e2e/`.
  - Existing commands: `npm test` and `npm run test:prod` from `e2e/`.
  - Existing coverage includes portal home/PQRS modal, providers, suite routes/PIN access, inventory, Gemba, map page, and legacy pages.

## Safe Fix Applied

Changed `aproviva-suite/js/ui.js` so suite photo uploads send JSON payloads with `Content-Type: text/plain`, matching the resident portal upload path.

Reason: Apps Script web apps do not reliably handle CORS `OPTIONS` preflight. The resident portal already avoids preflight for the same endpoint; the suite helper should use the same safe pattern for Gemba and map photo uploads.

Changed files:

- `/home/jeffery/Adwen-Tech/apps/villa-valencia-portal/aproviva-suite/js/ui.js`
- `/home/jeffery/Adwen-Tech/apps/villa-valencia-portal/reports/villa-p0-launch-blockers.md`

Target report path requested by the lane:

- `/home/jeffery/Adwen-Tech/night-operator/runs/2026-04-29/launch-iteration-2/reports/villa-p0-launch-blockers.md`

Write attempt result: blocked by filesystem with `Read-only file system`. The repo-local report above contains the intended content.

## Can Be Fixed In Code Now

1. Keep `PQRS_USE_VV_SUPABASE: false` until the live SQL fix is applied and verified.
2. Keep the client-side lookup false-positive guard in `js/app.js`; it prevents display of a wrong case if a bad RPC response slips through.
3. Keep photo upload helpers aligned on `text/plain` for Apps Script.
4. Add a future E2E smoke for suite photo upload only if a non-production Apps Script endpoint or mocked route is available. Do not test by writing uncontrolled production Drive files.
5. Add future UI consumption of `get_md04_lite_exceptions(uuid)` after the data backbone is approved/applied. Current report/junta views are acceptable as legacy summaries but are not yet the MD04-lite board.

## Requires Jeff Approval / Production Supabase Action

1. Apply the corrected `lookup_pqrs_case(p_case_ref text)` SQL in Villa Valencia Supabase project `tgoitmwdpdkhlpqpwrvs`.
2. Confirm fake PQRS lookup returns zero rows.
3. Confirm known PQRS lookup returns exactly the requested case reference.
4. Decide whether to apply the recorridos data backbone migration `20260429120000_inspection_plan_data_backbone.sql`.
5. If applying the data backbone, run the runbook verification SQL in `docs/RECORRIDOS-DATA-BACKBONE-RUNBOOK.md`.
6. Only after the SQL/RPC smoke passes, approve a separate deployment or config cutover that flips production `PQRS_USE_VV_SUPABASE` from `false` to `true`.

## Recommended Sequence

1. Production Supabase: apply only the PQRS RPC fix first.
2. SQL smoke: fake lookup returns zero rows; known lookup returns the correct reference.
3. Controlled admin smoke: submit one clearly labeled PQRS test case with no sensitive data, then look it up.
4. Preview deploy or shareable QA build: verify portal and suite flows without changing production.
5. Production deploy: only after Jeff approves the Supabase fix and cutover.
6. Post-deploy smoke: resident portal, PQRS submit/lookup, photo attachment, suite login roles, Gemba, map, providers.
7. Separately approve/apply the recorridos data backbone and MD04-lite migration.
8. After MD04 SQL is live, wire a UI board/report to `get_md04_lite_exceptions(uuid)` if desired.

## Exact Smoke Checks

### Local/Preview Static Checks

From repo root:

```sh
node --check js/app.js
node --check js/config.js
node --check aproviva-suite/js/config.js
node --check aproviva-suite/js/auth.js
node --check aproviva-suite/js/ui.js
node --check aproviva-suite/js/modules/gemba.js
node --check aproviva-suite/js/modules/mapa.js
```

From `e2e/`:

```sh
npm test
```

If browser dependencies are missing, run these checks in an environment with Playwright Chromium dependencies installed.

### Production HTTP Smoke

```sh
curl -I https://villavalencia.vercel.app/
curl -I https://villavalencia.vercel.app/js/config.js
curl -I https://villavalencia.vercel.app/aproviva-suite/index.html
curl -I https://villavalencia.vercel.app/aproviva-suite/mapa-pqrs.html
curl -I https://villavalencia.vercel.app/proveedores.html
```

Expected: HTTP 200 for each.

### PQRS Supabase RPC Smoke

Run in Villa Valencia Supabase SQL editor after applying the RPC fix:

```sql
select *
from public.lookup_pqrs_case('VV-PQRS-NOTREAL-SMOKE');
```

Expected: zero rows.

Then run with a known real reference:

```sql
select case_reference, status, created_at, updated_at
from public.lookup_pqrs_case('VV-PQRS-YYYYMMDD-XXXXXX');
```

Expected: one row and `case_reference` exactly equals the requested reference.

### PQRS Submit/Lookup Browser Smoke

Use a controlled admin smoke case:

- Open `https://villavalencia.vercel.app/`.
- Open PQRS modal.
- Submit a case with subject like `SMOKE - Villa Valencia cutover - YYYY-MM-DD`.
- Use non-sensitive description and a clearly fake/test location if allowed.
- Confirm the UI returns a case reference.
- Paste the same reference into lookup.
- Expected: lookup shows the same reference and a valid status.

Do not run this until Jeff accepts creating one production smoke row.

### Photo Upload Smoke

Use a tiny test JPG/PNG under 1 MB.

- Resident portal PQRS: attach one image, submit the controlled smoke case, confirm returned success lists the uploaded file link.
- Suite Gemba/map: only test against production Drive if Jeff approves writing one test file. Otherwise use preview/staging/mocked Apps Script.

Expected: upload succeeds without CORS preflight failure and Drive link opens for anyone with the link.

### Suite Auth/PIN Smoke

Open `https://villavalencia.vercel.app/aproviva-suite/index.html#/login`.

- `2026` or `CONS26`: can access `inventario`, `gemba`, `incidencias`; cannot access junta/maestros.
- `SUP26`: can access `inventario`, `gemba`, `incidencias`, `reportes`, `proyectos`; cannot access junta/maestros.
- `GER26`: can access operational/admin modules including `maestros` and `reportes`.
- `JD26`: can access `reportes`, `junta`, `proyectos`; cannot access operational staff modules.

Expected: routes and nav match the configured role matrix.

### MD04/Data Backbone Smoke

Only after Jeff approves and applies `20260429120000_inspection_plan_data_backbone.sql`:

```sql
select plan_code, name, frequency
from public.inspection_plans
where building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'
order by plan_code;

select p.plan_code, pp.point_code, pp.label
from public.inspection_plan_points pp
join public.inspection_plans p on p.id = pp.plan_id
where p.building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'
order by p.plan_code, pp.sort_order;

select exception_type, severity, status, title, due_at
from public.get_md04_lite_exceptions('88e6c11e-4a8c-4f39-a571-5f97e7f2b774')
limit 50;
```

Expected:

- Seeded plans exist for `VV-SEC-DAILY` and `VV-WET-WEEKLY`.
- Plan points return in stable order.
- Exception RPC returns zero or more rows without SQL errors.

## Gate Checklist

- [ ] Production `lookup_pqrs_case(p_case_ref text)` fix applied in VV Supabase.
- [ ] Fake lookup returns zero rows.
- [ ] Known lookup returns exactly one matching row.
- [ ] Jeff approves one controlled production PQRS smoke case.
- [ ] Controlled submit/lookup smoke passes.
- [ ] Photo upload smoke passes or is explicitly deferred with known risk accepted.
- [ ] Playwright suite passes in an environment with browser dependencies.
- [ ] `PQRS_USE_VV_SUPABASE` production cutover is approved separately.
- [ ] No dependency remains on `ph-management.vercel.app` for Villa Valencia PQRS after cutover.
- [ ] MD04/data backbone migration is approved separately before applying.
- [ ] If MD04 migration is applied, runbook verification SQL passes.

## Launch Decision

Do not launch/cut over PQRS yet. The smallest safe next action is the production Supabase RPC fix plus SQL smoke. After that, the repo can be considered ready for a controlled preview/prod smoke and a separate cutover approval.

## 2026-04-29 Supabase RPC smoke update
Jeff applied the narrow production Supabase RPC replacement for `public.lookup_pqrs_case(case_ref text)`.

External PostgREST smoke from OpenClaw:
- POST `/rest/v1/rpc/lookup_pqrs_case` with `{ "case_ref": "VV-PQRS-NOTREAL-SMOKE" }`
- Result: HTTP 200 `[]`

This confirms the false-match bug is fixed for the current function signature. The old `p_case_ref` payload intentionally returns PGRST202 because the live parameter name is `case_ref`.
