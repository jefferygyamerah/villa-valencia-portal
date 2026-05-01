# P3-COM-002 — Demo Narrative and Seed Script

Date: 2026-05-01  
Product: Villa Valencia / APROVIVA  
Status: controlled demo playbook  
Goal: make Villa Valencia demoable without private data or production drift.

## Demo principle

The demo should prove one thing:

> Daily building work becomes board-ready evidence automatically.

Avoid showing every module. Show a single operational thread that travels through roles.

## Demo guardrails

- Use only seed/demo records.
- Do not import real/private operational data.
- Do not create unmanaged production drift during demos.
- If a live demo creates temporary rows, clean them immediately or use a local/mock environment.
- Do not expose bank data, resident PII, private free-text complaints, or real staff contact details.
- Be honest that PIN auth is POC-grade and RLS/auth hardening is required before broad external rollout.

## Demo URLs and PINs

Production:
- Portal: `https://villavalencia.vercel.app/`
- Suite: `https://villavalencia.vercel.app/aproviva-suite/`

PINs:
- Conserjería: `2026` or `CONS26`
- Supervisor: `SUP26`
- Gerencia: `GER26`
- Junta: `JD26`

## 30-second opening

“Most PH/condo operations live in WhatsApp, Excel, Drive folders, and meeting minutes. APROVIVA turns that into one operating record: conserjería captures evidence on phone, supervisión assigns and closes work, gerencia sees accountability, and junta gets board-ready drill-downs without seeing private noise.”

## 5-minute demo path

### Objective

Show the minimal end-to-end operating loop:

Conserje issue → supervisor action → junta oversight → report/export.

### Step 1 — Public portal and access split (30 sec)

Surface:
- `https://villavalencia.vercel.app/`
- Scroll to Accessos.

Talk track:
- “Residents get the public portal and PQRS status. Staff and Junta enter the operations suite separately.”
- “Resident access is intentionally not mixed into the staff backend.”

Proof:
- Accessos only shows administration and junta paths.
- Provider/docs/PQRS surfaces are public-safe.

### Step 2 — Conserjería captures operational evidence (75 sec)

PIN: `2026` or `CONS26`  
Route: `#/gemba`, optionally `#/mapa`

Talk track:
- “Field staff do not need a spreadsheet. They execute a Plan Maestro, tap inspection points, and register hallazgos with controlled choices.”

Demo action options:
- Non-mutating: open Gemba, show Plan Maestro/active/recent/hallazgo sections.
- Mutating controlled demo only: start a recorrido and add a hallazgo, then clean after.

Show:
- Role-specific home.
- Recorridos / Plan Maestro execution.
- Point UX: OK revisado / No aplica / Registrar hallazgo.
- Map tap-to-place issue flow if using a local/mock demo.

Proof line:
- “The important part is not the map itself; it is that location, evidence, point, role, and timestamp become structured operations data.”

### Step 3 — Supervisor turns findings into action (75 sec)

PIN: `SUP26`  
Routes: `#/incidencias`, `#/proyectos`, `#/inventario`

Talk track:
- “Supervisión does not just read reports. They triage incidents, create/update work orders, and handle stockout procurement.”

Show:
- Incidencias detail/action flow.
- Proyectos work order card with owner/status/due date/update action.
- Inventario supervisor procurement action instead of count capture.

Proof line:
- “This is where WhatsApp breaks: there is no reliable owner, due date, status, or closure history. APROVIVA gives every item a lifecycle.”

### Step 4 — Gerencia reviews accountability (60 sec)

PIN: `GER26`  
Routes: `#/inicio`, `#/reportes`, `#/proyectos`

Talk track:
- “Gerencia sees a macro operating lens and can drill down. They can import structured work orders, update progress, and produce weekly views.”

Show:
- Inicio KPI drill-down.
- Reportes daily/weekly/escalation source text.
- Proyectos CSV/template and update flow.

Proof line:
- “This turns management from chasing screenshots into reviewing exceptions.”

### Step 5 — Junta sees decisions, not noise (90 sec)

PIN: `JD26`  
Routes: `#/junta`, `#/proyectos`, `#/reportes`

Talk track:
- “Junta does not need every operational note. They need decisions, risks, backlog, capital projects, and evidence.”

Show:
- Junta KPI drill-down.
- Decisiones pendientes / patrones repetidos / historial de cierre.
- Proyectos split: Proyectos capitales vs Backlog operativo.
- Reportes source logic.

Proof line:
- “This is the board packet starting to write itself.”

### Close

“APROVIVA is not trying to replace accounting today. It complements it: accounting says where the money went; APROVIVA shows what happened in the building, who owns the next step, and what the board needs to decide.”

## 15-minute demo path

Use when the buyer wants operational depth.

1. Public portal + access split.
2. Conserjería mobile flow:
   - Inicio.
   - Gemba Plan Maestro.
   - Map issue context.
   - Inventory count.
3. Supervisor flow:
   - Incident detail/action.
   - Work order creation/update.
   - Inventory procurement status.
4. Gerencia flow:
   - KPI drill-down.
   - Proyectos CSV/import path.
   - Reportes weekly summary.
5. Junta flow:
   - KPI drill-down.
   - Capital/backlog split.
   - Escalation/closure history.
6. Commercial wrap:
   - Board packet roadmap.
   - PDF/scorecard next.
   - Auth/RLS hardening caveat.

## Seed/demo data requirements

Current production seed-only baseline supports the demo without importing private data:

- PQRS seed ref: `VV-PQRS-E2E-000001`
- One inspection plan.
- One inspection round.
- One inspection finding.
- One work assignment: `WO-E2E-001`
- One incident ticket: `INC-E2E-001`
- One inventory item/location/movement.
- One service listing.
- One document.
- One weekly report.
- One spend policy.
- One building metadata demo Gemba template: `Demo Villa Valencia`
- No open escalation events by default.

## Recommended demo seed enrichment — not yet applied

Do not apply automatically to production. These should be added only through an explicit seed script or local fixture after Jeff approves.

### Demo project/capital seed

Purpose: make Junta Proyectos capital section non-empty.

Suggested row:
- table: `work_assignments`
- task_type: `project`
- title: `Reparación preventiva de bombas — Demo`
- area: `Cuarto Eléctrico`
- priority: `high`
- status: `in_progress`
- metadata:
  - `capital_project: true`
  - `demo_seed: true`
  - `rag: yellow`
  - `milestone: Cotización y alcance`
  - `percent_complete: 35`
  - `history`: one progress note.

### Demo escalation seed

Purpose: make Junta decision state visually stronger.

Suggested row:
- table: `escalation_events`
- source_type: `incident_ticket`
- severity: `high`
- status: `open`
- title: `Decisión demo: filtración recurrente en área social`
- payload:
  - source_context,
  - ticket_number,
  - category,
  - location_label,
  - decision_needed.

### Demo vendor seed

Purpose: support vendor/contract watchlist P3-RPT-005.

Suggested row can live initially as metadata on a work assignment or service listing until a richer vendor event model exists.

Fields:
- vendor name/service.
- contract expiration date.
- last attendance.
- missed/late service flag.
- linked work assignment.

## Demo reset / cleanup checklist

After any live demo that mutates production:

1. Verify counts for core operational tables.
2. Delete only demo rows tagged `metadata.demo_seed === true` or known non-seed IDs.
3. Preserve foundation seed rows.
4. Re-check:
   - `inspection_rounds`: expected 1 seed row unless demo seed approved.
   - `inspection_findings`: expected 1 seed row unless demo seed approved.
   - `work_assignments`: expected 1 seed row unless demo capital seed approved.
   - `incident_tickets`: expected 1 seed row unless demo incident seed approved.
   - `escalation_events`: expected 0 unless demo escalation seed approved.
5. Run non-mutating smokes:
   - `node scripts/production-smoke.mjs`
   - `node scripts/pqrs-rpc-smoke.mjs --live --known-ref VV-PQRS-E2E-000001`
   - `node scripts/recorridos-md04-preflight.mjs --live`

## Safe demo modes

### Mode A — Production read-only demo

Recommended for first buyer calls.

- Do not create records.
- Use existing seed rows and drill-downs.
- Describe write paths without submitting.
- Safest for clean production.

### Mode B — Local/static demo with live Supabase writes disabled/mocked

Recommended for product walkthroughs where you need to show create flows.

- Serve local static app.
- Use Playwright mocks or a test Supabase target.
- Do not hit production Supabase for mutating flows.

### Mode C — Approved production demo seed

Use only with explicit approval.

- Add tagged demo rows.
- Demo full lifecycle.
- Clean using known tags after the call or preserve as approved demo seed if desired.

## Objection handling

### “We already use WhatsApp.”

WhatsApp is good for messages, bad for operating records. APROVIVA keeps the proof: owner, due date, status, evidence, and closure history.

### “We already have accounting software.”

Accounting shows financial transactions. APROVIVA shows operational accountability: inspections, findings, work orders, escalations, inventory risk, and board decisions.

### “This looks like a lot for staff.”

Conserjería gets the simplest path: tap a plan point, choose controlled options, add photo if needed. Supervisors and gerencia handle the richer management layer.

### “Can it handle multiple buildings?”

The model already carries building context, and the commercial direction supports portfolio oversight. Villa Valencia is the focused production proof; multi-building expansion is a controlled productization step.

### “Is it secure enough?”

For controlled internal POC, yes. For broad external rollout, the security lane is clear: real auth, tighter RLS, and scoped write policies. We should be transparent about that.

## Demo assets to create next

1. One-page buyer PDF: “From WhatsApp to Board Packet.”
2. SAP comparison one-pager.
3. Board packet wireframe.
4. Screenshots for each persona.
5. Approved demo seed fixture/script with cleanup.

## Script: 5-minute talk track

> “Let me show you how a building issue becomes a board-ready decision. We start at the Villa Valencia portal. Residents see public information and PQRS, while staff and Junta enter the operations suite separately.
>
> As conserjería, the experience is phone-first. They do not manage spreadsheets. They follow a Plan Maestro, tap inspection points, and register hallazgos with controlled choices and evidence.
>
> Supervisión sees the operational layer: incidents, work orders, stockout actions, and progress updates. This is where an issue gets an owner, a due date, and a status.
>
> Gerencia gets the accountability view — KPIs with drill-downs, reports, and project progress — without chasing screenshots in WhatsApp.
>
> Junta gets the governance view: decisions pending, chronic patterns, capital projects separated from operational backlog, and evidence behind each number.
>
> The result is simple: APROVIVA turns daily operations into a board packet. WhatsApp can still be used for conversation, but APROVIVA becomes the operating record.”
