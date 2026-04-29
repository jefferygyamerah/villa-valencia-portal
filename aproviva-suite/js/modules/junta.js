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
        window.SB.select('weekly_reports', { select: '*', order: 'submitted_at.desc.nullslast', limit: '20' }),
        window.SB.select('work_assignments', { select: '*', order: 'created_at.desc', limit: '200' }),
        window.SB.select('compliance_cases', { select: '*', order: 'created_at.desc', limit: '50' }),
      ]);
      var buildings = results[0] || [];
      var esc = results[1] || [];
      var incidents = results[2] || [];
      var rounds = results[3] || [];
      var reports = results[4] || [];
      var wo = results[5] || [];
      var compliance = results[6] || [];

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

      box.innerHTML = '' +
        decisionBox(decisionText, decisionLevel) +
        '<div class="vv-privacy-card junta-privacy">' +
          '<div class="vv-eyebrow">Lectura segura</div>' +
          '<p>Esta pantalla resume estados operativos para Junta. No muestra datos de contacto, bancos, residentes ni detalles libres de casos.</p>' +
        '</div>' +
        '<div class="kpi-grid">' +
          kpi('Escalaciones abiertas', openEsc.length) +
          kpi('Altas / cr\u00edticas', criticalEsc.length) +
          kpi('Patrones cr\u00f3nicos', chronicPatterns.length) +
          kpi('\u00d3rdenes atrasadas', lateWO.length) +
          kpi('Casos compliance', compliance.length) +
          kpi('Edificios activos', buildings.filter(function (b) { return b.status === 'active'; }).length || buildings.length) +
        '</div>' +

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
            { key: 'source_type', label: 'Origen' },
            { key: 'created_at', label: 'Creado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
          ]) : '<p class="empty">Sin escalaciones cr\u00edticas/altas abiertas.</p>') +
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
    } catch (e) {
      window.UI.errorBox(box, e);
    }
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
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

  window.ROUTER.register('junta', { render: render, requiredModule: 'junta' });
})();
