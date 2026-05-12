# P3 Premium Product Benchmark — AppFolio / Munily Bar

Date: 2026-05-01  
Directive: research → assess → build → test → deploy iteratively until APROVIVA feels as solid and premium as AppFolio or Munily.

## Benchmark signals

### AppFolio patterns to emulate

Public product research highlights:

- Unified property-management platform, not scattered tools.
- Mobile maintenance workflows for teams in the field.
- Work orders tracked from intake to finish.
- Resident/owner updates and communication loops.
- Inspections and common-area maintenance.
- Built-in automation/AI for intake, follow-up, scheduling, dispatch, and feedback.
- Auditing center: tracked change history by user, property, dates, entities.
- Accounting/reporting depth as a trust layer.
- Tiering/scalability: core workflows first, advanced fields/API/control later.

APROVIVA implication:
- Keep the field workflow simple, but make the board/reporting surface feel premium and trustworthy.
- Strengthen audit/history, print/PDF reporting, and status lifecycle before chasing broad modules.

### Munily patterns to emulate

Public product research highlights:

- LATAM condo/community focus.
- All-in-one platform around administration, accounting, security, access, communication.
- Visitor/supplier/package entry management.
- Common-area reservations.
- PQRS/ticket management.
- Panic button, virtual citofonía, chat/communications.
- Collections/payment reminders and reports.
- Administrative dashboard and real-time reporting.
- AI assistant positioning.

APROVIVA implication:
- Munily owns resident/security/access breadth. APROVIVA should win first on operations-to-board evidence and Villa-specific governance.
- Future premium lanes: access/security/reservations/communications only after board packet, resident UX, auth/RLS, and demo quality are polished.

## Gap assessment

| Premium expectation | APROVIVA today | Gap | Priority |
| --- | --- | --- | --- |
| Unified role-based operating platform | Strong: public portal + suite roles + modules | Needs visual polish and tighter premium home/board storytelling | P1 |
| Mobile field maintenance | Strong: Gemba, Mapa, Inventario, Incidencias | Needs screenshots/demo polish and less POC-feeling copy | P1 |
| Board-ready reporting | Good data; now needs premium packet/export | Build print/PDF board packet and weekly scorecard | P1 |
| Work-order lifecycle | Good enough | Add clearer owner/due/age buckets and board-visible SLA language | P1 |
| Audit/history | Partial metadata history | Need cross-module audit log/change history view later | P2 |
| Resident communications | Public portal + PQRS | Need resident app-like polish, status transparency, notifications later | P2 |
| Accounting/collections | Transparency dashboard only | Do not claim full accounting; integrate/position later | P2/P3 |
| Access/security/reservations | Not core yet | Future Munily-parity lane, not current operations wedge | P3 |
| Automation/AI | Research/design only | Add deterministic rules first; AI draft later with privacy guardrails | P2 |
| Enterprise hardening | POC PIN/RLS caveat | Auth/RLS hardening before external pilot | P1 before broad launch |

## Current build slice

Implemented first premium reporting slice:

- `P3-RPT-001` initial board packet print/PDF surface in `Reportes`.
- Button: `Paquete Junta`.
- Sections:
  1. executive cover,
  2. privacy note,
  3. decisions required,
  4. risks,
  5. governance scorecard,
  6. operations execution,
  7. backlog age buckets,
  8. inventory risk,
  9. capital projects,
  10. evidence appendix.
- Print CSS so browser print can save PDF without adding a PDF dependency yet.

## Iteration loop

1. Benchmark premium pattern.
2. Assess APROVIVA gap.
3. Build the smallest visible premium slice.
4. Add E2E coverage.
5. Deploy to production.
6. Smoke production and keep DB seed-only.
7. Record next slice.

## Next premium slices

1. ✅ `P3-RPT-002` weekly board scorecard metrics: implemented across Reportes board packet and Junta live dashboard with 8 metrics, owner/source/detail, age buckets, chronic issue metric, and preventive/corrective ratio.
2. ✅ Premium visual pass for Junta + Reportes: executive hero, board summary strip, stronger scorecard hierarchy, mobile readability, and print cleanup.
3. ✅ Audit/history center lite: Junta now has a read-only audit/history center consolidating safe recent movements across incidents, rounds, findings, escalations, and work orders. See `docs/test-findings/premium-audit-history-2026-05-12.md`.
4. Next: Auth/RLS hardening plan and first implementation slice.
5. Resident/PQRS premium polish against Munily-style resident expectations.


## All-module suite polish pass — 2026-05-01

Jeff clarified the premium standard must apply across all modules. The first product-wide suite slice adds consistent module hero/context blocks and privacy/evidence notes across field and management modules, plus route/mobile tests.

Covered in this slice:
- Inicio
- Inventario
- Recorridos/Gemba
- Mapa
- Incidencias
- Proyectos/backlog
- Maestros
- Reportes landing
- Existing Junta/Reportes board packet premium surfaces remain the reference standard.

Next product-wide slice: public portal, suite login, resident/PQRS journey, map PQRS, and legacy surface guard.


## Public/login/PQRS premium polish — 2026-05-01

Second product-wide premium slice after the suite module shell:
- Suite login now presents a private-access/security note first and gates quick demo PIN shortcuts behind a "Modo demo / QA" disclosure.
- Resident portal now shows a clear Residentes → Operación → Junta handoff strip.
- PQRS resident journey now explains Radica → Seguimiento → Operación, with visible privacy copy in the panel and modal.
- Standalone `mapa-pqrs.html` now has read-only badge, legend, and summary cards for PQRS reference, boundary/route, and privacy.
- Legacy `aproviva-portal.html` is visibly marked as a reference/legacy surface so it is not confused with the commercial path.
