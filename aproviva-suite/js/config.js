/**
 * APROVIVA Operations Suite - Configuration
 *
 * Public-safe config for the static frontend. The Supabase publishable key is
 * intentionally exposed (it is the public anon key); RLS on the database is the
 * actual security boundary, not key secrecy.
 */
window.APROVIVA_SUITE_CONFIG = {
  SUPABASE_URL: 'https://tgoitmwdpdkhlpqpwrvs.supabase.co',
  SUPABASE_PUBLIC_KEY: 'sb_publishable_rF14WdkYwSnffaOxzKsncA_PjtaXgBz',

  BUILDING_ID: '88e6c11e-4a8c-4f39-a571-5f97e7f2b774',
  BUILDING_CODE: 'VV-001',
  BUILDING_NAME: 'Villa Valencia',

  PINS: {
    '2026': {
      role: 'staff',
      label: 'Personal / Conserjer\u00eda',
      modules: ['inventario', 'gemba', 'incidencias'],
    },
    'JD26': {
      role: 'junta',
      label: 'Junta / Administraci\u00f3n',
      modules: ['inventario', 'gemba', 'incidencias', 'proyectos', 'maestros', 'reportes', 'junta'],
    },
  },

  PHOTO_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbzwbIHtZgjjI5fbrJlyCjJInwtPCoe8lu5YcNyunvQBmHgmIRCOy2S04QRLo4QfqqWp6g/exec',

  PORTAL_HOME_URL: '../index.html',
};
