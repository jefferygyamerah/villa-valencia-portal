/**
 * Reporting data generator for APROVIVA Portal.
 *
 * Reads the latest monthly informe financiero (XLSX) from Drive,
 * extracts budget vs actual from "Estado de Presupuesto" sheet,
 * and writes a flat table to the reporting spreadsheet.
 *
 * Auto-refreshes via hourly trigger.
 * Run setupReporting() once, then installTriggers() once.
 */

var FINANZAS_FOLDER_ID = '1JFxrA8lMiCyBeKjahEu1wGW58BsSs0qA';
var INFORMES_2026_FOLDER_ID = '1YqL-WgiaJT_WGS7uniSYnXpYbTYcZk6S';
var ENTREGA_FOLDER_ID = '1-gF8X8k4hIpcgZ4KhxvpxsPmclyRX8-3';
var BUDGET_SPREADSHEET_ID = '1CGmPqMbRsC3EI-8Gq53zd1rjjt-EeG62XidwuBSddgk';
var BUDGET_SHEET_NAME = 'PRESUPUESTO 2026 REVISADO';

function setupReporting() {
  var finanzasFolder = DriveApp.getFolderById(FINANZAS_FOLDER_ID);
  var reportingFolders = finanzasFolder.getFoldersByName('Reporting - No Editar');
  var reportingFolder;
  if (reportingFolders.hasNext()) {
    reportingFolder = reportingFolders.next();
  } else {
    reportingFolder = finanzasFolder.createFolder('Reporting - No Editar');
    reportingFolder.setDescription('Datos para dashboards. No editar — se actualiza automáticamente.');
  }

  var fileName = 'Presupuesto 2026 - Dashboard Data';
  var existing = reportingFolder.getFilesByName(fileName);
  var ss;
  if (existing.hasNext()) {
    ss = SpreadsheetApp.open(existing.next());
  } else {
    ss = SpreadsheetApp.create(fileName);
    DriveApp.getFileById(ss.getId()).moveTo(reportingFolder);
  }

  refreshBudgetData(ss);

  Logger.log('Reporting spreadsheet: ' + ss.getUrl());
  Logger.log('Spreadsheet ID: ' + ss.getId());
  return ss.getId();
}

function refreshBudgetData(ss) {
  if (!ss) {
    ss = getReportingSpreadsheet();
    if (!ss) return;
  }

  // Read the latest informe to get actuals
  var actuals = readLatestInforme();
  if (!actuals || !actuals.rows || !actuals.rows.length) {
    Logger.log('No se encontró informe XLSX válido en la carpeta Entrega de Informes.');
    return;
  }

  // Read the annual budget for baseline
  var budget = readAnnualBudget();

  // Build flat table combining budget + actuals
  writeFlatTable(ss, budget, actuals, {
    note: 'No editar — se regenera automáticamente',
  });

  writeExecutiveSummary(ss, budget, actuals);
}

function getReportingSpreadsheet() {
  var finanzasFolder = DriveApp.getFolderById(FINANZAS_FOLDER_ID);
  var reportingFolders = finanzasFolder.getFoldersByName('Reporting - No Editar');
  if (!reportingFolders.hasNext()) return null;
  var files = reportingFolders.next().getFilesByName('Presupuesto 2026 - Dashboard Data');
  if (!files.hasNext()) return null;
  return SpreadsheetApp.open(files.next());
}

/**
 * Parse informe month/year from first rows of "Estado de Presupuesto" (col A).
 * Header text is usually like "Al 31 de Enero de 2026".
 */
function readInformePeriodFromHeaderData(data) {
  var monthRe = new RegExp(
    '(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Setiembre|Septiembre|Octubre|Noviembre|Diciembre)',
    'i'
  );
  var defaultY = (new Date()).getFullYear();
  for (var h = 0; h < Math.min(5, data.length); h++) {
    var headerText = String(data[h][0] || '');
    var monthMatch = headerText.match(monthRe);
    if (!monthMatch) continue;
    var yearMatch = headerText.match(/\b(20\d{2})\b/);
    var y = yearMatch ? parseInt(yearMatch[1], 10) : defaultY;
    var m = monthToNumber(monthMatch[1]);
    if (m > 0) {
      return { y: y, m: m, monthLabel: monthMatch[1] };
    }
  }
  return null;
}

/**
 * Pick the .xlsx whose *contents* (informe period) is latest — not the file with
 * the newest Drive create date. That was causing re-uploads of an older month
 * to overwrite the dashboard while newer months were already in the folder.
 */
function pickBestInformeXlsx(folder) {
  var list = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (/\.xlsx$/i.test(f.getName())) {
      list.push(f);
    }
  }
  if (list.length === 0) return null;

  var best = null;
  var bestScore = -1;
  var bestTie = 0;

  for (var i = 0; i < list.length; i++) {
    var file = list[i];
    var converted = null;
    try {
      var blob = file.getBlob();
      converted = Drive.Files.insert(
        { title: 'temp-informe-scan-' + Date.now() + '-' + i, mimeType: 'application/vnd.google-apps.spreadsheet' },
        blob, { convert: true }
      );
      var tempSs = SpreadsheetApp.openById(converted.id);
      var presSheet = tempSs.getSheetByName('Estado de Presupuesto');
      if (!presSheet) {
        DriveApp.getFileById(converted.id).setTrashed(true);
        continue;
      }
      var sample = presSheet.getRange(1, 1, 5, 1).getValues();
      var period = readInformePeriodFromHeaderData(sample);
      DriveApp.getFileById(converted.id).setTrashed(true);
      if (!period) {
        continue;
      }
      var score = period.y * 12 + period.m;
      var tie = file.getLastUpdated().getTime();
      if (score > bestScore || (score === bestScore && tie > bestTie)) {
        bestScore = score;
        bestTie = tie;
        best = file;
      }
    } catch (e) {
      if (converted && converted.id) {
        try { DriveApp.getFileById(converted.id).setTrashed(true); } catch (ignore) {}
      }
    }
  }
  if (!best && list.length > 0) {
    list.sort(function (a, b) {
      return b.getLastUpdated().getTime() - a.getLastUpdated().getTime();
    });
    best = list[0];
  }
  return best;
}

/**
 * Find and read the latest monthly informe XLSX.
 * Returns array of {concepto, presupuestoAnual, mesActual, realAcumulado, pctEjecucion, saldo, categoria}
 */
function readLatestInforme() {
  var folder = DriveApp.getFolderById(ENTREGA_FOLDER_ID);
  var latestXlsx = pickBestInformeXlsx(folder);
  if (!latestXlsx) {
    return { rows: [], month: '', fileDate: null, fileId: '', fileName: '' };
  }

  var fileLastUpdated = latestXlsx.getLastUpdated();
  // Convert XLSX to Google Sheets temporarily
  var blob = latestXlsx.getBlob();
  var converted = Drive.Files.insert(
    { title: 'temp-informe-' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' },
    blob, { convert: true }
  );

  var tempSs = SpreadsheetApp.openById(converted.id);
  var presSheet = tempSs.getSheetByName('Estado de Presupuesto');
  var result = {
    rows: [],
    month: '',
    fileDate: fileLastUpdated,
    fileId: latestXlsx.getId(),
    fileName: latestXlsx.getName()
  };

  if (presSheet) {
    var data = presSheet.getDataRange().getValues();

    // Extract month from header (row 2 typically: "Al 31 de Enero de 2026")
    for (var h = 0; h < Math.min(5, data.length); h++) {
      var headerText = String(data[h][0] || '');
      var monthMatch = headerText.match(
        /(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Setiembre|Septiembre|Octubre|Noviembre|Diciembre)/i
      );
      if (monthMatch) {
        result.month = monthMatch[0];
        break;
      }
    }

    // Parse rows — the format is:
    // Col A: Cuenta (concept name)
    // Col B: Presupuesto Anual
    // Col C: Mes actual amount
    // Col D: Real Acumulado
    // Col E: % Ejecucion
    // Col F: Saldo Restante
    var currentCategory = '';
    for (var i = 6; i < data.length; i++) {
      var concepto = String(data[i][0] || '').trim();
      if (!concepto) continue;

      // Detect category headers
      if (concepto === 'Ingresos' || concepto === 'Total de Ingresos') {
        if (concepto === 'Ingresos') currentCategory = 'Ingresos';
        continue;
      }
      if (concepto.indexOf('Gastos Generales') !== -1) { currentCategory = 'Gastos'; continue; }
      if (concepto.indexOf('Gastos de Personal') !== -1) { currentCategory = 'Gastos de Personal'; continue; }
      if (concepto.indexOf('Servicios Básicos') !== -1 && !data[i][1]) { currentCategory = 'Servicios Básicos'; continue; }
      if (concepto.indexOf('Gastos de Funcionamiento') !== -1 && !data[i][1]) { currentCategory = 'Gastos de Funcionamiento'; continue; }
      if (concepto.indexOf('Mantenimientos Preventivos') !== -1 && !data[i][1]) { currentCategory = 'Mantenimientos Preventivos'; continue; }
      if (concepto.indexOf('Mantenimientos Correctivos') !== -1 && !data[i][1]) { currentCategory = 'Mantenimientos Correctivos'; continue; }
      if (concepto.indexOf('Otros Gastos') !== -1 && !data[i][1]) { currentCategory = 'Otros Gastos'; continue; }

      // Skip totals
      if (concepto.indexOf('Total de') !== -1 || concepto.indexOf('TOTAL') !== -1) continue;

      var presAnual = Number(data[i][1]) || 0;
      var mesActual = Number(data[i][2]) || 0;
      var realAcum = Number(data[i][3]) || 0;
      var pctEjec = Number(data[i][4]) || 0;
      var saldo = Number(data[i][5]) || 0;

      // Only include rows that have some data
      if (presAnual || mesActual || realAcum) {
        result.rows.push({
          concepto: concepto,
          categoria: currentCategory,
          presupuestoAnual: presAnual,
          mesActual: mesActual,
          realAcumulado: realAcum,
          pctEjecucion: pctEjec,
          saldoRestante: saldo
        });
      }
    }
  }

  // Clean up temp file
  DriveApp.getFileById(converted.id).setTrashed(true);

  return result;
}

function writeExecutiveSummary(ss, budget, actuals) {
  var monthNum = monthToNumber(actuals.month);
  var metrics = computeExecutiveMetrics(budget, actuals, monthNum);
  var summarySheet = ss.getSheetByName('Resumen') || ss.insertSheet('Resumen');
  summarySheet.clear();

  var rows = [
    ['Indicador', 'Valor', 'Detalle'],
    ['Último informe', actuals.month || 'N/A', actuals.fileName || ''],
    ['Fecha archivo', actuals.fileDate || 'N/A', 'Último archivo detectado en Drive'],
    ['Ingresos ejecutados acumulados', metrics.ingresosActual, 'B/.'],
    ['Gastos ejecutados acumulados', metrics.gastosActual, 'B/.'],
    ['Resultado neto acumulado', metrics.resultadoNeto, 'B/.'],
    ['Presupuesto gastos YTD', metrics.gastosBudgetYtd, 'Hasta mes de informe'],
    ['Desviación gastos YTD', metrics.desviacionGastosYtd, 'Actual vs presupuesto'],
    ['Ejecución gastos YTD', metrics.ejecucionGastosPct, '%'],
    ['Saldo restante anual (gastos)', metrics.saldoRestanteAnual, 'B/.']
  ];

  summarySheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  summarySheet.getRange(1, 1, 1, 3)
    .setFontWeight('bold')
    .setBackground('#1A6BB8')
    .setFontColor('#ffffff');
  summarySheet.getRange(2, 2, rows.length - 1, 1).setNumberFormat('#,##0.00');
  summarySheet.autoResizeColumns(1, 3);

  var topRows = buildTopExecutionRows(actuals.rows, 5);
  if (topRows.length) {
    summarySheet.getRange(rows.length + 2, 1).setValue('Top conceptos por ejecución');
    summarySheet.getRange(rows.length + 3, 1, 1, 5).setValues([[
      'Categoría', 'Concepto', 'Presupuesto Anual', 'Ejecutado Acumulado', '% Ejecución'
    ]]);
    summarySheet.getRange(rows.length + 3, 1, 1, 5)
      .setFontWeight('bold')
      .setBackground('#E8F2FC');
    summarySheet.getRange(rows.length + 4, 1, topRows.length, 5).setValues(topRows);
    summarySheet.getRange(rows.length + 4, 3, topRows.length, 2).setNumberFormat('#,##0.00');
    summarySheet.getRange(rows.length + 4, 5, topRows.length, 1).setNumberFormat('0.00%');
  }
}

function computeExecutiveMetrics(budget, actuals, monthNum) {
  var gastosBudgetYtd = 0;
  for (var i = 0; i < budget.rows.length; i++) {
    var row = budget.rows[i];
    if (row.categoria === 'Ingresos') continue;
    var end = monthNum > 0 ? monthNum : 12;
    for (var m = 0; m < end; m++) {
      gastosBudgetYtd += Number(row.monthly[m]) || 0;
    }
  }

  var ingresosActual = 0;
  var gastosActual = 0;
  var saldoRestanteAnual = 0;
  for (var j = 0; j < actuals.rows.length; j++) {
    var a = actuals.rows[j];
    if (a.categoria === 'Ingresos') {
      ingresosActual += Number(a.realAcumulado) || 0;
    } else {
      gastosActual += Number(a.realAcumulado) || 0;
      saldoRestanteAnual += Number(a.saldoRestante) || 0;
    }
  }

  var desviacion = gastosActual - gastosBudgetYtd;
  var ejecPct = gastosBudgetYtd > 0 ? (gastosActual / gastosBudgetYtd) * 100 : 0;

  return {
    ingresosActual: ingresosActual,
    gastosActual: gastosActual,
    resultadoNeto: ingresosActual - gastosActual,
    gastosBudgetYtd: gastosBudgetYtd,
    desviacionGastosYtd: desviacion,
    ejecucionGastosPct: ejecPct,
    saldoRestanteAnual: saldoRestanteAnual
  };
}

function buildTopExecutionRows(actualRows, limit) {
  var rows = [];
  for (var i = 0; i < actualRows.length; i++) {
    var r = actualRows[i];
    if (r.categoria === 'Ingresos') continue;
    var annual = Number(r.presupuestoAnual) || 0;
    var acum = Number(r.realAcumulado) || 0;
    var pct = annual > 0 ? (acum / annual) : 0;
    rows.push([r.categoria, r.concepto, annual, acum, pct]);
  }
  rows.sort(function (a, b) { return b[4] - a[4]; });
  return rows.slice(0, limit || 5);
}

function monthToNumber(monthName) {
  var name = String(monthName || '').toLowerCase();
  var map = {
    'enero': 1,
    'febrero': 2,
    'marzo': 3,
    'abril': 4,
    'mayo': 5,
    'junio': 6,
    'julio': 7,
    'agosto': 8,
    'septiembre': 9,
    'setiembre': 9,
    'octubre': 10,
    'noviembre': 11,
    'diciembre': 12
  };
  return map[name] || 0;
}

/**
 * Read the annual budget spreadsheet for monthly planned amounts.
 */
function readAnnualBudget() {
  var source = SpreadsheetApp.openById(BUDGET_SPREADSHEET_ID);
  var srcSheet = source.getSheetByName(BUDGET_SHEET_NAME);
  var data = srcSheet.getDataRange().getValues();

  var months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Map row indices to categories (from budget spreadsheet structure)
  var items = [
    [5, 'Ingresos'], [6, 'Ingresos'],
    [12, 'Servicios Básicos'], [13, 'Servicios Básicos'], [14, 'Servicios Básicos'],
    [15, 'Servicios Básicos'], [16, 'Servicios Básicos'], [17, 'Servicios Básicos'],
    [18, 'Servicios Básicos'], [19, 'Servicios Básicos'], [20, 'Servicios Básicos'],
    [21, 'Servicios Básicos'], [22, 'Servicios Básicos'],
    [24, 'Gastos de Funcionamiento'], [25, 'Gastos de Funcionamiento'],
    [26, 'Gastos de Funcionamiento'], [27, 'Gastos de Funcionamiento'],
    [28, 'Gastos de Funcionamiento'], [29, 'Gastos de Funcionamiento'],
    [30, 'Gastos de Funcionamiento'], [31, 'Gastos de Funcionamiento'],
    [32, 'Gastos de Funcionamiento'], [33, 'Gastos de Funcionamiento'],
    [34, 'Gastos de Funcionamiento'], [35, 'Gastos de Funcionamiento'],
    [38, 'Mantenimientos Preventivos'], [39, 'Mantenimientos Preventivos'],
    [40, 'Mantenimientos Preventivos'], [41, 'Mantenimientos Preventivos'],
    [42, 'Mantenimientos Preventivos'], [43, 'Mantenimientos Preventivos'],
    [45, 'Mantenimientos Preventivos'], [46, 'Mantenimientos Preventivos'],
    [47, 'Mantenimientos Preventivos'], [48, 'Mantenimientos Preventivos'],
    [49, 'Mantenimientos Preventivos'], [50, 'Mantenimientos Preventivos'],
    [51, 'Mantenimientos Preventivos'],
    [53, 'Mantenimientos Correctivos'], [54, 'Mantenimientos Correctivos'],
    [56, 'Otros Gastos'], [57, 'Otros Gastos'],
  ];

  var rows = [];
  for (var i = 0; i < items.length; i++) {
    var rowIdx = items[i][0];
    var cat = items[i][1];
    if (rowIdx >= data.length) continue;
    var concepto = String(data[rowIdx][0] || '').trim();
    if (!concepto) continue;

    var monthly = [];
    var annual = 0;
    for (var m = 0; m < 12; m++) {
      var v = Number(data[rowIdx][m + 1]) || 0;
      monthly.push(v);
      annual += v;
    }
    rows.push({ concepto: concepto, categoria: cat, annual: annual, monthly: monthly });
  }

  return { rows: rows, months: months };
}

/**
 * Write combined budget + actuals to the reporting spreadsheet.
 */
function writeFlatTable(ss, budget, actuals, options) {
  options = options || {};
  var months = budget.months;

  // Sheet 1: Budget (monthly planned)
  var headers = ['Tipo', 'Categoría', 'Concepto', 'Mes', 'Mes_Num', 'Presupuestado'];
  var flatRows = [headers];
  for (var i = 0; i < budget.rows.length; i++) {
    var r = budget.rows[i];
    var tipo = r.categoria === 'Ingresos' ? 'Ingresos' : 'Gastos';
    for (var m = 0; m < 12; m++) {
      flatRows.push([tipo, r.categoria, r.concepto, months[m], m + 1, r.monthly[m]]);
    }
  }
  writeSheet(ss, 'Presupuesto', flatRows, 5);

  // Sheet 2: Ejecucion (actuals from latest informe)
  var execHeaders = ['Categoría', 'Concepto', 'Presupuesto_Anual',
                     'Ejecutado_Mes', 'Ejecutado_Acumulado', 'Pct_Ejecucion', 'Saldo_Restante'];
  var execRows = [execHeaders];
  for (var i = 0; i < actuals.rows.length; i++) {
    var a = actuals.rows[i];
    execRows.push([a.categoria, a.concepto, a.presupuestoAnual,
                   a.mesActual, a.realAcumulado, a.pctEjecucion, a.saldoRestante]);
  }
  writeSheet(ss, 'Ejecucion', execRows, 2);

  // Sheet 3: Meta
  var metaSheet = ss.getSheetByName('Meta') || ss.insertSheet('Meta');
  metaSheet.clear();
  metaSheet.getRange(1, 1).setValue('Última actualización');
  metaSheet.getRange(1, 2).setValue(new Date());
  metaSheet.getRange(2, 1).setValue('Último informe');
  metaSheet.getRange(2, 2).setValue(actuals.month || 'N/A');
  metaSheet.getRange(3, 1).setValue('Fecha archivo');
  metaSheet.getRange(3, 2).setValue(actuals.fileDate || 'N/A');
  metaSheet.getRange(4, 1).setValue('Nota');
  metaSheet.getRange(4, 2).setValue(options.note || 'No editar — se regenera automáticamente');

  // Clean up extra sheets
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    if (name !== 'Presupuesto' && name !== 'Ejecucion' && name !== 'Meta' && name !== 'Resumen') {
      if (sheets.length > 1) ss.deleteSheet(sheets[s]);
    }
  }
}

function writeSheet(ss, name, rows, currencyCol) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(name);
  }

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sheet.getRange(1, 1, 1, rows[0].length)
      .setFontWeight('bold')
      .setBackground('#1A6BB8')
      .setFontColor('#ffffff');
    if (currencyCol) {
      sheet.getRange(2, currencyCol + 1, rows.length - 1, 1).setNumberFormat('#,##0.00');
    }
    for (var c = 1; c <= rows[0].length; c++) {
      sheet.autoResizeColumn(c);
    }
  }
}

/**
 * Install triggers for automatic refresh.
 * Run ONCE from the Apps Script editor.
 */
function installTriggers() {
  removeTriggers();

  // Daily trigger — executive reporting refresh from latest available informe
  ScriptApp.newTrigger('triggerRefresh')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log('Daily 06:00 trigger installed');
}

function removeTriggers() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    var fn = existing[i].getHandlerFunction();
    if (fn === 'triggerRefresh') {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }
}

function triggerRefresh() {
  refreshBudgetData();
}
