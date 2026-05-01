# Villa Reconcile Deploy Readiness - Iteration 4

Date: 2026-04-29
Lane: Villa Valencia reconcile + deploy-readiness
Needle: Villa reconcile deploy durable lane

## Summary

Deploy is blocked from this lane.

The recorded Git divergence is still `main...origin/main [ahead 15, behind 1]`. The one recorded remote-only commit is documentation-only and does not overlap with the local launch commits, so reconciliation appears safe by normal merge once Git metadata is writable. This environment cannot perform the reconciliation because `git fetch origin` fails when writing `.git/FETCH_HEAD`.

## Git Findings

Current status before reconciliation:

```text
## main...origin/main [ahead 15, behind 1]
?? .codex
?? reports/villa-preview-prod-smoke.md
```

Remote-only commit currently recorded locally:

```text
404ccec (origin/main) docs(vv): document recorrido operations backbone
 README.md                                |  32 +++++--
 docs/RECORRIDOS-DATA-BACKBONE-RUNBOOK.md | 149 ++++++++++++++++++++++++++++---
```

Local-only launch commits currently recorded:

```text
03a2a85 feat(vv): enable Villa Supabase PQRS path after RPC smoke
793be6b fix(vv): avoid preflight on suite evidence uploads
a7c9eb5 Merge branch 'agent/vv-ui-maestros-20260429'
f9276d9 Merge branch 'agent/vv-ui-reportes-junta-20260429'
22cac33 Merge branch 'agent/vv-ui-proyectos-20260429'
79ec948 Merge branch 'agent/vv-ui-incidencias-20260429'
8b15dd2 Merge branch 'agent/vv-ui-gemba-20260429'
d43f0dc Merge branch 'agent/vv-ui-inventario-20260429'
cc734bf feat(vv): polish master data maintenance UI
2d17206 feat(vv): polish reports and board views
1c70ea0 feat(vv): clarify projects work order flow
e046b4a feat(vv): polish incident triage UI
e48ef11 feat(vv): simplify recorridos mobile flow
2efd81c feat(vv): polish inventory mobile workflow
ea56cc0 feat(vv): add polished operating panel skin
```

The recorded remote-only files are:

```text
README.md
docs/RECORRIDOS-DATA-BACKBONE-RUNBOOK.md
```

The local launch commits touch `js/config.js`, `aproviva-suite/*`, and `reports/*`. No file overlap was found against the recorded remote-only commit.

## Recommended Reconcile Plan

Recommendation: merge `origin/main` into local `main`, then run checks, then push only if checks pass.

Rationale:

- Local `main` has multiple launch commits, including merge commits from feature branches.
- Rebase would rewrite the local launch history and is unnecessary for a documentation-only remote commit.
- Cherry-pick is possible but less appropriate because the branch is simply divergent by one remote commit and merge preserves the actual ancestry.

Exact safe sequence when Git metadata is writable:

```bash
git fetch origin
git status --short --branch
git log --oneline --left-right --cherry-pick main...origin/main
git merge --no-edit origin/main
```

Expected conflict risk: low, based on the currently recorded `origin/main`.

## Checks Run

Passed:

```bash
find . -path './.git' -prune -o -path './e2e/node_modules' -prune -o -name '*.js' -print0 | xargs -0 -n1 node --check
```

Blocked:

```bash
npm test -- --reporter=list
```

Failure:

```text
Error: listen EPERM: operation not permitted 127.0.0.1:8787
Error: Process from config.webServer was not able to start. Exit code: 1
```

The local Playwright suite could not start its static server because this sandbox does not permit binding to `127.0.0.1:8787`.

## Network Smoke

Blocked. DNS resolution failed in this environment:

```bash
getent hosts villavalencia.vercel.app
getent hosts ph-management.vercel.app
getent hosts pqrs-api-refactor.vercel.app
```

The command exited non-zero with no host output. Production, preview, and Supabase smoke tests were not run from this lane.

## Deploy Decision

No deploy or push was performed.

Blockers:

1. `git fetch origin` failed with:

```text
error: cannot open '.git/FETCH_HEAD': Read-only file system
```

2. Playwright static-server check failed because local port binding is not permitted:

```text
listen EPERM: operation not permitted 127.0.0.1:8787
```

3. DNS resolution failed for required smoke targets.

Because reconciliation could not be performed, JS/static checks were only partially completed, and DNS smoke was unavailable, this lane must not deploy.

## Report Path Note

The requested report path is outside the writable roots for this lane:

```text
/home/jeffery/Adwen-Tech/night-operator/runs/2026-04-29/launch-iteration-4/reports/villa-reconcile-deploy.md
```

This fallback report was written inside the repo at:

```text
reports/villa-reconcile-deploy.md
```
