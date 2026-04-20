/**
 * APROVIVA Operations Suite - Configuration
 *
 * Public-safe config for the static frontend. The Supabase publishable key is
 * intentionally exposed (it is the public anon key); RLS on the database is the
 * actual security boundary, not key secrecy.
 *
 * SITE_PLACES: each ubicaci\u00f3n fija tiene kind (edificio vs \u00e1rea) para UI y reportes.
 */
(function () {
  var SITE_PLACES = [
    { id: 'banos_area_social', label: 'Ba\u00f1os \u00e1rea social', kind: 'building' },
    { id: 'gimnasio', label: 'Gimnasio', kind: 'building' },
    { id: 'salon_fiesta', label: 'Sal\u00f3n de Fiesta', kind: 'building' },
    { id: 'piscina', label: 'Piscina', kind: 'area' },
    { id: 'cuarto_electrico', label: 'Cuarto El\u00e9ctrico', kind: 'building' },
    { id: 'garita', label: 'Garita', kind: 'building' },
    { id: 'cuarto_conserjes', label: 'Cuarto de Conserjes', kind: 'building' },
    { id: 'oficina_admin', label: 'Oficina de Administraci\u00f3n', kind: 'building' },
    { id: 'comedor_conserjes', label: 'Comedor de conserjes', kind: 'building' },
  ];

  var UBICACION_LABELS = SITE_PLACES.map(function (p) { return p.label; });

  window.APROVIVA_SUITE_CONFIG = {
    SUPABASE_URL: 'https://tgoitmwdpdkhlpqpwrvs.supabase.co',
    SUPABASE_PUBLIC_KEY: 'sb_publishable_rF14WdkYwSnffaOxzKsncA_PjtaXgBz',

    BUILDING_ID: '88e6c11e-4a8c-4f39-a571-5f97e7f2b774',
    BUILDING_CODE: 'VV-001',
    BUILDING_NAME: 'Villa Valencia',

    /** Cat\u00e1logo de puntos del conjunto con clasificaci\u00f3n edificio / \u00e1rea. */
    SITE_PLACES: SITE_PLACES,

    /**
     * Four operational roles (session.role). Legacy PIN aliases:
     * - 2026 \u2192 conserjer\u00eda (same as CONS26)
     * - JD26 \u2192 junta directiva (governance + backlog intake; not day-to-day ops)
     */
    PINS: {
      '2026': {
        role: 'conserje',
        label: 'Personal / Conserjer\u00eda',
        modules: ['inventario', 'gemba', 'incidencias'],
      },
      CONS26: {
        role: 'conserje',
        label: 'Personal / Conserjer\u00eda',
        modules: ['inventario', 'gemba', 'incidencias'],
      },
      SUP26: {
        role: 'supervisor',
        label: 'Supervisi\u00f3n operativa',
        modules: ['inventario', 'gemba', 'incidencias', 'reportes', 'proyectos'],
      },
      GER26: {
        role: 'gerencia',
        label: 'Gerencia / Administraci\u00f3n',
        modules: ['inventario', 'gemba', 'incidencias', 'proyectos', 'maestros', 'reportes'],
      },
      JD26: {
        role: 'junta',
        label: 'Junta directiva',
        modules: ['reportes', 'junta', 'proyectos'],
      },
    },

    PHOTO_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbzwbIHtZgjjI5fbrJlyCjJInwtPCoe8lu5YcNyunvQBmHgmIRCOy2S04QRLo4QfqqWp6g/exec',

    PORTAL_HOME_URL: '../index.html',

    /**
     * Conserjería / supervisión: prefer selects / plantillas over free text (teléfono en ruta).
     * Gerencia y junta usan formularios completos en los módulos a los que tienen acceso.
     */
    STAFF_QUICK_PICKS: {
      CONTEO_NOTAS: [
        { value: '', label: 'Sin observación' },
        { value: 'Conteo verificado en sitio.', label: 'Conteo verificado' },
        { value: 'Material en orden; sin novedad.', label: 'Sin novedad' },
      ],
      /** Derivado de SITE_PLACES (mismas etiquetas). */
      UBICACIONES_FIJAS: UBICACION_LABELS.slice(),
      RECORRIDO_TITULOS: [
        'Recorrido matutino',
        'Recorrido vespertino',
        'Ronda de seguridad',
        'Inspecci\u00f3n \u00e1reas h\u00famedas',
        'Ronda puntos cr\u00edticos',
      ],
      /** Misma lista que UBICACIONES_FIJAS para recorridos Gemba. */
      ZONAS_GEMBA: UBICACION_LABELS.slice(),
      /** title + description generated for incident_tickets (no typing). */
      MOTIVOS_INCIDENTE: [
        { id: 'inv_faltante', category: 'Inventory', title: 'Faltante de material', description: 'Faltante de material o insumo en punto revisado. Reporte operativo (conserjer\u00eda).' },
        { id: 'inv_dano', category: 'Inventory', title: 'Material da\u00f1ado', description: 'Material o insumo da\u00f1ado o en mal estado. Reporte operativo (conserjer\u00eda).' },
        { id: 'mant_orden', category: 'Maintenance', title: 'Orden y limpieza', description: 'Hallazgo de orden, limpieza o aseo en zona com\u00fan. Reporte operativo (conserjer\u00eda).' },
        { id: 'mant_humedad', category: 'Maintenance', title: 'Humedad / filtraci\u00f3n', description: 'Posible humedad, filtraci\u00f3n o goteras. Reporte operativo (conserjer\u00eda).' },
        { id: 'mant_iluminacion', category: 'Maintenance', title: 'Iluminaci\u00f3n / el\u00e9ctrico', description: 'Luminaria o punto el\u00e9ctrico fuera de servicio. Reporte operativo (conserjer\u00eda).' },
        { id: 'seg_acceso', category: 'Security', title: 'Acceso / cerramiento', description: 'Cerramiento, acceso o control de visitantes. Reporte operativo (conserjer\u00eda).' },
        { id: 'seg_cctv', category: 'Security', title: 'CCTV / alarmas', description: 'Observaci\u00f3n sobre CCTV o alarmas en ronda. Reporte operativo (conserjer\u00eda).' },
        { id: 'limp_areas', category: 'Cleanliness', title: 'Limpieza zonas comunes', description: 'Limpieza o desechos en zonas comunes. Reporte operativo (conserjer\u00eda).' },
      ],
      HALLAZGO_FRASE: [
        { value: 'std', label: 'Seguimiento est\u00e1ndar', text: '' },
        { value: 'prio', label: 'Priorizar mantenimiento', text: 'Requiere priorizaci\u00f3n en mantenimiento.' },
        { value: 'urg', label: 'Atenci\u00f3n prioritaria', text: 'Requiere atenci\u00f3n prioritaria.' },
        { value: 'seg', label: 'Riesgo de seguridad', text: 'Posible riesgo de seguridad; revisar.' },
      ],
    },
  };

  var byLabel = {};
  SITE_PLACES.forEach(function (p) { byLabel[p.label] = p; });

  function escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.APROVIVA_SUITE_CONFIG.getPlaceByLabel = function (label) {
    return byLabel[label] || null;
  };

  window.APROVIVA_SUITE_CONFIG.placeKindShortLabel = function (kind) {
    if (kind === 'building') return 'Edificio';
    if (kind === 'area') return '\u00c1rea';
    if (kind === 'circulation') return 'Circulaci\u00f3n';
    return '';
  };

  window.APROVIVA_SUITE_CONFIG.placeKindBadgeKind = function (kind) {
    if (kind === 'building') return 'info';
    if (kind === 'area') return 'success';
    if (kind === 'circulation') return 'neutral';
    return 'neutral';
  };

  /**
   * &lt;option&gt;s agrupadas por kind (requiere window.UI.esc en runtime; fallback escHtml).
   */
  window.APROVIVA_SUITE_CONFIG.buildZonaSelectOptionsHtml = function () {
    var esc = (window.UI && window.UI.esc) ? window.UI.esc : escHtml;
    var C = window.APROVIVA_SUITE_CONFIG;
    var places = C.SITE_PLACES;
    if (!places || !places.length) {
      var zones = (C.STAFF_QUICK_PICKS && C.STAFF_QUICK_PICKS.ZONAS_GEMBA) || [];
      return zones.map(function (z) {
        return '<option value="' + esc(z) + '">' + esc(z) + '</option>';
      }).join('');
    }
    var groupTitle = {
      building: 'Edificios y espacios cubiertos',
      area: '\u00c1reas exteriores / amenidades',
      circulation: 'Circulaci\u00f3n',
    };
    var order = ['building', 'area', 'circulation'];
    var html = '';
    order.forEach(function (k) {
      var group = places.filter(function (p) { return p.kind === k; });
      if (!group.length) return;
      html += '<optgroup label="' + esc(groupTitle[k] || k) + '">';
      group.forEach(function (p) {
        html += '<option value="' + esc(p.label) + '">' + esc(p.label) + '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  };
})();
