# Recorridos Go-Live Checklist (Strict) - 2026-04-21

Scope: `templates -> recorrido -> hallazgo -> incidencia` for `#/gemba` in production (`https://villavalencia.vercel.app/aproviva-suite/`).

Threshold selected: **strict all-pass**. Any single fail = NO-GO.

## Evidence Log

| # | Criterion | Role | Action performed | Observed result | Status |
|---|---|---|---|---|---|
| 1 | Migration/table effectively live | Ops validation | Tried DB apply/verification path from workstation (`SUPABASE_DB_URL`, `supabase` CLI), then validated via production UI behavior. | `SUPABASE_DB_URL` missing locally, `supabase` CLI unavailable; in UI, shared-template admin path not reachable with validated role set. | FAIL |
| 2 | GER26 template create/delete | GER26 | Attempted login with `GER26` (plus focused retries `ger26`, trimmed `GER26`) to reach `#/gemba` and `Nueva plantilla`. | Login consistently returns `PIN incorrecto`; cannot access template CRUD flow. | FAIL |
| 3 | CONS26 starts recorrido from team template | 2026 (conserjeria) | Login as `2026` -> open `#/gemba` -> `Iniciar recorrido` -> look for team template picker and start flow. | Team template picker not present in observed production run; start flow did not produce verifiable active recorrido. | FAIL |
| 4 | Hallazgo linked to active recorrido | 2026 (conserjeria) | Attempted hallazgo flow after creating/opening recorrido. | No active recorrido was established in the run, so hallazgo linkage could not be completed. | FAIL |
| 5 | Derivar a incidencia creates incident ticket | 2026 (conserjeria) | Attempted to derive from hallazgo in `#/gemba`. | Derivation path unreachable because no qualifying hallazgo from an active recorrido in this run. | FAIL |

## Blockers

1. Non-conserjeria PINs required by acceptance (`GER26`, `SUP26`, `JD26`) were not accepted in production login during validation.
2. Strict acceptance requires end-to-end flow; prerequisites failed before hallazgo/incidencia checks.
3. Local direct DB apply path was unavailable on this workstation (`SUPABASE_DB_URL` not set and `supabase` CLI not installed).

## Decision

- **GO/NO-GO:** **NO-GO**
- Rationale: strict gate requires all 5 criteria pass; current run has multiple hard fails.

