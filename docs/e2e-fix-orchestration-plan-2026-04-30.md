# E2E Fix Orchestration Plan

Date: 2026-04-30

Source of truth: `docs/website-fix-log.md`

## Convergence Decision

Do not create a new multi-agent architecture, task hierarchy, or parallel execution system for this work.

The backend workflow is not finished end to end. The safe operating model is:

1. One active implementation lane at a time.
2. One source of truth for scope: `docs/website-fix-log.md`.
3. This plan controls execution order.
4. Playwright verifies each slice before the next slice starts.
5. Research/commercial packaging stays in backlog until the operational loop works.

"Agents" in this plan means scoped execution roles/prompts, not a new runtime system.

## Current Inventory

Captured fix-log count:

| Priority | Count | Meaning |
| --- | ---: | --- |
| P1 | 45 | Operational blockers, broken role flows, missing routing, broken data lifecycle |
| P2 | 17 | UX clarity, hierarchy, drill-down, layout, role polish |
| P3 | 21 | Confirmed-good items, backlog enhancements, later reporting/commercial polish |

Code surfaces:

| Surface | Primary files |
| --- | --- |
| Public Accessos | `index.html`, `js/config.js` |
| Suite auth/routing | `aproviva-suite/js/auth.js`, `aproviva-suite/js/router.js`, `aproviva-suite/js/modules/inicio.js` |
| Recorridos / hallazgos | `aproviva-suite/js/modules/gemba.js`, Supabase inspection-plan migrations |
| Inventario | `aproviva-suite/js/modules/inventario.js` |
| Mapa | `aproviva-suite/js/modules/mapa.js`, `aproviva-suite/data/villa-valencia-site.geojson` |
| Incidencias / escalaciones | `aproviva-suite/js/modules/incidencias.js`, `aproviva-suite/js/modules/junta.js`, `aproviva-suite/js/modules/reportes.js` |
| Proyectos / backlog / work orders | `aproviva-suite/js/modules/proyectos.js` |
| Gerencia / Junta reporting | `aproviva-suite/js/modules/inicio.js`, `aproviva-suite/js/modules/reportes.js`, `aproviva-suite/js/modules/junta.js` |
| E2E tests | `e2e/tests/*.ts`, `e2e/package.json` |

Known worktree note: `aproviva-suite/js/modules/gemba.js` and `e2e/tests/suite-routes.spec.ts` already have uncommitted edits. Read before changing and do not revert unrelated work.

## Agent Roles

Use these as sequential prompts, not simultaneous workers.

| Agent | Purpose | Allowed output |
| --- | --- | --- |
| Convergence Lead | Owns scope, updates fix log, prevents new architecture drift | Plan updates, fix-log status changes, implementation order |
| Data Backbone Agent | Makes master/config data explicit: roles, areas, assignees, plan points, escalation lifecycle | Small config/migration/model patches and data-contract notes |
| Flow Implementation Agent | Edits UI modules for the current wave only | Focused code changes in listed files |
| E2E Verification Agent | Adds/updates Playwright tests and runs local verification | Test changes, screenshots/traces, pass/fail notes |
| Research Agent | Later backlog only: HOA board reporting, SAP comparison, module packaging | Research notes after P1 flows pass |

Rule: only one implementation agent edits code in a given wave. The E2E agent may work after the implementation patch for that wave, not in parallel against the same files.

## Delivery Waves

### Wave 0: Baseline And Safety Gate

Goal: establish the current behavior and protect against accidental regressions.

Scope:

- Run current Playwright suite locally.
- Capture current failing/fragile tests.
- Add or confirm smoke coverage for PIN roles: conserje, supervisor, gerencia, junta.
- Confirm public `Accessos` route and suite login route.

Files:

- `e2e/tests/suite-routes.spec.ts`
- `e2e/tests/portal-home.spec.ts`
- `docs/website-fix-log.md`

Done criteria:

- Baseline test result is documented.
- Existing failures are separated from new failures.
- No production behavior changed in this wave.

### Wave 1: Fast UI Convergence Fixes

Goal: remove obvious duplication/product copy and fix hierarchy without touching data contracts.

Scope:

- Public `Accessos`: remove `Ingreso residentes`; keep `Ingreso administracion` and `Ingreso junta`.
- Tighten desktop `Accessos` layout.
- Remove `Limite de confianza` / product-style messaging from operational views.
- Remove duplicated `Tools Modulo` on mobile where bottom navigation exists.
- Move installed-app prompt/action to top of concierge main screen.
- Junta mobile: avoid module-grid duplication when bottom nav is present.

Files:

- `index.html`
- `aproviva-suite/js/modules/inicio.js`
- `aproviva-suite/js/modules/gemba.js`
- `aproviva-suite/js/modules/mapa.js`
- `aproviva-suite/js/modules/junta.js`
- `aproviva-suite/css/suite.css`
- `e2e/tests/portal-home.spec.ts`
- `e2e/tests/suite-routes.spec.ts`

Done criteria:

- Public Accessos shows only admin and junta.
- Mobile suite has no duplicated navigation/module grid.
- Product-sales copy is gone from backend operational views.
- E2E smoke passes for public portal and all PIN roles.

### Wave 2: Master Data Backbone

Goal: create one source of truth for controlled choices before fixing forms.

Scope:

- Define controlled areas/locations.
- Define assignees/users/roles from existing PIN role config or available `admin_users`.
- Define inspection plan structure: role, owner, frequency, area, points, sequence, comments.
- Define follow-up action/status taxonomy for findings/incidents/work orders.
- Define one escalation lifecycle used by conserje, supervisor, gerencia, junta.

Files:

- `aproviva-suite/js/config.js`
- `aproviva-suite/js/auth.js`
- `aproviva-suite/js/modules/maestros.js`
- `aproviva-suite/supabase/migrations/*`
- `docs/website-fix-log.md`

Done criteria:

- Forms stop relying on free-text areas/assignees where routing depends on them.
- Recorrido, location, segment, assignee, and escalation fields all point to one controlled data source.
- No duplicate ingestion path is introduced.

### Wave 3: Incidencias And Escalation E2E

Goal: make incident lifecycle trustworthy across all roles.

Scope:

- Conserje sees only incidents raised by them or assigned to them.
- Supervisor/Gerencia can open incident details.
- Resolve requires/allows comments and evidence.
- Add send-back/reassign/escalate actions where appropriate.
- Escalated items appear in Junta escalations with source context.
- Reporter/management/Junta can review closure history.

Files:

- `aproviva-suite/js/modules/incidencias.js`
- `aproviva-suite/js/modules/junta.js`
- `aproviva-suite/js/modules/reportes.js`
- `aproviva-suite/js/config.js`
- `e2e/tests/suite-routes.spec.ts`
- new or updated incident lifecycle spec

Done criteria:

- Create incident as conserje.
- Escalate as supervisor or gerencia.
- See escalation as junta.
- Resolve with comment/evidence.
- Reopen/review history where applicable.

### Wave 4: Recorridos And Hallazgos

Goal: prevent the wrong role from running the wrong recorrido and make plan data drive execution.

Scope:

- Pull `Area de base` and `Frecuencia` from selected plan maestro.
- Clarify daily conserje, daily administradora, and weekly supervisor recorridos.
- Make `Continuar puntos` ownership explicit.
- Improve point status pills so the meaning is obvious.
- Consolidate duplicate active-execution blocks.
- Add better completion state.
- Drive `Ubicacion in situ` and segment options from inspection point/master data.
- Keep current good pieces: recent executions, master plan selector, timing default, active task list.

Files:

- `aproviva-suite/js/modules/gemba.js`
- `aproviva-suite/js/config.js`
- inspection-plan migrations/data
- `e2e/tests/gemba-supervisor-conserje.spec.ts`

Done criteria:

- Conserje starts only conserje-appropriate recorrido.
- Supervisor sees oversight or supervisor-owned recorrido clearly.
- Area/frequency are inherited from plan.
- Findings use valid point/location data.
- Completion has a clear end state.

### Wave 5: Map Becomes Operational

Goal: make the map useful, not just visual.

Scope:

- Show route points, inspection points, and issue markers.
- Save newly flagged issue and show it on map after return/refresh.
- Connect selected map point to issue form location/segment.
- Keep photo attachment.
- Define mobile tap-to-place or drag-to-adjust interaction without adding a separate map system.

Files:

- `aproviva-suite/js/modules/mapa.js`
- `aproviva-suite/js/modules/gemba.js`
- `aproviva-suite/data/villa-valencia-site.geojson`
- map/waypoint migrations
- `e2e/tests/mapa-pqrs.spec.ts`
- new suite map spec if needed

Done criteria:

- Staff can mark an issue location on mobile.
- The selected location appears in the issue form.
- Saved marker appears on the map.
- Supervisor/Gerencia/Junta map views show role-appropriate issue context.

### Wave 6: Inventory Role Split

Goal: make inventory actions match role responsibility.

Scope:

- Conserje: `Registrar conteo` opens immediately in view on mobile.
- Conserje: long lists collapse below operational action flow.
- Conserje: add comments to count form.
- Supervisor: remove concierge count registration.
- Supervisor: add purchase-order/status/comment workflow for low stock/stockouts.
- Gerencia: macro review only unless explicitly acting on stock issue.

Files:

- `aproviva-suite/js/modules/inventario.js`
- `e2e/tests/inventory-apics.spec.ts`

Done criteria:

- Mobile conserje count flow is immediate.
- Supervisor sees stock actioning, not count capture.
- Comments persist with count/status action.
- Existing top summary and terms dropdown remain.

### Wave 7: Work Orders, Projects, Backlog

Goal: make assignments route to people and make progress reportable.

Scope:

- Fix `Supabase 400 on work assignment`.
- Make `Area` dropdown controlled.
- Make `Asignado` dropdown controlled.
- Save work order and route it to assigned person's task list.
- Add update flow for existing projects/actions.
- Separate capital projects from operational backlog for Junta.
- Capital projects: milestones, percent completion, RAG, progress comments.
- Operational backlog: owner, status, priority, due date, comments, escalation state.

Files:

- `aproviva-suite/js/modules/proyectos.js`
- `aproviva-suite/js/config.js`
- work assignment/project migrations if required
- new or updated project/backlog e2e spec

Done criteria:

- Supervisor creates work order successfully.
- Assigned conserje/admin sees assigned action.
- Existing item can be updated.
- Junta sees operational backlog separately from capital projects.

### Wave 8: Gerencia And Junta Oversight

Goal: make macro views drillable and board-appropriate after underlying data flows work.

Scope:

- Gerencia KPIs drill down by building/status/owner.
- Junta KPIs drill down to supporting detail.
- Replace module-count wording with governance/oversight metrics.
- Clarify source of suggested actions.
- Ensure Junta loading states resolve or show real errors.
- Improve daily/weekly report text only after data is reliable.

Files:

- `aproviva-suite/js/modules/inicio.js`
- `aproviva-suite/js/modules/junta.js`
- `aproviva-suite/js/modules/reportes.js`
- `aproviva-suite/js/modules/proyectos.js`
- role/report e2e specs

Done criteria:

- Gerencia can drill from KPI to detail.
- Junta can drill from KPI to detail.
- Suggested actions have understandable logic/source.
- Escalations, backlog, projects, and reports tell one story.

### Wave 9: Backlog Research And Commercial Readiness

Goal: improve board reporting and module packaging only after P1 workflow closure.

Scope:

- HOA/condo board reporting research.
- Prior SAP comparison reuse.
- Better PDF report design.
- AI/RAG qualitative status exploration for inventory, operations, repairs, vendors.
- Module-by-module commercial QA.

Done criteria:

- P1 flows are already passing e2e before this begins.
- Research outputs become specific backlog tickets, not new architecture.

## E2E Gate Per Wave

Each wave must produce:

1. Fix-log status update for affected rows.
2. Focused Playwright coverage for the changed flow.
3. Full local Playwright run.
4. Manual mobile check for phone-first surfaces.
5. Deployment decision note: ship, hold, or split.

Minimum verification commands:

```bash
cd /home/jeffery/Adwen-Tech/apps/villa-valencia-portal/e2e
npm test
```

Production verification, only after local pass:

```bash
cd /home/jeffery/Adwen-Tech/apps/villa-valencia-portal/e2e
npm run test:prod
```

## First Implementation Slice

Start with Wave 0, then Wave 1.

Reason:

- They do not require schema decisions.
- They remove visible mess fast.
- They establish the e2e rhythm before touching workflows.
- They reduce duplicated UI and product-copy noise without changing the operational data model.

Do not start master-data, escalation, projects, or AI/reporting work until Wave 0 and Wave 1 are done and verified.
