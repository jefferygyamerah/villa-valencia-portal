# P3-COM-001 — Module Packaging QA Matrix

Date: 2026-05-01  
Product: Villa Valencia / APROVIVA  
Status: Commercial-readiness working matrix  
Goal: make each module demoable, board-relevant, privacy-safe, and clearly better than WhatsApp + Excel.

## Commercial thesis

APROVIVA is not just a resident portal or an operations dashboard. It is a **phone-first condo operating layer** that turns daily building work into board-ready evidence.

The product story:

> Conserjería captures what happened in the building. Supervisión/Gerencia turns it into accountable work. Junta sees risks, decisions, and evidence without reading chat threads or rebuilding spreadsheets.

## Readiness scale

- **Ready:** good enough for a controlled demo/sales conversation now.
- **Demo-ready with caveat:** usable, but explain the caveat clearly.
- **Needs P3 polish:** do not lead with this module commercially until the listed polish is complete.
- **Backlog:** not needed for the current sales story.

## Module matrix

| Module | Buyer / user | 60-second demo story | Lifecycle | Role boundaries | Drill-down / evidence | Mobile path | Privacy posture | Spreadsheet/WhatsApp replacement | Commercial readiness | P3 polish ticket |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public portal / Accessos | Residents, board, admin | Resident lands on a branded Villa Valencia portal, sees transparency, providers, PQRS, and separate admin/junta access. | Resident info → PQRS/status → suite handoff. | Public vs staff/junta entry is separated. | PQRS status lookup and provider/document surfaces. | Good for resident browsing. | No private operational data exposed on public surface. | Replaces scattered links and ad-hoc announcement pages. | Ready | P3-COM-002 demo script |
| Suite auth + role routing | Admin/operator buyer | Four PIN roles show clear separation: conserje, supervisor, gerencia, junta. | Login → role modules → logout. | Strong UI role gating; POC caveat: not real auth/RLS-hard yet. | E2E verifies allowed/denied routes. | Good. | Must disclose POC PIN gate before broad external use. | Replaces shared spreadsheet tabs with role-specific workflows. | Demo-ready with caveat | Security/RLS hardening later |
| Inicio / operating lens | Gerencia, Junta, staff | Each role gets a different operating lens and KPI drill-downs instead of a generic menu. | Session role → next action → module. | Copy and actions adapt by role. | Gerencia/Junta KPI drill-downs are live. | Good; duplicate module grid hidden on phone. | Avoids PII, shows operational status only. | Replaces “what should I look at?” manual navigation. | Ready | P3-RPT-002 scorecard metrics |
| Recorridos / Gemba | Conserje, supervisor, gerencia | Supervisor has Plan Maestro; conserje executes points; hallazgos become evidence and reports. | Plan → round → point result → finding → close/report. | Conserje sees own role plans; supervisor owns oversight; gerencia oversight-only. | Point-level evidence, history, findings, report roll-up. | Strong phone-first path. | Uses operational areas, not resident PII. | Replaces paper checklists + WhatsApp photos. | Ready | P3-COM-002 demo path; reserve component mapping later |
| Mapa | Conserje, supervisor, gerencia | Tap inside Villa boundary to mark hallazgo; map shows route/issue context and registry. | Place point → form context → saved marker → registry/action. | Field roles can mark; supervisors/gerencia manage route points. | Marker registry, photos/comments, finding markers. | Good; tap-to-place is clear. | Map uses common-area context only. | Replaces “where exactly?” WhatsApp ambiguity. | Ready | P3-RPT-004 reserve/component overlays later |
| Inventario | Conserje, supervisor, gerencia | Conserje records count; supervisor manages stockout/replenishment; gerencia reviews risk. | Count → alert → procurement/status → report. | Conserje count; supervisor actioning; gerencia macro review. | Movement history, notes, low-stock cards. | Good for conserje counts. | No resident data. | Replaces supply notebook and chat requests. | Ready | P3-RPT-003 RAG inventory narrative |
| Incidencias / escalaciones | Conserje, supervisor, gerencia, junta | Conserje reports/gets assigned; supervisor triages; gerencia/junta see escalated context and history. | Create/assign → take action → resolve/escalate → closure history. | Conserje scope filtered; supervisor/gerencia manage; junta sees escalations. | Detail sheets, escalation context, closure history. | Good. | PII-free operational categories; free-text should stay guarded. | Replaces chat threads with audit trail. | Ready | P3-RPT-002 recurring issue metrics |
| Proyectos / backlog / capital projects | Supervisor, gerencia, junta | Junta sees capital projects separately from operational backlog; gerencia/supervisor update work. | Request/create → assign → progress → close → board view. | Junta intake/read; supervisor/gerencia create/update; gerencia CSV. | Last progress comments, RAG, owner/status/due date. | Good for updates, less phone-critical than Gemba. | Board view avoids resident/banking data. | Replaces action-item spreadsheet and meeting minutes drift. | Ready | P3-RPT-004 capital/reserve fields |
| Reportes | Supervisor, gerencia, junta | Daily/weekly/escalation reports summarize work, risks, and next steps from live operational tables. | Read operational data → KPI/export/print. | Supervisor/gerencia/junta access; conserje restricted. | KPI CSV export and source logic text. | Usable; report consumption is more desktop/tablet. | Explicit no-PII posture. | Replaces manual weekly summary compilation. | Demo-ready with caveat | P3-RPT-001 PDF packet; P3-RPT-002 scorecard |
| Junta dashboard | Junta | Board sees decision box, KPIs, drill-downs, chronic patterns, closures, compliance, weekly reports. | Operations/escalations → board decision detail. | Junta-only. | Drill-down tables, history, decision framing. | Usable on phone, stronger on tablet/desktop. | Executive view avoids contact/bank/resident private fields. | Replaces agenda prep from fragmented sources. | Ready | P3-RPT-001/P3-RPT-002 |
| Maestros / config | Gerencia/admin | Gerencia controls catalog/master data so field forms stop using unsafe free text. | Configure items/locations/users → drive forms. | Gerencia-only. | Master data visible in forms. | Desktop/tablet preferred. | Operational config only. | Replaces hidden assumptions in spreadsheets. | Demo-ready with caveat | Admin UX polish later |

## Demo positioning by persona

### Conserje

Message: “Don’t type paragraphs. Follow the route, tap the point, capture evidence.”

Proof points:
- PIN 2026 / CONS26.
- Mobile-first Inicio.
- Gemba Plan Maestro execution.
- Map tap-to-place hallazgo.
- Inventory count.
- Incident closure with note/evidence.

### Supervisor

Message: “Turn findings into accountable work and make execution visible.”

Proof points:
- PIN SUP26.
- Plan Maestro ownership.
- Active/overdue rounds.
- Incident triage/actions.
- Procurement actioning for stockouts.
- Work order creation/update.

### Gerencia

Message: “See operations as decisions and accountability, not raw chat.”

Proof points:
- PIN GER26.
- KPI drill-downs.
- Proyectos CSV/import + update.
- Reportes daily/weekly/escalations.
- Map and Gemba oversight without taking over field execution.

### Junta

Message: “Get board-ready evidence without private operational noise.”

Proof points:
- PIN JD26.
- Junta dashboard KPI drill-downs.
- Capital projects vs operational backlog.
- Escalation context and closure history.
- Reportes with visible source logic.

## Sales narrative

### The pain

Most condos run operations through WhatsApp, Excel, Google Drive, paper rounds, and meeting minutes. That creates four failures:

1. no single source of truth,
2. weak accountability,
3. no reliable board packet,
4. lost evidence when staff changes or chats scroll away.

### The promise

APROVIVA turns building work into a live operating record:

- field work captured on phone,
- assignments and escalation tracked by role,
- board sees only what matters,
- reporting becomes generated evidence, not manual cleanup.

### The wedge

Start with operations + board reporting, not full HOA accounting. Accounting systems show money; APROVIVA explains what happened operationally and what needs a decision.

### The “why now”

Boards need confidence and documentation. Staff need simple phone workflows. Managers need fewer follow-up chats. APROVIVA connects all three.

## Competitive positioning

### Against WhatsApp + Excel

APROVIVA wins on:
- status history,
- owner/due date,
- evidence links,
- role visibility,
- board drill-down,
- repeatable reporting.

WhatsApp/Excel may still exist, but APROVIVA becomes the operating record.

### Against generic property management software

APROVIVA wins on:
- condo/HOA board packet focus,
- Spanish phone-first field workflows,
- local operational context,
- lightweight deployment.

Generic systems win on:
- billing/accounting depth,
- broad leasing/property-management modules,
- mature integrations.

### Against SAP-style enterprise maintenance

APROVIVA should not claim SAP parity. Position it as a focused vertical layer:

- SAP is deep enterprise asset management.
- APROVIVA is lightweight condo operations + board governance.
- APROVIVA borrows lifecycle discipline: notification → work → evidence → closure → analytics.

## Current caveats to disclose honestly

- PIN gate is POC-grade; production hardening needs real auth/RLS before wide external rollout.
- Financial accounting is not complete HOA accounting; current finance pieces are transparency/reporting surfaces.
- Real historical/private operational backfill is intentionally deferred until private exports/mapping approval.
- PDF packet is not implemented yet; print/export is the next P3 UI slice.

## Packaging scorecard

| Category | Score | Notes |
| --- | ---: | --- |
| Operational loop | 8/10 | Core create/act/close/report loop works; real data backfill pending. |
| Board oversight | 8/10 | Drill-downs and backlog split are strong; PDF packet/scorecard polish next. |
| Mobile field UX | 8/10 | Gemba/map/inventory are phone-first enough for demo. |
| Commercial story | 7/10 | Clear now; needs demo script and one-pagers. |
| Security posture | 5/10 | Fine for controlled internal POC; needs auth/RLS hardening before broad rollout. |
| Data maturity | 6/10 | Clean seed/demo state; real import and reserve/vendor enrichment pending. |

## Next actions

1. Build `P3-COM-002` demo narrative and seed script.
2. Build `P3-SAP-001` one-page comparison.
3. Implement `P3-RPT-001` board packet print/PDF template.
4. Add `P3-RPT-002` scorecard metrics to Junta/Reportes.
5. Plan security/RLS hardening as a separate production-readiness lane before external pilots.
