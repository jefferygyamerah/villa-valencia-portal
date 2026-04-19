# Villa Valencia Portal Guardrails

Anchor on `../../docs/strategic-positioning.md` — that file is canonical for the relationship between `villa-valencia-portal` and `ph-management`. This file restates only what is operationally relevant for work in this repo.

## What This Repo Is

- This repo is the **live iteration lab**. The human works here. New features are designed, built, shipped to residents, and iterated based on real use here FIRST. After a feature is live and working, agents extract reusable patterns into `ph-management`.
- It is also a customer-specific reference implementation and customer-specific runtime for the APROVIVA / Villa Valencia community (118 houses).
- It is **not** the flagship product. The flagship is `ph-management`. It is also **not** legacy — it is where every new feature originates.

## Cutover Reality

- Live at `villavalencia.vercel.app`, serving residents and admin for ~118 families.
- PQRS submit and lookup consume `ph-management.vercel.app` APIs (`/api/pqrs/submit`, `/api/pqrs/lookup`). That cutover was an exception, not the canonical pattern — it happened because a schema and admin UI already existed in ph-management when residents needed PQRS trust fast.
- Other surfaces (dashboard, budget, providers) still run on Apps Script.

## UI and Content Guardrail

- Keep the resident-facing experience focused on residents, administration, junta, finances, PQRS, and building operations.
- Resident copy stays Villa Valencia / APROVIVA. Do not put PH Management product marketing or funnel copy here.

## Customer-Specific Glue Is Allowed and Expected Here

- Customer-specific integrations belong here: Google Drive photo uploads via Apps Script (using the customer's Drive), Apps Script dashboards, legacy Google Sheets-backed reads, etc.
- Some of this glue will eventually be extracted into `ph-management` as configurable modules. Some will stay customer-specific forever. Both outcomes are fine.

## Publishing and Hosting Default

- For ad-hoc previews, QA links, or shareable static artifacts, default to `here.now`.
- Prefer `here.now` for agent-led sharing to minimize Vercel spend.
- Keep the live Villa Valencia production runtime on its current infrastructure unless explicit migration approval is given.
