# CLAUDE.md — Portal Residencial Villa Valencia

## Proyecto

Portal público para residentes de Villa Valencia (APROVIVA), barriada de 118 casas.
Transparencia financiera, PQRS, y directorio de proveedores.

## Strategic role

Anchor on `../../../docs/ml-collaborator-brief.md` (canonical) and `../../../docs/strategic-positioning.md` (deeper companion). The brief wins when they disagree.

- This repo is **both an active live deployment AND a proving ground for `ph-management`**. It serves 118 APROVIVA families daily and is also where new product features should ideally face real residents before being extracted upstream.
- This is **not** the main white-label product direction (that role belongs to `ph-management`). It is also **not** legacy, archived, or merely historical — it is an ongoing live implementation that continues to inform the evolution of the platform.
- Investment here should ideally create value in two directions (per the brief's important constraint): (a) support the live operational needs of Villa Valencia, and (b) extract and upstream validated product capabilities into `ph-management`. Most new product work can serve both at once.
- Resident-facing surface promise: residents only see `villavalencia.vercel.app`. Cross-origin calls to `ph-management.vercel.app` are an internal implementation detail — never surface that domain to residents. **Direction:** migrate VV PQRS **here** (VV Supabase + this repo) per `docs/PQRS-MIGRATION-PH-TO-VV.md`; ph-management stays the **product**, Villa Valencia stays the **deployment**.
- Customer-glue allowance: Google Drive uploads via Apps Script, Apps Script-backed dashboards (presupuesto, proveedores, reporting), and similar customer integrations are valid and stay here. Some will eventually get extracted into `ph-management` as configurable modules; others will stay customer-specific forever — both outcomes are fine.

## Arquitectura

- **Frontend:** Static HTML/CSS/JS hosted on GitHub Pages
- **Backend (PQRS submit/lookup):** Hoy `https://ph-management.vercel.app`; **objetivo** — API + datos en el stack Villa Valencia (Supabase `tgoitmwdpdkhlpqpwrvs` / este repo). Ver `docs/PQRS-MIGRATION-PH-TO-VV.md`.
- **Backend (dashboard, presupuesto, proveedores):** Google Apps Script web app (deployed v15)
- **Data:** Supabase (`pqrs_cases`) + Google Sheets (Budget/Reporting/legacy PQRS history)
- **Live URL:** https://villavalencia.vercel.app/

## Orden ejecutiva (actualizada)

- Este repo representa el portal real de Villa Valencia / APROVIVA para usuarios finales.
- El portal **depende hoy** de la API en `https://ph-management.vercel.app` para submit/lookup; la migración prevista **devuelve** esos endpoints al runtime Villa Valencia (`docs/PQRS-MIGRATION-PH-TO-VV.md`) sin confundir este repo con el producto ph-management.
- Lo demás (dashboard de transparencia, presupuesto, proveedores) sigue en Google Apps Script + Sheets — no migrar sin decisión humana explícita.
- No convertir este portal en sitio comercial de PH Management. La copia y branding siguen siendo APROVIVA / Villa Valencia.

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

## Publishing Default

- For ad-hoc preview/demo/share links, default to `here.now` (skill: `here-now`).
- Prefer `here.now` for agent-generated static sharing to reduce Vercel costs.
- Keep existing production endpoints and live runtime URLs unchanged unless explicit migration is requested.

## Clasp

- Path: `~/.local/bin/clasp` (v3.3.0)
- CLI tokens lack script.scriptapp and full Drive scopes — run trigger/scope-sensitive functions from Apps Script editor
- Push, version, deploy work from CLI
