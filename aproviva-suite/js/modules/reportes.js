/**
 * Reportes - daily, weekly, escalation summary, KPI export.
 * Scenarios 12, 13, 14, 15.
 */
(function () {
  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="reportes-page">' +
        '<h2 class="page-title">Reportes</h2>' +
        '<p class="page-subtitle">Resumen diario, semanal, escalaciones y exportaci\u00f3n de KPIs.</p>' +
        '<div class="row wrap" style="gap:0.5rem; margin-top:0.85rem;">' +
          '<button class="btn btn-primary-sm" id="rp-daily">Resumen diario</button>' +
          '<button class="btn btn-primary-sm" id="rp-weekly">Reporte semanal</button>' +
          '<button class="btn btn-primary-sm" id="rp-esc">Resumen escalaciones</button>' +
          '<button class="btn btn-primary-sm" id="rp-kpi">KPI export (CSV)</button>' +
          '<button class="btn btn-ghost" id="rp-print">Imprimir</button>' +
        '</div>' +
        '<div id="rp-output" class="page-section"><p class="muted">Selecciona un reporte arriba.</p></div>' +
      '</section>';

    document.getElementById('rp-daily').addEventListener('click', renderDaily);
    document.getElementById('rp-weekly').addEventListener('click', renderWeekly);
    document.getElementById('rp-esc').addEventListener('click', renderEscalations);
    document.getElementById('rp-kpi').addEventListener('click', exportKpi);
    document.getElementById('rp-print').addEventListener('click', function () { window.print(); });
  }

  async function fetchAll() {
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    return Promise.all([
      window.SB.select('inspection_rounds', { select: '*', order: 'created_at.desc', limit: '200' }),
      window.SB.select('inspection_findings', { select: '*', order: 'created_at.desc', limit: '200' }),
      window.SB.select('incident_tickets', { select: '*', building_id: 'eq.' + bid, order: 'created_at.desc', limit: '200' }),
      window.SB.select('inventory_movements', { select: '*', order: 'movement_at.desc', limit: '200' }),
      window.SB.select('inventory_items', { select: '*', is_active: 'eq.true', limit: '200' }),
      window.SB.select('escalation_events', { select: '*', order: 'created_at.desc', limit: '100' }),
      window.SB.select('work_assignments', { select: '*', order: 'created_at.desc', limit: '100' }),
    ]);
  }

  function inWindow(iso, ms) {
    if (!iso) return false;
    return Date.now() - new Date(iso).getTime() <= ms;
  }

  async function renderDaily() {
    var box = document.getElementById('rp-output');
    window.UI.loading(box, 'Generando resumen diario...');
    try {
      var results = await fetchAll();
      var rounds = results[0], findings = results[1], incidents = results[2], moves = results[3], items = results[4], esc = results[5];

      var DAY = 24 * 3600 * 1000;
      var roundsToday = rounds.filter(function (r) { return inWindow(r.completed_at, DAY); });
      var roundsMissed = rounds.filter(function (r) { return r.scheduled_for && new Date(r.scheduled_for).getTime() < Date.now() - DAY && r.status !== 'completed' && r.status !== 'closed'; });
      var newIncidents = incidents.filter(function (r) { return inWindow(r.created_at, DAY); });
      var openCritical = incidents.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed' && (r.severity === 'critical' || r.severity === 'high'); });
      var countsToday = moves.filter(function (m) { return inWindow(m.movement_at, DAY) && m.movement_type === 'counted'; });
      var newEsc = esc.filter(function (r) { return inWindow(r.created_at, DAY); });

      box.innerHTML = '' +
        '<h3 class="section-title">Resumen diario &mdash; ' + window.UI.fmtDate(new Date().toISOString(), { dateOnly: true }) + '</h3>' +
        '<div class="kpi-grid">' +
          kpi('Recorridos completados (24h)', roundsToday.length) +
          kpi('Recorridos atrasados', roundsMissed.length) +
          kpi('Incidentes nuevos (24h)', newIncidents.length) +
          kpi('Cr\u00edticos / altos abiertos', openCritical.length) +
          kpi(
            'Conteos (24h)',
            countsToday.length,
            'Solo movimientos inventory con tipo conteo (counted) en las \u00faltimas 24 horas.'
          ) +
          kpi('Escalaciones nuevas', newEsc.length) +
        '</div>' +
        '<div class="page-section"><h4>Incidentes cr\u00edticos abiertos</h4>' + window.UI.table(openCritical.slice(0, 10), [
          { key: 'ticket_number', label: '#' },
          { key: 'title', label: 'T\u00edtulo' },
          { key: 'severity', label: 'Sev' },
          { key: 'status', label: 'Estado' },
          { key: 'created_at', label: 'Reportado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
        ]) + '</div>' +
        '<div class="page-section"><h4>Recorridos atrasados</h4>' + window.UI.table(roundsMissed.slice(0, 10), [
          { key: 'round_number', label: '#' },
          { key: 'title', label: 'T\u00edtulo' },
          { key: 'scheduled_for', label: 'Programado', render: function (r) { return window.UI.fmtDate(r.scheduled_for); } },
        ]) + '</div>';
    } catch (e) {
      window.UI.errorBox(box, e);
    }
  }

  async function renderWeekly() {
    var box = document.getElementById('rp-output');
    window.UI.loading(box, 'Generando reporte semanal...');
    try {
      var results = await fetchAll();
      var rounds = results[0], incidents = results[2], moves = results[3], esc = results[5];

      var WEEK = 7 * 24 * 3600 * 1000;
      var roundsCompleted = rounds.filter(function (r) { return inWindow(r.completed_at, WEEK); });
      var roundsScheduled = rounds.filter(function (r) { return r.scheduled_for && inWindow(r.scheduled_for, WEEK); });
      var compliance = roundsScheduled.length ? Math.round(100 * roundsCompleted.length / roundsScheduled.length) : 100;
      var incidentsWeek = incidents.filter(function (r) { return inWindow(r.created_at, WEEK); });
      var resolvedWeek = incidents.filter(function (r) { return inWindow(r.resolved_at, WEEK); });
      var byCategory = {};
      incidentsWeek.forEach(function (i) { byCategory[i.category || 'Sin categor\u00eda'] = (byCategory[i.category || 'Sin categor\u00eda'] || 0) + 1; });
      var escWeek = esc.filter(function (r) { return inWindow(r.created_at, WEEK); });

      box.innerHTML = '' +
        '<h3 class="section-title">Reporte semanal de desempe\u00f1o</h3>' +
        '<p class="muted">Periodo: \u00faltimos 7 d\u00edas</p>' +
        '<div class="kpi-grid">' +
          kpi('Cumplimiento recorridos', compliance + '%') +
          kpi('Recorridos completados', roundsCompleted.length) +
          kpi('Incidentes nuevos', incidentsWeek.length) +
          kpi('Incidentes resueltos', resolvedWeek.length) +
          kpi('Escalaciones', escWeek.length) +
        '</div>' +
        '<div class="page-section"><h4>Incidentes por categor\u00eda</h4>' +
          window.UI.table(Object.keys(byCategory).map(function (k) { return { categoria: k, total: byCategory[k] }; }), [
            { key: 'categoria', label: 'Categor\u00eda' },
            { key: 'total', label: 'Total' },
          ]) + '</div>' +
        '<div class="page-section"><h4>Recomendaciones autom\u00e1ticas</h4>' +
          '<ul>' +
            (compliance < 80 ? '<li>Cumplimiento de recorridos por debajo del 80%. Revisar asignaciones y disponibilidad.</li>' : '') +
            (escWeek.length > 5 ? '<li>Volumen elevado de escalaciones (' + escWeek.length + '). Revisar causas ra\u00edz.</li>' : '') +
            (incidentsWeek.length - resolvedWeek.length > 10 ? '<li>Backlog de incidentes creciendo. Reasignar recursos.</li>' : '') +
            '<li>Revisar art\u00edculos sin conteo reciente en Inventario.</li>' +
          '</ul></div>';
    } catch (e) {
      window.UI.errorBox(box, e);
    }
  }

  async function renderEscalations() {
    var box = document.getElementById('rp-output');
    window.UI.loading(box, 'Generando resumen de escalaciones...');
    try {
      var rows = await window.SB.select('escalation_events', { select: '*', order: 'created_at.desc', limit: '50' });
      var open = rows.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed'; });
      var critical = open.filter(function (r) { return r.severity === 'critical' || r.severity === 'high'; });

      box.innerHTML = '' +
        '<h3 class="section-title">Resumen de escalaciones</h3>' +
        '<div class="kpi-grid">' +
          kpi('Total', rows.length) +
          kpi('Abiertas', open.length) +
          kpi('Cr\u00edticas/Altas abiertas', critical.length) +
        '</div>' +
        '<div class="page-section"><h4>Escalaciones cr\u00edticas / altas abiertas</h4>' + window.UI.table(critical, [
          { key: 'severity', label: 'Sev' },
          { key: 'title', label: 'T\u00edtulo' },
          { key: 'source_type', label: 'Origen' },
          { key: 'created_at', label: 'Creado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
          { key: 'details', label: 'Detalle' },
        ]) + '</div>' +
        '<div class="page-section"><h4>Todas las escalaciones recientes</h4>' + window.UI.table(rows.slice(0, 25), [
          { key: 'severity', label: 'Sev' },
          { key: 'status', label: 'Estado' },
          { key: 'title', label: 'T\u00edtulo' },
          { key: 'source_type', label: 'Origen' },
          { key: 'created_at', label: 'Fecha', render: function (r) { return window.UI.fmtDate(r.created_at); } },
        ]) + '</div>';
    } catch (e) { window.UI.errorBox(box, e); }
  }

  async function exportKpi() {
    var box = document.getElementById('rp-output');
    window.UI.loading(box, 'Generando export...');
    try {
      var results = await fetchAll();
      var rounds = results[0], findings = results[1], incidents = results[2], moves = results[3], items = results[4], esc = results[5], wo = results[6];
      var lines = [];
      lines.push('metric,value');
      lines.push('articulos_activos,' + items.length);
      lines.push('movimientos_recientes,' + moves.length);
      lines.push('recorridos_total,' + rounds.length);
      lines.push('recorridos_abiertos,' + rounds.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; }).length);
      lines.push('hallazgos_total,' + findings.length);
      lines.push('hallazgos_abiertos,' + findings.filter(function (f) { return f.status !== 'resolved' && f.status !== 'closed'; }).length);
      lines.push('incidentes_total,' + incidents.length);
      lines.push('incidentes_abiertos,' + incidents.filter(function (i) { return i.status !== 'resolved' && i.status !== 'closed'; }).length);
      lines.push('incidentes_criticos_abiertos,' + incidents.filter(function (i) { return i.status !== 'resolved' && i.status !== 'closed' && (i.severity === 'critical' || i.severity === 'high'); }).length);
      lines.push('escalaciones_total,' + esc.length);
      lines.push('escalaciones_abiertas,' + esc.filter(function (r) { return r.status !== 'resolved' && r.status !== 'closed'; }).length);
      lines.push('ordenes_total,' + wo.length);
      lines.push('ordenes_abiertas,' + wo.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; }).length);
      lines.push('ordenes_atrasadas,' + wo.filter(function (r) { return r.due_at && new Date(r.due_at).getTime() < Date.now() && r.status !== 'completed' && r.status !== 'closed'; }).length);

      var csv = lines.join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = 'aproviva-kpi-' + stamp + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      box.innerHTML = '<p class="empty">Export descargado: aproviva-kpi-' + stamp + '.csv</p><pre style="background:#f1f5f9;padding:0.85rem;border-radius:8px;font-size:0.85rem;">' + window.UI.esc(csv) + '</pre>';
    } catch (e) { window.UI.errorBox(box, e); }
  }

  function kpi(label, value, title) {
    var tip = title ? ' title="' + window.UI.esc(title) + '"' : '';
    return '<div class="kpi-card"' + tip + '><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.ROUTER.register('reportes', { render: render, requiredModule: 'reportes' });
})();
