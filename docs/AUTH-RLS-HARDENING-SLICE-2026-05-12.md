# Auth/RLS hardening slice — APROVIVA Villa Valencia

Status: docs-only planning slice, 2026-05-12. This document does **not** authorize production config changes, deploys, Supabase mutations, data imports, deletes, or policy applies.

## Current posture inspected

- Frontend auth is PIN/sessionStorage only (`aproviva-suite/js/auth.js`, `aproviva-suite/js/config.js`). PINs map to UI roles/modules: conserje, supervisor, gerencia, junta.
- The browser Supabase client (`aproviva-suite/js/supabase.js`) sends the public publishable key as both `apikey` and `Authorization: Bearer <publishable key>` for all REST/RPC calls.
- Existing RLS doc (`docs/RLS-STRATEGY.md`) correctly states the PIN gate is a soft UI boundary, not a database identity boundary.
- PQRS is the strongest current RLS pattern: anonymous insert constrained to the Villa Valencia `building_id`; direct select/update blocked; lookup via `lookup_pqrs_case(text)`.
- Operational suite tables still rely on permissive anon/authenticated policies or project defaults for browser writes. Known permissive policy files include map waypoints, site geo, Gemba templates, and inspection plan/result backbone migrations.
- Mutating browser paths are broad: inventory movements, incident tickets, work assignments, map points, master data, building metadata, inspection rounds/findings, and escalation events all call `window.SB.insert/update/remove` directly from static JS.

## Recommended next slice

**Goal:** introduce a real staff identity boundary without breaking the controlled PIN demo path.

The smallest useful slice is **Auth foundation + read/write policy scaffold**, not immediate lockdown of every table. It should prove one end-to-end authenticated role can write one low-risk operational workflow while the rest of the suite stays in documented POC mode.

### Slice scope

1. Add Supabase Auth for internal staff/junta users.
2. Map `auth.users.id` to existing or new staff profile rows (`admin_users` if it can safely carry `auth_user_id`, otherwise a small `staff_identities` bridge).
3. Define role/building claims in database tables, not in frontend PIN config.
4. Convert exactly one low-risk workflow first: recommended `gemba_round_templates` or `recorrido_map_waypoints`, because both are already isolated by `building_id` and have explicit migrations.
5. Keep PIN UX only as a convenience/demo selector until every mutating path uses Auth-backed policies or an Edge Function.

Out of scope for this slice: broad production lock-down, secret rotation, service-role Edge Function migration, historical imports, and changing resident PQRS behavior.

## Implementation sequence

### 0) Preflight inventory — read-only

- Export or inspect table definitions for:
  - `admin_users`
  - `buildings`
  - `inventory_items`, `inventory_locations`, `inventory_movements`
  - `inspection_rounds`, `inspection_findings`, `inspection_plans`, `inspection_plan_points`, `inspection_round_results`
  - `incident_tickets`, `escalation_events`
  - `work_assignments`
  - `recorrido_map_waypoints`, `site_place_geo`, `gemba_round_templates`
- Confirm each mutating table has a reliable `building_id` or a deterministic join to a row with `building_id`.
- Confirm there is at least one active staff/admin row for Villa Valencia and which current PIN role it corresponds to.
- Capture current policies from `pg_policies` before changes.

### 1) Identity bridge migration — dry-run first

Preferred model:

```sql
-- conceptual only; do not run from this document
alter table public.admin_users
  add column if not exists auth_user_id uuid unique references auth.users(id),
  add column if not exists role text,
  add column if not exists is_active boolean default true;
```

If `admin_users` is shared/fragile, create a separate bridge:

```sql
-- conceptual only; do not run from this document
create table public.staff_identities (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id),
  admin_user_id uuid,
  building_id uuid not null,
  role text not null check (role in ('conserje', 'supervisor', 'gerencia', 'junta')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

Add helper functions only after confirming schema:

- `current_staff_building_id()` returns the caller's active building id.
- `current_staff_role()` returns the caller's role.
- `current_staff_can_write(required_roles text[])` checks active identity + role.

Use `security definer`, fixed `search_path`, and minimal grants. Avoid leaking full staff rows to the browser.

### 2) Frontend auth adapter — feature-flagged

- Add an auth adapter around `window.SB` that can use either:
  - current publishable-key-only mode, or
  - Supabase Auth session access token.
- Do **not** remove PINs in this slice. Instead, add a feature flag such as `AUTH_MODE: 'pin-demo' | 'supabase-auth'`.
- When `AUTH_MODE='supabase-auth'`, `Authorization` must use the Supabase Auth session JWT, not the publishable key.
- Preserve existing route/module tests for all PIN roles until Supabase Auth flows have equivalent tests.

### 3) First RLS conversion — choose one table family

Recommended first table: `gemba_round_templates`.

Why:

- Already scoped by `building_id`.
- Current policies are explicitly permissive and easy to replace.
- It exercises read + create/delete without touching resident data, inventory counts, or incidents.

Target policy posture:

- `SELECT`: authenticated active staff for same building; optionally keep anon select only if the static demo still needs it, but document that as a temporary exception.
- `INSERT/UPDATE/DELETE`: authenticated active `supervisor` or `gerencia` for same building.
- `WITH CHECK`: new/changed rows must keep `building_id = current_staff_building_id()`.

Defer higher-risk tables (`inventory_movements`, `incident_tickets`, `work_assignments`, `inspection_findings`) until the first table family passes tests.

### 4) Rollout gate

- Apply in a non-production Supabase project first, or make a production backup/export and policy snapshot before applying.
- Enable `AUTH_MODE='supabase-auth'` only for a small internal QA path.
- Do not tighten operational anon write policies until the frontend is confirmed to send Auth JWTs.

## Risk notes

- **Immediate lockdown risk:** switching existing operational policies from anon to authenticated before frontend JWT support will break all suite writes.
- **False-security risk:** keeping PINs while adding Auth can confuse operators. UI copy must say PIN is demo/convenience unless backed by a real session.
- **Schema risk:** some operational tables may lack direct `building_id` or have nullable backfilled IDs. Do not write policies that assume complete building scope until verified.
- **Service-role risk:** Edge Functions can be secure, but moving writes there increases operational surface. This slice should prove Supabase Auth/RLS first unless a specific workflow cannot be expressed safely in RLS.
- **Public map risk:** `recorrido_map_waypoints` and `site_place_geo` may support public/embedded reads. Separate public read policies from staff write policies.
- **Junta role risk:** Junta may need read access but should generally not mutate operational records. Treat `junta` as read/reporting first.

## Test gates

### Static/code gates

- `grep`/review confirms no new hard-coded secret keys beyond the existing publishable key.
- Supabase client sends publishable key as `apikey`, but Auth JWT as `Authorization` when signed in.
- Feature flag defaults preserve current demo behavior until explicitly changed.

### SQL/policy gates

Run against staging or controlled SQL editor session, not blindly from agents:

- Snapshot current policies:
  - `select * from pg_policies where schemaname = 'public' order by tablename, policyname;`
- Assert no anon writes on the converted table after policy swap.
- Assert authenticated supervisor/gerencia can insert/update/delete only for Villa Valencia building.
- Assert authenticated conserje/junta cannot mutate the converted table.
- Assert cross-building writes fail even for supervisor/gerencia.

### Browser/E2E gates

- Existing PIN route/module smoke remains green in `pin-demo` mode.
- New Supabase Auth login path can establish a session and route to the same modules.
- Converted workflow succeeds for allowed role and shows a clear denial for disallowed role.
- Public PQRS submit/lookup still works and does not gain table select access.

### Production go/no-go

Go only when all are true:

- Policy snapshot and rollback SQL are saved.
- At least one real internal user is mapped to Villa Valencia with a role.
- Frontend Auth JWT is verified in network requests.
- Converted table has passing allowed/denied tests.
- Jeff/admin explicitly approves Supabase production mutation.

## Suggested follow-up order after first slice

1. `gemba_round_templates` staff write policies.
2. `recorrido_map_waypoints` / `site_place_geo`: public read + staff-only write.
3. `inspection_plans` / `inspection_plan_points` / `inspection_round_results`.
4. `inspection_rounds` / `inspection_findings`.
5. `incident_tickets` / `escalation_events`.
6. `inventory_*`.
7. `work_assignments`.
8. Remove or demote frontend PINs after Auth coverage is complete.
