/**
 * Creates a reporting folder and a flat-table copy of the budget
 * for Looker Studio consumption.
 *
 * Run once via Apps Script to set up, then schedule monthly refresh.
 */

function setupReporting() {
  // Create reporting folder in the finanzas folder
  var finanzasFolder = DriveApp.getFolderById('1JFxrA8lMiCyBeKjahEu1wGW58BsSs0qA');
  var reportingFolders = finanzasFolder.getFoldersByName('Reporting - No Editar');
  var reportingFolder;
  if (reportingFolders.hasNext()) {
    reportingFolder = reportingFolders.next();
  } else {
    reportingFolder = finanzasFolder.createFolder('Reporting - No Editar');
    reportingFolder.setDescription('Datos estructurados para dashboards. No editar manualmente — se actualiza automáticamente.');
  }

  // Create or get the reporting spreadsheet
  var fileName = 'Presupuesto 2026 - Dashboard Data';
  var existing = reportingFolder.getFilesByName(fileName);
  var ss;
  if (existing.hasNext()) {
    ss = SpreadsheetApp.open(existing.next());
  } else {
    ss = SpreadsheetApp.create(fileName);
    DriveApp.getFileById(ss.getId()).moveTo(reportingFolder);
  }

  // Build the flat table
  refreshBudgetData(ss);

  Logger.log('Reporting spreadsheet: ' + ss.getUrl());
  Logger.log('Spreadsheet ID: ' + ss.getId());
  return ss.getId();
}

function refreshBudgetData(ss) {
  if (!ss) {
    // Find the reporting spreadsheet
    var finanzasFolder = DriveApp.getFolderById('1JFxrA8lMiCyBeKjahEu1wGW58BsSs0qA');
    var reportingFolders = finanzasFolder.getFoldersByName('Reporting - No Editar');
    if (!reportingFolders.hasNext()) return;
    var reportingFolder = reportingFolders.next();
    var files = reportingFolder.getFilesByName('Presupuesto 2026 - Dashboard Data');
    if (!files.hasNext()) return;
    ss = SpreadsheetApp.open(files.next());
  }

  var source = SpreadsheetApp.openById('1CGmPqMbRsC3EI-8Gq53zd1rjjt-EeG62XidwuBSddgk');
  var srcSheet = source.getSheetByName('PRESUPUESTO 2026 REVISADO');
  var data = srcSheet.getDataRange().getValues();

  var months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Define line items to extract: [rowIndex, category, subcategory]
  var items = [
    // Ingresos
    [5,  'Ingresos', 'Ingresos'],
    [6,  'Ingresos', 'Ingresos'],
    // Servicios Básicos
    [12, 'Gastos', 'Servicios Básicos'],
    [13, 'Gastos', 'Servicios Básicos'],
    [14, 'Gastos', 'Servicios Básicos'],
    [15, 'Gastos', 'Servicios Básicos'],
    [16, 'Gastos', 'Servicios Básicos'],
    [17, 'Gastos', 'Servicios Básicos'],
    [18, 'Gastos', 'Servicios Básicos'],
    [19, 'Gastos', 'Servicios Básicos'],
    [20, 'Gastos', 'Servicios Básicos'],
    [21, 'Gastos', 'Servicios Básicos'],
    [22, 'Gastos', 'Servicios Básicos'],
    // Gastos de Funcionamiento
    [24, 'Gastos', 'Gastos de Funcionamiento'],
    [25, 'Gastos', 'Gastos de Funcionamiento'],
    [26, 'Gastos', 'Gastos de Funcionamiento'],
    [27, 'Gastos', 'Gastos de Funcionamiento'],
    [28, 'Gastos', 'Gastos de Funcionamiento'],
    [29, 'Gastos', 'Gastos de Funcionamiento'],
    [30, 'Gastos', 'Gastos de Funcionamiento'],
    [31, 'Gastos', 'Gastos de Funcionamiento'],
    [32, 'Gastos', 'Gastos de Funcionamiento'],
    [33, 'Gastos', 'Gastos de Funcionamiento'],
    [34, 'Gastos', 'Gastos de Funcionamiento'],
    [35, 'Gastos', 'Gastos de Funcionamiento'],
    // Mantenimientos Preventivos
    [38, 'Gastos', 'Mantenimientos Preventivos'],
    [39, 'Gastos', 'Mantenimientos Preventivos'],
    [40, 'Gastos', 'Mantenimientos Preventivos'],
    [41, 'Gastos', 'Mantenimientos Preventivos'],
    [42, 'Gastos', 'Mantenimientos Preventivos'],
    [43, 'Gastos', 'Mantenimientos Preventivos'],
    [45, 'Gastos', 'Mantenimientos Preventivos'],
    [46, 'Gastos', 'Mantenimientos Preventivos'],
    [47, 'Gastos', 'Mantenimientos Preventivos'],
    [48, 'Gastos', 'Mantenimientos Preventivos'],
    [49, 'Gastos', 'Mantenimientos Preventivos'],
    [50, 'Gastos', 'Mantenimientos Preventivos'],
    [51, 'Gastos', 'Mantenimientos Preventivos'],
    // Mantenimientos Correctivos
    [53, 'Gastos', 'Mantenimientos Correctivos'],
    [54, 'Gastos', 'Mantenimientos Correctivos'],
    // Otros Gastos
    [56, 'Gastos', 'Otros Gastos'],
    [57, 'Gastos', 'Otros Gastos'],
  ];

  // Build flat rows: one row per line item per month
  var flatRows = [['Tipo', 'Categoría', 'Concepto', 'Mes', 'Mes_Num', 'Monto_Presupuestado']];

  for (var i = 0; i < items.length; i++) {
    var rowIdx = items[i][0];
    var tipo = items[i][1];
    var categoria = items[i][2];
    if (rowIdx >= data.length) continue;

    var concepto = String(data[rowIdx][0] || '').trim();
    if (!concepto) continue;

    for (var m = 0; m < 12; m++) {
      var val = Number(data[rowIdx][m + 1]) || 0;
      if (val === 0 && tipo === 'Ingresos') continue;
      flatRows.push([tipo, categoria, concepto, months[m], m + 1, val]);
    }
  }

  // Write to sheet
  var sheetName = 'Presupuesto';
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(sheetName);
  }

  if (flatRows.length > 1) {
    sheet.getRange(1, 1, flatRows.length, flatRows[0].length).setValues(flatRows);
    // Format header
    sheet.getRange(1, 1, 1, flatRows[0].length)
      .setFontWeight('bold')
      .setBackground('#1A6BB8')
      .setFontColor('#ffffff');
    // Format currency column
    sheet.getRange(2, 6, flatRows.length - 1, 1).setNumberFormat('#,##0.00');
    // Auto-resize
    for (var c = 1; c <= flatRows[0].length; c++) {
      sheet.autoResizeColumn(c);
    }
  }

  // Also create a summary sheet with category totals
  var summaryName = 'Resumen';
  var summarySheet = ss.getSheetByName(summaryName);
  if (summarySheet) {
    summarySheet.clear();
  } else {
    summarySheet = ss.insertSheet(summaryName);
  }

  var summaryRows = [['Categoría', 'Presupuesto Anual']];
  var catTotals = {};
  for (var i = 1; i < flatRows.length; i++) {
    var cat = flatRows[i][1];
    catTotals[cat] = (catTotals[cat] || 0) + flatRows[i][5];
  }
  var catOrder = ['Ingresos', 'Servicios Básicos', 'Gastos de Funcionamiento',
                  'Mantenimientos Preventivos', 'Mantenimientos Correctivos', 'Otros Gastos'];
  for (var c = 0; c < catOrder.length; c++) {
    if (catTotals[catOrder[c]]) {
      summaryRows.push([catOrder[c], catTotals[catOrder[c]]]);
    }
  }

  summarySheet.getRange(1, 1, summaryRows.length, 2).setValues(summaryRows);
  summarySheet.getRange(1, 1, 1, 2)
    .setFontWeight('bold')
    .setBackground('#1A6BB8')
    .setFontColor('#ffffff');
  summarySheet.getRange(2, 2, summaryRows.length - 1, 1).setNumberFormat('#,##0.00');
  summarySheet.autoResizeColumn(1);
  summarySheet.autoResizeColumn(2);

  // Delete default Sheet1 if it exists
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Add last-updated timestamp
  var metaName = 'Meta';
  var metaSheet = ss.getSheetByName(metaName);
  if (metaSheet) {
    metaSheet.clear();
  } else {
    metaSheet = ss.insertSheet(metaName);
  }
  metaSheet.getRange(1, 1).setValue('Última actualización');
  metaSheet.getRange(1, 2).setValue(new Date());
  metaSheet.getRange(2, 1).setValue('Fuente');
  metaSheet.getRange(2, 2).setValue('BORRADOR PRESUPUESTO 2026');
  metaSheet.getRange(3, 1).setValue('Nota');
  metaSheet.getRange(3, 2).setValue('No editar — se regenera automáticamente');
}
