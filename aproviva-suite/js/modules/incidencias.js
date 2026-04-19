/**
 * Incidencias - generic incident triage list (admin/junta routing).
 * Scenarios 3, 7, 8, 9 - admin review/route, supervisor intervention.
 */
(function () {
  var STATE = { tickets: [], filter: 'open' };

  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="incidencias-page">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h2 class="page-title">Incidencias</h2>' +
            '<p class="page-subtitle">Triage, escalaci\u00f3n y seguimiento de incidentes operativos.</p>' +
          '</div>' +
          '<div class="row wrap" style="gap:0.5rem;">' +
            '<select id="inc-filter" class="btn btn-ghost">' +
              '<option value="open">Abiertas</option>' +
              '<option value="all">Todas</option>' +
              '<option value="closed">Cerradas</option>' +
            '</select>' +
            '<button class="btn btn-primary-sm" id="inc-new" type="button">+ Nueva incidencia</button>' +
          '</div>' +
        '</div>' +
        '<div class="kpi-grid" id="inc-kpis"><div class="loading">...</div></div>' +
        '<div class="page-section">' +
          '<div id="inc-list"></div>' +
        '</div>' +
      '</section>' +
      '<div id="inc-modal-host"></div>';

    document.getElementById('inc-filter').addEventListener('change', function (e) {
      STATE.filter = e.target.value;
      renderList();
    });
    document.getElementById('inc-new').addEventListener('click', openNewModal);

    await load();
  }

  async function load() {
    try {
      var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
      var rows = await window.SB.select('incident_tickets', { select: '*', building_id: 'eq.' + bid, order: 'created_at.desc', limit: '100' });
      STATE.tickets = rows || [];
      renderKpis();
      renderList();
    } catch (e) {
      window.UI.errorBox('inc-list', e);
    }
  }

  function renderKpis() {
    var open = STATE.tickets.filter(function (t) { return t.status !== 'resolved' && t.status !== 'closed'; });
    var critical = open.filter(function (t) { return t.severity === 'critical' || t.severity === 'high'; });
    var resolved24h = STATE.tickets.filter(function (t) {
      if (!t.resolved_at) return false;
      return new Date(t.resolved_at).getTime() > Date.now() - 24 * 3600 * 1000;
    });
    document.getElementById('inc-kpis').innerHTML = '' +
      kpi('Total', STATE.tickets.length) +
      kpi('Abiertas', open.length) +
      kpi('Cr\u00edticas/Altas', critical.length) +
      kpi('Resueltas (24h)', resolved24h.length);
  }

  function renderList() {
    var rows = STATE.tickets;
    if (STATE.filter === 'open') rows = rows.filter(function (t) { return t.status !== 'resolved' && t.status !== 'closed'; });
    if (STATE.filter === 'closed') rows = rows.filter(function (t) { return t.status === 'resolved' || t.status === 'closed'; });

    if (!rows.length) {
      document.getElementById('inc-list').innerHTML = '<p class="empty">Sin incidencias en este filtro.</p>';
      return;
    }
    document.getElementById('inc-list').innerHTML = window.UI.table(rows, [
      { key: 'ticket_number', label: '#' },
      { key: 'title', label: 'T\u00edtulo' },
      { key: 'category', label: 'Categor\u00eda' },
      { key: 'location_label', label: 'Ubicaci\u00f3n' },
      { key: 'severity', label: 'Severidad', render: function (r) { return window.UI.badge(r.severity, sevKind(r.severity)); }, html: true },
      { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusKind(r.status)); }, html: true },
      { key: 'created_at', label: 'Reportada', render: function (r) { return window.UI.fmtDate(r.created_at); } },
      { key: 'actions', label: '', render: function (r) {
        if (r.status === 'resolved' || r.status === 'closed') return '<span class="muted">Cerrada</span>';
        if (!window.AUTH.canAccess('proyectos')) return '';
        return '<button class="btn btn-ghost" data-act="advance" data-id="' + window.UI.esc(r.id) + '" data-current="' + window.UI.esc(r.status) + '">Avanzar</button> ' +
               '<button class="btn btn-ghost" data-act="escalate" data-id="' + window.UI.esc(r.id) + '">Escalar</button>';
      }, html: true },
    ]);
    document.getElementById('inc-list').addEventListener('click', onAction);
  }

  function sevKind(s) {
    if (s === 'critical' || s === 'high') return 'danger';
    if (s === 'medium') return 'warning';
    return 'neutral';
  }

  function statusKind(s) {
    if (s === 'resolved' || s === 'closed') return 'success';
    if (s === 'in_progress') return 'info';
    if (s === 'received') return 'warning';
    return 'neutral';
  }

  function nextStatus(s) {
    if (s === 'received' || !s) return 'in_progress';
    if (s === 'in_progress') return 'resolved';
    return s;
  }

  async function onAction(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    if (act === 'advance') {
      var current = btn.getAttribute('data-current');
      var next = nextStatus(current);
      try {
        var patch = { status: next, resident_visible_status: next === 'in_progress' ? 'In progress' : 'Resolved' };
        if (next === 'resolved') patch.resolved_at = new Date().toISOString();
        await window.SB.update('incident_tickets', { id: 'eq.' + id }, patch);
        window.UI.toast('Incidencia avanzada a ' + next + '.', 'success');
        await load();
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    }
    if (act === 'escalate') {
      var ticket = STATE.tickets.find(function (t) { return t.id === id; });
      if (!ticket) return;
      var session = window.AUTH.readSession();
      try {
        await window.SB.insert('escalation_events', {
          severity: ticket.severity || 'medium',
          status: 'open',
          source_type: 'incident_ticket',
          source_id: ticket.id,
          title: 'Escalaci\u00f3n: ' + ticket.title,
          details: 'Escalada desde incidencia ' + ticket.ticket_number + ' por ' + session.label + '.',
          payload: { actorRole: session.role, ticket_number: ticket.ticket_number, building_id: ticket.building_id },
        });
        window.UI.toast('Escalaci\u00f3n creada.', 'success');
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    }
  }

  function openNewModal() {
    var host = document.getElementById('inc-modal-host');
    host.innerHTML = '' +
      '<section class="page" data-testid="inc-new-form">' +
        '<h3 class="section-title">Nueva incidencia</h3>' +
        '<form id="inc-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>Categor\u00eda</label>' +
            '<select name="category" required>' +
              '<option value="Maintenance">Mantenimiento</option>' +
              '<option value="Security">Seguridad</option>' +
              '<option value="Inventory">Inventario</option>' +
              '<option value="Cleanliness">Limpieza</option>' +
              '<option value="Other">Otro</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Severidad</label>' +
            '<select name="severity" required>' +
              '<option value="low">Baja</option>' +
              '<option value="medium" selected>Media</option>' +
              '<option value="high">Alta</option>' +
              '<option value="critical">Cr\u00edtica</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Ubicaci\u00f3n</label>' +
            '<input type="text" name="location" placeholder="Ej: Garita, Cuarto t\u00e9cnico" required></div>' +
          '<div class="form-field"><label>Visible al residente</label>' +
            '<select name="visible">' +
              '<option value="false">No</option>' +
              '<option value="true">S\u00ed</option>' +
            '</select></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>T\u00edtulo</label>' +
            '<input type="text" name="title" required></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n</label>' +
            '<textarea name="description" rows="3" required></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Crear</button>' +
            '<button class="btn btn-ghost" type="button" id="inc-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('inc-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('inc-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(this);
      var body = {
        building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
        ticket_number: 'INC-' + Math.floor(Math.random() * 900000 + 100000),
        source: 'internal',
        category: fd.get('category'),
        location_label: fd.get('location'),
        severity: fd.get('severity'),
        status: 'received',
        title: fd.get('title'),
        description: fd.get('description'),
        resident_visible_status: fd.get('visible') === 'true' ? 'Received' : null,
        metadata: { actorRole: session.role, actorLabel: session.label, source: 'aproviva-suite' },
      };
      try {
        await window.SB.insert('incident_tickets', body);
        window.UI.toast('Incidencia creada.', 'success');
        host.innerHTML = '';
        await load();
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    });
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.ROUTER.register('incidencias', { render: render, requiredModule: 'incidencias' });
})();
