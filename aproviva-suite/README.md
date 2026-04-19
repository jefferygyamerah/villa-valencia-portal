# APROVIVA Operations Suite

Single-page operations app for Villa Valencia / APROVIVA, covering the 19 business
scenarios across 5 roles (conserje, admin de planta, supervisor, gerencia, junta).

- **Live (production):** https://villavalencia.vercel.app/aproviva-suite/
- **Preview (here.now):** https://whole-crystal-6gt7.here.now/
- **Stack:** Vanilla HTML / CSS / JS (no build step) over Supabase REST + RLS.
- **Auth:** PIN-based session (`2026` = staff/conserjeria, `JD26` = junta/administracion). POC-grade — see security note below.
- **Data:** Live Supabase project `tgoitmwdpdkhlpqpwrvs` (47 already-migrated tables). **PQRS** cases table: `supabase/migrations/20260422120000_pqrs_cases.sql` (portal toggles via `js/config.js` `PQRS_USE_VV_SUPABASE`). See `../docs/PQRS-MIGRATION-PH-TO-VV.md`. Map/recorrido: `20260420120000_recorrido_map_waypoints.sql`, `20260421120000_site_place_geo_pqrs_map.sql`, optional `20260421130000_drop_duplicate_pqrs_map_objects.sql`.

## Modules

| Route | Role | Tables |
|---|---|---|
| `#/inicio` | all | cross-table KPIs |
| `#/inventario` | staff + junta | `inventory_items`, `inventory_locations`, `inventory_movements` |
| `#/gemba` | staff + junta | `inspection_rounds`, `inspection_findings` |
| `#/mapa` | staff + junta | static `data/villa-valencia-site.geojson` + **`recorrido_map_waypoints`** (waypoints CRUD; junta/supervisor places points) |
| **`mapa-pqrs.html`** | public (no login) | Same GeoJSON + read-only waypoints from Supabase — linked from **PQRS** on the main portal for residents |
| `#/incidencias` | staff + junta | `incident_tickets` (+ `escalation_events` on escalate) |
| `#/proyectos` | junta only | `work_assignments` |
| `#/maestros` | junta only | `inventory_items`, `inventory_locations`, `buildings`, `admin_users` |
| `#/reportes` | junta only | reads all of the above; CSV export |
| `#/junta` | junta only | `escalation_events`, `weekly_reports`, `compliance_cases`, `work_assignments` |

## Scenario coverage

All 19 scenarios from the master scenario list are implemented; 14 are LIVE end-to-end (write + read against Supabase), 5 are PARTIAL (function exists, gap noted in `../docs/test-findings/comprehensive.md`).

## Security note (POC)

This is a POC. The publishable Supabase key in `js/config.js` allows anonymous reads and writes against the operational tables. RLS policies on those tables are permissive today — the assumption is internal-only access via the PIN gate. Before opening this surface to residents at scale, RLS policies must scope writes to authenticated `admin_users`.

The PIN gate (`2026` / `JD26`) is UI-level only. It does not authenticate against Supabase. Both the keys and the gate are visible in the page source. Treat this app as open to anyone who has the URL and a valid PIN.

## Files

```
aproviva-suite/
├── index.html                    # SPA shell + script load order
├── css/suite.css                 # mobile-first stylesheet
├── README.md                     # this file
├── supabase/migrations/          # DDL for map + PQRS/hallazgos layers (run in Supabase)
└── js/
    ├── config.js                 # Supabase URL + publishable key + PIN map + building ID
    ├── supabase.js               # thin REST wrapper (select / insert / update / remove / rpc)
    ├── auth.js                   # PIN session storage + role gating
    ├── ui.js                     # toast / table / fmtDate / esc / loading / error helpers
    ├── router.js                 # hash router with role-gated nav
    └── modules/
        ├── login.js              # PIN entry
        ├── inicio.js             # role-aware home + KPIs
        ├── inventario.js         # Scenarios 1, 2 (count, alerts, novedad)
        ├── gemba.js              # Scenarios 4-10 (recorridos + hallazgos)
        ├── mapa.js               # Site map: GeoJSON perimeter/route + Supabase waypoints
        ├── incidencias.js        # Scenarios 3, 7 (triage + advance + escalate)
        ├── proyectos.js          # Scenarios 8, 9 (work assignments, junta-only)
        ├── maestros.js           # Scenario 11 (master data, junta-only)
        ├── reportes.js           # Scenarios 12-15 (daily, weekly, escalations, KPI CSV)
        └── junta.js              # Scenarios 16-19 (governance dashboard)
```

## Local dev

There is no build step. To run locally, serve the `aproviva-suite/` folder with any static server:

```bash
cd aproviva-suite
python3 -m http.server 8081
# Open http://localhost:8081/
```

Or use here.now to publish a preview:

```bash
bash ~/.claude/skills/here-now/scripts/publish.sh aproviva-suite --client cursor --spa
```

## Conventions

- All user-facing copy is Spanish.
- Internal code is English.
- No npm dependencies; no framework.
- No new Google integrations (Drive remains the only allowed Google use, for photo upload — `inspection_findings.photo_url` is the field; uploader UI still TODO).
- Every Supabase write tags `metadata.actorRole` and `metadata.actorLabel` so the audit log captures which PIN session performed the action.
