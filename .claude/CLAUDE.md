# CLAUDE.md — Portal Residencial Villa Valencia

## Proyecto

Portal público para residentes de Villa Valencia (APROVIVA), barriada de 118 casas.
Transparencia financiera, PQRS, y directorio de proveedores.

## Arquitectura

- **Frontend:** Static HTML/CSS/JS hosted on GitHub Pages
- **Backend:** Google Apps Script web app (deployed v15)
- **Data:** Google Sheets (PQRS, Proveedores, Budget/Reporting)
- **Live URL:** https://villavalencia.vercel.app/

## Orden ejecutiva

- Este repo representa el portal real de Villa Valencia / APROVIVA para usuarios finales.
- `ph-management` y `ph-management-hub` son la misma linea de producto PH Management y no deben confundirse con este runtime cliente.
- No convertir este portal en sitio comercial de PH Management.

## Key IDs

- Apps Script: `1pXDEUSqByv4w4Ff1xetQTf2zkBM__aOp-YV2MmJ2aRqXMsFOaxzYLG2I`
- PQRS Sheet: `1kD0v-nGH4h7AJg7i4wTdkJuQ_vkjzBF28blGvQXAGYo`
- Budget Sheet: `1CGmPqMbRsC3EI-8Gq53zd1rjjt-EeG62XidwuBSddgk`
- Reporting Sheet: `1MI6BHRy7Y5abCb1jI1YQcEq19-bAuTDvddznDNfwcaA`

## What's Live

- Portal fully open (no OAuth)
- PQRS inline form + dashboard with KPIs, bar charts, recent reports
- Provider suggestion form → Proveedores sheet
- Budget dashboard: presupuesto vs ejecucion real from monthly informes
  - Month selector, category cards with % execution, expandable line items
- Hourly auto-refresh trigger for budget data

## Auto-Update Chain

Accountant uploads monthly XLSX → Drive "Entrega de Informes" → hourly trigger → Apps Script reads "Estado de Presupuesto" sheet → updates reporting spreadsheet → portal fetches on page load

## Conventions

- All user-facing text in Spanish
- Internal code in English
- Term: "barriada" (not "copropiedad")

## Clasp

- Path: `~/.local/bin/clasp` (v3.3.0)
- CLI tokens lack script.scriptapp and full Drive scopes — run trigger/scope-sensitive functions from Apps Script editor
- Push, version, deploy work from CLI
