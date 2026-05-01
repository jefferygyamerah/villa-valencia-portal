# Villa Valencia Portal

Digital portal for Villa Valencia HOA (APROVIVA), Costa Sur, Don Bosco, Panama.

## Production Identity

- `villavalencia.vercel.app` is the Villa Valencia/APROVIVA live production webapp for HOA management.
- This portal is the end-user runtime, not the PH Management vanilla product site.
- Keep this repo client-specific and operational.

**PQRS backend:** Submit + lookup are now configured for the Villa Valencia Supabase project (`PQRS_USE_VV_SUPABASE: true`) after the production RPC false-positive fix was applied and a fake-reference smoke returned zero rows. `PH_MANAGEMENT_API_BASE` remains in config as an explicit rollback path, not the intended active runtime. **Canon:** Villa Valencia (`here`) is the live HOA deployment; **ph-management** is the reusable product - migrating PQRS home clarifies that boundary; see `docs/PQRS-MIGRATION-PH-TO-VV.md`. The transparency dashboard, budget, and provider directory remain on Google Apps Script + Sheets until those are unified separately.

## Overview

Community portal for 118 homeowners providing transparency into HOA operations, finances, and maintenance. Production runs at `villavalencia.vercel.app` as a static Vercel deployment backed by Apps Script, Villa Valencia Supabase for PQRS, and the APROVIVA suite. PH Management remains only as a rollback path for resident PQRS while historical backfill/decommission is completed.

## Active production operations direction — 2026-04-29

Villa Valencia is production, not a disposable demo. The recorrido/operations suite now follows a SAP-inspired backbone:

- supervisor/admin creates Plan Maestro / inspection plan;
- plan contains Puntos de Inspección;
- conserje executes scheduled recorrido instance;
- hallazgos/findings attach to inspection context;
- operations should see MD04-lite exceptions: due, overdue, missing, blocked, critical, vendor, inventory, and follow-up items.

Runbook: `docs/RECORRIDOS-DATA-BACKBONE-RUNBOOK.md`.

Latest known shipped commit for this correction: `068854b fix(vv): stabilize recorrido plan gate`.

Non-mutating MD04/data-backbone guard:

```sh
node scripts/recorridos-md04-preflight.mjs
node scripts/recorridos-md04-preflight.mjs --print-sql
```

Use `--live` only for read-only Supabase REST prerequisite probes before applying the MD04 migration; it uses `limit=0` and does not create rows.

## Structure

```
index.html               Canonical resident portal entrypoint
proveedores.html         Canonical provider directory page
aproviva-suite/          Canonical operations suite (PIN roles) + public map surfaces
css/styles.css           Shared portal styles
js/config.js             Portal config: URLs, feature flags, Drive links, role handoff links
js/app.js                Portal page logic (dashboard, PQRS, budget, resident actions)
js/proveedores.js        Provider directory logic
docs/                    Reference documents and migration notes
```

## Canonical vs legacy pages

- Maintain `index.html`, `proveedores.html`, and `aproviva-suite/` as the canonical user-facing surfaces.
- `aproviva-portal.html`, `aproviva-proveedores.html`, and `mock-finanzas-dashboard.html` are legacy / alternate HTML pages kept for reference and smoke coverage. They should not be treated as the primary production experience.

## Configuration

Edit `js/config.js` with your values:

- `PH_MANAGEMENT_API_BASE` � fallback PQRS backend while VV Supabase PQRS remains disabled
- `PQRS_USE_VV_SUPABASE` � active PQRS path; keep `true` after the production RPC smoke, set `false` only for rollback
- `APPS_SCRIPT_URL` � Apps Script endpoint for dashboard, budget, and supporting automation
- `DRIVE_LINKS` � Google Drive folder URLs for each document section
- `ROLE_LOGIN_LINKS` � resident-facing auth handoff links; staff/junta currently land in the local suite

## Deployment

Production identity remains `villavalencia.vercel.app`.
Historical GitHub Pages references are legacy only; if Pages is used for ad-hoc hosting, treat it as non-canonical unless explicitly reactivated.

## End-to-end tests (Playwright)

From `e2e/`: `npm install` then `npm test` (starts a static server on port 8787 and runs Chromium). To hit production instead: `npm run test:prod` (uses `BASE_URL=https://villavalencia.vercel.app`). CI runs the same suite via `.github/workflows/e2e-playwright.yml`.

## Non-mutating production smokes

From the repo root:

```sh
node scripts/production-smoke.mjs
node scripts/pqrs-rpc-smoke.mjs --live --known-ref VV-PQRS-E2E-000001
node scripts/recorridos-md04-preflight.mjs --live
POSTGRES_URL='<private-villa-valencia-production-db-url>' node scripts/vv-e2e-seed-verify.mjs
```

These checks only read production route/config/RPC/DB state. They do not submit PQRS cases or write resident data. The E2E seed verifier requires a private Villa Valencia production DB URL and opens a read-only transaction. After real operational data is loaded, rerun it with `--allow-extra-operational`.

Post-reset review path and real-data-load readiness criteria: `docs/POST-RESET-E2E-SEED-VERIFICATION.md`.

## PQRS historical backfill guard

Before importing any private ph-management export into Villa Valencia Supabase, validate the staged CSV offline:

```sh
node scripts/pqrs-backfill-validate.mjs --file /tmp/vv-pqrs-backfill.csv
```

Runbook: `docs/PQRS-HISTORICAL-BACKFILL-RUNBOOK.md`. Fixture smoke: `node scripts/pqrs-backfill-validate.mjs --file scripts/fixtures/pqrs-backfill-sample.csv`.

## Operational real-data-load readiness

For non-PQRS operational data, stage a private JSON bundle or per-table CSV directory outside the repo, then run the offline validator:

```sh
node scripts/vv-operational-load-validate.mjs --bundle /tmp/vv-operational-load.json --strict
node scripts/vv-operational-load-validate.mjs --dir /tmp/vv-operational-load-csv --strict
```

Safe synthetic fixture smoke:

```sh
node scripts/vv-operational-load-validate.mjs --bundle scripts/fixtures/operational-load-sample.json
```

Runbook: `docs/OPERATIONAL-REAL-DATA-LOAD-READINESS.md`. Actual import still requires private exports/source data and explicit Jeff approval before any live DB mutation.

## Lightweight Automation (Drive-based)

Canonical finance automation path:

- Source folder: `Entrega de Informes` (latest XLSX is auto-detected)
- Script reads the newest monthly file and updates reporting tables
- Daily refresh trigger at 06:00 (Apps Script timezone)
- Executive KPIs are written to `Resumen` sheet
- Executive API endpoint: `?action=executive-summary`

Executive summary includes:

- �ltimo informe detectado
- Ingresos y gastos acumulados
- Resultado neto acumulado
- Presupuesto YTD vs gasto real YTD
- Desviaci�n y % ejecuci�n
- Top conceptos por nivel de ejecuci�n
