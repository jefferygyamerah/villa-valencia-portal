/**
 * APROVIVA Portal – Main page logic
 */
(function () {
  'use strict';

  var config = window.APROVIVA_CONFIG;

  function isScriptConfigured() {
    return config.APPS_SCRIPT_URL &&
      config.APPS_SCRIPT_URL.indexOf('YOUR_') === -1;
  }

  // ── Drive links ──
  function populateDriveLinks() {
    var links = config.DRIVE_LINKS;
    var els = document.querySelectorAll('[data-drive]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-drive');
      if (links[key] && links[key].indexOf('YOUR_') === -1) {
        els[i].href = links[key];
        els[i].target = '_blank';
        els[i].rel = 'noopener';
      } else {
        els[i].removeAttribute('href');
        els[i].style.opacity = '0.5';
        els[i].title = 'Enlace pendiente de configurar';
      }
    }
  }

  // ── PQRS Modal ──
  function openPqrs() {
    document.getElementById('pqrsModal').classList.add('open');
  }

  function closePqrs() {
    document.getElementById('pqrsModal').classList.remove('open');
    document.getElementById('pqrsForm').style.display = '';
    document.getElementById('pqrsSuccess').classList.remove('show');
    var fields = ['pqrs-resumen', 'pqrs-descripcion', 'pqrs-tipo',
                  'pqrs-ubicacion', 'pqrs-urgencia', 'pqrs-casa'];
    for (var i = 0; i < fields.length; i++) {
      var el = document.getElementById(fields[i]);
      if (el) el.value = '';
    }
  }

  function submitPqrs() {
    var resumen = document.getElementById('pqrs-resumen').value.trim();
    var descripcion = document.getElementById('pqrs-descripcion').value.trim();
    var tipo = document.getElementById('pqrs-tipo').value;
    var ubicacion = document.getElementById('pqrs-ubicacion').value;
    var urgencia = document.getElementById('pqrs-urgencia').value;
    var casa = document.getElementById('pqrs-casa').value.trim();

    if (!descripcion || !tipo || !ubicacion || !casa) {
      alert('Por favor completa los campos obligatorios (*).');
      return;
    }

    var btn = document.querySelector('#pqrsForm .btn-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    if (!isScriptConfigured()) {
      showPqrsSuccess();
      return;
    }

    var payload = {
      resumen: resumen,
      descripcion: descripcion,
      tipo: tipo,
      ubicacion: ubicacion,
      urgencia: urgencia,
      casa: casa
    };

    fetch(config.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    }).then(function () {
      showPqrsSuccess();
      loadDashboard();
    }).catch(function () {
      showPqrsSuccess();
    });
  }

  function showPqrsSuccess() {
    document.getElementById('pqrsForm').style.display = 'none';
    document.getElementById('pqrsSuccess').classList.add('show');
    var btn = document.querySelector('#pqrsForm .btn-submit');
    btn.disabled = false;
    btn.textContent = 'Enviar reporte \u2192';
  }

  function setupPqrsBackdrop() {
    var modal = document.getElementById('pqrsModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closePqrs();
      });
    }
  }

  // ── Dashboard ──
  function loadDashboard() {
    var loading = document.getElementById('dashLoading');
    var content = document.getElementById('dashContent');
    var error = document.getElementById('dashError');

    if (!loading) return;

    if (!isScriptConfigured()) {
      loading.style.display = 'none';
      error.style.display = 'block';
      error.textContent = 'Configura APPS_SCRIPT_URL en js/config.js para ver el dashboard.';
      return;
    }

    fetch(config.APPS_SCRIPT_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        loading.style.display = 'none';
        content.style.display = '';
        renderDashboard(data.rows || []);
      })
      .catch(function () {
        loading.style.display = 'none';
        error.style.display = 'block';
      });
  }

  function renderDashboard(rows) {
    // KPIs
    var total = rows.length;
    var alta = 0, media = 0, baja = 0;
    var tipoCounts = {};
    var ubicacionCounts = {};

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var urg = (r.urgencia || '').toLowerCase();
      if (urg === 'alta') alta++;
      else if (urg === 'media') media++;
      else if (urg === 'baja') baja++;

      var t = r.tipo || 'Sin tipo';
      tipoCounts[t] = (tipoCounts[t] || 0) + 1;

      var u = r.ubicacion || 'Sin ubicación';
      ubicacionCounts[u] = (ubicacionCounts[u] || 0) + 1;
    }

    setText('kpi-total', total);
    setText('kpi-alta', alta);
    setText('kpi-media', media);
    setText('kpi-baja', baja);

    renderBarChart('chart-tipo', tipoCounts, total);
    renderBarChart('chart-ubicacion', ubicacionCounts, total);
    renderRecent(rows);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderBarChart(containerId, counts, total) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var sorted = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });

    var max = sorted.length ? counts[sorted[0]] : 1;
    var html = '';

    for (var i = 0; i < sorted.length; i++) {
      var label = sorted[i];
      var count = counts[label];
      var pct = Math.round((count / max) * 100);
      html += '<div class="dash-bar-row">' +
        '<div class="dash-bar-label">' + escapeHtml(label) + '</div>' +
        '<div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="dash-bar-count">' + count + '</div>' +
        '</div>';
    }

    el.innerHTML = html || '<div style="font-size:0.8rem;color:var(--text-light)">Sin datos</div>';
  }

  function renderRecent(rows) {
    var el = document.getElementById('dash-recent');
    if (!el) return;

    var recent = rows.slice(-10).reverse();
    var html = '';

    for (var i = 0; i < recent.length; i++) {
      var r = recent[i];
      var date = r.timestamp ? formatDate(r.timestamp) : '';
      var urg = (r.urgencia || '').toLowerCase();
      var urgClass = urg === 'alta' ? 'dash-urg-alta' :
                     urg === 'media' ? 'dash-urg-media' :
                     urg === 'baja' ? 'dash-urg-baja' : '';
      var desc = r.resumen || r.descripcion || 'Sin descripción';

      html += '<div class="dash-recent-row">' +
        '<div class="dash-recent-date">' + escapeHtml(date) + '</div>' +
        '<div class="dash-recent-tipo">' + escapeHtml(r.tipo || '') + '</div>' +
        '<div class="dash-recent-desc">' + escapeHtml(desc) + '</div>' +
        (urgClass ? '<div class="dash-recent-urgencia ' + urgClass + '">' + escapeHtml(r.urgencia) + '</div>' : '') +
        '</div>';
    }

    el.innerHTML = html || '<div style="font-size:0.8rem;color:var(--text-light);padding:1rem 0">Sin reportes a&uacute;n</div>';
  }

  function formatDate(ts) {
    try {
      var d = new Date(ts);
      var day = d.getDate();
      var months = ['ene','feb','mar','abr','may','jun',
                    'jul','ago','sep','oct','nov','dic'];
      return day + ' ' + months[d.getMonth()];
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Budget Dashboard ──
  var budgetData = [];
  var ejecucionData = [];
  var budgetMeta = {};
  var selectedMonth = 0;

  var CAT_COLORS = {
    'Servicios B\u00e1sicos': '#1A6BB8',
    'Gastos de Funcionamiento': '#F5C842',
    'Mantenimientos Preventivos': '#16a34a',
    'Mantenimientos Correctivos': '#d97706',
    'Otros Gastos': '#8b5cf6',
    'Gastos de Personal': '#ec4899'
  };
  var MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun',
                     'Jul','Ago','Sep','Oct','Nov','Dic'];
  var MONTH_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var CAT_ORDER = ['Servicios B\u00e1sicos', 'Gastos de Funcionamiento',
    'Gastos de Personal', 'Mantenimientos Preventivos',
    'Mantenimientos Correctivos', 'Otros Gastos'];

  function getLastInformeMonth() {
    var name = (budgetMeta.ultimoInforme || '').trim();
    for (var i = 0; i < MONTH_FULL.length; i++) {
      if (MONTH_FULL[i].toLowerCase() === name.toLowerCase()) return i + 1;
    }
    return 0;
  }

  function loadBudget() {
    var loading = document.getElementById('budgetLoading');
    var content = document.getElementById('budgetContent');
    var error = document.getElementById('budgetError');
    if (!loading) return;

    if (!isScriptConfigured()) {
      loading.style.display = 'none';
      error.style.display = 'block';
      return;
    }

    fetch(config.APPS_SCRIPT_URL + '?action=budget')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        budgetData = data.budget || [];
        ejecucionData = data.ejecucion || [];
        budgetMeta = data.meta || {};
        loading.style.display = 'none';
        content.style.display = '';
        renderMonthBar();
        renderBudget();
      })
      .catch(function () {
        loading.style.display = 'none';
        error.style.display = 'block';
      });
  }

  function renderMonthBar() {
    var bar = document.getElementById('budgetMonthBar');
    if (!bar) return;
    var lastMonth = getLastInformeMonth();
    var html = '<button class="budget-month-btn active" onclick="window._selectMonth(0)">Todo</button>';
    for (var m = 0; m < 12; m++) {
      var hasData = (m + 1) <= lastMonth;
      html += '<button class="budget-month-btn' +
        (hasData ? '' : ' disabled') + '" onclick="window._selectMonth(' +
        (m + 1) + ')">' + MONTH_NAMES[m] +
        (hasData ? '' : '') + '</button>';
    }
    bar.innerHTML = html;
  }

  function selectMonth(m) {
    selectedMonth = m;
    var btns = document.querySelectorAll('.budget-month-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', i === m);
    }
    renderBudget();
  }

  function monthHasActuals(m) {
    var lastMonth = getLastInformeMonth();
    return m > 0 && m <= lastMonth;
  }

  function renderBudget() {
    var filtered = budgetData;
    if (selectedMonth > 0) {
      filtered = budgetData.filter(function (r) {
        return r.mesNum === selectedMonth;
      });
    }

    var lastMonth = getLastInformeMonth();
    var showActuals = ejecucionData.length > 0 &&
      (selectedMonth === 0 || monthHasActuals(selectedMonth));

    // Budget totals
    var totalIngresos = 0, totalGastos = 0;
    var catBudget = {};
    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      if (r.tipo === 'Ingresos') {
        totalIngresos += r.monto;
      } else {
        totalGastos += r.monto;
        catBudget[r.categoria] = (catBudget[r.categoria] || 0) + r.monto;
      }
    }

    // Actual totals from ejecucion
    // ejecutadoMes = single month, ejecutadoAcumulado = cumulative
    // When viewing a specific month that has data: use ejecutadoMes
    // When viewing "Todo": use ejecutadoAcumulado (cumulative through last informe)
    var totalEjecGastos = 0;
    var catEjec = {};
    if (showActuals) {
      var useField = (selectedMonth > 0) ? 'ejecutadoMes' : 'ejecutadoAcumulado';
      for (var i = 0; i < ejecucionData.length; i++) {
        var e = ejecucionData[i];
        var val = e[useField] || 0;
        if (e.categoria !== 'Ingresos') {
          totalEjecGastos += val;
          catEjec[e.categoria] = (catEjec[e.categoria] || 0) + val;
        }
      }
    }

    // For "Todo" view, compare actuals against budget up to last informe month only
    var compareBudget = totalGastos;
    if (selectedMonth === 0 && lastMonth > 0) {
      compareBudget = 0;
      for (var i = 0; i < budgetData.length; i++) {
        var r = budgetData[i];
        if (r.tipo !== 'Ingresos' && r.mesNum <= lastMonth) {
          compareBudget += r.monto;
        }
      }
    }

    var pctGlobal = compareBudget > 0
      ? Math.round((totalEjecGastos / compareBudget) * 100) : 0;
    var period = selectedMonth > 0 ? MONTH_FULL[selectedMonth - 1] : 'Anual';
    var infoLine = budgetMeta.ultimoInforme
      ? '\u00daltimo informe: ' + budgetMeta.ultimoInforme
      : '';

    // KPIs
    var kpis = document.getElementById('budgetKpis');
    kpis.innerHTML =
      kpiCard('B/. ' + fmtNum(totalIngresos), 'Presupuesto Ingresos', period) +
      kpiCard('B/. ' + fmtNum(totalGastos), 'Presupuesto Gastos', period) +
      (showActuals
        ? kpiCard('B/. ' + fmtNum(totalEjecGastos), 'Ejecutado Real',
            infoLine, totalEjecGastos > compareBudget ? 'negative' : '')
        : kpiCard('B/. ' + fmtNum(totalIngresos - totalGastos),
            (totalIngresos - totalGastos) >= 0 ? 'Super\u00e1vit Proyectado' : 'D\u00e9ficit Proyectado',
            period, (totalIngresos - totalGastos) >= 0 ? 'positive' : 'negative')) +
      kpiCard(showActuals ? pctGlobal + '%' : '\u2014',
        'Ejecuci\u00f3n',
        showActuals
          ? (selectedMonth > 0 ? 'del presupuesto de ' + MONTH_FULL[selectedMonth - 1] : 'acumulado a ' + (budgetMeta.ultimoInforme || ''))
          : 'sin datos reales para este mes');

    // Category cards
    var cats = document.getElementById('budgetCategories');
    var maxCat = 0;
    for (var c = 0; c < CAT_ORDER.length; c++) {
      var v = catBudget[CAT_ORDER[c]] || catEjec[CAT_ORDER[c]] || 0;
      if (v > maxCat) maxCat = v;
    }

    var catHtml = '';
    for (var c = 0; c < CAT_ORDER.length; c++) {
      var cat = CAT_ORDER[c];
      var budgeted = catBudget[cat] || 0;
      var executed = catEjec[cat] || 0;
      if (!budgeted && !executed) continue;

      var barBase = budgeted || executed;
      var pctBar = maxCat > 0 ? Math.round((barBase / maxCat) * 100) : 0;
      var pctExec = budgeted > 0 ? Math.round((executed / budgeted) * 100) : 0;
      var overBudget = executed > budgeted && budgeted > 0;

      catHtml += '<div class="budget-cat-card" onclick="window._toggleCat(\'' +
        cat.replace(/'/g, "\\'") + '\')">' +
        '<div class="budget-cat-header">' +
        '<span class="budget-cat-name">' + escapeHtml(cat) + '</span>' +
        '<span class="budget-cat-amount">B/. ' + fmtNum(budgeted) + '</span></div>' +
        '<div class="budget-cat-bar"><div class="budget-cat-fill" style="width:' +
        pctBar + '%;background:' + (CAT_COLORS[cat] || 'var(--blue)') + '"></div></div>';

      if (showActuals && executed > 0) {
        catHtml += '<div class="budget-cat-pct" style="color:' +
          (overBudget ? 'var(--red)' : 'var(--green)') + '">' +
          'Ejecutado: B/. ' + fmtNum(executed) + ' (' + pctExec + '%)</div>';
      } else {
        catHtml += '<div class="budget-cat-pct">' +
          (totalGastos > 0 ? Math.round((budgeted / totalGastos) * 100) : 0) +
          '% del total</div>';
      }
      catHtml += '</div>';
    }
    cats.innerHTML = catHtml;

    // Monthly trend
    renderTrend();

    // Reset detail
    var detail = document.getElementById('budgetDetail');
    detail.innerHTML = '';
  }

  function kpiCard(value, label, sub, cls) {
    return '<div class="budget-kpi">' +
      '<div class="budget-kpi-value ' + (cls || '') + '">' + value + '</div>' +
      '<div class="budget-kpi-label">' + label + '</div>' +
      (sub ? '<div class="budget-kpi-sub">' + sub + '</div>' : '') +
      '</div>';
  }

  function renderTrend() {
    var trend = document.getElementById('budgetTrend');
    if (!trend) return;

    var monthCats = [];
    var maxMonth = 0;
    for (var m = 1; m <= 12; m++) {
      var monthData = {};
      var monthTotal = 0;
      for (var i = 0; i < budgetData.length; i++) {
        var r = budgetData[i];
        if (r.mesNum === m && r.tipo !== 'Ingresos') {
          monthData[r.categoria] = (monthData[r.categoria] || 0) + r.monto;
          monthTotal += r.monto;
        }
      }
      monthCats.push(monthData);
      if (monthTotal > maxMonth) maxMonth = monthTotal;
    }

    var activeCats = CAT_ORDER.filter(function (c) {
      for (var m = 0; m < 12; m++) {
        if (monthCats[m][c]) return true;
      }
      return false;
    });

    var html = '';
    for (var m = 0; m < 12; m++) {
      html += '<div class="budget-trend-col">' +
        '<div class="budget-trend-stack" style="height:140px">';
      for (var c = 0; c < activeCats.length; c++) {
        var val = monthCats[m][activeCats[c]] || 0;
        var segH = maxMonth > 0 ? Math.round((val / maxMonth) * 140) : 0;
        html += '<div class="budget-trend-seg" style="height:' + segH +
          'px;background:' + (CAT_COLORS[activeCats[c]] || '#ccc') + '"></div>';
      }
      html += '</div><div class="budget-trend-label">' + MONTH_NAMES[m] + '</div></div>';
    }

    var legendHtml = '<div class="budget-trend-legend">';
    for (var c = 0; c < activeCats.length; c++) {
      legendHtml += '<div class="budget-legend-item"><div class="budget-legend-dot" style="background:' +
        CAT_COLORS[activeCats[c]] + '"></div>' + activeCats[c] + '</div>';
    }
    legendHtml += '</div>';

    trend.parentElement.innerHTML =
      '<div class="dash-chart-title">Distribuci\u00f3n mensual por categor\u00eda</div>' +
      '<div class="budget-trend">' + html + '</div>' + legendHtml;
  }

  function toggleCat(cat) {
    var detail = document.getElementById('budgetDetail');
    if (!detail) return;

    if (detail.getAttribute('data-cat') === cat) {
      detail.innerHTML = '';
      detail.removeAttribute('data-cat');
      return;
    }
    detail.setAttribute('data-cat', cat);

    var hasActuals = ejecucionData.length > 0 &&
      (selectedMonth === 0 || monthHasActuals(selectedMonth));

    // Get budget items
    var budgetItems = {};
    var bFiltered = budgetData.filter(function (r) {
      return r.categoria === cat && r.tipo !== 'Ingresos' &&
        (selectedMonth === 0 || r.mesNum === selectedMonth);
    });
    for (var i = 0; i < bFiltered.length; i++) {
      budgetItems[bFiltered[i].concepto] =
        (budgetItems[bFiltered[i].concepto] || 0) + bFiltered[i].monto;
    }

    // Get actual items
    var execItems = {};
    for (var i = 0; i < ejecucionData.length; i++) {
      if (ejecucionData[i].categoria === cat) {
        execItems[ejecucionData[i].concepto] = ejecucionData[i];
      }
    }

    // Merge all concepts
    var allConcepts = {};
    for (var k in budgetItems) allConcepts[k] = true;
    for (var k in execItems) allConcepts[k] = true;
    var sorted = Object.keys(allConcepts).sort(function (a, b) {
      return (budgetItems[b] || 0) - (budgetItems[a] || 0);
    });

    var html = '<table class="budget-detail-table"><thead><tr>' +
      '<th>Concepto</th><th>Presupuestado</th>';
    if (hasActuals) html += '<th>Ejecutado</th><th>%</th>';
    html += '</tr></thead><tbody>';

    for (var s = 0; s < sorted.length; s++) {
      var name = sorted[s];
      var budg = budgetItems[name] || 0;
      var exec = execItems[name] ? execItems[name].ejecutadoAcumulado : 0;
      var pct = budg > 0 ? Math.round((exec / budg) * 100) : (exec > 0 ? 'N/A' : 0);
      var overBudget = exec > budg && budg > 0;

      html += '<tr><td>' + escapeHtml(name) + '</td>' +
        '<td>B/. ' + fmtNum(budg) + '</td>';
      if (hasActuals) {
        html += '<td style="color:' + (overBudget ? 'var(--red)' : '') +
          '">B/. ' + fmtNum(exec) + '</td>' +
          '<td style="color:' + (overBudget ? 'var(--red)' : 'var(--green)') +
          '">' + pct + '%</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    detail.innerHTML = html;
  }

  function fmtNum(n) {
    return n.toLocaleString('es-PA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  window._selectMonth = selectMonth;
  window._toggleCat = toggleCat;

  // ── Init ──
  window._openPqrs = openPqrs;
  window._closePqrs = closePqrs;
  window._submitPqrs = submitPqrs;

  document.addEventListener('DOMContentLoaded', function () {
    populateDriveLinks();
    setupPqrsBackdrop();
    loadDashboard();
    loadBudget();
  });
})();
