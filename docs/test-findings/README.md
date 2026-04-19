# APROVIVA Suite — Role Scenario Test Findings

10 browser-use agents tested the 19 business scenarios across 5 roles
against the live preview at https://whole-crystal-6gt7.here.now/.

Each agent writes one file in this folder:

- `01-conserje-inventario.md` (Scenarios 1, 2)
- `02-conserje-recorrido.md` (Scenarios 5, 6)
- `03-conserje-cross.md` (mobile + photo + session)
- `04-admin-inventario.md` (Scenario 3)
- `05-admin-recorrido.md` (Scenarios 4, 7, 10)
- `06-admin-maestros.md` (Scenario 11)
- `07-supervisor-control.md` (Scenarios 8, 9)
- `08-supervisor-reporting.md` (Scenarios 12, 13, 14, 15)
- `09-gerencia.md` (Scenario 16)
- `10-junta-cross-cutting.md` (Scenarios 17, 18, 19, plus PQRS regression and console sweep)

Each finding follows the schema:

```
- {scenario, role, severity (P0/P1/P2/P3), surface, type (bug | gap | regression), repro, expected, actual, suggested-fix}
```
