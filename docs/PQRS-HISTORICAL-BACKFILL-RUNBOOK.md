# PQRS historical backfill and decommission runbook

Status: Wave 6 production-readiness prep. This document is a plan only; it does not authorize agents to mutate production data.

## Goal

Move Villa Valencia PQRS history that still lives in `ph-management` into the Villa Valencia Supabase project (`tgoitmwdpdkhlpqpwrvs`) without creating test rows, overwriting resident cases, or losing lookup continuity.

New resident PQRS submit/lookup already uses `villavalencia.vercel.app` + the Villa Valencia Supabase project. This runbook closes the remaining historical/admin continuity gap.

## Safety rules

- Do not run imports, deletes, tenant freezes, or production SQL mutations without Jeff approval.
- Do not commit resident exports, CSVs, SQL dumps, emails, names, phone numbers, or case descriptions to this repo.
- Use `/tmp` or an approved private machine path for export files.
- Prefer read-only discovery and offline validation until the import window is approved.
- Preserve original `case_reference` values so resident lookup codes keep working.

## Phase 0: read-only discovery in ph-management

Run these only in the ph-management database/admin environment. Adjust table and tenant filters to the actual ph-management schema.

```sql
-- Identify the Villa Valencia tenant/building/org id used by ph-management.
select id, name, slug
from public.buildings
where lower(name) like '%villa valencia%'
   or lower(slug) like '%villa-valencia%';

-- Count the candidate historical PQRS rows before exporting.
select count(*) as pqrs_rows,
       min(created_at) as first_case,
       max(created_at) as latest_case
from public.pqrs_cases
where building_id = '<PH_MANAGEMENT_VV_BUILDING_ID>';

-- Pick 3-5 known references for post-import lookup smoke.
select case_reference, status, created_at
from public.pqrs_cases
where building_id = '<PH_MANAGEMENT_VV_BUILDING_ID>'
order by created_at desc
limit 5;
```

Do not paste resident descriptions or personal data into logs. The useful handoff artifact is counts, date range, and a few case references.

## Phase 1: export and stage locally

Export to a private CSV outside the repo. The staged CSV should use this canonical header:

```text
case_reference,subject,description,location,email,site_place_id,zona_label,tipo,urgencia,casa,status,created_at,updated_at,metadata
```

Rules:

- `case_reference`: required, unique, preserved from ph-management.
- `status`: one of `recibido`, `en_progreso`, `resuelto`, `cerrado`; map ph-management values before import.
- `metadata`: JSON object. Include original ph-management ids and source fields here, for example `{"source":"ph-management","ph_management_id":"..."}`.
- `building_id`: do not carry the ph-management tenant id into the staged import. The VV import will force `88e6c11e-4a8c-4f39-a571-5f97e7f2b774`.

Offline validation:

```sh
node scripts/pqrs-backfill-validate.mjs --file /tmp/vv-pqrs-backfill.csv
```

Fixture check, safe to run anytime:

```sh
node scripts/pqrs-backfill-validate.mjs --file scripts/fixtures/pqrs-backfill-sample.csv
```

The validator is non-mutating. It reads the CSV only and reports duplicate references, invalid statuses, non-parseable dates, bad metadata JSON, and a known-reference smoke candidate.

## Phase 2: import window

Use a short approved window. Keep `PQRS_USE_VV_SUPABASE: true`; do not switch residents back to ph-management unless rollback is needed.

Recommended import approach:

1. Create a temporary staging table in the Villa Valencia Supabase SQL editor.
2. Load the staged CSV through Supabase Table Editor import or `psql \copy`.
3. Run pre-insert checks against staging.
4. Insert into `public.pqrs_cases` with `ON CONFLICT (case_reference) DO NOTHING`.
5. Record conflicts separately and decide manually whether any should be merged.

Staging table:

```sql
create table if not exists public.pqrs_cases_import_stage (
  case_reference text,
  subject text,
  description text,
  location text,
  email text,
  site_place_id text,
  zona_label text,
  tipo text,
  urgencia text,
  casa text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  metadata jsonb
);
```

Pre-insert checks:

```sql
select count(*) as staged_rows from public.pqrs_cases_import_stage;

select case_reference, count(*)
from public.pqrs_cases_import_stage
group by case_reference
having count(*) > 1;

select status, count(*)
from public.pqrs_cases_import_stage
group by status
order by status;

select s.case_reference
from public.pqrs_cases_import_stage s
join public.pqrs_cases c on c.case_reference = trim(s.case_reference)
limit 50;
```

Import insert:

```sql
insert into public.pqrs_cases (
  building_id,
  case_reference,
  subject,
  description,
  location,
  email,
  site_place_id,
  zona_label,
  tipo,
  urgencia,
  casa,
  status,
  created_at,
  updated_at,
  metadata
)
select
  '88e6c11e-4a8c-4f39-a571-5f97e7f2b774'::uuid,
  trim(case_reference),
  nullif(trim(subject), ''),
  nullif(trim(description), ''),
  nullif(trim(location), ''),
  nullif(trim(email), ''),
  nullif(trim(site_place_id), ''),
  nullif(trim(zona_label), ''),
  nullif(trim(tipo), ''),
  nullif(trim(urgencia), ''),
  nullif(trim(casa), ''),
  coalesce(nullif(trim(status), ''), 'recibido'),
  coalesce(created_at, now()),
  coalesce(updated_at, created_at, now()),
  coalesce(metadata, '{}'::jsonb) || jsonb_build_object('imported_from', 'ph-management')
from public.pqrs_cases_import_stage
where case_reference is not null
  and trim(case_reference) <> ''
on conflict (case_reference) do nothing;
```

## Phase 3: post-import validation

Run these in Villa Valencia Supabase:

```sql
select count(*), min(created_at), max(created_at)
from public.pqrs_cases
where building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774';

select *
from public.lookup_pqrs_case('VV-PQRS-YYYYMMDD-XXXXXX');
```

Then run non-mutating production smokes from this repo:

```sh
node scripts/production-smoke.mjs
node scripts/pqrs-rpc-smoke.mjs --live
node scripts/pqrs-rpc-smoke.mjs --live --known-ref VV-PQRS-YYYYMMDD-XXXXXX
```

Expected:

- production routes/config still report `PQRS_USE_VV_SUPABASE: true`;
- fake lookup returns zero rows;
- each imported known reference returns exactly one row and the same reference.

## Phase 4: ph-management freeze/decommission

Do this only after the import and known-reference checks pass.

Checklist:

- Export archive is saved outside this repo.
- Final delta export after the freeze timestamp is checked and imported if needed.
- ph-management VV tenant PQRS submit path is disabled or made read-only.
- ph-management admin UI for Villa Valencia PQRS shows a freeze banner or redirects staff to the Villa Valencia suite/admin process.
- ph-management no longer creates Villa Valencia PQRS rows after the freeze timestamp.
- `PH_MANAGEMENT_API_BASE` remains in `js/config.js` only as rollback configuration until Jeff declares the cutover final.
- Docs in both repos record the freeze timestamp, exported row count, imported row count, skipped conflict count, and known references validated.

## Rollback

Rollback is operational, not destructive:

1. Set `PQRS_USE_VV_SUPABASE: false` in `js/config.js` and deploy if residents must temporarily use ph-management again.
2. Do not delete imported VV rows unless a DBA approves a targeted cleanup.
3. Keep the import-stage table until counts, conflicts, and known-reference lookup have been reviewed.

## Next-wave handoff

The next agent should not create a production PQRS row. The next concrete step is to obtain either:

- a real known PQRS reference for non-mutating lookup smoke, or
- an approved private ph-management export so `scripts/pqrs-backfill-validate.mjs` can be run against the staged CSV.
