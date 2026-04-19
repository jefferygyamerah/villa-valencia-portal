/**
 * APROVIVA Portal Configuration
 * All external URLs and feature flags in one place.
 */
window.APROVIVA_CONFIG = {
  // Next.js + Supabase backend (legacy path when PQRS_USE_VV_SUPABASE is false).
  // APPS_SCRIPT_URL still owns the dashboard + budget + provider directory.
  PH_MANAGEMENT_API_BASE: 'https://ph-management.vercel.app',

  // Villa Valencia Supabase (same project as aproviva-suite). Set PQRS_USE_VV_SUPABASE
  // to true after running aproviva-suite/supabase/migrations/20260422120000_pqrs_cases.sql
  PQRS_USE_VV_SUPABASE: false,
  SUPABASE_URL: 'https://tgoitmwdpdkhlpqpwrvs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_rF14WdkYwSnffaOxzKsncA_PjtaXgBz',
  BUILDING_ID: '88e6c11e-4a8c-4f39-a571-5f97e7f2b774',

  // Google Apps Script Web App URL (handles PQRS submit + dashboard data)
  // Deploy the script from the PQRS spreadsheet, then paste the URL here.
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzwbIHtZgjjI5fbrJlyCjJInwtPCoe8lu5YcNyunvQBmHgmIRCOy2S04QRLo4QfqqWp6g/exec',

  // Provider suggestion Google Form (if separate from PQRS)
  PROVIDER_SUGGEST_FORM_URL: null,

  // Google Drive folder URLs — open in new tab from nav and cards
  DRIVE_LINKS: {
    asambleas:   'https://drive.google.com/drive/folders/1JsUzlFz2ImILowa5-Y4vLI3S0wqaTBtc',
    finanzas:    'https://drive.google.com/drive/folders/1JFxrA8lMiCyBeKjahEu1wGW58BsSs0qA',
    comunicados: 'https://drive.google.com/drive/folders/1JudSzn7Dz-4ga1w9rOTrzjdFJAh_m0Co',
    planos:      'https://drive.google.com/drive/folders/1cRsTsxNqq4M2V0BGYBOZOT7jTJqTVyWP',
    proyectos:   'https://drive.google.com/drive/folders/1AafYkFFj23xFcSWaS4yfAgBGUOLcetu4',
  },

  // Role-based login URLs — set each secure destination when available
  ROLE_LOGIN_LINKS: {
    residentes: 'https://vv-auth-app.vercel.app/es/resident/login?next=/es/resident/inicio',
    administracion: 'https://vv-auth-app.vercel.app/es/admin/login?next=/es/admin/inicio',
    junta: 'https://vv-auth-app.vercel.app/es/admin/login?next=/es/admin/junta',
  },
};
