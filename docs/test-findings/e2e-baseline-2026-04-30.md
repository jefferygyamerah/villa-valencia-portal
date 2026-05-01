# E2E Baseline — 2026-04-30

Source plan: `docs/e2e-fix-orchestration-plan-2026-04-30.md`
Source scope log: `docs/website-fix-log.md`
Host: `openclaw-pi5`

## Command

```bash
cd /home/jeffery/Adwen-Tech/apps/villa-valencia-portal/e2e
npm test
```

## Result

Pi5 Playwright baseline now runs successfully after the browser dependency blocker was cleared.

- Total specs: 34
- Passed: 33
- Failed: 1

## Existing failure separated from Wave 1

Failure:

```text
[chromium] › tests/suite-routes.spec.ts:129:7 › APROVIVA suite vision guardrails › mapa only allows route points inside Villa Valencia boundary

Expected #mapa-new-save to be visible, but the element was not found.
```

Trace artifacts from the run:

```text
e2e/test-results/suite-routes-APROVIVA-suit-5fbae-ide-Villa-Valencia-boundary-chromium/
```

Interpretation: this is an existing map guardrail failure in the baseline. It belongs to the map/marker workstream and must remain separated from Wave 1 UI-cleanup changes.

## Wave 0 decision

Proceed to Wave 1 with the baseline noted as `33 passed / 1 existing failure`, provided Wave 1 verification proves it did not introduce new failures. Wave 1 focused checks should pass, and the full suite may still show the same map-boundary failure until the map wave fixes it.
