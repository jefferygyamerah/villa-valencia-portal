/**
 * Gemba (Recorridos) - templates, execution, finding logs, exception detection.
 * Scenarios 4 (configure), 5 (execute), 6 (report issue), 7 (route), 10 (missed).
 */
(function () {
  var STATE = { rounds: [], findings: [], locations: [] };

  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="gemba-page">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h2 class="page-title">Recorridos (Gemba)</h2>' +
            '<p class="page-subtitle">Inspecciones programadas, ejecuci\u00f3n y hallazgos.</p>' +
          '</div>' +
          '<div class="row wrap" style="gap:0.5rem;">' +
            (window.AUTH.canAccess('maestros')
              ? '<button class="btn btn-ghost" id="gemba-new-tpl" type="button">Nueva plantilla</button>'
              : '') +
            '<button class="btn btn-primary-sm" id="gemba-start-btn" type="button">Iniciar recorrido</button>' +
          '</div>' +
        '</div>' +
        '<div class="kpi-grid" id="gemba-kpis"><div class="loading">...</div></div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Recorridos en curso o atrasados</h3>' +
          '<div id="gemba-active"></div>' +
        '</div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Recorridos recientes</h3>' +
          '<div id="gemba-recent"></div>' +
        '</div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Hallazgos abiertos</h3>' +
          '<div id="gemba-findings"></div>' +
        '</div>' +
      '</section>' +
      '<div id="gemba-modal-host"></div>';

    document.getElementById('gemba-start-btn').addEventListener('click', openStartModal);
    var newTpl = document.getElementById('gemba-new-tpl');
    if (newTpl) newTpl.addEventListener('click', openStartModal);

    await loadAll();
  }

  async function loadAll() {
    try {
      var results = await Promise.all([
        window.SB.select('inspection_rounds', { select: '*', order: 'scheduled_for.desc.nullslast', limit: '40' }),
        window.SB.select('inspection_findings', { select: '*', order: 'created_at.desc', limit: '40' }),
        window.SB.select('inventory_locations', { select: '*', is_active: 'eq.true', order: 'name.asc' }),
      ]);
      STATE.rounds = results[0] || [];
      STATE.findings = results[1] || [];
      STATE.locations = results[2] || [];
      renderKpis();
      renderActive();
      renderRecent();
      renderFindings();
    } catch (e) {
      window.UI.errorBox('gemba-active', e);
    }
  }

  function renderKpis() {
    var now = Date.now();
    var open = STATE.rounds.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; });
    var overdue = open.filter(function (r) { return r.scheduled_for && new Date(r.scheduled_for).getTime() < now - 12 * 3600 * 1000; });
    var thisWeek = STATE.rounds.filter(function (r) {
      if (!r.completed_at) return false;
      return new Date(r.completed_at).getTime() > now - 7 * 24 * 3600 * 1000;
    });
    document.getElementById('gemba-kpis').innerHTML = '' +
      kpi('Abiertos', open.length) +
      kpi('Atrasados', overdue.length) +
      kpi('Completados (7d)', thisWeek.length) +
      kpi('Hallazgos abiertos', STATE.findings.filter(function (f) { return f.status !== 'resolved' && f.status !== 'closed'; }).length);
  }

  function renderActive() {
    var rows = STATE.rounds.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; });
    if (!rows.length) {
      document.getElementById('gemba-active').innerHTML = '<p class="empty">Sin recorridos abiertos.</p>';
      return;
    }
    document.getElementById('gemba-active').innerHTML = window.UI.table(rows, [
      { key: 'round_number', label: '#' },
      { key: 'title', label: 'T\u00edtulo' },
      { key: 'area', label: '\u00c1rea' },
      { key: 'round_type', label: 'Tipo' },
      { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusBadgeKind(r.status)); }, html: true },
      { key: 'scheduled_for', label: 'Programado', render: function (r) { return r.scheduled_for ? window.UI.fmtDate(r.scheduled_for) : ''; } },
      { key: 'actions', label: '', render: function (r) {
        return '<button class="btn btn-ghost" data-act="complete" data-id="' + window.UI.esc(r.id) + '">Marcar completado</button> ' +
               '<button class="btn btn-ghost" data-act="finding" data-id="' + window.UI.esc(r.id) + '">+ Hallazgo</button>';
      }, html: true },
    ]);
    document.getElementById('gemba-active').addEventListener('click', onTableAction);
  }

  function renderRecent() {
    var rows = STATE.rounds.filter(function (r) { return r.status === 'completed' || r.status === 'closed'; }).slice(0, 10);
    document.getElementById('gemba-recent').innerHTML = window.UI.table(rows, [
      { key: 'round_number', label: '#' },
      { key: 'title', label: 'T\u00edtulo' },
      { key: 'round_type', label: 'Tipo' },
      { key: 'completed_at', label: 'Completado', render: function (r) { return r.completed_at ? window.UI.fmtDate(r.completed_at) : ''; } },
    ]);
  }

  function renderFindings() {
    var byRound = {};
    STATE.rounds.forEach(function (r) { byRound[r.id] = r; });
    var rows = STATE.findings.filter(function (f) { return f.status !== 'resolved' && f.status !== 'closed'; });
    if (!rows.length) {
      document.getElementById('gemba-findings').innerHTML = '<p class="empty">Sin hallazgos abiertos.</p>';
      return;
    }
    document.getElementById('gemba-findings').innerHTML = window.UI.table(rows, [
      { key: 'description', label: 'Hallazgo' },
      { key: 'finding_type', label: 'Tipo' },
      { key: 'severity', label: 'Severidad', render: function (r) { return window.UI.badge(r.severity || 'low', sevBadgeKind(r.severity)); }, html: true },
      { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status || 'open', statusBadgeKind(r.status)); }, html: true },
      { key: 'round', label: 'Recorrido', render: function (r) { return byRound[r.inspection_round_id] ? byRound[r.inspection_round_id].round_number : '?'; } },
      { key: 'created_at', label: 'Creado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
    ]);
  }

  function statusBadgeKind(s) {
    if (s === 'completed' || s === 'resolved' || s === 'closed') return 'success';
    if (s === 'in_progress') return 'info';
    if (s === 'overdue' || s === 'failed') return 'danger';
    return 'neutral';
  }

  function sevBadgeKind(s) {
    if (s === 'critical' || s === 'high') return 'danger';
    if (s === 'medium') return 'warning';
    return 'neutral';
  }

  function onTableAction(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    if (act === 'complete') return completeRound(id);
    if (act === 'finding') return openFindingModal(id);
  }

  async function completeRound(id) {
    try {
      await window.SB.update('inspection_rounds', { id: 'eq.' + id }, { status: 'completed', completed_at: new Date().toISOString() });
      window.UI.toast('Recorrido completado.', 'success');
      await loadAll();
    } catch (e) {
      window.UI.toast('Error: ' + e.message, 'error');
    }
  }

  function openStartModal() {
    var host = document.getElementById('gemba-modal-host');
    host.innerHTML = '' +
      '<section class="page" data-testid="gemba-start-form">' +
        '<h3 class="section-title">Iniciar nuevo recorrido</h3>' +
        '<form id="round-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>T\u00edtulo</label>' +
            '<input type="text" name="title" required placeholder="Ej: Recorrido matutino \u00e1rea social"></div>' +
          '<div class="form-field"><label>\u00c1rea</label>' +
            '<input type="text" name="area" required placeholder="Ej: Piscina, Garita, Calles"></div>' +
          '<div class="form-field"><label>Tipo</label>' +
            '<select name="round_type" required>' +
              '<option value="daily">Diario</option>' +
              '<option value="weekly">Semanal</option>' +
              '<option value="monthly">Mensual</option>' +
              '<option value="ad_hoc">Ad-hoc</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Programado para</label>' +
            '<input type="datetime-local" name="scheduled_for"></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Iniciar</button>' +
            '<button class="btn btn-ghost" type="button" id="round-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('round-cancel').addEventListener('click', function () {
      document.getElementById('gemba-modal-host').innerHTML = '';
    });
    document.getElementById('round-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(this);
      var body = {
        round_number: 'GEM-' + Math.floor(Math.random() * 900000 + 100000),
        title: fd.get('title'),
        area: fd.get('area'),
        round_type: fd.get('round_type'),
        status: 'in_progress',
        scheduled_for: fd.get('scheduled_for') ? new Date(fd.get('scheduled_for')).toISOString() : null,
        started_at: new Date().toISOString(),
        metadata: { actorRole: session.role, actorLabel: session.label, source: 'aproviva-suite' },
      };
      try {
        await window.SB.insert('inspection_rounds', body);
        window.UI.toast('Recorrido iniciado.', 'success');
        document.getElementById('gemba-modal-host').innerHTML = '';
        await loadAll();
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    });
  }

  function openFindingModal(roundId) {
    var host = document.getElementById('gemba-modal-host');
    host.innerHTML = '' +
      '<section class="page" data-testid="gemba-finding-form">' +
        '<h3 class="section-title">Registrar hallazgo</h3>' +
        '<form id="finding-form" class="form-grid cols-2">' +
          '<input type="hidden" name="round_id" value="' + window.UI.esc(roundId) + '">' +
          '<div class="form-field"><label>Tipo</label>' +
            '<select name="finding_type" required>' +
              '<option value="defect">Defecto</option>' +
              '<option value="missing">Faltante</option>' +
              '<option value="damage">Da\u00f1o</option>' +
              '<option value="safety">Seguridad</option>' +
              '<option value="cleanliness">Limpieza</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Severidad</label>' +
            '<select name="severity" required>' +
              '<option value="low">Baja</option>' +
              '<option value="medium" selected>Media</option>' +
              '<option value="high">Alta</option>' +
              '<option value="critical">Cr\u00edtica</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Ubicaci\u00f3n</label>' +
            '<select name="location_id">' +
              '<option value="">N/A</option>' +
              STATE.locations.map(function (l) { return '<option value="' + l.id + '">' + window.UI.esc(l.name) + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="form-field"><label>Foto URL (opcional)</label>' +
            '<input type="url" name="photo_url" placeholder="https://drive.google.com/..."></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n</label>' +
            '<textarea name="description" rows="3" required></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Guardar</button>' +
            '<button class="btn btn-ghost" type="button" id="finding-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('finding-cancel').addEventListener('click', function () {
      document.getElementById('gemba-modal-host').innerHTML = '';
    });
    document.getElementById('finding-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(this);
      var body = {
        inspection_round_id: fd.get('round_id'),
        location_id: fd.get('location_id') || null,
        finding_type: fd.get('finding_type'),
        severity: fd.get('severity'),
        status: 'open',
        description: fd.get('description'),
        photo_url: fd.get('photo_url') || null,
        metadata: { actorRole: session.role, actorLabel: session.label },
      };
      try {
        await window.SB.insert('inspection_findings', body);
        window.UI.toast('Hallazgo registrado.', 'success');
        document.getElementById('gemba-modal-host').innerHTML = '';
        await loadAll();
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    });
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.ROUTER.register('gemba', { render: render, requiredModule: 'gemba' });
})();
