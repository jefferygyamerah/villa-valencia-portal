/**
 * Pure/testable functions extracted from app.js
 * Used by both the browser IIFE and test suite.
 */

function formatDate(ts) {
  try {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    var day = d.getDate();
    var months = ['ene','feb','mar','abr','may','jun',
                  'jul','ago','sep','oct','nov','dic'];
    return day + ' ' + months[d.getMonth()];
  } catch (e) {
    return '';
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  var s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtNum(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  return n.toLocaleString('es-PA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function isScriptConfigured(config) {
  return config &&
    config.APPS_SCRIPT_URL &&
    config.APPS_SCRIPT_URL.indexOf('YOUR_') === -1;
}

var MONTH_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getLastInformeMonth(budgetMeta) {
  var name = ((budgetMeta && budgetMeta.ultimoInforme) || '').trim();
  for (var i = 0; i < MONTH_FULL.length; i++) {
    if (MONTH_FULL[i].toLowerCase() === name.toLowerCase()) return i + 1;
  }
  return 0;
}

/**
 * Compute dashboard KPIs from rows.
 * Returns { total, alta, media, baja, tipoCounts, ubicacionCounts }
 */
function computeDashboardKpis(rows) {
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

  return { total: total, alta: alta, media: media, baja: baja,
           tipoCounts: tipoCounts, ubicacionCounts: ubicacionCounts };
}

/**
 * Compute budget summary for a given month selection.
 * Returns { totalIngresos, totalGastos, catBudget, totalEjecGastos, catEjec,
 *           compareBudget, pctGlobal }
 */
function computeBudgetSummary(budgetData, ejecucionData, selectedMonth, lastMonth) {
  var filtered = budgetData;
  if (selectedMonth > 0) {
    filtered = budgetData.filter(function (r) {
      return r.mesNum === selectedMonth;
    });
  }

  var showActuals = ejecucionData.length > 0 &&
    (selectedMonth === 0 || (selectedMonth > 0 && selectedMonth <= lastMonth));

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

  return {
    totalIngresos: totalIngresos,
    totalGastos: totalGastos,
    catBudget: catBudget,
    totalEjecGastos: totalEjecGastos,
    catEjec: catEjec,
    compareBudget: compareBudget,
    pctGlobal: pctGlobal,
    showActuals: showActuals
  };
}

/**
 * Compute monthly trend data for stacked bar chart.
 * Returns { monthCats: [{cat: amount}], maxMonth, activeCats }
 */
function computeMonthlyTrend(budgetData, catOrder) {
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

  var activeCats = catOrder.filter(function (c) {
    for (var m = 0; m < 12; m++) {
      if (monthCats[m][c]) return true;
    }
    return false;
  });

  return { monthCats: monthCats, maxMonth: maxMonth, activeCats: activeCats };
}

/**
 * Validate PQRS form fields.
 * Returns { valid: boolean, missing: string[] }
 */
function validatePqrsFields(fields) {
  var required = ['descripcion', 'tipo', 'ubicacion', 'casa'];
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    var val = (fields[required[i]] || '').trim();
    if (!val) missing.push(required[i]);
  }
  return { valid: missing.length === 0, missing: missing };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    fmtNum: fmtNum,
    isScriptConfigured: isScriptConfigured,
    getLastInformeMonth: getLastInformeMonth,
    computeDashboardKpis: computeDashboardKpis,
    computeBudgetSummary: computeBudgetSummary,
    computeMonthlyTrend: computeMonthlyTrend,
    validatePqrsFields: validatePqrsFields,
    MONTH_FULL: MONTH_FULL,
  };
}
