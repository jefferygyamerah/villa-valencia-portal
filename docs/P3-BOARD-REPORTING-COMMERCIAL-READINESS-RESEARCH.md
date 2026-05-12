# P3 Board Reporting & Commercial Readiness Research

Date: 2026-05-01
Status: P3 research output — backlog tickets, not new architecture
Scope source: `docs/e2e-fix-orchestration-plan-2026-04-30.md` Wave 9 and P3 rows in `docs/website-fix-log.md`.

## Executive conclusion

APROVIVA's core operational loop is now strong enough to support P3 packaging. The next commercial value is not “more modules”; it is a board-ready operating packet that connects:

1. financial/risk governance,
2. maintenance execution,
3. reserve/capital planning,
4. vendor/accountability tracking,
5. resident-facing confidence.

The product should sell as: **a board packet generated from live operations, not a dashboard that requires another spreadsheet cleanup.**

## Research signals

### HOA / condo board reporting

Common board reporting guidance emphasizes a monthly package that a volunteer board can interpret quickly. Strong packages give a clear snapshot of cash, budget variance, delinquency/receivables, and reserve funds; missing reconciliations, aged receivables, or reserve summaries are called out as control gaps.

Sources reviewed:
- RowCal, “HOA Management Accounting: What Monthly Financials Should Look Like” — monthly board packages should show cash, budget-vs-actual, homeowner balances, and reserve status.
- Buildium, “HOA Finances: A Practical Guide for Association Managers” — reserve planning ties inspections, common-area assets, prioritization, and future capital projects.
- HOA/condo template searches consistently surface board packets, treasurer reports, balance sheets, reserve studies, work-order logs, vendor contracts, RFP matrices, and accounts payable/receivable as common board artifacts.

### Maintenance / facility KPI benchmark

Facility maintenance dashboards should stay small and decision-oriented. The strongest pattern is weekly review of 6–10 metrics with clear owners and follow-up actions.

Useful KPI set:
- Open work-order backlog, with age buckets: 0–7, 8–30, 31+ days.
- Response time: request → first action.
- Completion/cycle time: open → closed.
- Preventive vs corrective ratio.
- First-time fix rate.
- Recurring issue rate by location/asset.
- Overdue preventive inspections.
- Stockout/reorder exceptions.

Source reviewed:
- SimpleWorkOrders, “Facility Maintenance KPI Dashboard: What Property and Warehouse Teams Should Track Weekly” — recommends a small weekly dashboard tied to ownership and actions, not too many metrics.

### SAP / enterprise benchmark reuse

SAP-style maintenance systems are useful as a maturity benchmark, not as something APROVIVA should copy wholesale. The relevant concepts are:
- notification/intake,
- work order planning,
- execution confirmation,
- planner backlog,
- maintenance history,
- embedded analytics.

APROVIVA should keep its phone-first condo context, but borrow the lifecycle discipline: every exception needs origin, owner, due date, status, evidence, closure history, and analytics roll-up.

Sources reviewed:
- SAP S/4HANA/Fiori maintenance-planning search results around maintenance notifications, work orders, work center monitoring, real-time insights, backlog, and embedded analytics.

## Board packet target structure

A useful Junta PDF/export should have these sections:

1. **Cover / decision summary**
   - Period, building, prepared date.
   - Top 3 decisions needed.
   - Top 3 operational risks.
   - “No private resident data included” privacy note.

2. **Governance scorecard**
   - Open escalations.
   - High/critical risks.
   - Chronic patterns.
   - Overdue work/orders.
   - Compliance cases.
   - Capital projects RAG.

3. **Operations execution**
   - Recorridos scheduled/completed/missed.
   - Open findings by area/severity.
   - Preventive vs corrective work ratio.
   - Repeat issues by location.

4. **Backlog accountability**
   - Work orders by owner/status/age bucket.
   - Overdue actions.
   - Last progress note per critical item.
   - Escalation state.

5. **Inventory / supplies risk**
   - Stockouts / below-reorder items.
   - Purchase-order/replenishment status.
   - Items without recent count.

6. **Capital projects / reserves**
   - Capital project status, RAG, milestone, percent completion.
   - Reserve/asset link when available.
   - Next decision / quote / approval needed.

7. **Vendor / contract watchlist**
   - Vendor attendance / missed service.
   - Expiring contracts.
   - Open vendor work.
   - Quote comparison/RFP matrix when available.

8. **Appendix / evidence**
   - Drill-down tables.
   - Photo/evidence links.
   - Audit trail/history.

## P3 backlog tickets

### P3-RPT-001 — Board packet PDF template

**User:** Junta / Gerencia  
**Goal:** Export a board-ready PDF packet from current APROVIVA reporting data.

Acceptance criteria:
- PDF has the board packet structure above.
- Includes period, building, prepared timestamp, and privacy note.
- Includes decision summary, scorecard, operations, backlog, inventory, capital projects, vendor watchlist, appendix.
- Uses existing seed/demo data without new schema dependencies for first version.
- Export does not expose PII/banking/resident free text.

Implementation notes:
- First version can generate print CSS + browser print instead of server PDF.
- Later version can add generated PDF library once layout is stable.

### P3-RPT-002 — Weekly board scorecard metrics

**User:** Junta  
**Goal:** Replace generic report language with board scorecard metrics.

Acceptance criteria:
- Shows 6–10 board metrics only.
- Each metric has owner/source/drill-down.
- Adds age buckets for backlog: 0–7, 8–30, 31+ days.
- Adds repeat-issue/chronic-location metric.
- Adds preventive vs corrective ratio using work assignment `task_type` and recorrido completion data.

### P3-RPT-003 — AI/RAG qualitative status draft

**User:** Gerencia / Junta  
**Goal:** Generate a human-readable RAG narrative from structured operational data.

Acceptance criteria:
- RAG rules are explicit before any AI text is used.
- AI text is draft-only and clearly labeled.
- No private resident data or free-text sensitive notes are sent to a model.
- Output covers inventory, operations, repairs/projects, vendors.

Suggested non-AI baseline rules:
- Red: critical escalation open, blocked/overdue capital item, stockout on critical item, repeated issue 3+ times.
- Yellow: high priority open, overdue routine item, below reorder, compliance open.
- Green: no overdue/high risk and weekly recorridos above threshold.

### P3-RPT-004 — Reserve/capital project linkage

**User:** Junta / Gerencia  
**Goal:** Connect capital projects to reserve/common-area planning.

Acceptance criteria:
- Capital projects have component/area, estimated cost, funding source, reserve relevance, target quarter.
- Board view separates operational repairs from reserve/capital decisions.
- Project cards show RAG, next decision, latest progress note.

### P3-RPT-005 — Vendor/contract watchlist

**User:** Gerencia / Junta  
**Goal:** Add vendor accountability into board reporting.

Acceptance criteria:
- Lists vendors/services with open/overdue work.
- Flags missed attendance, expiring contracts, and quote/RFP status.
- Links vendor work to work orders/projects when available.

### P3-COM-001 — Module packaging QA matrix

**User:** Sales / product  
**Goal:** Review every module for commercial readiness.

Acceptance criteria per module:
- Target buyer/user is clear.
- Demo story is clear in 60 seconds.
- Data lifecycle is complete: create → assign → act → close → report.
- Role boundaries are visible.
- Drill-down exists for executive KPIs.
- Mobile path works for field staff.
- Privacy posture is stated.
- “Why this beats spreadsheet/WhatsApp” is explicit.

Modules:
- Accessos / public portal.
- Suite auth and role routing.
- Recorridos/Gemba.
- Mapa.
- Inventario.
- Incidencias/escalaciones.
- Proyectos/backlog/capital projects.
- Reportes/Junta.
- Maestros/config.

### P3-COM-002 — Demo narrative and seed data script

**User:** Sales/demo  
**Goal:** Build a repeatable Villa Valencia demo script without private data.

Acceptance criteria:
- 5-minute demo path: conserje issue → supervisor action → junta oversight → report export.
- 15-minute demo path includes map, inventory stockout, capital project, board packet.
- Seed data supports the demo without polluting production transactional tables.
- Demo reset/cleanup instructions are explicit.

### P3-SAP-001 — SAP comparison one-pager

**User:** Buyer / enterprise evaluator  
**Goal:** Position APROVIVA against SAP-style maintenance systems.

Acceptance criteria:
- Compare notification, work order, inspection, inventory, reporting, analytics, mobile UX.
- State APROVIVA’s advantage: condo-specific, phone-first, board-ready, lightweight deployment.
- State SAP’s advantage: enterprise asset depth, finance integration, broad standardization.
- Avoid claiming SAP parity; frame APROVIVA as focused vertical operating layer.



## Completed P3 commercial docs

- `docs/P3-MODULE-PACKAGING-QA-MATRIX.md` — module-by-module commercial readiness, persona positioning, caveats, and packaging scorecard.
- `docs/P3-DEMO-NARRATIVE-AND-SEED-SCRIPT.md` — 5-minute and 15-minute demo paths, seed requirements, cleanup checklist, and talk track.
- `docs/P3-SAP-COMPARISON-ONE-PAGER.md` — buyer-facing SAP-style comparison and positioning guardrails.
- `docs/P3-PREMIUM-PRODUCT-BENCHMARK.md` — AppFolio/Munily benchmark, gap assessment, and iterative premium-product loop.

## Recommended next implementation order

1. ✅ `P3-COM-001` module packaging QA matrix — completed in `docs/P3-MODULE-PACKAGING-QA-MATRIX.md`.
2. ✅ `P3-COM-002` demo narrative and seed script — completed in `docs/P3-DEMO-NARRATIVE-AND-SEED-SCRIPT.md`.
3. ✅ `P3-SAP-001` one-pager for commercial comparison — completed in `docs/P3-SAP-COMPARISON-ONE-PAGER.md`.
4. ✅ `P3-RPT-001` initial PDF/print board packet surface — implemented as browser print/PDF in Reportes (`Paquete Junta`).
5. ✅ `P3-RPT-002` initial weekly board scorecard semantics — Reportes board packet now has 8 KPI cards with Responsable/Fuente/Ver detalle, backlog age cards, chronic metric, and preventive/corrective ratio.
6. ✅ Premium audit/history center lite — Junta now consolidates safe recent movements across incidents, rounds, findings, escalations, and work orders. See `docs/test-findings/premium-audit-history-2026-05-12.md`.
7. Next: `P3-RPT-003` AI/RAG qualitative draft — only after deterministic RAG rules are accepted.
8. Then: `P3-RPT-004` reserve/capital linkage and `P3-RPT-005` vendor watchlist.

## Non-goals / guardrails

- Do not import real/private operational data in P3 research.
- Do not add a new agent architecture.
- Do not add AI text generation until privacy-safe fields and deterministic rules are defined.
- Do not claim financial accounting completeness; current APROVIVA scope is operational/board reporting, not full HOA accounting.
- Keep production seed-only unless Jeff explicitly authorizes demo seed changes.
