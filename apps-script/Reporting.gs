/**
 * Reporting data generator for APROVIVA Portal.
 *
 * Reads the latest monthly informe financiero (XLSX) from Drive,
 * extracts budget vs actual from "Estado de Presupuesto" sheet,
 * and writes a flat table to the reporting spreadsheet.
 *
 * Pure logic lives in Shared.gs (shared with Jest test suite).
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

  // Read the annual budget for baseline
  var budget = readAnnualBudget();

  // Build flat table combining budget + actuals
  writeFlatTable(ss, budget, actuals);
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
 * Find and read the latest monthly informe XLSX.
 * Returns { rows: [...], month: string, fileDate: Date }
 */
function readLatestInforme() {
  var folder = DriveApp.getFolderById(ENTREGA_FOLDER_ID);
  var files = folder.getFiles();
  var latestXlsx = null;
  var latestDate = new Date(0);

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (name.indexOf('.xlsx') !== -1 || name.indexOf('.XLSX') !== -1) {
      var created = file.getDateCreated();
      if (created > latestDate) {
        latestDate = created;
        latestXlsx = file;
      }
    }
  }

  if (!latestXlsx) return { rows: [], month: '', fileDate: null };

  // Convert XLSX to Google Sheets temporarily
  var blob = latestXlsx.getBlob();
  var converted = Drive.Files.insert(
    { title: 'temp-informe-' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' },
    blob, { convert: true }
  );

  var tempSs = SpreadsheetApp.openById(converted.id);
  var presSheet = tempSs.getSheetByName('Estado de Presupuesto');
  var result = { rows: [], month: '', fileDate: latestDate };

  if (presSheet) {
    var data = presSheet.getDataRange().getValues();

    // Extract month from header (row 2 typically: "Al 31 de Enero de 2026")
    for (var h = 0; h < Math.min(5, data.length); h++) {
      var headerText = String(data[h][0] || '');
      var monthName = extractMonthFromHeader(headerText);
      if (monthName) {
        result.month = monthName;
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

      // Detect category headers using shared function
      var detectedCat = detectInformeCategory(concepto, !!data[i][1]);
      if (detectedCat) {
        currentCategory = detectedCat;
        continue;
      }
      if (concepto === 'Total de Ingresos') continue;

      // Skip totals using shared function
      if (isSkippableRow(concepto)) continue;

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
function writeFlatTable(ss, budget, actuals) {
  // Sheet 1: Budget (monthly planned) — uses shared buildBudgetFlatTable
  var flatRows = buildBudgetFlatTable(budget.rows, budget.months);
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
  metaSheet.getRange(4, 2).setValue('No editar — se regenera automáticamente');

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

  // Hourly trigger — picks up new informe uploads
  ScriptApp.newTrigger('triggerRefresh')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('Hourly trigger installed');
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
