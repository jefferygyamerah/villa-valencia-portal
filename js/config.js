/**
 * APROVIVA Portal Configuration
 * All external URLs, IDs, and feature flags in one place.
 * Update these values before deploying to production.
 */
window.APROVIVA_CONFIG = {
  // Google OAuth 2.0 Client ID (from Google Cloud Console)
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',

  // Restrict login to a specific email domain (null = allow any Google account)
  ALLOWED_DOMAIN: null,

  // Demo mode: allows bypassing auth for preview purposes
  DEMO_MODE_ENABLED: true,

  // PQRS Google Form — URL to open in new tab
  PQRS_FORM_URL: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',

  // Provider suggestion Google Form (if separate from PQRS)
  PROVIDER_SUGGEST_FORM_URL: null,

  // Google Drive folder URLs — open in new tab from nav and cards
  DRIVE_LINKS: {
    asambleas:   'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    finanzas:    'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    comunicados: 'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    planos:      'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    documentos:  'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
  },
};
