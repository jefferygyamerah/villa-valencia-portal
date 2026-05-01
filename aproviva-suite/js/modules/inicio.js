/**
 * Inicio (home) - role-aware module shortcuts, Villa Valencia operating lens, and quick KPIs.
 */
(function () {
  var MODULES = [
    { id: 'inventario', eyebrow: 'OPERACI\u00d3N', icon: '\ud83d\udce6', title: 'Inventario', desc: 'Conteo c\u00edclico, alertas de stock m\u00ednimo y registro de novedades.' },
    { id: 'gemba', eyebrow: 'OPERACI\u00d3N', icon: '\ud83d\udd0d', title: 'Recorridos', desc: 'Ejecuci\u00f3n y seguimiento de recorridos asignados (Gemba).' },
    { id: 'incidencias', eyebrow: 'OPERACI\u00d3N', icon: '\ud83d\udea8', title: 'Incidencias', desc: 'Registro y triage de incidentes operativos del edificio.' },
    { id: 'proyectos', eyebrow: 'COORDINACI\u00d3N', icon: '\ud83c\udfd7\ufe0f', title: 'Proyectos', desc: '\u00d3rdenes de trabajo, backlog (junta) y ejecuci\u00f3n (supervisi\u00f3n/gerencia).' },
    { id: 'maestros', eyebrow: 'CONTROL', icon: '\ud83d\uddc2\ufe0f', title: 'Datos maestros', desc: 'Cat\u00e1logos: art\u00edculos, ubicaciones, edificios.' },
    { id: 'reportes', eyebrow: 'REPORTING', icon: '\ud83d\udcca', title: 'Reportes', desc: 'Resumen diario, semanal, escalaciones, KPI export.' },
    { id: 'junta', eyebrow: 'GOBERNANZA', icon: '\ud83e\udded', title: 'Junta', desc: 'Visi\u00f3n ejecutiva: KPIs, escalaciones cr\u00f3nicas, accountability.' },
  ];

  var ROLE_LENS = {
    conserje: {
      label: 'Conserjer\u00eda',
      headline: 'Hoy toca ejecutar y dejar evidencia clara.',
      focus: 'Recorridos, inventario e incidencias desde el tel\u00e9fono.',
      primary: { label: 'Abrir recorrido', href: '#/gemba' },
      secondary: { label: 'Reportar incidencia', href: '#/incidencias' },
      steps: ['Ronda abierta', 'Evidencia', 'Novedad', 'Seguimiento'],
      now: 1,
      rows: [
        { title: 'Recorrido matutino', meta: 'Ba\u00f1os, gimnasio, piscina', status: 'En curso', kind: 'success' },
        { title: 'Conteo operativo', meta: 'Insumos cr\u00edticos y llaves', status: 'Pendiente', kind: 'warning' },
        { title: 'Foto de hallazgo', meta: 'Sube a Drive con caso asociado', status: 'Seguro', kind: 'info' },
      ],
      privacy: 'Solo ves tareas operativas. Junta y gerencia ven resumen, no notas privadas.'
    },
    supervisor: {
      label: 'Supervisi\u00f3n',
      headline: 'Convierte hallazgos en seguimiento con responsable.',
      focus: 'Rondas atrasadas, evidencia, asignaciones y reportes diarios.',
      primary: { label: 'Ver recorridos', href: '#/gemba' },
      secondary: { label: 'Reporte diario', href: '#/reportes' },
      steps: ['Detectar', 'Validar', 'Asignar', 'Cerrar'],
      now: 2,
      rows: [
        { title: 'Bomba de agua', meta: 'Activo cr\u00edtico, proveedor vinculado', status: 'Priorizar', kind: 'danger' },
        { title: 'Ascensor Torre A', meta: 'Servicio programado en 3 d\u00edas', status: 'Vigilar', kind: 'warning' },
        { title: 'Incidencias abiertas', meta: 'Triage y responsable operativo', status: 'Asignar', kind: 'info' },
      ],
      privacy: 'Puede ver operaci\u00f3n de Villa Valencia, con datos sensibles ocultos.'
    },
    gerencia: {
      label: 'Gerencia',
      headline: 'Mira el tablero de acci\u00f3n, no otro Excel.',
      focus: 'Backlog, proyectos, reportes y decisiones para APROVIVA.',
      primary: { label: 'Revisar backlog y atrasos', href: '#/proyectos' },
      secondary: { label: 'Abrir reportes ejecutivos', href: '#/reportes' },
      steps: ['Captura', 'Trabajo', 'Costo', 'Junta'],
      now: 2,
      kpis: [
        { label: 'Edificios', value: 'VV' },
        { label: 'Backlog', value: 'drill-down' },
        { label: 'Riesgo', value: 'visible' },
      ],
      rows: [
        { title: 'Pendientes de aprobaci\u00f3n', meta: 'Cotizaciones y cambios de alcance', status: '4', kind: 'warning' },
        { title: 'Trabajos abiertos', meta: 'Proveedor, evidencia y fecha objetivo', status: '9', kind: 'info' },
        { title: 'Resumen semanal', meta: 'Listo para junta sin limpiar hojas', status: 'Auto', kind: 'success' },
      ],
      privacy: 'Contratos, bancos, saldos y contactos quedan protegidos por rol.'
    },
    junta: {
      label: 'Junta',
      headline: 'Ve pruebas y decisiones, no ruido operativo.',
      focus: 'KPIs, escalaciones, aprobaciones y cambios de la semana.',
      primary: { label: 'Vista junta', href: '#/junta' },
      secondary: { label: 'Aprobaciones', href: '#/proyectos' },
      steps: ['Resumen', 'Riesgo', 'Decisi\u00f3n', 'Acta'],
      now: 1,
      rows: [
        { title: 'Cotizaci\u00f3n ascensor', meta: 'Evidencia adjunta, requiere decisi\u00f3n', status: 'Ver', kind: 'warning' },
        { title: 'Incidencias cr\u00f3nicas', meta: 'Patrones por zona y causa ra\u00edz', status: '3', kind: 'danger' },
        { title: 'Cambios de la semana', meta: 'Solicitudes resueltas y hallazgos nuevos', status: 'OK', kind: 'success' },
      ],
      privacy: 'Vista ejecutiva sin PII, sin conversaciones privadas y sin datos bancarios.'
    }
  };

  async function render(container, session) {
    var allowed = MODULES.filter(function (m) { return window.AUTH.canAccess(m.id); });
    container.innerHTML = '' +
      '<section class="page" data-testid="inicio-page">' +
        '<h2 class="page-title">Bienvenido, ' + window.UI.esc(session.label) + '</h2>' +
        '<p class="page-subtitle">' + window.UI.esc(window.APROVIVA_SUITE_CONFIG.BUILDING_NAME) + ' &middot; ' + window.UI.esc(window.APROVIVA_SUITE_CONFIG.BUILDING_CODE) + '</p>' +
        '<div class="page-section install-section install-section--top" id="install-section" style="display:none">' +
          '<h3 class="section-title">App en tu pantalla</h3>' +
          '<div class="install-card" id="install-ios" style="display:none">' +
            '<p class="muted" style="margin:0 0 0.5rem;">En <strong>iPhone / iPad</strong> (Safari): toca <strong>Compartir</strong> y luego <strong>A\u00f1adir a inicio</strong>.</p>' +
          '</div>' +
          '<div class="install-card" id="install-android" style="display:none">' +
            '<p class="muted" style="margin:0 0 0.75rem;">Instala la app para abrirla a pantalla completa.</p>' +
            '<button type="button" class="btn btn-primary-sm" id="install-pwa-btn">Instalar app</button>' +
          '</div>' +
        '</div>' +
        renderVillaLens(session) +
        '<div class="kpi-grid" id="home-kpis"><div class="loading">Cargando KPIs...</div></div>' +
        '<div class="page-section" id="home-kpi-detail" data-testid="home-kpi-detail" style="display:none"></div>' +
        '<div class="page-section home-modules" data-testid="home-modules">' +
          '<h3 class="section-title">Tus m\u00f3dulos</h3>' +
          '<div class="module-grid">' +
            allowed.map(function (m) {
              return '<a class="module-card" href="#/' + m.id + '">' +
                '<span class="module-icon" aria-hidden="true">' + window.UI.esc(m.icon || '') + '</span>' +
                '<span class="card-eyebrow">' + window.UI.esc(m.eyebrow) + '</span>' +
                '<h3>' + window.UI.esc(m.title) + '</h3>' +
                '<p>' + window.UI.esc(m.desc) + '</p>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</section>';

    loadKpis();
    setupInstallHints();
  }

  function renderVillaLens(session) {
    var lens = ROLE_LENS[session.role] || ROLE_LENS.conserje;
    var siteCount = (window.APROVIVA_SUITE_CONFIG.SITE_PLACES || []).length;
    var allowedCount = (session.modules || []).length;
    var strip = lens.kpis || [
      { label: 'Puntos fijos', value: siteCount || 9 },
      { label: 'Módulos', value: allowedCount },
      { label: 'PII', value: 'oculta' },
    ];
    return '' +
      '<div class="vv-lens" data-testid="villa-lens-card">' +
        '<div class="vv-lens-head">' +
          '<div>' +
            '<div class="vv-eyebrow">Villa Valencia operating lens</div>' +
            '<h3>' + window.UI.esc(lens.headline) + '</h3>' +
            '<p>' + window.UI.esc(lens.focus) + '</p>' +
          '</div>' +
          '<span class="vv-role-pill">' + window.UI.esc(lens.label) + '</span>' +
        '</div>' +
        '<div class="vv-lens-grid">' +
          '<div class="vv-workspace">' +
            '<div class="vv-kpi-strip" data-testid="home-kpi-strip">' +
              strip.map(function (item) { return miniKpi(item.label, item.value); }).join('') +
            '</div>' +
            '<div class="vv-progress" aria-label="Flujo operativo">' +
              lens.steps.map(function (step, idx) {
                var cls = idx < lens.now ? 'done' : (idx === lens.now ? 'now' : '');
                return '<span class="' + cls + '"><i></i><b>' + window.UI.esc(step) + '</b></span>';
              }).join('') +
            '</div>' +
            '<div class="vv-row-list">' +
              lens.rows.map(renderLensRow).join('') +
            '</div>' +
          '</div>' +
          '<aside class="vv-side-panel">' +
            '<div class="vv-side-card">' +
              '<div class="vv-eyebrow">Acci\u00f3n sugerida</div>' +
              '<a class="vv-primary-action" href="' + window.UI.esc(lens.primary.href) + '">' + window.UI.esc(lens.primary.label) + '</a>' +
              '<a class="vv-secondary-action" href="' + window.UI.esc(lens.secondary.href) + '">' + window.UI.esc(lens.secondary.label) + '</a>' +
            '</div>' +
            '<div class="vv-privacy-card home-privacy-card" data-testid="home-privacy-card"><div class="vv-eyebrow">Privacidad por rol</div><p>' + window.UI.esc(lens.privacy || 'Vista operativa con datos sensibles protegidos.') + '</p></div>' +
          '</aside>' +
        '</div>' +
      '</div>';
  }

  function miniKpi(label, value) {
    return '<div class="vv-mini-kpi"><strong>' + window.UI.esc(value) + '</strong><span>' + window.UI.esc(label) + '</span></div>';
  }

  function renderLensRow(row) {
    return '' +
      '<div class="vv-op-row">' +
        '<div>' +
          '<strong>' + window.UI.esc(row.title) + '</strong>' +
          '<span>' + window.UI.esc(row.meta) + '</span>' +
        '</div>' +
        '<em class="vv-status vv-status-' + window.UI.esc(row.kind) + '"><i></i>' + window.UI.esc(row.status) + '</em>' +
      '</div>';
  }

  function setupInstallHints() {
    var sec = document.getElementById('install-section');
    if (!sec) return;
    var standalone = false;
    try {
      standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (e) {}
    if (standalone) return;

    var ua = navigator.userAgent || '';
    var isIos = /iPhone|iPad|iPod/i.test(ua);
    if (isIos) {
      sec.style.display = '';
      var ios = document.getElementById('install-ios');
      if (ios) ios.style.display = '';
      return;
    }

    function showAndroid() {
      sec.style.display = '';
      var ad = document.getElementById('install-android');
      if (ad) ad.style.display = '';
      var btn = document.getElementById('install-pwa-btn');
      if (btn && window.APROVIVA_INSTALL) {
        btn.addEventListener('click', function () {
          window.APROVIVA_INSTALL.prompt();
        });
      }
    }

    if (window.APROVIVA_INSTALL && window.APROVIVA_INSTALL.canPrompt && window.APROVIVA_INSTALL.canPrompt()) {
      showAndroid();
    } else {
      window.addEventListener('aproviva-install-available', showAndroid);
    }
  }

  async function loadKpis() {
    var box = document.getElementById('home-kpis');
    try {
      var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
      var results = await Promise.all([
        window.SB.select('inventory_items', { select: 'id', is_active: 'eq.true' }),
        window.SB.select('inventory_movements', { select: 'id', order: 'movement_at.desc', limit: '500' }),
        window.SB.select('incident_tickets', { select: 'id,status', building_id: 'eq.' + bid, limit: '200' }),
        window.SB.select('inspection_rounds', { select: 'id,status', limit: '200' }),
        window.SB.select('escalation_events', { select: 'id,status', limit: '200' }),
      ]);
      var items = results[0] || [];
      var moves = results[1] || [];
      var incidents = results[2] || [];
      var rounds = results[3] || [];
      var escalations = results[4] || [];

      var openIncidents = incidents.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed'; }).length;
      var openRounds = rounds.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; }).length;
      var openEsc = escalations.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed'; }).length;

      var openIncidentRows = incidents.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed'; });
      var openRoundRows = rounds.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; });
      var openEscRows = escalations.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed'; });
      var drill = {
        items: { title: 'Artículos activos', rows: items.slice(0, 25), columns: [
          { key: 'id', label: 'ID' },
        ] },
        moves: { title: 'Movimientos recientes', rows: moves.slice(0, 25), columns: [
          { key: 'id', label: 'ID' },
        ] },
        incidents: { title: 'Incidencias abiertas', rows: openIncidentRows.slice(0, 25), columns: [
          { key: 'id', label: 'ID' },
          { key: 'status', label: 'Estado' },
        ] },
        rounds: { title: 'Recorridos en curso', rows: openRoundRows.slice(0, 25), columns: [
          { key: 'id', label: 'ID' },
          { key: 'status', label: 'Estado' },
        ] },
        escalations: { title: 'Escalaciones abiertas', rows: openEscRows.slice(0, 25), columns: [
          { key: 'id', label: 'ID' },
          { key: 'status', label: 'Estado' },
        ] },
      };

      box.innerHTML = '' +
        kpi('Artículos activos', items.length, 'items') +
        kpi('Movimientos recientes', moves.length, 'moves') +
        kpi('Incidencias abiertas', openIncidents, 'incidents') +
        kpi('Recorridos en curso', openRounds, 'rounds') +
        kpi('Escalaciones abiertas', openEsc, 'escalations');
      box.querySelectorAll('[data-home-drill]').forEach(function (btn) {
        btn.addEventListener('click', function () { renderHomeDrill(drill[this.getAttribute('data-home-drill')]); });
      });
    } catch (e) {
      console.error(e);
      window.UI.errorBox(box, e);
    }
  }

  function renderHomeDrill(cfg) {
    var box = document.getElementById('home-kpi-detail');
    if (!box || !cfg) return;
    box.style.display = '';
    box.innerHTML = '<h3 class="section-title">Detalle: ' + window.UI.esc(cfg.title) + '</h3>' +
      '<p class="muted">Drill-down operativo desde el KPI seleccionado.</p>' +
      window.UI.table(cfg.rows || [], cfg.columns || [{ key: 'id', label: 'ID' }]);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function kpi(label, value, drillKey) {
    var attr = drillKey ? ' role="button" tabindex="0" data-home-drill="' + window.UI.esc(drillKey) + '"' : '';
    return '<button type="button" class="kpi-card"' + attr + '><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div><div class="muted">Ver detalle</div></button>';
  }

  window.ROUTER.register('inicio', { render: render });
})();
