# Villa Valencia Portal

Digital portal for Villa Valencia HOA (APROVIVA), Costa Sur, Don Bosco, Panama.

## Production Identity

- `villavalencia.vercel.app` is the Villa Valencia/APROVIVA live production webapp for HOA management.
- This portal is the end-user runtime, not the PH Management vanilla product site.
- Keep this repo client-specific and operational.

**PQRS backend:** Submit + lookup currently call **ph-management** (`https://ph-management.vercel.app/api/pqrs/{submit,lookup}`) as a temporary cutover. **Target:** bring PQRS storage and APIs **into the Villa Valencia stack** (this repo + VV Supabase) so production identity stays **`villavalencia.vercel.app`** without depending on the ph-management deployment for VV cases. **Canon:** Villa Valencia (`here`) is the live HOA deployment; **ph-management** is the reusable product — migrating PQRS home clarifies that boundary; see `docs/PQRS-MIGRATION-PH-TO-VV.md`. The transparency dashboard, budget, and provider directory remain on Google Apps Script + Sheets until those are unified separately.

## Overview

Community portal for 118 homeowners providing transparency into HOA operations, finances, and maintenance. Production runs at `villavalencia.vercel.app` as a static Vercel deployment backed by Apps Script, PH Management APIs, and the APROVIVA suite.

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

- `PH_MANAGEMENT_API_BASE` — fallback PQRS backend while VV Supabase PQRS remains disabled
- `PQRS_USE_VV_SUPABASE` — flips resident PQRS to Villa Valencia Supabase after required SQL is applied
- `APPS_SCRIPT_URL` — Apps Script endpoint for dashboard, budget, and supporting automation
- `DRIVE_LINKS` — Google Drive folder URLs for each document section
- `ROLE_LOGIN_LINKS` — resident-facing auth handoff links; staff/junta currently land in the local suite

## Deployment

Production identity remains `villavalencia.vercel.app`.
Historical GitHub Pages references are legacy only; if Pages is used for ad-hoc hosting, treat it as non-canonical unless explicitly reactivated.

## End-to-end tests (Playwright)

From `e2e/`: `npm install` then `npm test` (starts a static server on port 8787 and runs Chromium). To hit production instead: `npm run test:prod` (uses `BASE_URL=https://villavalencia.vercel.app`). CI runs the same suite via `.github/workflows/e2e-playwright.yml`.

## Lightweight Automation (Drive-based)

Canonical finance automation path:

- Source folder: `Entrega de Informes` (latest XLSX is auto-detected)
- Script reads the newest monthly file and updates reporting tables
- Daily refresh trigger at 06:00 (Apps Script timezone)
- Executive KPIs are written to `Resumen` sheet
- Executive API endpoint: `?action=executive-summary`

Executive summary includes:

- Último informe detectado
- Ingresos y gastos acumulados
- Resultado neto acumulado
- Presupuesto YTD vs gasto real YTD
- Desviación y % ejecución
- Top conceptos por nivel de ejecución
