/**
 * APROVIVA Portal Configuration
 * All external URLs and feature flags in one place.
 */
window.APROVIVA_CONFIG = {
  // Next.js + Supabase backend (legacy path when PQRS_USE_VV_SUPABASE is false).
  // APPS_SCRIPT_URL still owns the dashboard + budget + provider directory.
  PH_MANAGEMENT_API_BASE: 'https://ph-management.vercel.app',

  // Villa Valencia Supabase (same project as aproviva-suite). Uses Villa Valencia Supabase directly for PQRS submit + lookup.
  // The live lookup_pqrs_case(p_case_ref text) RPC was fixed/smoked before the 2026-04-30 production cutover.
  PQRS_USE_VV_SUPABASE: true,
  SUPABASE_URL: 'https://tgoitmwdpdkhlpqpwrvs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_rF14WdkYwSnffaOxzKsncA_PjtaXgBz',
  BUILDING_ID: '88e6c11e-4a8c-4f39-a571-5f97e7f2b774',

  // Google Apps Script Web App URL (handles PQRS submit + dashboard data)
  // Deploy the script from the PQRS spreadsheet, then paste the URL here.
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzwbIHtZgjjI5fbrJlyCjJInwtPCoe8lu5YcNyunvQBmHgmIRCOy2S04QRLo4QfqqWp6g/exec',

  // Read-only resident finance snapshot published from the controlled report
  // pipeline: Drive report -> validate totals -> publish JSON -> render portal.
  FINANCIAL_SNAPSHOT_URL: 'data/financial-report-snapshot.json',
  FINANCIAL_DASHBOARD_SCRIPT: 'js/financial-dashboard.js',

  // Provider suggestion Google Form (if separate from PQRS)
  PROVIDER_SUGGEST_FORM_URL: null,

  // Google Drive folder URLs — open in new tab from nav and cards
  DRIVE_LINKS: {
    asambleas:   'https://drive.google.com/drive/folders/1JsUzlFz2ImILowa5-Y4vLI3S0wqaTBtc',
    finanzas:    'https://drive.google.com/drive/folders/1-gF8X8k4hIpcgZ4KhxvpxsPmclyRX8-3',
    comunicados: 'https://drive.google.com/drive/folders/1JudSzn7Dz-4ga1w9rOTrzjdFJAh_m0Co',
    planos:      'https://drive.google.com/drive/folders/1cRsTsxNqq4M2V0BGYBOZOT7jTJqTVyWP',
    proyectos:   'https://drive.google.com/drive/folders/1AafYkFFj23xFcSWaS4yfAgBGUOLcetu4',
  },

  // Role-based login URLs — set each secure destination when available
  ROLE_LOGIN_LINKS: {
    residentes: null,
    administracion: 'https://vv-auth-app.vercel.app/es/admin/login?next=/es/admin/inicio',
    junta: 'https://vv-auth-app.vercel.app/es/admin/login?next=/es/admin/junta',
  },
};

(function loadResidentFinanceDashboard() {
  var cfg = window.APROVIVA_CONFIG || {};
  var scriptUrl = cfg.FINANCIAL_DASHBOARD_SCRIPT;
  if (!scriptUrl) return;

  // Load the resident finance renderer as an isolated enhancement. Keeping it
  // outside app.js avoids blending the PQRS dashboard and financial report loops.
  var script = document.createElement('script');
  script.src = scriptUrl;
  script.defer = true;
  document.head.appendChild(script);
})();
