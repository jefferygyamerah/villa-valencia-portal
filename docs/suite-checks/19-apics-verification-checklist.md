# 19-point verification — APROVIVA suite (APICS / CPIM lens)

**Purpose:** Repeatable smoke + regression checklist aligned with the **19 business scenarios** in [`docs/test-findings/comprehensive.md`](../test-findings/comprehensive.md). Inventory-heavy items include notes framed as a **supply chain / inventory operations** review (APICS CPIM body of knowledge: inventory planning, cycle counting, performance measurement).

**Disclaimer:** This is an **internal product QA checklist**, not an audit attestation. “Consultant-style” criteria paraphrase common APICS teaching points (e.g. reconcile physical counts to system balances, monitor reorder signals, separate routine counts from exception reporting).

---

## Executive summary (inventory module)

**Strengths (POC):** Cycle-count capture (`movement_type = counted`), reorder-point alerts, link from inventory exceptions to `incident_tickets`, role-based quick-picks for floor staff.

**Gaps to watch:** Multi-location SKU logic is **approximate** when a single “latest per SKU” is used for alerts—full APICS-style **per-location** balances need either rolled-up queries or explicit business rules. **ABC classification** is not stored in DB; the UI may show **heuristic** hints only unless master data adds `metadata.abc_class`.

---

## 19 checks (map to scenarios 1–19)

| # | Check | APICS / ops note | Module / route | Pass criteria |
|---|--------|------------------|----------------|---------------|
| 1 | Routine physical count posted | Cycle counting updates system record; variance visible vs prior balance | `#/inventario` | Conteo guardado; metadata opcional con varianza |
| 2 | Low / missing / damaged reported | Exception path separate from count; ties to incident pipeline | `#/inventario` novedad | Crea `incident_tickets` (staff quick-pick o formulario completo) |
| 3 | Exception triage | Dispatch / advance / escalate | `#/incidencias` | Lista + acciones visibles según rol |
| 4 | Recorrido templates | Standard work for Gemba | `#/gemba` | Plantillas y selector |
| 5 | Recorrido execution | Scheduled vs actual | `#/gemba` | Crear y cerrar recorrido |
| 6 | Finding during round | Links finding data | `#/gemba` hallazgo | `inspection_findings` |
| 7 | Finding → incident | Closed-loop | Gemba + `#/incidencias` | Derivación crea ticket |
| 8 | Supervisor KPIs | Performance visibility | `#/gemba`, `#/inicio` | KPIs sin error |
| 9 | Work assignments | Backlog + advance | `#/proyectos` | Crear/avanzar según rol |
| 10 | Missed / incomplete round flagged | Schedule adherence | `#/gemba` | Regla 12h documentada en UI si aplica |
| 11 | Master data | Item + location integrity | `#/maestros` | CRUD lectura/escritura según rol |
| 12 | Daily operational report | Management review | `#/reportes` diario | KPIs cargan |
| 13 | Weekly performance | Trend review | `#/reportes` semanal | Bloques renderizan |
| 14 | Escalation summary | Risk concentration | `#/reportes` escalaciones | Tabla/lista |
| 15 | KPI CSV export | External analysis | `#/reportes` export | CSV descargable |
| 16 | Multi-location / building lens | Governance scope | `#/junta` | Tabla por edificio o aviso single-site |
| 17 | Junta KPIs + escalations | Board pack | `#/junta` | Dashboard |
| 18 | Critical → governance | Escalation object | `#/incidencias` → `#/junta` | `escalation_events` |
| 19 | Chronic pattern detection | Pareto / repeat issues | `#/junta` | Patrones listados |

---

## Inventory module — deeper criteria (APICS-style)

| Theme | Question | Where to look |
|-------|----------|---------------|
| **Record accuracy** | Does each count store enough to explain **variance** vs prior balance at that SKU/location? | `inventory_movements.metadata` |
| **Reorder policy** | Is **on-hand vs reorder point** visible before stockout? | Catálogo: delta vs reorden; alertas |
| **Exception channel** | Are **non-routine** events routed outside the count form? | Novedad → `incident_tickets` |
| **Audit trail** | Who acted? | `metadata.actorRole` / `actorLabel` |

---

## Automation

Playwright: `e2e/tests/inventory-apics.spec.ts` covers **inventory UI** checks (help panel, KPIs, modals). Full end-to-end DB verification remains a **manual / Supabase** confirmation for environments without seed data guarantees.
