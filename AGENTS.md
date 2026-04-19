# Villa Valencia Portal Guardrails

Anchor on `../../docs/ml-collaborator-brief.md` (canonical) and `../../docs/strategic-positioning.md` (deeper companion). The brief wins when they disagree. This file restates only what is operationally relevant for work in this repo.

## What This Repo Is

- This repo is **both an active live deployment AND a proving ground for `ph-management`**. It serves the APROVIVA / Villa Valencia community (118 houses) every day and is also where new product features should ideally face real residents before being extracted upstream.
- It is **not** the main white-label product direction. The flagship platform is `ph-management`. It is also **not** legacy or merely historical — it continues to inform the evolution of the white-label platform.
- Per the brief's important constraint, investment here should ideally create value in two directions: (1) support the live operational needs of Villa Valencia, and (2) extract and upstream validated product capabilities into `ph-management`.

## Cutover Reality

- Live at `villavalencia.vercel.app`, serving residents and admin for ~118 families.
- PQRS submit and lookup consume `ph-management.vercel.app` APIs (`/api/pqrs/submit`, `/api/pqrs/lookup`). That cutover was an exception to the canonical extraction direction — it happened because a schema and admin UI already existed in ph-management when residents needed PQRS trust fast.
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
