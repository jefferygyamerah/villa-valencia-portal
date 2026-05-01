# Website Fix Log

Single source of truth for the Villa Valencia / APROVIVA website cleanup.

Workflow: audit one page, capture changes, summarize current-page scope, implement approved changes, verify, mark done, then move to the next page.

| Page | Section | Problem | Desired Change | Priority | Screenshot | Status | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Accessos | Desktop layout | Page has too much empty space on computer view. | Improve the layout density and spacing while keeping the existing design direction. | P2 | Pending | Done | Desktop Accessos now uses an intentional two-card grid for administration and junta. |
| Accessos | Access options | `Ingreso residentes` is redundant because users have already accessed the website by this point. | Show only `Ingreso administracion` and `Ingreso junta`. Remove/hide resident entry from this page. | P1 | Pending | Done | Accessos presents only administration and junta entry points; E2E asserts two access cards and no resident entry. |
| Accessos | Administracion PIN screen | Admin access opens a PIN screen. | Leave this screen unchanged for now. | P3 | Pending | Deferred | PIN screen remains as-is during this pass. |
| Consejeria / Recorridos | Status summary buttons | `En curso`, `Conteo operativo`, and `Foto de hallazgo` look like clickable controls but cannot be clicked. | Enable drill-down from each status summary into the relevant filtered detail view, or restyle them so they do not imply interaction. | P2 | Pending | Done 2026-05-01 | Home KPI/detail and Recorridos next-action cards now open the relevant operational detail instead of dead-looking summary controls. |
| Consejeria / Recorridos | Product messaging box | `Limite de confianza` box sounds like product sales messaging and does not belong in the live operational backend. | Remove the entire `Limite de confianza` box from this operational screen. | P1 | Pending | Done | Home operating lens no longer renders the `Limite de confianza` product-style box; mobile E2E asserts it is gone. |
| Consejeria / Recorridos | Ejecuciones recientes | Recent runs list appears after opening recorrido and is useful. | Keep this list as-is unless later issues are found. | P3 | Pending | Confirmed good | Recent executions remain visible and useful. |
| Consejeria / Nueva ejecucion | Plan maestro selection | Master plan selection works well. | Keep the master plan selector. | P3 | Pending | Confirmed good | User can select the correct master inspection plan. |
| Consejeria / Nueva ejecucion | Area de base | `Area de base` is manually selected even though it should come from the selected master plan. | Pull `Area de base` from the selected plan maestro and avoid asking the conserje to choose it manually. | P1 | Pending | Done 2026-05-01 | Selected Plan Maestro applies area automatically and marks the field as derived from the plan. |
| Consejeria / Nueva ejecucion | Frecuencia | `Frecuencia` is manually selected every execution even though it should come from the master inspection plan. | Pull frequency from the selected master inspection plan instead of asking the conserje each time. | P1 | Pending | Done 2026-05-01 | Selected Plan Maestro applies frequency automatically and marks the field as derived from the plan. |
| Consejeria / Nueva ejecucion | Timing | Timing default is acceptable as currently shown. | Keep current default timing behavior. | P3 | Pending | Confirmed good | Timing continues to default correctly. |
| Consejeria / Ejecucion activa | Task list | Execution correctly shows tasks such as `Revisar garita` and access-meter verification. | Keep the active task list behavior. | P3 | Pending | Confirmed good | Execution displays the expected tasks from the selected plan. |
| Consejeria / Hallazgo | Hallazgo details | Found issue details display correctly after adding a hallazgo. | Keep the hallazgo detail display. | P3 | Pending | Confirmed good | User can see what was found after adding a hallazgo. |
| Consejeria / Hallazgo | Ubicacion in situ | `Ubicacion in situ` dropdown does not make sense for the selected inspection point. | Use master data tied to the inspection point to populate valid location options. | P1 | Pending | Done 2026-05-01 | Point-triggered hallazgos carry the selected Punto de Inspeccion, suggested zone, segment/map metadata, and explain that context in the form. |
| Consejeria / Hallazgo | Seguimiento options | Follow-up options need a practical operational list. | Research and define follow-up actions such as fixed, needs attention, escalate to junta, replace/buy part, or close as dealt with. | P2 | Pending | Done 2026-05-01 | Shared status/priority/escalation taxonomy is defined and staff hallazgo form uses controlled follow-up phrases for operational routing. |
| Inventario | Top summary | `Conteo ciclico`, `Alertas`, and `Registro de novedades` at the top are acceptable. | Keep this top summary. | P3 | Pending | Confirmed good | Top inventory summary remains visible and clear. |
| Inventario | Terms dropdown | Dropdown that explains terms is acceptable. | Keep the terms dropdown. | P3 | Pending | Confirmed good | Staff can still expand term explanations when needed. |
| Inventario | Registrar conteo interaction | Clicking `Registrar conteo` appears to do nothing because the form opens at the bottom of the screen. | Open the count registration form immediately in the user's current view, optimized for phone use. | P1 | Pending | Done 2026-05-01 | Count form opens in the in-page modal host from the primary action and next-step action; supervisor no longer sees the count entry point. |
| Inventario | List placement | Operational lists can push the primary action form too far down. | Make list sections collapsible and place them after the operational action flow. | P1 | Pending | Done 2026-05-01 | Alerts/catalog/movements are now below the action flow; long catalog and movements sections are collapsed by default. |
| Inventario | Count form fields | Count form supports article, storage location, quantity/update, but lacks comments. | Keep article/location/quantity fields and add a comments field. | P2 | Pending | Done 2026-05-01 | Count form keeps article/location/quantity and includes controlled/optional comments persisted in movement notes. |
| Mapa | Map base view | Map itself looks good visually, but no pins or points are visible. | Display relevant route points, inspection points, issue markers, or other operational map markers. | P1 | Pending | Done 2026-05-01 | Map renders GeoJSON route preview markers, saved route waypoints, and saved/new finding markers. |
| Mapa | Mark issue flow | `Marcar hallazgo` allows selecting a map point, but the map/form context only says `Ruta de recorrido`. | Make the selected point meaningful in the issue flow, with clear location context from the map selection. | P1 | Pending | Done 2026-05-01 | Tap-to-place hallazgo flow passes lat/lng and selected zone into Gemba, with clear context in the form. |
| Mapa | Issue form location | Location dropdown has only a few unrelated items and does not match the selected map area or operational context. | Drive location options from master data and/or selected map point. | P1 | Pending | Done 2026-05-01 | Map-selected zone and master-data site places drive the hallazgo location context. |
| Mapa | Issue form segment | Segment dropdown does not make sense for the selected map point or issue. | Drive segment options from route/inspection master data or remove segment if not operationally useful. | P1 | Pending | Done 2026-05-01 | Segment context is represented by the selected inspection point/zone; unrelated segment field is not exposed in the map flow. |
| Mapa | Photo attachment | Issue form supports adding a picture. | Keep photo attachment. | P3 | Pending | Confirmed good | Staff can attach a picture to a map issue. |
| Mapa | New issue visibility | After saving an issue and returning to map, the issue point is not visible. | Show newly flagged issues as markers on the map after save. | P1 | Pending | Done 2026-05-01 | Map listens for newly saved Gemba findings and immediately renders the lat/lng marker, while still loading persisted findings from `v_inspection_findings_map`. |
| Mapa | Map interaction model | Current map is not functional enough; click/drag or direct point flagging may be needed. | Define a practical mobile-first way for staff to flag the issue location on the map. | P2 | Pending | Done 2026-05-01 | Mobile-first tap-to-place workflow is implemented for route points and hallazgos, with boundary validation and drag adjustment for managers. |
| Incidencias | Concierge visibility | Concierge view appears to show previous incidents broadly. | Show only incidents raised by the concierge or assigned to that concierge. | P1 | Pending | Wave 10 implemented | Conserjeria list is filtered client-side to tickets raised by the conserjeria role/session metadata or assigned to it; mocked E2E coverage added, browser execution blocked by sandbox. |
| Incidencias | Incident action | Concierge needs an action path for assigned incidents/work orders. | Allow assigned incidents/work orders to be marked closed with a comment and/or evidence. | P1 | Pending | Wave 10 implemented | Assigned/raised conserjeria incidents can be closed with a required note and optional evidence URL; closure writes to incident metadata history without schema change. |
| Consejeria / Main screen | Tools module duplication | `Tools Modulo` duplicates the navigation bar below. | Remove the duplicated `Tools Modulo` area from the main screen. | P2 | Pending | Done | Logged-in phone views hide the home module grid where fixed bottom nav exists; desktop keeps module cards. |
| Consejeria / Main screen | Installed app placement | Installed app prompt/action is too low in the hierarchy. | Move installed app prompt/action to the very top of the main screen. | P1 | Pending | Done | Install prompt container now renders before the operating lens; E2E asserts DOM order on mobile. |
| Consejeria / Main screen | Welcome personalization | `Bienvenido Personal Conserjeria` is acceptable for now, but should later use the logged-in person's name. | After login is fixed, show `Bienvenido` plus the logged-in person's name. | P2 | Pending | Done 2026-05-01 | Home uses the logged-in session label in the welcome headline. |
| Supervision / Role model | Future role split | Current `supervision` login will eventually split into administration/supervision responsibilities. | Keep current audit under supervision, but design fixes so administration/supervision role boundaries can be separated later. | P2 | Pending | Done 2026-05-01 | Role checks are centralized through configured PIN/session roles and do not hard-code a future admin split. |
| Supervision / Recorridos | Recorrido master data | Daily concierge recorridos, daily administradora de planta recorridos, and weekly supervisor recorridos need one definition source. | Maintain recorridos as master data/config with role, frequency, owner, and inspection points. | P1 | Pending | Done 2026-05-01 | Templates and rounds carry role, owner, frequency, area, and plan points from one Plan Maestro source. |
| Supervision / Recorridos | Summary clarity | `Abierto`, `Atrasado`, and `Completado` appear to summarize conserje completions, but role scope is unclear. | Clarify whether summaries show all recorridos, only assigned role recorridos, or team oversight metrics. | P1 | Pending | Done 2026-05-01 | Recorrido summaries and next-action cards state owner role and visible scope. |
| Supervision / Recorridos | Continue recorrido ambiguity | `Siguiente paso`, `Recorrido matutino`, and `Continuar puntos` make it unclear whether supervisor is continuing a conserje recorrido or their own recorrido. | Make recorrido ownership and action explicit before continuing. | P1 | Pending | Done 2026-05-01 | Continue actions show owner role and conserje/supervisor visibility is role-filtered. |
| Supervision / Recorridos | Point action UX | Clicking points changes a pill to `No aplica`, but the interaction is not intuitive. | Make point status actions clearer, with obvious selected state and meaning. | P2 | Pending | Done 2026-05-01 | Point actions now say `OK revisado`, `No aplica`, and `Registrar hallazgo`, with selected button state and status badge. |
| Supervision / Recorridos | Repeated active execution | `Ejecucion en curso` repeats `Recorrido matutino`, making the screen feel duplicated. | Consolidate repeated recorrido information into one clear active execution area. | P2 | Pending | Done 2026-05-01 | Next-action and active cards separate summary from execution; active card carries the single execution action block. |
| Supervision / Recorridos | Completion end state | Completing the recorrido only changes status to `Completado` with no useful follow-up. | Add a clearer completion state, confirmation, or return path after completion. | P2 | Pending | Done 2026-05-01 | Completion now shows a clear saved state with points registered and a path to Reportes. |
| Supervision / Mapa | Map usefulness | Site map still shows no useful operational information. | Apply the same marker/pin/location fixes captured for the map workflow. | P1 | Pending | Done 2026-05-01 | Supervisor map shows route preview/saved points, findings, registry context, and issue details. |
| Supervision / Incidencias | Incident detail access | Incidents are visible but cannot be opened for useful review. | Allow supervisor to open incident details. | P1 | Pending | Wave 10 implemented | Supervisor/Gerencia incident cards now open a detail sheet with description, context, assignment badge, and movement history. |
| Supervision / Incidencias | Incident comments/actions | Supervisor cannot add comments, send back, or meaningfully manage incidents. | Add incident action workflow with comments, send-back/reassign where appropriate, and evidence/closure notes. | P1 | Pending | Wave 10 implemented | Supervisor/Gerencia can take, resolve, reassign, send back, and escalate incidents with history metadata. |
| Supervision / Incidencias | Resolver action | `Tomar accion` > `Resolver` only changes status without comments. | Require or allow closure comments/evidence when resolving. | P1 | Pending | Wave 10 implemented | Resolve/close requires a comment and accepts optional evidence URL; history is visible in incident detail and Junta closure review. |
| Supervision / Projects and Actions | Section naming | Section is labeled `Project and Action`, mixing languages and concepts. | Rename/clarify this section around work orders/actions/projects according to actual operational use. | P2 | Pending | Done 2026-05-01 | Project screen copy uses Proyectos / Acciones, órdenes de trabajo, backlog operativo, and capital projects consistently by role. |
| Supervision / New work order | Area field | `Area` is free text, but should be controlled data. | Make area a dropdown from master data/config. | P1 | Pending | Done | Work-order area uses the shared master-data area dropdown. |
| Supervision / New work order | Assigned-to field | `Asignado` is free text, but should route work to actual users/roles. | Make assignee a dropdown based on configured administration, concierge/operator, and junta users. | P1 | Pending | Done 2026-05-01 | Assignee field is a controlled dropdown derived from role/master-data config. |
| Supervision / New work order | Deadline field | Deadline field and mask are useful. | Keep deadline input behavior. | P3 | Pending | Confirmed good | Supervisor can set a deadline cleanly. |
| Supervision / New work order | Work required field | `Trabajo requerido` comments are useful. | Keep work required/comments field. | P3 | Pending | Confirmed good | Supervisor can describe required work. |
| Supervision / New work order | Supabase 400 error | Creating a work assignment errors with `Supabase 400 on work assignment`. | Debug and fix work assignment creation, likely tied to required controlled fields/foreign keys. | P1 | Pending | Done 2026-05-01 | New work-assignment payloads include building_id and controlled required fields; syntax/E2E route coverage passes without 400-prone free-text path. |
| Supervision / Projects and Actions | Existing project updates | No clear way to update existing projects/actions. | Add or expose update flow for existing work orders/projects/actions. | P1 | Pending | Done 2026-05-01 | Existing work cards expose update modal for status, priority, due date, and progress history. |
| Supervision / Reportes | Daily summary KPIs | `Resumen diario` shows KPIs and is useful. | Keep KPI summary. | P3 | Pending | Confirmed good | Supervisor can view daily KPIs. |
| Supervision / Reportes | CSV export | `Exportar KPIs` produces a CSV and works well. | Keep CSV export. | P3 | Pending | Confirmed good | KPI CSV export continues to work. |
| Supervision / Reportes | PDF export | PDF export works but is very basic. | Backlog a designed PDF report template. | P3 | Pending | Backlog | PDF report has a cleaner, designed format when prioritized. |
| Supervision / Inventario | Role mismatch | Supervisor sees `Registrar conteo`, but count registration belongs to concierge. | Remove/hide count registration from supervisor inventory view. | P1 | Pending | Done 2026-05-01 | Supervisor inventory no longer renders `Registrar conteo`; E2E coverage asserts the role split. |
| Supervision / Inventario | Reportar novedad | `Reportar novedad` opens the same fields and does not match supervisor responsibilities. | Replace supervisor inventory actions with purchase-order/status/comment workflows for stockouts and low-stock items. | P1 | Pending | Done 2026-05-01 | Supervisor gets procurement/status workflow instead of concierge count/novelty capture. |
| Supervision / Inventario | Stockout actioning | Supervisor should be able to act on low stock/stockout flags. | Add actions for purchase order raised, comments, status updates, and follow-up ownership. | P1 | Pending | Done 2026-05-01 | Low-stock actioning supports status, purchase-order reference, comments, and follow-up ownership in movement metadata. |
| Gerencia | Role scope | Gerencia role needs visibility across multiple buildings, supervisors, administradoras de planta, and staff. | Treat Gerencia as a macro oversight role, not a local execution role. | P1 | Pending | Done 2026-05-01 | Gerencia is treated as macro oversight: no Plan Maestro creation, portfolio-style KPIs, projects/reporting, and drill-downs. |
| Gerencia / Home | KPI drill-down | KPIs such as `Pendiente de aprobacion`, `Trabajos abiertos`, and `Resumen semanal` cannot be drilled down. | Add drill-down from each KPI into the relevant filtered detail view. | P1 | Pending | Done 2026-05-01 | Inicio KPIs open filtered supporting detail, and Gerencia copy points to backlog/atrasos instead of a generic report action. |
| Gerencia / Home | Suggested action | `Accion sugerida` says `Abrir reportes`, but the action is basic and not very descriptive. | Improve suggested actions so they guide macro-level oversight decisions. | P2 | Pending | Done 2026-05-01 | Gerencia primary suggested action now points to backlog/atrasos review with reports as secondary context. |
| Gerencia / Reportes | Daily summary quality | `Resumen diario` shows basic KPIs, but should be more descriptive and qualitative. | Backlog a richer qualitative reporting layer, potentially including AI-generated RAG status for inventory, operations, repairs, vendors, and related areas. | P3 | Pending | Backlog | Reporting can summarize portfolio health qualitatively once underlying data is reliable. |
| Gerencia / Reportes | Reporting module | Reporting module is generally fine. | Keep current reporting module while improving report content over time. | P3 | Pending | Confirmed good | Reports remain accessible and functional. |
| Gerencia / Proyectos | Project/action structure | Projects/actions can be raised but lack dropdowns/structure, preventing meaningful progress reporting. | Add structured project/action fields, controlled dropdowns, and progress update model. | P1 | Pending | Done 2026-05-01 | Project/order forms use controlled area, assignee, priority, status, type, due date, and progress metadata. |
| Gerencia / Proyectos | Progress reporting | No clear way to add progress against projects over time. | Add progress/status update workflow for projects/actions. | P1 | Pending | Done 2026-05-01 | Progress updates are captured in metadata history and surfaced as last progress comments for board reporting. |
| Gerencia / Incidencias | Incident action | Incidents show `Tomar` and `Resolver`, but resolution still lacks comments/context. | Reuse fixed incident action workflow with comments, evidence, escalation, and closure history. | P1 | Pending | Wave 10 implemented | Gerencia shares the supervisor lifecycle workflow and can resolve/escalate with reviewable metadata history. |
| Gerencia / Incidencias | Escalation | Gerencia needs a way to escalate incidents, with downstream visibility for Junta. | Ensure escalated incidents become visible/actionable to Junta. | P1 | Pending | Wave 10 implemented | Escalation payload now includes ticket number, location/category context, evidence URL, and incident history for Junta/Reportes. |
| Gerencia / Mapa | Building issue visibility | Map has no visual representation of issues for the specific building. | Show building-specific issue markers and relevant operational map context. | P1 | Pending | Done 2026-05-01 | Gerencia map view shows building-specific route/finding context for the configured Villa Valencia building. |
| Gerencia / Recorridos | Master plan ownership | `Nuevo plan maestro` appears in Gerencia, but master plan creation should live with the supervisor/admin operational row. | Move or restrict master plan creation to the appropriate operational role, likely supervisor/admin, while Gerencia retains oversight. | P1 | Pending | Done 2026-05-01 | `Nuevo Plan Maestro` is hidden from Gerencia and visible to Supervisor; focused route coverage added. |
| Gerencia / Recorridos | Execution class duplication | `Clases de ejecucion` / recorridos are too fragmented; matutino/diario overlap. | Consolidate execution class/frequency concepts, e.g. use `diario` instead of separate matutino/diario where appropriate. | P2 | Pending | Done 2026-05-01 | Frequency/classification uses shared inspection-plan taxonomy and selected Plan Maestro values. |
| Gerencia / Recorridos | Plan area definition | `Area base del plan` is too limited for plan setup. | Plan maestro should define multiple location points, inspection sequence, frequency, and optional comments. | P1 | Pending | Done 2026-05-01 | Plan Maestro captures area, frequency, owner role, ordered points, and comments/notes via point text metadata. |
| Junta / Home | KPI wording | Home KPIs show `modulos`, which does not feel like board-level information. | Replace module-oriented KPI wording with governance/oversight metrics that matter to Junta. | P2 | Pending | Done 2026-05-01 | Junta home operating lens now shows decisions, risks, and evidence instead of module counts. |
| Junta / Home | Product messaging box | `Limite de confianza` appears again and is not needed. | Remove the `Limite de confianza` box from Junta view. | P1 | Pending | Done | Shared home operating lens no longer renders the `Limite de confianza` box for any role. |
| Junta / Home | KPI drill-down | Junta KPIs cannot be drilled down. | Add drill-down from KPI cards into filtered supporting detail. | P1 | Pending | Done 2026-05-01 | Junta KPI cards open supporting detail tables for escalations, chronic patterns, orders, compliance, and buildings. |
| Junta / Navigation | Module duplication on mobile | Module icons are fine on desktop where there is no bottom nav, but duplicate the mobile bottom navigation. | Keep desktop module grid if useful; hide or reduce duplicated module grid on mobile when bottom nav is present. | P2 | Pending | Done | Logged-in phone views hide the duplicated home module grid when bottom nav is present. |
| Junta / Proyectos | Backlog/project visibility | `Backlog`/similar labels appear, but no operational backlog or projects are visible. | Build a clear board-level projects/backlog view once source data exists. | P1 | Pending | Done 2026-05-01 | Junta Proyectos now separates capital projects from operational backlog and no longer only shows Junta-requested rows. |
| Junta / Proyectos | Capital projects | Junta needs top-down view of capital projects. | Show capital projects with milestones, percent completion, RAG status, and supervisor/administration progress comments. | P1 | Pending | Done 2026-05-01 | Capital projects are grouped separately with RAG derived from status/priority/overdue state and last progress comment. |
| Junta / Proyectos | Operational backlog | Junta needs separate operational backlog for actions owned by supervisors, administration, or Gerencia. | Show operational backlog with owner, status, priority, due date, comments, and escalation state. | P1 | Pending | Done 2026-05-01 | Operational backlog is grouped separately with owner, status, priority, due date, and last progress comment. |
| Junta / Reportes | Basic reporting | Current daily/weekly summaries and KPIs are acceptable for now. | Keep current basic reporting while improving content over time. | P3 | Pending | Confirmed good | Junta can still access daily/weekly summary reporting. |
| Junta / Reportes | Suggested actions source | `Acciones sugeridas` appear, but source/logic is unclear. | Clarify or document how suggested actions are generated. | P2 | Pending | Done 2026-05-01 | Reportes now explains the rule sources for next steps and suggested actions. |
| Junta / Reportes | Board report research | Need to benchmark what board directors in a housing association typically want to see. | Research board-level HOA/condo reporting needs and improve Junta report structure accordingly. | P3 | Pending | Backlog | Junta report design reflects common board priorities and APROVIVA needs. |
| Junta / Escalaciones | Missing escalation | Escalation raised from Gerencia/supervision test did not appear in Junta escalations. | Fix escalation routing so items escalated from administration/Gerencia/residents/concierge-originated incidents appear for Junta. | P1 | Pending | Wave 10 implemented | Junta decisions table now renders escalation source context from payload or linked incident id; mocked E2E verifies escalated incident context appears. |
| Junta / Escalaciones | Escalation source model | Escalations should come from administration, resident-originated issues, concierge-detected issues, or Junta-flagged items. | Define one escalation lifecycle and source model consumed by all roles. | P1 | Pending | Done 2026-05-01 | One escalation taxonomy is used in config and incident-originated escalations carry source context/history into Junta/Reportes; non-incident sources use the same status/target model. |
| Junta / Junta tab | Loading state | Junta tab initially says `Cargando`; eventually shows good KPIs. | Keep loading behavior if short, but ensure it resolves reliably and does not mask errors. | P2 | Pending | Done 2026-05-01 | Junta tab renders KPIs after async load and uses UI error boxes instead of masking failures. |
| Junta / Junta tab | KPI improvements | Junta tab KPIs are good but need a board-level improvement pass. | Research and improve Junta KPI set using HOA/board needs and prior SAP comparison work. | P3 | Pending | Backlog | Junta KPI view is commercially credible and operationally useful. |
| Junta / Commercial readiness | Module packaging | Application may be sold module-by-module, so each module needs a QA/commercial readiness pass. | Backlog module-by-module review for completeness, role fit, drill-down, and sales packaging after core workflows work. | P3 | Pending | Backlog | Modules are coherent enough to demonstrate/sell without exposing unfinished workflow gaps. |
| Junta / Benchmarking | SAP comparison | Prior SAP functionality comparison may help strengthen Junta/product views. | Reuse prior SAP comparison work during reporting/module readiness review. | P3 | Pending | Backlog | Board and product views reflect relevant enterprise workflow expectations without overbuilding. |

## Page Notes

### Accessos

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: improve the existing page only; do not redesign from scratch or create a competing UI system
- Captured from voice audit:
  - Desktop layout has excessive empty space.
  - `Ingreso residentes` should not appear on Accessos.
  - Accessos should only show `Ingreso administracion` and `Ingreso junta`.
  - Administration PIN screen is intentionally unchanged for now.

### Consejeria / Recorridos

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: improve the existing backend operational flow only; do not introduce product-sales messaging or a competing workflow.
- Confirmed good:
  - Main screen looks good overall.
  - `Bienvenido` is acceptable.
  - `Ejecuciones recientes` list is useful.
  - Master plan selector works well.
  - Timing default is acceptable.
  - Active execution task list appears correctly.
  - Hallazgo details display correctly.
- Captured from voice audit:
  - Status summary items should drill down or stop looking clickable.
  - Remove `Limite de confianza` box.
  - `Area de base` should come from selected plan maestro.
  - `Frecuencia` should come from selected master inspection plan.
  - `Ubicacion in situ` should be driven by master data for the selected inspection point.
  - `Seguimiento` needs researched, operational follow-up action options.

### Inventario

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: optimize the existing operational inventory flow for conserjes on phones; do not create a new inventory system.
- Confirmed good:
  - Top summary with `Conteo ciclico`, `Alertas`, and `Registro de novedades` is fine.
  - Terms explanation dropdown is fine.
- Captured from voice audit:
  - `Registrar conteo` currently opens a form too low on the screen, making it feel broken.
  - `Registrar conteo` should open the count form immediately in the current view, especially on phones.
  - Lists should be collapsible and lower on the screen.
  - Operational action flow should come first.
  - Count form should include article, storage location, quantity/update, and comments.

### Mapa

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: make the existing map operationally useful; do not introduce a separate mapping system.
- Confirmed good:
  - Base map view looks good visually.
  - Issue form supports adding a picture.
- Captured from voice audit:
  - Map has no visible pins, route points, issue points, or useful markers.
  - `Marcar hallazgo` lets the user select a point, but the form context only says `Ruta de recorrido`.
  - Location dropdown has unrelated options.
  - Segment dropdown does not make sense.
  - Saved issue does not show as a point on the map after returning.
  - Need a practical mobile-first interaction for flagging exact issue locations, potentially click/tap-to-place or drag-to-adjust marker.

### Incidencias

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: keep the existing incidents workflow, but make concierge visibility and actions operationally correct.
- Captured from voice audit:
  - Concierge should not see a broad list of previous incidents.
  - Concierge should see only incidents they raised or incidents/work orders assigned to them.
  - Assigned incidents/work orders should include an action to mark closed.
  - Closure should support a comment and/or evidence.

### Consejeria / Main Screen

- Audit status: complete
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: clean up the existing concierge home screen hierarchy; do not add a new dashboard architecture.
- Captured from voice audit:
  - `Tools Modulo` duplicates the bottom navigation and should be removed.
  - Installed app prompt/action should be the first item at the top of the screen.
  - `Bienvenido Personal Conserjeria` is okay for now, but once login is fixed it should show the logged-in person's name.

## Audit Closure

- Concierge backend voice audit completed on 2026-04-30.
- Next step: summarize implementation scope before editing.
- Implementation order should prioritize P1 operational blockers first, then P2 layout/hierarchy improvements.

### Supervision

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: improve the existing supervision workflow; do not create a separate administration architecture yet, but avoid blocking the future role split.
- Cross-cutting master data requirement:
  - Recorridos must be defined once with role/owner/frequency/inspection points.
  - Areas must come from controlled master data.
  - Assignees must come from configured users/roles.
  - Work assignments must route to the assigned person's login/task list.
- Confirmed good:
  - Deadline input in new work order is useful.
  - `Trabajo requerido` comments are useful.
  - Daily summary KPIs are useful.
  - CSV KPI export works.
  - PDF export works, but should be redesigned later.
- Captured from voice audit:
  - Recorridos screen is messy and role ownership is unclear.
  - Need clarity between daily concierge recorridos, daily administradora recorridos, and weekly supervisor recorridos.
  - `Continuar puntos` may imply continuing the concierge recorrido, which would be wrong unless explicitly intended.
  - Point status pill interaction is not intuitive.
  - Active execution area duplicates recorrido information.
  - Completion state is too thin.
  - Map remains visually present but operationally useless without markers/context.
  - Incidents cannot be opened, commented on, sent back, or resolved with closure evidence.
  - Resolving incident only changes status, leaving no review trail for reporter, junta, or management.
  - Work order area and assignee must be dropdowns from master/config data.
  - New work order currently fails with `Supabase 400 on work assignment`.
  - Existing projects/actions need an update path.
  - Supervisor inventory view is wrong: it should not include concierge count registration.
  - Supervisor inventory should support purchase-order/status/comment actions for stockouts and low-stock items.

### Gerencia

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: Gerencia is a macro oversight role across buildings; avoid turning it into another local execution console.
- Role definition:
  - Gerencia should see multiple buildings.
  - Each building may have supervisors, administradoras de planta, and staff.
  - Gerencia should review macro status, drill down, escalate, and monitor progress.
- Confirmed good:
  - Reporting module is generally fine.
- Captured from voice audit:
  - Home KPIs cannot be drilled down.
  - `Accion sugerida` / `Abrir reportes` is too basic.
  - `Resumen diario` should become more qualitative and descriptive over time.
  - AI-generated RAG status for inventory, operations, repairs, vendors, etc. is a backlog candidate after the core data/workflows are stable.
  - Projects/actions lack dropdowns and structure, blocking project progress reporting.
  - Gerencia needs project progress updates that can be reported against.
  - Incidents need escalation, comments, evidence, and close-out history.
  - Escalated incidents should be visible/actionable to Junta.
  - Map needs issue markers for the selected building.
  - `Nuevo plan maestro` likely belongs under supervisor/admin operational ownership, not Gerencia macro oversight.
  - Execution classes/frequencies should be consolidated where duplicated, such as matutino/diario.
  - Plan maestro should define location, multiple location points, sequence, frequency, and comments.

### Junta

- Audit status: in progress
- Editing status: blocked until requested changes are summarized and approved
- Scope rule: Junta is a board/governance view; do not turn it into an operational data-entry console.
- Confirmed good:
  - Desktop module grid can be useful where there is no bottom navigation.
  - Daily/weekly report summaries are acceptable for now.
  - Junta tab eventually shows some useful KPIs.
- Captured from voice audit:
  - KPI wording around `modulos` is not board-relevant.
  - `Limite de confianza` box should be removed.
  - KPI cards need drill-down.
  - Mobile module icons duplicate bottom nav.
  - Projects view should show capital projects with milestones, percent completion, RAG status, and progress comments.
  - Operational backlog should be separate from capital projects and include actions owned by supervision, administration, or Gerencia.
  - Suggested action source is unclear.
  - Escalation raised in the previous flow did not appear in Junta, so escalation routing is broken.
  - Escalations should come from administration, resident-originated issues, concierge-detected issues, Gerencia, or Junta itself through one lifecycle.
  - Junta tab loading should resolve reliably.
  - Need a later research pass on board-level HOA/condo reporting expectations.
  - Use prior SAP comparison work during the module/reporting readiness pass.
  - Commercial readiness pass should happen module-by-module after core workflows are stable.
