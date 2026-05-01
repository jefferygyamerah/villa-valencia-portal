# Villa Valencia production proof — 2026-05-01

Status: **passed after cleanup of pre-existing live test drift**

Production URL: <https://villavalencia.vercel.app>

## Purpose

Before transferring Villa Valencia/APROVIVA patterns into the white-label PH Management app or sales website, Villa must be proven as the reference implementation.

This proof gate verifies:

- public resident portal is reachable and premium PQRS trust copy is deployed;
- standalone PQRS map is read-only and loads;
- suite login has demo-safe posture;
- governance/board surfaces render;
- field modules render premium shell without triggering writes;
- live PQRS lookup works;
- live MD04 prerequisites remain compatible;
- deployed assets contain expected premium markers;
- production data is strict seed-only after verification.

## Read-only browser proof

Command:

```bash
cd e2e
BASE_URL=https://villavalencia.vercel.app npx playwright test tests/production-proof-readonly.spec.ts --project=chromium
```

Result:

- `4 passed`

Covered:

1. Public resident path: hero, role path, PQRS journey, privacy note, modal privacy note.
2. Standalone PQRS map: read-only badge, summary, legend, Leaflet map root.
3. Suite login + governance: private access note, demo/QA disclosure, Junta scorecard, Reportes board packet.
4. Field modules: Inventario, Gemba, Mapa, Incidencias premium hero/privacy shell.

## Production smoke proof

Commands:

```bash
node scripts/production-smoke.mjs
node scripts/pqrs-rpc-smoke.mjs --live --known-ref VV-PQRS-E2E-000001
node scripts/recorridos-md04-preflight.mjs --live
```

Result:

- HTTP smoke OK for `/`, `/js/config.js`, `/aproviva-suite/index.html`, `/aproviva-suite/mapa-pqrs.html`, `/proveedores.html`.
- Villa Supabase URL present.
- `PQRS_USE_VV_SUPABASE` true.
- Legacy `ph-management` fallback retained only for rollback.
- PQRS fake lookup returned zero rows.
- Known lookup `VV-PQRS-E2E-000001` returned itself.
- MD04 live prerequisite checks OK for required tables/columns.
- No writes performed by these smokes.

## Deployed asset marker proof

Verified expected production markers in deployed files:

- `portal-role-path-strip`
- `portal-pqrs-journey`
- `portal-pqrs-privacy-note`
- `mapa-pqrs-readonly-badge`
- `mapa-pqrs-legend`
- `suite-login-security-note`
- `suite-demo-access`
- `junta-premium-hero`
- `junta-scorecard`
- `reportes-premium-hero`
- `board-packet`
- `gemba-premium-hero`
- `gemba-privacy-note`
- `inventario-premium-hero`
- `inv-privacy-note`
- `mapa-premium-hero`
- `mapa-privacy-note`
- `inc-premium-hero`
- `inc-privacy-note`
- `legacy-portal-notice`

## Production data proof

A count check initially found live test drift created earlier:

- `inspection_rounds=3` expected `1`
- `inspection_findings=2` expected `1`

Non-seed rows were removed immediately. Final strict seed-only check passed:

| Table | Expected | Final |
| --- | ---: | ---: |
| inspection_plans | 1 | 1 |
| inspection_rounds | 1 | 1 |
| inspection_findings | 1 | 1 |
| work_assignments | 1 | 1 |
| incident_tickets | 1 | 1 |
| inventory_locations | 1 | 1 |
| inventory_items | 1 | 1 |
| inventory_movements | 1 | 1 |
| service_listings | 1 | 1 |
| documents | 1 | 1 |
| weekly_reports | 1 | 1 |
| spend_policies | 1 | 1 |
| escalation_events | 0 | 0 |

## Gate decision

Villa Valencia is proven enough to remain the reference implementation for the next planning phase, with one operational caveat:

- Any live manual/E2E interaction with Gemba or Inventario can create Supabase drift; future proof runs should use the read-only proof spec and mocked tests by default, then finish with seed-only REST counts.

The PH Management / sales-site transfer lane should not import real Villa data and should continue treating Villa as a case-study/demo reference, not as generic app copy.
