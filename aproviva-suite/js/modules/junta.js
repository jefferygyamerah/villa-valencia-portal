/**
 * Junta Gobernanza - executive view: KPIs, escalations, chronic patterns.
 * Scenarios 16 (multi-location), 17 (oversight), 18 (governance escalation), 19 (chronic).
 */
(function () {
  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="junta-page">' +
        '<h2 class="page-title">Junta</h2>' +
        '<p class="page-subtitle">Vista ejecutiva para decidir: excepciones abiertas, patrones repetidos y reportes listos para revisi\u00f3n.</p>' +
        '<div id="junta-body"><div class="loading">Cargando vista ejecutiva...</div></div>' +
      '</section>';
    await loadAll();
  }

  async function loadAll() {
    var box = document.getElementById('junta-body');
    try {
      var results = await Promise.all([
        window.SB.select('buildings', { select: '*' }),
        window.SB.select('escalation_events', { select: '*', order: 'created_at.desc', limit: '100' }),
        window.SB.select('incident_tickets', { select: '*', order: 'created_at.desc', limit: '300' }),
        window.SB.select('inspection_rounds', { select: '*', order: 'created_at.desc', limit: '200' }),
        window.SB.select('inspection_findings', { select: '*', order: 'created_at.desc', limit: '200' }),
        window.SB.select('inventory_items', { select: '*', is_active: 'eq.true', limit: '200' }),
        window.SB.select('weekly_reports', { select: '*', order: 'submitted_at.desc.nullslast', limit: '20' }),
        window.SB.select('work_assignments', { select: '*', order: 'created_at.desc', limit: '200' }),
        window.SB.select('compliance_cases', { select: '*', order: 'created_at.desc', limit: '50' }),
      ]);
      var buildings = results[0] || [];
      var esc = results[1] || [];
      var incidents = results[2] || [];
      var rounds = results[3] || [];
      var findings = results[4] || [];
      var items = results[5] || [];
      var reports = results[6] || [];
      var wo = results[7] || [];
      var compliance = results[8] || [];

      // Per-building rollups (Scenario 16 multi-location)
      var byBuilding = {};
      buildings.forEach(function (b) { byBuilding[b.id] = { building: b, openIncidents: 0, criticalIncidents: 0, openRounds: 0, openWO: 0 }; });
      incidents.forEach(function (i) {
        if (!byBuilding[i.building_id]) return;
        if (i.status !== 'resolved' && i.status !== 'closed') byBuilding[i.building_id].openIncidents++;
        if ((i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved' && i.status !== 'closed') byBuilding[i.building_id].criticalIncidents++;
      });
      // Rounds and WO are not building-scoped in current schema; aggregate at portfolio level

      var openEsc = esc.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed'; });
      var criticalEsc = openEsc.filter(function (r) { return r.severity === 'critical' || r.severity === 'high'; });
      var incidentById = {};
      incidents.forEach(function (i) { incidentById[i.id] = i; });

      // Chronic detection - source_id repeated 2+ times in escalations or incidents (Scenario 19)
      var sourceCount = {};
      esc.forEach(function (e) { sourceCount[e.source_id] = (sourceCount[e.source_id] || 0) + 1; });
      var chronicSourceIds = Object.keys(sourceCount).filter(function (k) { return sourceCount[k] >= 2 && k && k !== 'null'; });
      var titleCount = {};
      incidents.forEach(function (i) {
        var key = (i.location_label || '') + ' | ' + (i.category || '');
        titleCount[key] = (titleCount[key] || 0) + 1;
      });
      var chronicPatterns = Object.keys(titleCount)
        .map(function (k) { return { pattern: k, count: titleCount[k] }; })
        .filter(function (r) { return r.count >= 3; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 10);

      var openWO = wo.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled'; });
      var lateWO = openWO.filter(function (r) { return r.due_at && new Date(r.due_at).getTime() < Date.now(); });
      var WEEK = 7 * 24 * 3600 * 1000;
      var roundsCompleted = rounds.filter(function (r) { return inWindow(r.completed_at, WEEK); });
      var roundsScheduled = rounds.filter(function (r) { return r.scheduled_for && inWindow(r.scheduled_for, WEEK); });
      var compliancePct = roundsScheduled.length ? Math.round(100 * roundsCompleted.length / roundsScheduled.length) : 100;
      var stockRisk = items.filter(function (item) {
        var min = Number(item.reorder_point || item.default_reorder_point || item.min_quantity || 0);
        var qty = Number(item.current_quantity || item.quantity_on_hand || item.quantity || 0);
        return min > 0 && qty <= min;
      });
      var preventiveCorrective = preventiveCorrectiveRatio(wo, roundsCompleted);
      var metricCards = [
        { label: 'Escalaciones abiertas', value: openEsc.length, owner: 'Gerencia / Junta', source: 'escalation_events', status: criticalEsc.length ? 'Rojo' : (openEsc.length ? 'Amarillo' : 'Verde'), drillKey: 'openEsc', detail: 'Decisiones requeridas y bitácora.' },
        { label: 'Altas / críticas', value: criticalEsc.length, owner: 'Supervisión', source: 'escalation_events', status: criticalEsc.length ? 'Rojo' : 'Verde', drillKey: 'criticalEsc', detail: 'Escalaciones de mayor severidad.' },
        { label: 'Backlog abierto', value: openWO.length, owner: 'Supervisión', source: 'work_assignments', status: lateWO.length ? 'Amarillo' : 'Verde', drillKey: 'openWO', detail: 'Órdenes abiertas por dueño, prioridad y fecha.' },
        { label: 'Órdenes vencidas', value: lateWO.length, owner: 'Gerencia', source: 'work_assignments.due_at', status: lateWO.length ? 'Rojo' : 'Verde', drillKey: 'lateWO', detail: 'Trabajos vencidos que requieren desbloqueo.' },
        { label: 'Cumplimiento recorridos', value: compliancePct + '%', owner: 'Supervisión', source: 'inspection_rounds', status: compliancePct < 80 ? 'Amarillo' : 'Verde', drillKey: 'rounds', detail: 'Recorridos programados vs completados.' },
        { label: 'Patrones crónicos', value: chronicPatterns.length, owner: 'Gerencia', source: 'incident_tickets.location_label + category', status: chronicPatterns.length ? 'Amarillo' : 'Verde', drillKey: 'chronic', detail: '3+ repeticiones por ubicación/categoría.' },
        { label: 'Stock en riesgo', value: stockRisk.length, owner: 'Supervisión', source: 'inventory_items.reorder_point', status: stockRisk.length ? 'Amarillo' : 'Verde', drillKey: 'stockRisk', detail: 'Artículos bajo o igual al punto de reorden.' },
        { label: 'Preventivo / correctivo', value: preventiveCorrective.label, owner: 'Gerencia', source: 'work_assignments.task_type + inspection_rounds', status: preventiveCorrective.corrective > preventiveCorrective.preventive ? 'Amarillo' : 'Verde', drillKey: 'preventiveCorrective', detail: 'Balance semanal, excluye capital.' },
      ];
      var decisionLevel = criticalEsc.length || lateWO.length ? 'danger' : (openEsc.length || chronicPatterns.length ? 'warning' : 'success');
      var decisionText = criticalEsc.length
        ? 'Resolver due\u00f1o, fecha y pr\u00f3xima acci\u00f3n de escalaciones cr\u00edticas/altas.'
        : (lateWO.length ? 'Revisar \u00f3rdenes atrasadas y confirmar capacidad operativa.' : (chronicPatterns.length ? 'Convertir patrones repetidos en plan de mejora.' : 'Sin bloqueos ejecutivos visibles.'));

      var complianceRows = compliance.slice(0, 25).map(function (c) {
        return {
          status: c.status || '\u2014',
          summary: c.title || c.summary || c.case_type || c.id || '\u2014',
          opened: c.created_at || c.opened_at || '',
        };
      });
      var closureRows = incidents.filter(function (i) {
        return (i.status === 'resolved' || i.status === 'closed') && latestHistory(i);
      }).slice(0, 10);

      box.innerHTML = '' +
        decisionBox(decisionText, decisionLevel) +
        '<div class="vv-privacy-card junta-privacy">' +
          '<div class="vv-eyebrow">Lectura segura</div>' +
          '<p>Esta pantalla resume estados operativos para Junta. No muestra datos de contacto, bancos, residentes ni detalles libres de casos.</p>' +
        '</div>' +
        '<div class="kpi-grid junta-scorecard" id="junta-kpis" data-testid="junta-scorecard">' +
          metricCards.map(juntaKpiCard).join('') +
        '</div>' +
        '<div class="page-section" id="junta-kpi-detail" data-testid="junta-kpi-detail" style="display:none"></div>' +

        '<div class="page-section"><h3 class="section-title">Estado por edificio</h3>' +
          window.UI.table(Object.values(byBuilding), [
            { key: 'name', label: 'Edificio', render: function (r) { return r.building.name; } },
            { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.building.status, r.building.status === 'active' ? 'success' : 'neutral'); }, html: true },
            { key: 'openIncidents', label: 'Incidentes abiertos' },
            { key: 'criticalIncidents', label: 'Altos/cr\u00edticos' },
          ]) +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Decisiones pendientes</h3>' +
          (criticalEsc.length ? window.UI.table(criticalEsc.slice(0, 10), [
            { key: 'severity', label: 'Nivel', render: function (r) { return window.UI.badge(r.severity, severityKind(r.severity)); }, html: true },
            { key: 'title', label: 'Caso' },
            { key: 'context', label: 'Contexto', render: function (r) { return escalationContext(r, incidentById); } },
            { key: 'source_type', label: 'Origen' },
            { key: 'created_at', label: 'Creado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
          ]) : '<p class="empty">Sin escalaciones cr\u00edticas/altas abiertas.</p>') +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Historial de cierre</h3>' +
          (closureRows.length ? window.UI.table(closureRows, [
            { key: 'ticket_number', label: '#' },
            { key: 'title', label: 'Caso' },
            { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusKind(r.status)); }, html: true },
            { key: 'history', label: 'Ultimo movimiento', render: function (r) { return closureSummary(r); } },
          ]) : '<p class="empty">Sin cierres con bit\u00e1cora para revisar.</p>') +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Patrones repetidos</h3>' +
          (chronicPatterns.length ? window.UI.table(chronicPatterns, [
            { key: 'pattern', label: 'Ubicaci\u00f3n | categor\u00eda' },
            { key: 'count', label: 'Repeticiones', render: function (r) { return window.UI.badge(r.count + '\u00d7', 'warning'); }, html: true },
          ]) : '<p class="empty">Sin patrones cr\u00f3nicos detectados (umbral: 3+ repeticiones).</p>') +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Compliance</h3>' +
          (complianceRows.length
            ? window.UI.table(complianceRows, [
              { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusKind(r.status)); }, html: true },
              { key: 'summary', label: 'Tipo / resumen' },
              { key: 'opened', label: 'Fecha', render: function (r) { return r.opened ? window.UI.fmtDate(r.opened) : ''; } },
            ])
            : '<p class="empty">Sin casos de compliance registrados.</p>') +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Reportes semanales</h3>' +
          window.UI.table(reports.slice(0, 10), [
            { key: 'period_label', label: 'Periodo' },
            { key: 'inventory_snapshot_label', label: 'Inventario' },
            { key: 'incidents_label', label: 'Incidentes' },
            { key: 'inspections_label', label: 'Inspecciones' },
            { key: 'vendor_attendance_label', label: 'Proveedores' },
            { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, r.status === 'submitted' ? 'success' : (r.status === 'approved' ? 'success' : 'warning')); }, html: true },
            { key: 'submitted_at', label: 'Enviado', render: function (r) { return r.submitted_at ? window.UI.fmtDate(r.submitted_at) : ''; } },
          ]) +
        '</div>';

      wireKpiDrilldowns({
        openEsc: { title: 'Escalaciones abiertas', rows: openEsc, columns: [
          { key: 'severity', label: 'Nivel', render: function (r) { return window.UI.badge(r.severity, severityKind(r.severity)); }, html: true },
          { key: 'title', label: 'Caso' },
          { key: 'context', label: 'Contexto', render: function (r) { return escalationContext(r, incidentById); } },
          { key: 'status', label: 'Estado' },
        ] },
        criticalEsc: { title: 'Escalaciones altas / críticas', rows: criticalEsc, columns: [
          { key: 'severity', label: 'Nivel', render: function (r) { return window.UI.badge(r.severity, severityKind(r.severity)); }, html: true },
          { key: 'title', label: 'Caso' },
          { key: 'context', label: 'Contexto', render: function (r) { return escalationContext(r, incidentById); } },
        ] },
        chronic: { title: 'Patrones crónicos', rows: chronicPatterns, columns: [
          { key: 'pattern', label: 'Ubicación | categoría' },
          { key: 'count', label: 'Repeticiones' },
        ] },
        openWO: { title: 'Backlog abierto', rows: openWO, columns: [
          { key: 'assignment_number', label: '#' },
          { key: 'title', label: 'Trabajo' },
          { key: 'priority', label: 'Prioridad' },
          { key: 'status', label: 'Estado' },
          { key: 'due_at', label: 'Vence', render: function (r) { return r.due_at ? window.UI.fmtDate(r.due_at) : ''; } },
        ] },
        lateWO: { title: 'Órdenes vencidas', rows: lateWO, columns: [
          { key: 'assignment_number', label: '#' },
          { key: 'title', label: 'Trabajo' },
          { key: 'priority', label: 'Prioridad' },
          { key: 'due_at', label: 'Vence', render: function (r) { return window.UI.fmtDate(r.due_at); } },
        ] },
        compliance: { title: 'Casos compliance', rows: complianceRows, columns: [
          { key: 'status', label: 'Estado' },
          { key: 'summary', label: 'Tipo / resumen' },
          { key: 'opened', label: 'Fecha', render: function (r) { return r.opened ? window.UI.fmtDate(r.opened) : ''; } },
        ] },
        rounds: { title: 'Cumplimiento recorridos', rows: rounds.slice(0, 30), columns: [
          { key: 'round_number', label: '#' },
          { key: 'title', label: 'Recorrido' },
          { key: 'status', label: 'Estado' },
          { key: 'scheduled_for', label: 'Programado', render: function (r) { return r.scheduled_for ? window.UI.fmtDate(r.scheduled_for) : ''; } },
        ] },
        stockRisk: { title: 'Stock en riesgo', rows: stockRisk, columns: [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Artículo' },
          { key: 'current_quantity', label: 'Cantidad' },
          { key: 'reorder_point', label: 'Reorden' },
        ] },
        preventiveCorrective: { title: 'Preventivo / correctivo', rows: [preventiveCorrective], columns: [
          { key: 'preventive', label: 'Preventivo' },
          { key: 'corrective', label: 'Correctivo' },
          { key: 'label', label: 'Ratio' },
        ] },
      });
    } catch (e) {
      window.UI.errorBox(box, e);
    }
  }


  function inWindow(iso, ms) {
    if (!iso) return false;
    return Date.now() - new Date(iso).getTime() <= ms;
  }

  function isCapitalProject(row) {
    var meta = parseJson(row.metadata);
    var type = String(row.task_type || row.work_type || meta.task_type || '').toLowerCase();
    return meta.capital_project === true || meta.capital_project === 'true' || type.indexOf('capital') >= 0 || type.indexOf('project') >= 0 || type.indexOf('proyecto') >= 0;
  }

  function preventiveCorrectiveRatio(workRows, completedRounds) {
    var preventive = completedRounds.length;
    var corrective = 0;
    (workRows || []).forEach(function (row) {
      if (isCapitalProject(row)) return;
      var type = String(row.task_type || row.work_type || parseJson(row.metadata).task_type || '').toLowerCase();
      if (type.indexOf('correct') >= 0 || type.indexOf('repar') >= 0 || type.indexOf('incident') >= 0) corrective++;
      else if (type.indexOf('prevent') >= 0 || type.indexOf('recorrido') >= 0 || type.indexOf('inspection') >= 0) preventive++;
    });
    return { preventive: preventive, corrective: corrective, label: preventive + ' / ' + corrective };
  }

  function wireKpiDrilldowns(data) {
    var grid = document.getElementById('junta-kpis');
    if (!grid) return;
    grid.querySelectorAll('[data-junta-drill]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderJuntaDrill(data[this.getAttribute('data-junta-drill')]);
      });
    });
  }

  function renderJuntaDrill(cfg) {
    var box = document.getElementById('junta-kpi-detail');
    if (!box || !cfg) return;
    box.style.display = '';
    box.innerHTML = '<h3 class="section-title">Detalle: ' + window.UI.esc(cfg.title) + '</h3>' +
      '<p class="muted">Evidencia que alimenta el KPI seleccionado.</p>' +
      window.UI.table(cfg.rows || [], cfg.columns || [{ key: 'id', label: 'ID' }]);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function juntaKpiCard(metric) {
    var attr = metric.drillKey ? ' data-junta-drill="' + window.UI.esc(metric.drillKey) + '"' : '';
    return '<button type="button" class="kpi-card board-kpi-card junta-kpi-card" data-testid="junta-kpi-card"' + attr + '>' +
      '<div class="kpi-label">' + window.UI.esc(metric.label) + '</div>' +
      '<div class="kpi-value">' + window.UI.esc(metric.value) + '</div>' +
      '<div class="board-kpi-status board-kpi-status-' + statusClass(metric.status) + '">Estado: ' + window.UI.esc(metric.status) + '</div>' +
      '<div class="board-kpi-meta"><span>Responsable: ' + window.UI.esc(metric.owner) + '</span><span>Fuente: ' + window.UI.esc(metric.source) + '</span></div>' +
      '<div class="board-kpi-detail">Ver detalle · ' + window.UI.esc(metric.detail) + '</div>' +
    '</button>';
  }

  function statusClass(status) {
    var value = String(status || '').toLowerCase();
    if (value.indexOf('rojo') >= 0) return 'red';
    if (value.indexOf('amarillo') >= 0) return 'yellow';
    return 'green';
  }

  function decisionBox(text, kind) {
    return '<div class="junta-decision junta-decision-' + kind + '">' +
      '<span>Pr\u00f3xima decisi\u00f3n</span><strong>' + window.UI.esc(text) + '</strong></div>';
  }

  function severityKind(severity) {
    return severity === 'critical' || severity === 'high' ? 'danger' : (severity === 'medium' ? 'warning' : 'neutral');
  }

  function statusKind(status) {
    return status === 'resolved' || status === 'closed' || status === 'approved' ? 'success' : (status === 'open' || status === 'pending' ? 'warning' : 'info');
  }

  function parseJson(value) {
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value) || {}; } catch (e) { return {}; }
    }
    if (typeof value === 'object') return value;
    return {};
  }

  function latestHistory(incident) {
    var meta = parseJson(incident.metadata);
    var rows = Array.isArray(meta.incident_history) ? meta.incident_history : (Array.isArray(meta.history) ? meta.history : []);
    if (!rows.length) return null;
    return rows[rows.length - 1];
  }

  function closureSummary(incident) {
    var h = latestHistory(incident);
    if (!h) return '';
    var bits = [h.label || h.action || 'Movimiento'];
    if (h.note) bits.push(h.note);
    if (h.actor_label) bits.push('Por ' + h.actor_label);
    return bits.join(' · ');
  }

  function escalationContext(row, incidentById) {
    var payload = parseJson(row.payload);
    if (payload.source_context) return payload.source_context;
    if (payload.ticket_number) {
      return [payload.ticket_number, payload.category || '', payload.location_label || ''].filter(Boolean).join(' · ');
    }
    var incident = incidentById[row.source_id];
    if (incident) {
      return [incident.ticket_number, incident.category, incident.location_label].filter(Boolean).join(' · ');
    }
    return row.source_id || '';
  }

  window.ROUTER.register('junta', { render: render, requiredModule: 'junta' });
})();
