# Recorridos Data Backbone Runbook

Status: prepared for Villa Valencia/APROVIVA. Do not deploy from this worktree unless explicitly approved.

## Purpose

Migration `aproviva-suite/supabase/migrations/20260429120000_inspection_plan_data_backbone.sql` adds the production data backbone for the SAP-style recorrido redesign:

`inspection_plans -> inspection_plan_points -> inspection_rounds -> inspection_round_results -> inspection_findings -> work/inventory/vendor exceptions`.

The current Gemba UI can continue writing legacy `inspection_rounds` and `inspection_findings` rows. New columns are nullable bridges for the future planned execution UI.

## What Changes

- Creates `inspection_plans`, `inspection_plan_points`, and `inspection_round_results`.
- Adds nullable bridge columns to existing tables when present:
  - `inspection_rounds`: `building_id`, `inspection_plan_id`, `plan_code`, `assigned_to_label`, `due_at`.
  - `inspection_findings`: `inspection_round_result_id`, `inspection_plan_point_id`, `derivation_type`, derived incident/work assignment ids.
  - `work_assignments`: `building_id`, `inspection_finding_id`, `inspection_round_id`, `vendor_followup_required`.
  - `incident_tickets`: `inspection_finding_id`, `inspection_round_id`.
- Seeds two Villa Valencia plans, guarded by `building_id = 88e6c11e-4a8c-4f39-a571-5f97e7f2b774`.
- Creates `v_md04_lite_exceptions` and `get_md04_lite_exceptions(uuid)` for due/overdue rounds, open findings, overdue work/vendor follow-up, and inventory reorder exceptions.

## Apply Order

1. Confirm the current VV Supabase project is selected: `tgoitmwdpdkhlpqpwrvs`.
2. Apply pending earlier migrations first, especially:
   - `20260421120000_site_place_geo_pqrs_map.sql`
   - `20260423120000_gemba_round_templates.sql`
3. Apply `20260429120000_inspection_plan_data_backbone.sql`.
4. If using the one-paste workflow, apply the older bundle first, then this migration file separately. The bundle may be refreshed later, but the standalone migration is canonical for this change.

## Verification SQL

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

## Rollback Notes

This migration is additive. If a rollback is required before any new UI depends on it:

```sql
drop function if exists public.get_md04_lite_exceptions(uuid);
drop view if exists public.v_md04_lite_exceptions;
drop table if exists public.inspection_round_results;
drop table if exists public.inspection_plan_points;
drop table if exists public.inspection_plans;
```

Leave nullable bridge columns in place unless a DBA confirms no clients are reading them. Removing bridge columns is not required to restore current Gemba behavior and is riskier than leaving them dormant.

## Operational Notes

- Existing ad-hoc recorridos remain valid because `inspection_rounds.inspection_plan_id` is nullable.
- Existing hallazgos remain valid because `inspection_findings.inspection_round_result_id` is nullable.
- RLS follows the current APROVIVA suite POC posture: permissive anon/authenticated policies behind the PIN-gated static UI. Tighten this after Supabase Auth or service-role edge functions exist.
- The seed data is intentionally small. It establishes the production shape without forcing the current UI to execute point-by-point yet.
