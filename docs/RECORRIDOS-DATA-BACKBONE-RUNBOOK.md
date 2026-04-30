# Recorridos Data Backbone Runbook — Villa Valencia

## Status

This is the current production direction after the 2026-04-29 SAP-inspired recorrido correction.

Production site:

- `https://villavalencia.vercel.app/`

Latest known production commit:

- `068854b fix(vv): stabilize recorrido plan gate`

Validated gates after push:

- local targeted Playwright: **20/20 passed**;
- GitHub Actions E2E: **passed**.

## Principle

Villa Valencia is production, not a throwaway demo. Recorridos must be built around durable operations logic: inspection plans, inspection points, execution instances, findings, owner/SLA assignment, follow-up, inventory/vendor links, and exception visibility.

Borrow SAP-style functional logic, not SAP complexity or UI.

## Canonical recorrido flow

1. **Supervisor/admin creates Plan Maestro**
   - defines the recurring inspection task list;
   - names the area/system;
   - sets expected execution cadence/context.

2. **Plan contains Puntos de Inspección**
   - each point is a concrete checkable item;
   - examples: elevator status, pump room, lighting, access control, pool, lobby, fire equipment, doors/gates, water tanks, cameras, common-area cleanliness.

3. **Conserje executes scheduled recorrido instance**
   - opens the plan;
   - checks each point;
   - records OK / issue / blocked / not inspected;
   - adds notes/photos where relevant.

4. **Hallazgo/finding attaches to point context**
   - no floating findings without area/point/execution context;
   - finding should indicate severity, owner, next action, due date, evidence, and whether vendor/inventory/board action is needed.

5. **Operations reviews exception board**
   - due/overdue executions;
   - missing points;
   - blocked points;
   - critical findings;
   - follow-up actions;
   - vendor and inventory requirements.

## Current shipped baseline

The current production suite supports the first stable backbone:

- Plan Maestro creation;
- inspection point creation;
- recorrido execution against the plan;
- finding capture tied to inspection context;
- production route guardrails preserved.

## Data backbone migration details

Migration `aproviva-suite/supabase/migrations/20260429120000_inspection_plan_data_backbone.sql` adds the production data backbone for the SAP-style recorrido redesign:

```text
inspection_plans -> inspection_plan_points -> inspection_rounds -> inspection_round_results -> inspection_findings -> work/inventory/vendor exceptions
```

The current Gemba UI can continue writing legacy `inspection_rounds` and `inspection_findings` rows. New columns are nullable bridges for the future planned execution UI.

### What changes

- Creates `inspection_plans`, `inspection_plan_points`, and `inspection_round_results`.
- Adds nullable bridge columns to existing tables when present:
  - `inspection_rounds`: `building_id`, `inspection_plan_id`, `plan_code`, `assigned_to_label`, `due_at`.
  - `inspection_findings`: `inspection_round_result_id`, `inspection_plan_point_id`, `derivation_type`, derived incident/work assignment ids.
  - `work_assignments`: `building_id`, `inspection_finding_id`, `inspection_round_id`, `vendor_followup_required`.
  - `incident_tickets`: `inspection_finding_id`, `inspection_round_id`.
- Seeds two Villa Valencia plans, guarded by `building_id = 88e6c11e-4a8c-4f39-a571-5f97e7f2b774`.
- Creates `v_md04_lite_exceptions` and `get_md04_lite_exceptions(uuid)` for due/overdue rounds, open findings, overdue work/vendor follow-up, and inventory reorder exceptions.

### Apply order

Do not apply remote database changes without explicit approval.

If approved:

1. Confirm the current VV Supabase project is selected: `tgoitmwdpdkhlpqpwrvs`.
2. Apply pending earlier migrations first, especially:
   - `20260421120000_site_place_geo_pqrs_map.sql`
   - `20260423120000_gemba_round_templates.sql`
3. Apply `20260429120000_inspection_plan_data_backbone.sql`.
4. If using the one-paste workflow, apply the older bundle first, then this migration file separately. The standalone migration is canonical for this change.

### Verification SQL

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

### Rollback notes

This migration is additive. If a rollback is required before any new UI depends on it:

```sql
drop function if exists public.get_md04_lite_exceptions(uuid);
drop view if exists public.v_md04_lite_exceptions;
drop table if exists public.inspection_round_results;
drop table if exists public.inspection_plan_points;
drop table if exists public.inspection_plans;
```

Leave nullable bridge columns in place unless a DBA confirms no clients are reading them. Removing bridge columns is not required to restore current Gemba behavior and is riskier than leaving them dormant.

### Operational notes

- Existing ad-hoc recorridos remain valid because `inspection_rounds.inspection_plan_id` is nullable.
- Existing hallazgos remain valid because `inspection_findings.inspection_round_result_id` is nullable.
- RLS follows the current APROVIVA suite POC posture: permissive anon/authenticated policies behind the PIN-gated static UI. Tighten this after Supabase Auth or service-role edge functions exist.
- The seed data is intentionally small. It establishes the production shape without forcing the current UI to execute point-by-point yet.

## Remaining SAP-gap work

These are the next technical gaps to close:

1. **MD04-lite exception board**
   - view due, overdue, blocked, missing, critical, vendor, inventory, and follow-up items;
   - sort by severity/date/responsible owner;
   - keep it operations-first, not developer-first.

2. **Owner/SLA assignment**
   - every exception should have a responsible person/role;
   - store due date, SLA, acknowledgement, and close reason where relevant.

3. **RLS / browser write hardening**
   - review pilot-open write paths;
   - ensure browser clients cannot mutate records outside allowed community/suite constraints;
   - document required SQL before remote application.

4. **n8n notification/reminder scaffold**
   - manual approval first;
   - critical finding alerts;
   - overdue recorrido reminders;
   - no external send until Jeff approves credentials and workflow boundary.

5. **QA / go-no-go gates**
   - keep targeted Playwright coverage for suite routes and recorrido flows;
   - do not push production changes without green gates.

## Implementation boundary

This work belongs in the Villa Valencia portal / Pi SAP cell unless Jeff explicitly reassigns it.

Do not mix it with PropTechPA sales-site polishing or Cursor product-copy work.

PropTechPA may later extract reusable concepts from this backbone:

- inspection templates;
- inspection runs;
- inspection findings;
- work orders;
- asset/inventory links;
- vendor follow-up;
- exception board.

But Villa Valencia remains the production proof environment.

## Quick verification

From the repo:

```bash
cd /home/jeffery/Adwen-Tech/apps/villa-valencia-portal
git status --short --branch
npm --prefix e2e test -- --grep "suite routes|recorrido|Villa Valencia boundary"
```

If testing production:

```bash
cd /home/jeffery/Adwen-Tech/apps/villa-valencia-portal/e2e
BASE_URL=https://villavalencia.vercel.app npm run test:prod
```
