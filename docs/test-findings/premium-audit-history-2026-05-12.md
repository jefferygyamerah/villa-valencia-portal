# Premium Audit / History Center — 2026-05-12

Slice: product-wide premium continuation after Junta/Reportes scorecard and public/PQRS polish.

## Change

Added a Junta-facing **Centro de auditoría / historial** section that consolidates safe recent movements across:

- incident closures/history;
- completed recorridos;
- closed/resolved hallazgos;
- resolved/closed escalations;
- completed/closed work orders and capital projects.

The center deliberately shows operational labels, statuses, dates, and safe evidence summaries only. It avoids resident/contact/banking data and does not expose free-form private notes beyond the existing sanitized closure summary.

## Files

- `aproviva-suite/js/modules/junta.js`
- `e2e/tests/board-scorecard.spec.ts`

## Verification

- `node --check aproviva-suite/js/modules/junta.js` — passed.
- `cd e2e && npx playwright test tests/board-scorecard.spec.ts --reporter=line` — 3 passed.

## Deployment note

Ship as a read-only premium UI slice. No production data mutation and no Cloudflare/Vercel deploy performed in this run.
