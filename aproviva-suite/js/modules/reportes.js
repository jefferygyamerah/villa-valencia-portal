/**
 * Reportes - daily, weekly, escalation summary, KPI export.
 * Scenarios 12, 13, 14, 15.
 */
(function () {
  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="reportes-page">' +
        '<h2 class="page-title">Reportes</h2>' +
        '<p class="page-subtitle">Lectura ejecutiva de operaci\u00f3n sin datos personales: qu\u00e9 est\u00e1 pendiente, qu\u00e9 requiere decisi\u00f3n y qu\u00e9 se puede compartir.</p>' +
        '<div class="rp-action-bar" aria-label="Tipos de reporte">' +
          '<button class="btn btn-primary-sm" id="rp-daily">Resumen diario</button>' +
          '<button class="btn btn-ghost" id="rp-weekly">Semanal</button>' +
          '<button class="btn btn-ghost" id="rp-esc">Escalaciones</button>' +
          '<button class="btn btn-ghost" id="rp-kpi">Exportar KPIs</button>' +
          '<button class="btn btn-ghost" id="rp-board">Paquete Junta</button>' +
          '<button class="btn btn-ghost" id="rp-print">Imprimir</button>' +
        '</div>' +
        '<div class="vv-privacy-card rp-privacy">' +
          '<div class="vv-eyebrow">Privacidad</div>' +
          '<p>Los reportes muestran conteos, estados y categor\u00edas operativas. Evitan contactos, residentes, cuentas, bancos y notas libres sensibles.</p>' +
        '</div>' +
        '<div id="rp-output" class="page-section"><p class="empty">Selecciona un reporte para ver el siguiente paso.</p></div>' +
      '</section>';

    document.getElementById('rp-daily').addEventListener('click', renderDaily);
    document.getElementById('rp-weekly').addEventListener('click', renderWeekly);
    document.getElementById('rp-esc').addEventListener('click', renderEscalations);
    document.getElementById('rp-kpi').addEventListener('click', exportKpi);
    document.getElementById('rp-board').addEventListener('click', renderBoardPacket);
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
      var nextStep = openCritical.length
        ? 'Atender incidentes cr\u00edticos/altos abiertos antes de distribuir el cierre diario.'
        : (roundsMissed.length ? 'Reprogramar recorridos atrasados y confirmar responsable.' : 'Compartir cierre diario; no hay bloqueos cr\u00edticos visibles.');

      box.innerHTML = '' +
        '<h3 class="section-title">Resumen diario &mdash; ' + window.UI.fmtDate(new Date().toISOString(), { dateOnly: true }) + '</h3>' +
        decisionBox(nextStep, openCritical.length ? 'danger' : (roundsMissed.length ? 'warning' : 'success')) +
        '<div class="kpi-grid">' +
          kpi('Recorridos 24h', roundsToday.length) +
          kpi('Recorridos atrasados', roundsMissed.length) +
          kpi('Incidentes 24h', newIncidents.length) +
          kpi('Altos abiertos', openCritical.length) +
          kpi(
            'Conteos 24h',
            countsToday.length,
            'Solo movimientos inventory con tipo conteo (counted) en las \u00faltimas 24 horas.'
          ) +
          kpi('Escalaciones 24h', newEsc.length) +
        '</div>' +
        '<div class="page-section"><h4 class="section-title">Excepciones que bloquean cierre</h4>' + window.UI.table(openCritical.slice(0, 8), [
          { key: 'ticket_number', label: '#' },
          { key: 'title', label: 'Caso' },
          { key: 'severity', label: 'Nivel', render: function (r) { return window.UI.badge(r.severity, severityKind(r.severity)); }, html: true },
          { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusKind(r.status)); }, html: true },
          { key: 'created_at', label: 'Fecha', render: function (r) { return window.UI.fmtDate(r.created_at); } },
        ]) + '</div>' +
        '<div class="page-section"><h4 class="section-title">Recorridos por recuperar</h4>' + window.UI.table(roundsMissed.slice(0, 8), [
          { key: 'round_number', label: '#' },
          { key: 'title', label: 'Recorrido' },
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
      var backlogDelta = incidentsWeek.length - resolvedWeek.length;
      var nextStep = compliance < 80
        ? 'Priorizar cobertura de recorridos; cumplimiento semanal bajo 80%.'
        : (backlogDelta > 10 ? 'Reasignar atenci\u00f3n a incidentes; el backlog creci\u00f3 esta semana.' : 'Listo para revisi\u00f3n semanal de Junta.');

      box.innerHTML = '' +
        '<h3 class="section-title">Reporte semanal de desempe\u00f1o</h3>' +
        '<p class="muted">Periodo: \u00faltimos 7 d\u00edas</p>' +
        decisionBox(nextStep, compliance < 80 || backlogDelta > 10 ? 'warning' : 'success') +
        '<div class="kpi-grid">' +
          kpi('Cumplimiento recorridos', compliance + '%') +
          kpi('Recorridos completados', roundsCompleted.length) +
          kpi('Incidentes nuevos', incidentsWeek.length) +
          kpi('Incidentes resueltos', resolvedWeek.length) +
          kpi('Escalaciones', escWeek.length) +
        '</div>' +
        '<div class="page-section"><h4 class="section-title">Incidentes por categor\u00eda</h4>' +
          window.UI.table(Object.keys(byCategory).map(function (k) { return { categoria: k, total: byCategory[k] }; }), [
            { key: 'categoria', label: 'Categor\u00eda' },
            { key: 'total', label: 'Total' },
          ]) + '</div>' +
        '<div class="page-section"><h4 class="section-title">Acciones sugeridas</h4>' +
          '<p class="muted">Fuente: reglas visibles sobre cumplimiento de recorridos, escalaciones, crecimiento de backlog e inventario sin conteo reciente.</p>' +
          '<div class="rp-next-list">' +
            actionItem(compliance < 80, 'Revisar asignaciones de recorridos y disponibilidad de personal.') +
            actionItem(escWeek.length > 5, 'Revisar causas ra\u00edz de escalaciones recurrentes.') +
            actionItem(backlogDelta > 10, 'Reasignar recursos a incidentes abiertos.') +
            actionItem(true, 'Validar art\u00edculos sin conteo reciente en Inventario.') +
          '</div></div>';
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
      var nextStep = critical.length
        ? 'Asignar due\u00f1o y fecha de decisi\u00f3n para escalaciones cr\u00edticas/altas.'
        : 'Monitorear escalaciones abiertas; no hay cr\u00edticas/altas pendientes.';

      box.innerHTML = '' +
        '<h3 class="section-title">Resumen de escalaciones</h3>' +
        decisionBox(nextStep, critical.length ? 'danger' : (open.length ? 'warning' : 'success')) +
        '<div class="kpi-grid">' +
          kpi('Recientes', rows.length) +
          kpi('Abiertas', open.length) +
          kpi('Altas abiertas', critical.length) +
        '</div>' +
        '<div class="page-section"><h4 class="section-title">Para decisi\u00f3n</h4>' + window.UI.table(critical.slice(0, 10), [
          { key: 'severity', label: 'Nivel', render: function (r) { return window.UI.badge(r.severity, severityKind(r.severity)); }, html: true },
          { key: 'title', label: 'Caso' },
          { key: 'context', label: 'Contexto', render: escalationContext },
          { key: 'source_type', label: 'Origen' },
          { key: 'created_at', label: 'Creado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
        ]) + '</div>' +
        '<div class="page-section"><h4 class="section-title">Bit\u00e1cora reciente</h4>' + window.UI.table(rows.slice(0, 15), [
          { key: 'severity', label: 'Nivel', render: function (r) { return window.UI.badge(r.severity, severityKind(r.severity)); }, html: true },
          { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusKind(r.status)); }, html: true },
          { key: 'title', label: 'Caso' },
          { key: 'context', label: 'Contexto', render: escalationContext },
          { key: 'source_type', label: 'Origen' },
          { key: 'created_at', label: 'Fecha', render: function (r) { return window.UI.fmtDate(r.created_at); } },
        ]) + '</div>';
    } catch (e) { window.UI.errorBox(box, e); }
  }



  async function renderBoardPacket() {
    var box = document.getElementById('rp-output');
    window.UI.loading(box, 'Preparando paquete de Junta...');
    try {
      var results = await fetchAll();
      var rounds = results[0], findings = results[1], incidents = results[2], moves = results[3], items = results[4], esc = results[5], wo = results[6];
      var now = new Date();
      var WEEK = 7 * 24 * 3600 * 1000;
      var openIncidents = incidents.filter(isOpen);
      var criticalIncidents = openIncidents.filter(function (i) { return i.severity === 'critical' || i.severity === 'high'; });
      var openFindings = findings.filter(isOpen);
      var openEsc = esc.filter(isOpen);
      var criticalEsc = openEsc.filter(function (r) { return r.severity === 'critical' || r.severity === 'high'; });
      var openWO = wo.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled'; });
      var lateWO = openWO.filter(function (r) { return r.due_at && new Date(r.due_at).getTime() < Date.now(); });
      var roundsCompleted = rounds.filter(function (r) { return inWindow(r.completed_at, WEEK); });
      var roundsScheduled = rounds.filter(function (r) { return r.scheduled_for && inWindow(r.scheduled_for, WEEK); });
      var compliance = roundsScheduled.length ? Math.round(100 * roundsCompleted.length / roundsScheduled.length) : 100;
      var stockRisk = items.filter(function (item) {
        var min = Number(item.reorder_point || item.min_quantity || 0);
        var qty = Number(item.current_quantity || item.quantity_on_hand || item.quantity || 0);
        return min > 0 && qty <= min;
      });
      var capital = wo.filter(function (r) { return isCapitalProject(r); });
      var operations = wo.filter(function (r) { return !isCapitalProject(r); });
      var chronic = chronicPatterns(incidents);
      var age = ageBuckets(openWO);
      var decisions = [];
      if (criticalEsc.length) decisions.push('Asignar dueño y fecha de decisión para escalaciones altas/críticas.');
      if (lateWO.length) decisions.push('Confirmar plan de recuperación para órdenes vencidas.');
      if (stockRisk.length) decisions.push('Aprobar reposición de insumos bajo punto de reorden.');
      if (capital.length) decisions.push('Revisar avance/RAG de proyectos capitales y próxima aprobación.');
      if (!decisions.length) decisions.push('Sin decisión crítica visible; revisar tablero y aprobar acta operativa.');
      var risks = [];
      if (criticalIncidents.length) risks.push(criticalIncidents.length + ' incidentes altos/críticos abiertos');
      if (openFindings.length) risks.push(openFindings.length + ' hallazgos abiertos');
      if (compliance < 80) risks.push('cumplimiento de recorridos bajo 80%');
      if (chronic.length) risks.push(chronic.length + ' patrón(es) repetidos');
      if (!risks.length) risks.push('sin riesgo operativo mayor en datos visibles');

      box.innerHTML = '' +
        '<article class="board-packet" data-testid="board-packet">' +
          '<div class="board-cover">' +
            '<div><div class="vv-eyebrow">APROVIVA · Villa Valencia</div>' +
            '<h3>Paquete ejecutivo para Junta</h3>' +
            '<p>Periodo de lectura: últimos 7 días · Preparado: ' + window.UI.esc(window.UI.fmtDate(now.toISOString())) + '</p></div>' +
            '<button class="btn btn-primary-sm no-print" type="button" id="rp-board-print">Imprimir / guardar PDF</button>' +
          '</div>' +
          '<div class="board-privacy">No incluye datos personales, bancos, contactos de residentes ni notas libres sensibles. Fuente: tablas operativas APROVIVA.</div>' +
          '<section class="board-section"><h4>1. Decisiones requeridas</h4>' + list(decisions) + '</section>' +
          '<section class="board-section"><h4>2. Riesgos ejecutivos</h4>' + list(risks) + '</section>' +
          '<section class="board-section"><h4>3. Scorecard de gobernanza</h4><div class="kpi-grid board-kpis">' +
            kpi('Escalaciones abiertas', openEsc.length) +
            kpi('Altas / críticas', criticalEsc.length + criticalIncidents.length) +
            kpi('Backlog abierto', openWO.length) +
            kpi('Órdenes vencidas', lateWO.length) +
            kpi('Cumplimiento recorridos', compliance + '%') +
            kpi('Stock en riesgo', stockRisk.length) +
          '</div></section>' +
          '<section class="board-section"><h4>4. Ejecución operativa</h4>' +
            window.UI.table([
              { metric: 'Recorridos completados', value: roundsCompleted.length, note: 'Últimos 7 días' },
              { metric: 'Hallazgos abiertos', value: openFindings.length, note: 'Pendientes de cierre' },
              { metric: 'Incidentes abiertos', value: openIncidents.length, note: 'No resueltos/cerrados' },
              { metric: 'Patrones repetidos', value: chronic.length, note: '3+ por ubicación/categoría' },
            ], [
              { key: 'metric', label: 'Métrica' }, { key: 'value', label: 'Valor' }, { key: 'note', label: 'Lectura' }
            ]) + '</section>' +
          '<section class="board-section"><h4>5. Backlog y edad</h4>' +
            window.UI.table([
              { bucket: '0–7 días', total: age.fresh },
              { bucket: '8–30 días', total: age.mid },
              { bucket: '31+ días', total: age.old },
            ], [{ key: 'bucket', label: 'Edad' }, { key: 'total', label: 'Órdenes abiertas' }]) +
            '<h5>Trabajos vencidos / prioritarios</h5>' + window.UI.table(lateWO.slice(0, 8), [
              { key: 'assignment_number', label: '#' },
              { key: 'title', label: 'Trabajo' },
              { key: 'priority', label: 'Prioridad' },
              { key: 'due_at', label: 'Vence', render: function (r) { return window.UI.fmtDate(r.due_at); } },
            ]) + '</section>' +
          '<section class="board-section"><h4>6. Inventario y suministros</h4>' +
            window.UI.table(stockRisk.slice(0, 8), [
              { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Artículo' },
              { key: 'current_quantity', label: 'Cantidad' }, { key: 'reorder_point', label: 'Reorden' },
            ]) + '</section>' +
          '<section class="board-section"><h4>7. Proyectos capitales</h4>' +
            (capital.length ? window.UI.table(capital.slice(0, 10), [
              { key: 'assignment_number', label: '#' },
              { key: 'title', label: 'Proyecto' },
              { key: 'priority', label: 'Prioridad' },
              { key: 'status', label: 'Estado' },
              { key: 'due_at', label: 'Próximo hito', render: function (r) { return r.due_at ? window.UI.fmtDate(r.due_at) : ''; } },
            ]) : '<p class="empty">Sin proyectos capitales en datos semilla actuales.</p>') + '</section>' +
          '<section class="board-section"><h4>8. Apéndice de evidencia</h4>' +
            '<p class="muted">Las tablas anteriores salen de recorridos, hallazgos, incidencias, inventario, escalaciones y asignaciones. Use los drill-downs de Inicio/Junta para inspeccionar cada KPI antes de emitir acta.</p>' +
            '<p class="muted">Backlog operativo visible: ' + operations.length + ' filas · movimientos inventario recientes: ' + moves.length + '.</p>' +
          '</section>' +
        '</article>';
      document.getElementById('rp-board-print').addEventListener('click', function () { window.print(); });
    } catch (e) {
      window.UI.errorBox(box, e);
    }
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



  function isOpen(row) {
    return row && row.status !== 'resolved' && row.status !== 'closed' && row.status !== 'completed' && row.status !== 'cancelled';
  }

  function isCapitalProject(row) {
    var meta = parseJson(row.metadata);
    var type = String(row.task_type || row.work_type || meta.task_type || '').toLowerCase();
    return meta.capital_project === true || meta.capital_project === 'true' || type.indexOf('capital') >= 0 || type.indexOf('project') >= 0 || type.indexOf('proyecto') >= 0;
  }

  function ageBuckets(rows) {
    var out = { fresh: 0, mid: 0, old: 0 };
    rows.forEach(function (r) {
      var created = new Date(r.created_at || r.assigned_at || Date.now()).getTime();
      var days = Math.max(0, Math.floor((Date.now() - created) / (24 * 3600 * 1000)));
      if (days <= 7) out.fresh++;
      else if (days <= 30) out.mid++;
      else out.old++;
    });
    return out;
  }

  function chronicPatterns(incidents) {
    var titleCount = {};
    incidents.forEach(function (i) {
      var key = (i.location_label || 'Sin ubicación') + ' | ' + (i.category || 'Sin categoría');
      titleCount[key] = (titleCount[key] || 0) + 1;
    });
    return Object.keys(titleCount).map(function (k) { return { pattern: k, count: titleCount[k] }; }).filter(function (r) { return r.count >= 3; });
  }

  function list(items) {
    return '<ul class="board-list">' + items.map(function (item) { return '<li>' + window.UI.esc(item) + '</li>'; }).join('') + '</ul>';
  }

  function kpi(label, value, title) {
    var tip = title ? ' title="' + window.UI.esc(title) + '"' : '';
    return '<div class="kpi-card"' + tip + '><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  function decisionBox(text, kind) {
    return '<div class="rp-decision rp-decision-' + kind + '">' +
      '<span>Siguiente paso</span><strong>' + window.UI.esc(text) + '</strong>' +
      '<small>Calculado con conteos operativos, vencimientos y severidad; no usa datos personales.</small></div>';
  }

  function actionItem(active, text) {
    return '<div class="rp-next-item' + (active ? ' is-active' : '') + '">' +
      window.UI.badge(active ? 'Revisar' : 'Rutina', active ? 'warning' : 'neutral') +
      '<span>' + window.UI.esc(text) + '</span></div>';
  }

  function severityKind(severity) {
    return severity === 'critical' || severity === 'high' ? 'danger' : (severity === 'medium' ? 'warning' : 'neutral');
  }

  function statusKind(status) {
    return status === 'resolved' || status === 'closed' || status === 'completed' ? 'success' : (status === 'open' || status === 'pending' ? 'warning' : 'info');
  }

  function parseJson(value) {
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value) || {}; } catch (e) { return {}; }
    }
    if (typeof value === 'object') return value;
    return {};
  }

  function escalationContext(row) {
    var payload = parseJson(row.payload);
    if (payload.source_context) return payload.source_context;
    if (payload.ticket_number) {
      return [payload.ticket_number, payload.category || '', payload.location_label || ''].filter(Boolean).join(' · ');
    }
    return row.source_id || '';
  }

  window.ROUTER.register('reportes', { render: render, requiredModule: 'reportes' });
})();
