# Villa Valencia Portal

Digital portal for Villa Valencia HOA (APROVIVA), Costa Sur, Don Bosco, Panama.

## Production Identity

- `villavalencia.vercel.app` is the Villa Valencia/APROVIVA live production webapp for HOA management.
- This portal is the end-user runtime, not the PH Management vanilla product site.
- Keep this repo client-specific and operational.

**PQRS backend:** Submit + lookup currently call **ph-management** (`https://ph-management.vercel.app/api/pqrs/{submit,lookup}`) as a temporary cutover. **Target:** bring PQRS storage and APIs **into the Villa Valencia stack** (this repo + VV Supabase) so production identity stays **`villavalencia.vercel.app`** without depending on the ph-management deployment for VV cases. **Canon:** Villa Valencia (`here`) is the live HOA deployment; **ph-management** is the reusable product — migrating PQRS home clarifies that boundary; see `docs/PQRS-MIGRATION-PH-TO-VV.md`. The transparency dashboard, budget, and provider directory remain on Google Apps Script + Sheets until those are unified separately.

## Overview

Community portal for 118 homeowners providing transparency into HOA operations, finances, and maintenance. Static site hosted on GitHub Pages.

## Structure

```
index.html          Main portal (dashboard, comunicados, PQRS, financials)
proveedores.html    Provider directory with search and filtering
css/styles.css      Shared styles
js/config.js        Configuration (Google Client ID, form URLs, Drive links)
js/auth.js          Google Sign-In + demo mode
js/app.js           Portal page logic
js/proveedores.js   Provider directory logic
docs/               Reference documents and prototypes
```

## Configuration

Edit `js/config.js` with your values:

- `GOOGLE_CLIENT_ID` — OAuth 2.0 client ID from Google Cloud Console
- `PQRS_FORM_URL` — Published Google Form URL
- `DRIVE_LINKS` — Google Drive folder URLs for each document section

## Deployment

Historical static hosting can still use GitHub Pages from the `master` branch root with `.nojekyll`.
Production identity remains `villavalencia.vercel.app`.

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
