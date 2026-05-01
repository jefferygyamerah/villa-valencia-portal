# Post-reset E2E Seed Verification

Status: production reset follow-up. This document is a read-only review path only; it does not authorize data mutation, deployment, imports, deletes, or cleanup.

## Purpose

After the clean operational reset, production should contain preserved foundation data plus one small E2E example for each core workflow. Jeff can review those examples before loading real resident/admin operational data.

Seed references from `agent-logs/villa-data-reset-e2e-seed-20260430-1936.done`:

- PQRS: `VV-PQRS-E2E-000001`
- Recorrido: `E2E-RECORRIDO` / `REC-E2E-001` / seed finding
- Work assignment: `WO-E2E-001`
- Incident: `INC-E2E-001`
- Inventory: `E2E-CLORO` at `E2E-ALM`, balance `3`, reorder `5`
- Provider: `Proveedor E2E Jardineria`
- Document: `E2E Reglamento de prueba`
- Weekly report: `Semana E2E`
- Spend policy: `seed-spend-policy-e2e`

## Reviewer Command Sequence

Run from the repo root.

```sh
node scripts/production-smoke.mjs
node scripts/pqrs-rpc-smoke.mjs --live --known-ref VV-PQRS-E2E-000001
node scripts/recorridos-md04-preflight.mjs --live
POSTGRES_URL='<private-villa-valencia-production-db-url>' node scripts/vv-e2e-seed-verify.mjs
```

`DATABASE_URL` may be used instead of `POSTGRES_URL`.

For future checks after real operational data has been loaded, keep the seed presence checks but allow extra rows:

```sh
POSTGRES_URL='<private-villa-valencia-production-db-url>' node scripts/vv-e2e-seed-verify.mjs --allow-extra-operational
```

## What The New Verifier Checks

`scripts/vv-e2e-seed-verify.mjs` opens a PostgreSQL `BEGIN READ ONLY` transaction and runs SELECTs only.

It verifies:

- Villa Valencia building row exists.
- At least one active `admin_users` row exists.
- At least one `public.users` row exists.
- Each listed E2E seed example exists.
- `lookup_pqrs_case('VV-PQRS-E2E-000001')` returns exactly one row with that reference.
- `get_md04_lite_exceptions(Villa building)` includes the seeded `OPEN_FINDING` and `STOCK_OUT` examples.
- In default mode, tracked operational tables still match the clean seed counts exactly.

## Ready For Real Data Load

The environment is ready for real data load when:

- production route/config smoke passes;
- PQRS fake lookup still returns zero rows and the known E2E reference returns itself;
- MD04 live preflight passes;
- the E2E seed verifier passes without `--allow-extra-operational`;
- Jeff has reviewed the seed examples in the portal/suite and approves replacing seed-only state with real operational data;
- private exports or source data are available outside this repo.

Do not fabricate live DB success if the private DB URL is unavailable. Record the blocked live verification and rerun after credentials are pulled privately.
