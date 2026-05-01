# Villa Preview / Production Smoke Report

Date: 2026-04-29 America/Panama
Lane: Villa preview/prod smoke durable lane
Repo: `/home/jeffery/Adwen-Tech/apps/villa-valencia-portal`
Preview: `https://amber-yoga-gpnf.here.now/`
Production: `https://villavalencia.vercel.app/`

## Decision

Production deploy was **not executed**.

Reason: required preview/production/Supabase network smokes could not be completed from the shell because DNS resolution failed for all target hosts. The repo also has a non-fast-forward local `main` state relative to `origin/main` (`ahead 15, behind 1`). Under the instruction "Do not deploy if checks fail" and "deploy only if all checks pass", this is a deploy blocker.

## Repo State

```text
## main...origin/main [ahead 15, behind 1]
?? .codex
```

Recent local commits include:

```text
03a2a85 feat(vv): enable Villa Supabase PQRS path after RPC smoke
793be6b fix(vv): avoid preflight on suite evidence uploads
a7c9eb5 Merge branch 'agent/vv-ui-maestros-20260429'
```

Divergence from `origin/main`:

```text
> 03a2a85 feat(vv): enable Villa Supabase PQRS path after RPC smoke
> 793be6b fix(vv): avoid preflight on suite evidence uploads
...
< 404ccec docs(vv): document recorrido operations backbone
```

Working tree diff for tracked files was clean. The only untracked item was `.codex`.

## Key File Inspection

`js/config.js` currently has the Villa Supabase PQRS path enabled:

```text
PQRS_USE_VV_SUPABASE: true
SUPABASE_URL: https://tgoitmwdpdkhlpqpwrvs.supabase.co
BUILDING_ID: 88e6c11e-4a8c-4f39-a571-5f97e7f2b774
```

Relevant PQRS code references found:

```text
js/app.js:58-62       checks PQRS_USE_VV_SUPABASE and Supabase config
js/app.js:361-365     inserts PQRS cases via /rest/v1/pqrs_cases
js/app.js:641-645     calls /rest/v1/rpc/lookup_pqrs_case
```

Deployment wiring:

```text
.vercel/project.json exists
projectName: villa-valencia-portal
Vercel CLI: 52.2.0
```

No root `package.json` or `vercel.json` exists. E2E dependencies are isolated under `e2e/`.

## Local Static / JS Checks

Passed:

```bash
find js aproviva-suite/js -name '*.js' -print0 | xargs -0 -n1 node --check
find api -name '*.js' -print0 | xargs -0 -r -n1 node --check
find e2e -maxdepth 2 -type f \( -name '*.ts' -o -name '*.js' \) -print0 | xargs -0 -r -n1 node --check
```

All commands exited `0`.

HTML/config presence spot check:

```text
index.html has-config
aproviva-portal.html no-config
proveedores.html has-config
aproviva-suite/index.html has-config
```

## Network Smoke Results

Shell `curl` smokes were blocked by DNS resolution failures:

```text
curl: (6) Could not resolve host: amber-yoga-gpnf.here.now
curl: (6) Could not resolve host: villavalencia.vercel.app
curl: (6) Could not resolve host: tgoitmwdpdkhlpqpwrvs.supabase.co
```

Attempted targets:

```text
https://amber-yoga-gpnf.here.now/js/config.js
https://amber-yoga-gpnf.here.now/
https://amber-yoga-gpnf.here.now/index.html
https://amber-yoga-gpnf.here.now/aproviva-portal.html
https://amber-yoga-gpnf.here.now/proveedores.html
https://amber-yoga-gpnf.here.now/aproviva-suite/

https://villavalencia.vercel.app/
https://villavalencia.vercel.app/index.html
https://villavalencia.vercel.app/aproviva-portal.html
https://villavalencia.vercel.app/proveedores.html
https://villavalencia.vercel.app/aproviva-suite/

https://tgoitmwdpdkhlpqpwrvs.supabase.co/rest/v1/rpc/lookup_pqrs_case
```

Browser-side fetch evidence available in the session:

- `https://villavalencia.vercel.app/` opened successfully and redirected to `https://villavalencia.vercel.app/es`, returning the Villa Valencia entrance HTML.
- `https://amber-yoga-gpnf.here.now/` could not be validated through shell DNS; browser search/open tooling did not produce usable preview evidence.
- Supabase fake lookup RPC could not be re-smoked from shell due DNS failure.

## Deploy Readiness

Not safe to deploy in this lane.

Blockers:

1. Required preview/public endpoint smokes did not pass because they could not be executed from this shell environment.
2. Required fake Supabase RPC lookup did not pass in this run because the host could not be resolved.
3. Local `main` is divergent from `origin/main` (`ahead 15, behind 1`), so a production deploy from local state would not represent a clean fast-forward main without first reconciling `404ccec`.

No destructive SQL was run. No billing changes were made. No production deploy was executed.

## Requested Report Path

Requested path:

```text
/home/jeffery/Adwen-Tech/night-operator/runs/2026-04-29/launch-iteration-3/reports/villa-preview-prod-smoke.md
```

Write attempts to the requested path failed under this session's filesystem sandbox:

```text
apply_patch: writing outside of the project; rejected by user approval settings
tee: Read-only file system
```

This fallback copy was written at:

```text
/home/jeffery/Adwen-Tech/apps/villa-valencia-portal/reports/villa-preview-prod-smoke.md
```
