/**
 * Inicio (home) - role-aware module shortcuts and quick KPIs.
 */
(function () {
  var MODULES = [
    { id: 'inventario', eyebrow: 'OPERACI\u00d3N',  title: 'Inventario',     desc: 'Conteo c\u00edclico, alertas de stock m\u00ednimo y registro de novedades.' },
    { id: 'gemba',      eyebrow: 'OPERACI\u00d3N',  title: 'Recorridos',     desc: 'Ejecuci\u00f3n y seguimiento de recorridos asignados (Gemba).' },
    { id: 'incidencias',eyebrow: 'OPERACI\u00d3N',  title: 'Incidencias',    desc: 'Registro y triage de incidentes operativos del edificio.' },
    { id: 'proyectos',  eyebrow: 'COORDINACI\u00d3N',title: 'Proyectos',     desc: 'Acciones, \u00f3rdenes de trabajo y seguimiento (Junta).' },
    { id: 'maestros',   eyebrow: 'CONTROL',         title: 'Datos maestros',  desc: 'Cat\u00e1logos: art\u00edculos, ubicaciones, edificios.' },
    { id: 'reportes',   eyebrow: 'REPORTING',       title: 'Reportes',        desc: 'Resumen diario, semanal, escalaciones, KPI export.' },
    { id: 'junta',      eyebrow: 'GOBERNANZA',      title: 'Junta',           desc: 'Visi\u00f3n ejecutiva: KPIs, escalaciones cr\u00f3nicas, accountability.' },
  ];

  async function render(container, session) {
    var allowed = MODULES.filter(function (m) { return window.AUTH.canAccess(m.id); });
    container.innerHTML = '' +
      '<section class="page">' +
        '<h2 class="page-title">Bienvenido, ' + window.UI.esc(session.label) + '</h2>' +
        '<p class="page-subtitle">' + window.UI.esc(window.APROVIVA_SUITE_CONFIG.BUILDING_NAME) + ' &middot; ' + window.UI.esc(window.APROVIVA_SUITE_CONFIG.BUILDING_CODE) + '</p>' +
        '<div class="kpi-grid" id="home-kpis"><div class="loading">Cargando KPIs...</div></div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Tus m\u00f3dulos</h3>' +
          '<div class="module-grid">' +
            allowed.map(function (m) {
              return '<a class="module-card" href="#/' + m.id + '">' +
                '<span class="card-eyebrow">' + window.UI.esc(m.eyebrow) + '</span>' +
                '<h3>' + window.UI.esc(m.title) + '</h3>' +
                '<p>' + window.UI.esc(m.desc) + '</p>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="page-section install-section" id="install-section" style="display:none">' +
          '<h3 class="section-title">App en tu pantalla</h3>' +
          '<div class="install-card" id="install-ios" style="display:none">' +
            '<p class="muted" style="margin:0 0 0.5rem;">En <strong>iPhone / iPad</strong> (Safari): toca <strong>Compartir</strong> y luego <strong>A\u00f1adir a inicio</strong>.</p>' +
          '</div>' +
          '<div class="install-card" id="install-android" style="display:none">' +
            '<p class="muted" style="margin:0 0 0.75rem;">Instala la app para abrirla a pantalla completa.</p>' +
            '<button type="button" class="btn btn-primary-sm" id="install-pwa-btn">Instalar app</button>' +
          '</div>' +
        '</div>' +
      '</section>';

    loadKpis();
    setupInstallHints();
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

      box.innerHTML = '' +
        kpi('Art\u00edculos activos', items.length) +
        kpi('Movimientos (recientes)', moves.length) +
        kpi('Incidencias abiertas', openIncidents) +
        kpi('Recorridos en curso', openRounds) +
        kpi('Escalaciones abiertas', openEsc);
    } catch (e) {
      console.error(e);
      window.UI.errorBox(box, e);
    }
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.ROUTER.register('inicio', { render: render });
})();
