# PQRS: migrate control from ph-management to Villa Valencia (`here`)

This document frames **moving PQRS submit, lookup, storage, and map-facing reads** from the ph-management deployment into the **Villa Valencia production stack** (this repo + the Villa Valencia Supabase project + existing Apps Script where appropriate). It does **not** blur the product boundary described in `AGENTS.md`.

---

## Canon: two names, two roles

| | **Villa Valencia (`here`)** | **ph-management** |
|---|---|---|
| **What it is** | The live HOA surface for APROVIVA: `villavalencia.vercel.app`, this repo, customer-specific glue (Drive, Sheets, suite). | The white-label / flagship **product** platform: reusable admin, schemas, and ops for many properties. |
| **Who it serves first** | ~118 families, APROVIVA staff, junta — **production identity is always VV.** | Product, future PH customers, shared roadmap. |
| **PQRS after migration** | **Canonical runtime for VV PQRS**: portal + APIs + DB rows for **this** building/community live **here**. | May still host **other** tenants, patterns, and upstream features; VV is **not** required to stay a permanent tenant of the ph-management app for PQRS once migration completes. |

**Important:** Migrating PQRS **home** to Villa Valencia does **not** mean “this repo becomes ph-management.” It means **operational ownership** of VV’s PQRS data and endpoints lives in the **VV stack** (`here`). Validated patterns can still be **extracted upstream** into ph-management later (`AGENTS.md` two-way value rule).

---

## Why migrate

- **Resident promise:** Residents see `villavalencia.vercel.app`; cross-origin calls to `ph-management.vercel.app` were an implementation shortcut (`AGENTS.md` cutover note).
- **Single operational plane:** Map layers, suite (`aproviva-suite`), and PQRS should share **one** Supabase project for Villa Valencia (`tgoitmwdpdkhlpqpwrvs`) where possible.
- **Canon clarity:** ph-management remains the **product**; VV remains the **deployment**. Owning PQRS in VV strengthens that distinction instead of weakening it.

---

## Current state (April 2026)

- Portal `js/app.js` → `POST/GET` `PH_MANAGEMENT_API_BASE` (`/api/pqrs/submit`, `/api/pqrs/lookup`).
- Case truth + admin workflows primarily in **ph-management**’s Supabase and UI.
- Dashboard / transparency in portal may still be **Sheets**-backed (`loadDashboard`) — separate cutover.

---

## Target state (`here`)

1. **Supabase (Villa Valencia project):** tables/views for PQRS cases (or aligned names), RLS scoped by `building_id` / org, optional **`pqrs_map_events` or equivalent** for map aggregates if not served from a single cases table.
2. **API surface:** either **Supabase REST + RLS** from static portal/suite, **Edge Functions** in the same project, or **Apps Script** endpoints that write/read Supabase — pick one consistent pattern; avoid splitting writes across two backends without a story.
3. **Portal:** `js/config.js` points **`PQRS_API_BASE`** (or Supabase directly) at **VV-owned** URLs only; remove resident dependency on `ph-management.vercel.app` for submit/lookup.
4. **ph-management:** stop depending on it for **VV’s** PQRS after cutover; export historical rows and redirect or freeze VV tenant.

---

## Migration phases (outline)

1. **Schema** — Create/align `pqrs_*` tables in **VV Supabase** (migrations in `aproviva-suite/supabase/migrations/` or repo-level `supabase/`).
2. **Backfill** — Export from ph-management (SQL dump or API) → import into VV Supabase with id mapping document.
3. **Dual-write or read-through** (optional) — Short window for safety.
4. **Switch portal + suite** — Feature flag or config: `PH_MANAGEMENT_API_BASE` → null, VV endpoints live.
5. **Dashboard** — Unify transparency KPIs with new source (Sheets vs Supabase decision).
6. **Decommission** — VV PQRS disabled in ph-management UI; document in ph-management repo.

---

## Files to touch when implementing

| Area | Location |
|------|----------|
| Portal submit/lookup | `js/app.js`, `js/config.js` |
| Suite (if PQRS surfaces there) | `aproviva-suite/js/*` |
| SQL | `aproviva-suite/supabase/migrations/` (and/or new root `supabase/` if shared) |
| Apps Script | `apps-script/Code.gs` if Drive/Sheets stay in loop |
| Product guardrails | `AGENTS.md`, this file |

---

## Related

- `AGENTS.md` — cutover reality and two-way extraction rule.
- `README.md` — production identity for the portal.
- Historical ph-management ops docs live **in the ph-management repo**, not here.

---

## Implemented API (Villa Valencia Supabase)

- **Pattern:** **PostgREST** (`INSERT` into `public.pqrs_cases`) + **`lookup_pqrs_case(text)`** RPC (`SECURITY DEFINER`) so `anon` cannot `SELECT` the full table.
- **Migration files (en orden):** [20260422120000_pqrs_cases.sql](../aproviva-suite/supabase/migrations/20260422120000_pqrs_cases.sql), luego [20260422200000_pqrs_cases_align_existing.sql](../aproviva-suite/supabase/migrations/20260422200000_pqrs_cases_align_existing.sql) si la tabla `pqrs_cases` ya existía con otro esquema (p. ej. ph-management).
- **CI opcional:** [`.github/workflows/apply-vv-supabase-sql.yml`](../.github/workflows/apply-vv-supabase-sql.yml) — secret `SUPABASE_DB_URL`, ejecutar workflow manualmente en GitHub.
- **Portal:** [js/config.js](../js/config.js) — `PQRS_USE_VV_SUPABASE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BUILDING_ID`. Keep `PQRS_USE_VV_SUPABASE: false` until the SQL is applied and smoke-tested; then set `true` to stop calling ph-management for submit/lookup.

---

## Export / import checklist (ph-management → VV Supabase)

Run these in **ph-management**’s Supabase SQL editor or export UI, then import into **VV** project `tgoitmwdpdkhlpqpwrvs` (adjust table/column names to match your ph-management schema).

1. **Export**
   - From ph-management: `COPY` / CSV / `pg_dump` for the table that stores PQRS cases for Villa Valencia (filter by `building_id`, `tenant_id`, or `organization` as your schema defines).
   - Capture: external ids, `case_reference`, `subject`, `description`, `location`, email, status, timestamps, and any **ubicación** / map fields.

2. **Map columns**
   - Map into `pqrs_cases`: `building_id` = `88e6c11e-4a8c-4f39-a571-5f97e7f2b774` (VV), `case_reference` (must stay unique), `subject`, `description`, `location`, `email`, `site_place_id`, `zona_label`, `tipo`, `urgencia`, `casa`, `status`, `metadata` (JSON for extras), `created_at`, `updated_at`.

3. **Conflict handling**
   - If `case_reference` already exists, skip or rename with suffix `-IMPORT` and log in `metadata`.

4. **Verify (VV SQL)**
   - `SELECT count(*), min(created_at), max(created_at) FROM public.pqrs_cases WHERE building_id = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774';`
   - `SELECT * FROM public.lookup_pqrs_case('VV-PQRS-YYYYMMDD-XXXXXX');` — must return one row for a known reference.

5. **Rollback**
   - Revert portal `PQRS_USE_VV_SUPABASE` to `false` in [js/config.js](../js/config.js); residents use ph-management again. Do **not** delete imported rows until the cutover is final.

6. **Dashboard**
   - Portal transparency (`loadDashboard`) remains Apps Script until a separate cutover pulls PQRS KPIs from `pqrs_cases` or a synced sheet.
