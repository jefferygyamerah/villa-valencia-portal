# Auth/RLS Hardening Implementation Plan — 2026-05-12

Status: next premium/readiness slice after commit `4375545` (`feat(vv): add premium audit history center`). This is a plan only: no production mutation, deploy, key rotation, or Supabase policy apply is authorized by this document.

## Why this is the highest-leverage next slice

APROVIVA now has a strong operations-to-board evidence story: board packet, Junta scorecard, premium module shell, public/PQRS polish, SOP, and a read-only audit/history center. The remaining caveat that weakens a premium pilot is security posture: the suite is still a static browser app using the publishable Supabase key plus UI PIN gating.

The next sellable slice should make that caveat smaller without disrupting the demo: add a real staff auth boundary for writes, then tighten RLS table-by-table behind feature flags.

## Current state audit

- `aproviva-suite/js/auth.js` stores a local PIN session only; it does not create a Supabase Auth session or server-verified token.
- `aproviva-suite/js/supabase.js` sends direct REST requests from the browser with the publishable anon key.
- Operational migrations intentionally contain permissive POC policies for tables such as `recorrido_map_waypoints`, `site_place_geo`, `gemba_round_templates`, and the inspection plan backbone.
- PQRS is stronger than the internal suite: public insert is constrained to Villa Valencia and lookup goes through `lookup_pqrs_case(text)`.
- Existing docs already disclose the caveat in `aproviva-suite/README.md`, `docs/RLS-STRATEGY.md`, `docs/P3-MODULE-PACKAGING-QA-MATRIX.md`, and the role SOP.

## Recommended implementation wave: `SEC-001` Staff auth gateway for suite writes

Goal: preserve the current four-role UX while moving mutating operations off direct anon browser writes.

### Architecture decision

Use a small Supabase Edge Function (or equivalent serverless gateway) for suite mutations before attempting broad RLS lockdown.

Why this first:
- fewer UI changes than replacing PIN UX with full email/password immediately;
- allows server-side validation of role, table, action, and allowed fields;
- can tag `metadata.actorRole` / `metadata.actorLabel` consistently;
- lets read-only Junta/reporting pages continue working while writes are migrated module-by-module.

## Exact files to add/change

### New server/gateway layer

- `supabase/functions/vv-suite-write/index.ts` *(new)*
  - Accepts `{ table, action, payload, match, clientMutationId }`.
  - Validates an HMAC/signed suite session or Supabase Auth JWT before using service role.
  - Whitelists table/action/field combinations by APROVIVA role.
  - Rejects PII/banking fields on executive/reporting routes.
  - Adds audit metadata: actor role, actor label, request id, timestamp, source module.

- `supabase/functions/vv-suite-session/index.ts` *(new, only if keeping PIN UX temporarily)*
  - Exchanges a valid demo/pilot PIN for a short-lived signed role token.
  - Rate-limits attempts.
  - Keeps actual PINs out of shipped JS when production mode is enabled.

- `supabase/functions/_shared/vv-suite-policy.ts` *(new)*
  - Central role/table/action matrix used by gateway tests.

### Frontend integration

- `aproviva-suite/js/config.js`
  - Add `SUITE_WRITE_MODE: 'direct' | 'gateway'` and gateway URLs.
  - Add `DEMO_PIN_SHORTCUTS_ENABLED` so quick PIN buttons can be disabled for pilot.

- `aproviva-suite/js/auth.js`
  - Store gateway-issued role token/session expiry instead of only local PIN state when gateway mode is enabled.
  - Preserve role/module shape for router compatibility.

- `aproviva-suite/js/supabase.js`
  - Route `insert`, `update`, and `remove` through `vv-suite-write` when `SUITE_WRITE_MODE === 'gateway'`.
  - Keep existing direct REST path as local/demo fallback only.
  - Keep `select` read path unchanged in the first wave.

### First module to migrate

Start with `incidencias` because it is commercially visible and exercises create → assign/action → close/escalate:

- `aproviva-suite/js/modules/incidencias.js`
- `aproviva-suite/js/modules/inicio.js` if its incident quick actions write
- `e2e/tests/incident-lifecycle.spec.ts`

Then migrate:
1. `gemba.js` + map finding writes;
2. `inventario.js` count/movement writes;
3. `proyectos.js` backlog/capital project writes;
4. `maestros.js` master data writes.

## Database/RLS wave after gateway proves stable

Add a later migration, not first, after frontend writes are gateway-backed:

- `aproviva-suite/supabase/migrations/20260512_suite_rls_hardening_phase1.sql` *(new later)*
  - Revoke direct anon `INSERT/UPDATE/DELETE` from migrated operational tables.
  - Keep required `SELECT` policies for role-safe views.
  - Preserve PQRS public insert/lookup policies.
  - Add rollback comments and verification queries.

## Focused tests

### Unit/static checks

- `node --check aproviva-suite/js/auth.js`
- `node --check aproviva-suite/js/supabase.js`
- `node --check aproviva-suite/js/modules/incidencias.js`

### Gateway tests

- `supabase/functions/vv-suite-write` policy tests:
  - conserje can create/close permitted incident records only;
  - junta cannot mutate operational incidents;
  - unknown table/action rejected;
  - forbidden fields rejected;
  - actor metadata is attached;
  - replayed `clientMutationId` is idempotent or safely rejected.

### Playwright tests

- `e2e/tests/public-login-polish.spec.ts`
  - production/pilot mode hides demo quick PINs and states non-final auth posture.

- `e2e/tests/incident-lifecycle.spec.ts`
  - mock gateway and assert incident writes call gateway, not direct Supabase REST.
  - assert non-GET direct Supabase calls remain zero in gateway mode.

- `e2e/tests/production-proof-readonly.spec.ts`
  - keep production proof read-only; verify no mutation calls are made by proof routes.

### SQL verification before any live apply

- dry-run review of generated migration;
- policy introspection query against staging/private clone;
- read-only production probe only after explicit approval.

## Acceptance criteria for `SEC-001`

- Direct anon writes can be disabled for at least one full workflow without breaking the UI.
- Incident lifecycle writes are server-validated by role and table/action whitelist.
- Existing PIN UX still works for a controlled demo, but production mode can hide demo shortcuts.
- All write attempts carry actor metadata and request id.
- Junta/reporting read-only dashboards still render with no writes.
- No production data mutation or deploy happens without fresh approval.

## Not in this slice

- Full resident identity/accounts.
- Accounting/payment security.
- Broad table-by-table RLS lockdown before a gateway-backed workflow proves stable.
- Any production policy apply, key rotation, or data import.
