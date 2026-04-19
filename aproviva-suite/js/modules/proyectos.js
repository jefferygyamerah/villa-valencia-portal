/**
 * Proyectos / Acciones - work assignments (junta only).
 * Scenarios 8, 9 - supervisor intervention via assigned work orders.
 */
(function () {
  var STATE = { rows: [], filter: 'open' };

  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="proyectos-page">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h2 class="page-title">Proyectos / Acciones</h2>' +
            '<p class="page-subtitle">\u00d3rdenes de trabajo, intervenciones y seguimiento ejecutivo.</p>' +
          '</div>' +
          '<div class="row wrap" style="gap:0.5rem;">' +
            '<select id="proj-filter" class="btn btn-ghost">' +
              '<option value="open">Abiertos</option>' +
              '<option value="all">Todos</option>' +
              '<option value="closed">Cerrados</option>' +
            '</select>' +
            '<button class="btn btn-primary-sm" id="proj-new" type="button">+ Nueva orden</button>' +
          '</div>' +
        '</div>' +
        '<div class="kpi-grid" id="proj-kpis"><div class="loading">...</div></div>' +
        '<div class="page-section">' +
          '<div id="proj-list"></div>' +
        '</div>' +
      '</section>' +
      '<div id="proj-modal-host"></div>';

    document.getElementById('proj-filter').addEventListener('change', function (e) { STATE.filter = e.target.value; renderList(); });
    document.getElementById('proj-new').addEventListener('click', openNew);
    await load();
  }

  async function load() {
    try {
      var rows = await window.SB.select('work_assignments', { select: '*', order: 'due_at.asc.nullslast', limit: '200' });
      STATE.rows = rows || [];
      renderKpis();
      renderList();
    } catch (e) {
      window.UI.errorBox('proj-list', e);
    }
  }

  function renderKpis() {
    var open = STATE.rows.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled'; });
    var overdue = open.filter(function (r) { return r.due_at && new Date(r.due_at).getTime() < Date.now(); });
    var highPriority = open.filter(function (r) { return r.priority === 'high' || r.priority === 'critical'; });
    document.getElementById('proj-kpis').innerHTML = '' +
      kpi('Total', STATE.rows.length) +
      kpi('Abiertos', open.length) +
      kpi('Atrasados', overdue.length) +
      kpi('Alta prioridad', highPriority.length);
  }

  function renderList() {
    var rows = STATE.rows;
    if (STATE.filter === 'open') rows = rows.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled'; });
    if (STATE.filter === 'closed') rows = rows.filter(function (r) { return r.status === 'completed' || r.status === 'closed'; });

    if (!rows.length) {
      document.getElementById('proj-list').innerHTML = '<p class="empty">Sin \u00f3rdenes.</p>';
      return;
    }
    document.getElementById('proj-list').innerHTML = window.UI.table(rows, [
      { key: 'assignment_number', label: '#' },
      { key: 'title', label: 'T\u00edtulo' },
      { key: 'area', label: '\u00c1rea' },
      { key: 'task_type', label: 'Tipo' },
      { key: 'assignee_name', label: 'Asignado' },
      { key: 'priority', label: 'Prioridad', render: function (r) { return window.UI.badge(r.priority || 'normal', priKind(r.priority)); }, html: true },
      { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusKind(r.status)); }, html: true },
      { key: 'due_at', label: 'Vence', render: function (r) {
        if (!r.due_at) return '';
        var due = new Date(r.due_at);
        var late = due.getTime() < Date.now() && r.status !== 'completed' && r.status !== 'closed';
        return (late ? '<span class="badge badge-danger">' : '<span>') + window.UI.fmtDate(r.due_at, { dateOnly: true }) + '</span>';
      }, html: true },
      { key: 'actions', label: '', render: function (r) {
        if (r.status === 'completed' || r.status === 'closed') return '<span class="muted">Cerrada</span>';
        return '<button class="btn btn-ghost" data-act="advance" data-id="' + window.UI.esc(r.id) + '" data-current="' + window.UI.esc(r.status) + '">Avanzar</button>';
      }, html: true },
    ]);
    document.getElementById('proj-list').addEventListener('click', onAction);
  }

  function priKind(p) {
    if (p === 'critical' || p === 'high') return 'danger';
    if (p === 'normal') return 'info';
    return 'neutral';
  }

  function statusKind(s) {
    if (s === 'completed' || s === 'closed') return 'success';
    if (s === 'in_progress') return 'info';
    if (s === 'blocked') return 'danger';
    return 'neutral';
  }

  function nextStatus(s) {
    if (s === 'open' || !s) return 'in_progress';
    if (s === 'in_progress') return 'completed';
    return s;
  }

  async function onAction(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.getAttribute('data-act') === 'advance') {
      var id = btn.getAttribute('data-id');
      var current = btn.getAttribute('data-current');
      var next = nextStatus(current);
      try {
        var patch = { status: next };
        if (next === 'completed') patch.verified_at = new Date().toISOString();
        await window.SB.update('work_assignments', { id: 'eq.' + id }, patch);
        window.UI.toast('Orden avanzada a ' + next + '.', 'success');
        await load();
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    }
  }

  function openNew() {
    var host = document.getElementById('proj-modal-host');
    host.innerHTML = '' +
      '<section class="page" data-testid="proj-new-form">' +
        '<h3 class="section-title">Nueva orden de trabajo</h3>' +
        '<form id="proj-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>T\u00edtulo</label>' +
            '<input type="text" name="title" required></div>' +
          '<div class="form-field"><label>\u00c1rea</label>' +
            '<input type="text" name="area" required></div>' +
          '<div class="form-field"><label>Asignado a</label>' +
            '<input type="text" name="assignee_name" placeholder="Nombre del responsable" required></div>' +
          '<div class="form-field"><label>Tipo de tarea</label>' +
            '<select name="task_type">' +
              '<option value="corrective">Correctiva</option>' +
              '<option value="preventive">Preventiva</option>' +
              '<option value="inspection">Inspecci\u00f3n</option>' +
              '<option value="project">Proyecto</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Prioridad</label>' +
            '<select name="priority">' +
              '<option value="low">Baja</option>' +
              '<option value="normal" selected>Normal</option>' +
              '<option value="high">Alta</option>' +
              '<option value="critical">Cr\u00edtica</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Vence</label>' +
            '<input type="date" name="due_at"></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n</label>' +
            '<textarea name="description" rows="3" required></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Crear</button>' +
            '<button class="btn btn-ghost" type="button" id="proj-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('proj-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('proj-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(this);
      var body = {
        assignment_number: 'WO-' + Math.floor(Math.random() * 900000 + 100000),
        assignee_name: fd.get('assignee_name'),
        area: fd.get('area'),
        task_type: fd.get('task_type'),
        title: fd.get('title'),
        description: fd.get('description'),
        status: 'open',
        priority: fd.get('priority'),
        verification_required: false,
        due_at: fd.get('due_at') ? new Date(fd.get('due_at')).toISOString() : null,
        metadata: { actorRole: session.role, actorLabel: session.label, source: 'aproviva-suite' },
      };
      try {
        await window.SB.insert('work_assignments', body);
        window.UI.toast('Orden creada.', 'success');
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

  window.ROUTER.register('proyectos', { render: render, requiredModule: 'proyectos' });
})();
