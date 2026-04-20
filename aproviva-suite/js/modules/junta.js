/**
 * Junta Gobernanza - executive view: KPIs, escalations, chronic patterns.
 * Scenarios 16 (multi-location), 17 (oversight), 18 (governance escalation), 19 (chronic).
 */
(function () {
  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="junta-page">' +
        '<h2 class="page-title">Gobernanza &mdash; Junta</h2>' +
        '<p class="page-subtitle">Visi\u00f3n ejecutiva multi-edificio: KPIs, escalaciones, accountability.</p>' +
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

      var singleBuildingNote = buildings.length <= 1
        ? '<div class="page-section" style="padding:0.75rem 1rem;background:var(--surface-2,#f1f5f9);border-radius:var(--radius,12px);border:1px solid var(--border,#e2e8f0);margin-bottom:1rem;">' +
          '<strong>Multi-edificio (Sc. 16):</strong> en datos maestros hay <strong>' + buildings.length + '</strong> edificio(s). ' +
          'Cuando existan m\u00e1s filas en <code>buildings</code>, la tabla inferior mostrar\u00e1 comparaci\u00f3n real multi-sitio.</div>'
        : '';

      var complianceRows = compliance.slice(0, 25).map(function (c) {
        return {
          status: c.status || '\u2014',
          summary: c.title || c.summary || c.case_type || c.id || '\u2014',
          opened: c.created_at || c.opened_at || '',
        };
      });

      box.innerHTML = '' +
        singleBuildingNote +
        '<div class="kpi-grid">' +
          kpi('Edificios', buildings.length) +
          kpi('Escalaciones abiertas', openEsc.length) +
          kpi('Cr\u00edticas / altas', criticalEsc.length) +
          kpi('Patrones cr\u00f3nicos', chronicPatterns.length) +
          kpi('\u00d3rdenes atrasadas', lateWO.length) +
          kpi('Casos compliance', compliance.length) +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Desempe\u00f1o por edificio</h3>' +
          window.UI.table(Object.values(byBuilding), [
            { key: 'name', label: 'Edificio', render: function (r) { return r.building.name; } },
            { key: 'code', label: 'C\u00f3digo', render: function (r) { return r.building.code; } },
            { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.building.status, r.building.status === 'active' ? 'success' : 'neutral'); }, html: true },
            { key: 'openIncidents', label: 'Inc. abiertas' },
            { key: 'criticalIncidents', label: 'Inc. cr\u00edticas' },
          ]) +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Escalaciones cr\u00edticas / altas (Sc. 18)</h3>' +
          (criticalEsc.length ? window.UI.table(criticalEsc, [
            { key: 'severity', label: 'Sev', render: function (r) { return window.UI.badge(r.severity, 'danger'); }, html: true },
            { key: 'title', label: 'T\u00edtulo' },
            { key: 'source_type', label: 'Origen' },
            { key: 'created_at', label: 'Creado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
          ]) : '<p class="empty">Sin escalaciones cr\u00edticas/altas abiertas.</p>') +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Patrones cr\u00f3nicos detectados (Sc. 19)</h3>' +
          (chronicPatterns.length ? window.UI.table(chronicPatterns, [
            { key: 'pattern', label: 'Patr\u00f3n (ubicaci\u00f3n | categor\u00eda)' },
            { key: 'count', label: 'Repeticiones', render: function (r) { return window.UI.badge(r.count + '\u00d7', 'warning'); }, html: true },
          ]) : '<p class="empty">Sin patrones cr\u00f3nicos detectados (umbral: 3+ repeticiones).</p>') +
        '</div>' +

        '<div class="page-section"><h3 class="section-title">Compliance (lectura)</h3>' +
          '<p class="muted" style="margin:0 0 0.75rem;font-size:0.88rem;">Listado de filas en <code>compliance_cases</code>. Alta y cierre formal depender\u00e1n del flujo definido con gobierno.</p>' +
          (complianceRows.length
            ? window.UI.table(complianceRows, [
              { key: 'status', label: 'Estado' },
              { key: 'summary', label: 'Resumen / tipo' },
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
            { key: 'vendor_attendance_label', label: 'Vendor' },
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

  window.ROUTER.register('junta', { render: render, requiredModule: 'junta' });
})();
