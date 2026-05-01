# Operational real-data-load readiness

Status: Wave 9 readiness package. This document is a non-mutating staging contract only. It does not authorize imports, live database writes, deployment, deletes, or production cleanup.

## Scope

This covers operational data beyond PQRS:

- recorridos / MD04 backbone: `inspection_plans`, `inspection_plan_points`, `inspection_rounds`, `inspection_round_results`, `inspection_findings`;
- incidents and work: `incident_tickets`, `work_assignments`;
- inventory: `inventory_locations`, `inventory_items`, `inventory_movements`;
- providers/services: `service_listings`;
- documents and governance reporting: `documents`, `weekly_reports`, `spend_policies`.

PQRS has its own historical guard in `docs/PQRS-HISTORICAL-BACKFILL-RUNBOOK.md` and `scripts/pqrs-backfill-validate.mjs`.

## Safety rules

- Do not commit real exports, resident names, emails, phone numbers, provider contacts, staff personal data, photos, free-text private notes, or SQL dumps to this repo.
- Stage real exports outside the repo, preferably under `/tmp` or another approved private path.
- Run the offline validator before any import plan is reviewed.
- Actual import still requires private source data, an explicit Jeff approval window, and a separate import script or SQL plan.
- The current production seed-only state must not be mutated by this readiness package.

## Staging formats

The validator accepts either:

```sh
node scripts/vv-operational-load-validate.mjs --bundle /tmp/vv-operational-load.json
node scripts/vv-operational-load-validate.mjs --dir /tmp/vv-operational-load-csv
```

JSON bundle: top-level `meta` plus arrays named after the collections listed above.

CSV directory: one optional file per collection, named `<collection>.csv`, plus optional `meta.json`.

Required staged fields:

| Collection | Required fields |
|---|---|
| `inspection_plans` | `plan_code`, `name`, `category`, `frequency` |
| `inspection_plan_points` | `plan_code`, `point_code`, `label`, `check_type` |
| `inspection_rounds` | `round_number`, `title`, `status`, `scheduled_for` |
| `inspection_round_results` | `round_number`, `point_code`, `result_status` |
| `inspection_findings` | `finding_id`, `round_number`, `description`, `severity`, `status` |
| `incident_tickets` | `ticket_number`, `title`, `category`, `location_label`, `severity`, `status` |
| `work_assignments` | `assignment_number`, `title`, `area`, `assignee_name`, `task_type`, `priority`, `status` |
| `inventory_locations` | `code`, `name` |
| `inventory_items` | `sku`, `name`, `default_reorder_point` |
| `inventory_movements` | `movement_id`, `inventory_item_sku`, `inventory_location_code`, `movement_type`, `quantity`, `balance_after`, `movement_at` |
| `service_listings` | `provider_code`, `display_name`, `category`, `status` |
| `documents` | `document_code`, `title`, `category`, `status` |
| `weekly_reports` | `period_label`, `status` |
| `spend_policies` | `policy_code`, `title`, `status` |

Use stable source identifiers (`plan_code`, `round_number`, `finding_id`, `ticket_number`, `assignment_number`, `sku`, `code`) so imports can map rows without relying on generated Supabase UUIDs.

## Validator checks

`scripts/vv-operational-load-validate.mjs` runs offline only. It checks:

- required fields;
- duplicate staged IDs/references;
- Villa Valencia `building_id` when present;
- allowed statuses/categories where inferable from migrations and suite code;
- parseable timestamps and numeric fields;
- JSON-object `metadata`;
- cross-file references such as plan points to plans, round results to rounds/points, findings to rounds/points, incidents/work to findings, and inventory movements to items/locations;
- likely accidental emails or phone-like numbers in staged text fields.

Warnings do not fail the run unless `--strict` is passed.

## Safe fixture smoke

The committed fixture is synthetic and non-production:

```sh
node scripts/vv-operational-load-validate.mjs --bundle scripts/fixtures/operational-load-sample.json
node scripts/vv-operational-load-validate.mjs --bundle scripts/fixtures/operational-load-sample.json --strict
```

Expected result: validator passes and reports no production data touched.

## Real load readiness sequence

Use this sequence only after Jeff provides private source exports:

```sh
node scripts/production-smoke.mjs
node scripts/pqrs-rpc-smoke.mjs --live --known-ref VV-PQRS-E2E-000001
node scripts/recorridos-md04-preflight.mjs --live
POSTGRES_URL='<private-villa-valencia-production-db-url>' node scripts/vv-e2e-seed-verify.mjs
node scripts/vv-operational-load-validate.mjs --bundle /tmp/vv-operational-load.json --strict
```

If the bundle is split as CSV:

```sh
node scripts/vv-operational-load-validate.mjs --dir /tmp/vv-operational-load-csv --strict
```

After a real import is approved and completed, rerun the read-only seed verifier with:

```sh
POSTGRES_URL='<private-villa-valencia-production-db-url>' node scripts/vv-e2e-seed-verify.mjs --allow-extra-operational
```

## Remaining blockers

- Historical/private source exports are not available in this repo.
- Final field mapping must be reviewed against the actual export schemas.
- No import SQL or ETL should be run until Jeff explicitly approves a live mutation window.
