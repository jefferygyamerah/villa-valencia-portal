# Test Coverage Analysis — Villa Valencia Portal

**Date:** 2026-03-20
**Current coverage:** 0% (no test files, no test framework, no CI)

## Codebase Summary

| File | Lines | Purpose |
|------|-------|---------|
| `js/app.js` | 609 | Portal dashboard: PQRS, budget visualization |
| `js/proveedores.js` | 246 | Provider directory: search, filter, modals |
| `js/config.js` | 21 | Configuration constants |
| `apps-script/Code.gs` | 218 | Web app handlers: POST/GET dispatch |
| `apps-script/Reporting.gs` | 332 | Budget automation: XLSX parsing, data transform |

**Total testable JS:** ~1,426 lines, 0 tests.

## Priority 1: Pure Utility Functions

Easy to test, high value. No DOM or external API mocking needed.

| Function | Location | Risk |
|----------|----------|------|
| `escapeHtml(str)` | `app.js:238` | XSS — security vulnerability if broken |
| `fmtNum(n)` | `app.js:588` | Financial display — wrong B/. amounts |
| `formatDate(ts)` | `app.js:226` | Spanish date — edge cases with invalid input |
| `getLastInformeMonth()` | `app.js:266` | Controls which budget data is shown |
| `categoryLabel(cat)` | `proveedores.js:32` | Category display name mapping |
| `isScriptConfigured()` | `app.js:9` | Demo vs live mode gate |

## Priority 2: Backend Data Transformation

Financial data processing — highest business risk.

| Function | Location | Risk |
|----------|----------|------|
| `readLatestInforme()` | `Reporting.gs:75` | Category detection via fragile string matching |
| `readAnnualBudget()` | `Reporting.gs:177` | Hardcoded row indices — breaks silently on layout change |
| `writeFlatTable()` | `Reporting.gs:233` | Combines budget + actuals — wrong output = wrong dashboard |
| `doPost()` dispatch | `Code.gs:37` | Routes by `_type` — misrouting loses submissions |
| `serveBudgetData()` | `Code.gs:162` | Serializes for frontend — field name mismatches break UI |

## Priority 3: Form Validation

| Function | Location | Gap |
|----------|----------|-----|
| `submitPqrs()` | `app.js:49` | Checks presence but not format (house # range 1–118) |
| `submitSuggest()` | `proveedores.js:157` | Same — no phone format or category validation |

## Priority 4: Dashboard Calculation Logic

Testable if extracted from DOM rendering functions.

| Function | Location | What to Test |
|----------|----------|--------------|
| `renderDashboard()` | `app.js:138` | KPI counts by urgency, type aggregation |
| `renderBudget()` | `app.js:333` | Budget vs actuals %, over-budget detection |
| `renderTrend()` | `app.js:469` | Monthly stacked bar proportional heights |
| `toggleCat()` | `app.js:521` | Detail table % calculation, N/A handling |
| `applyFilters()` | `proveedores.js:65` | Search + category filter intersection |

## Key Risks Without Tests

1. **Financial miscalculation** — execution % shown to the board could be wrong
2. **XSS vulnerability** — `escapeHtml` is the only injection defense for user input
3. **Silent data loss** — hardcoded row indices in `readAnnualBudget` break without error
4. **Category parsing fragility** — `readLatestInforme` uses `indexOf` string matching

## Recommended Implementation Plan

1. Initialize `package.json` and install Jest with jsdom environment
2. Extract pure calculation logic from DOM-coupled functions
3. Write Priority 1 tests (~10 tests, covers utilities)
4. Mock Google APIs for Apps Script unit tests
5. Write Priority 2 tests (~15 tests, covers data pipeline)
6. Add GitHub Actions CI workflow to run tests on push
7. Add coverage threshold (target 80% of extractable logic)
