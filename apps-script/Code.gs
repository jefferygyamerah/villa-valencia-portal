/**
 * APROVIVA Portal — Google Apps Script
 *
 * Handles PQRS submissions and provider suggestions.
 * Pure logic lives in Shared.gs (shared with Jest test suite).
 */

var PQRS_SHEET = 'Portal';
var PROVIDERS_SHEET = 'Proveedores';

function getPqrsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PQRS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PQRS_SHEET);
    sheet.appendRow([
      'Timestamp', 'Resumen', 'Descripción', 'Tipo',
      'Ubicación', 'Urgencia', 'Casa'
    ]);
  }
  return sheet;
}

function getProvidersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROVIDERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PROVIDERS_SHEET);
    sheet.appendRow([
      'Timestamp', 'Nombre/Empresa', 'Categoría', 'Servicio',
      'Teléfono', 'Correo', 'Casa', 'Recomendado por', 'Comentario'
    ]);
  }
  return sheet;
}

// POST — dispatch based on payload type
function doPost(e) {
  var parsed = parsePostPayload(e.postData.contents);

  if (parsed.type === 'provider') {
    return saveProvider(parsed.data);
  }
  return savePqrs(parsed.data);
}

function savePqrs(data) {
  var sheet = getPqrsSheet();
  sheet.appendRow(buildPqrsRow(data, new Date()));
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function saveProvider(data) {
  var sheet = getProvidersSheet();
  sheet.appendRow(buildProviderRow(data, new Date()));
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok' })
  ).setMimeType(ContentService.MimeType.JSON);
}

// GET — return PQRS data for dashboard
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'pqrs';

  if (action === 'setup-reporting') {
    var id = setupReporting();
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', spreadsheetId: id })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'install-triggers') {
    installTriggers();
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', message: 'Triggers installed' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'dump-informe') {
    return dumpInforme();
  }

  if (action === 'budget') {
    return serveBudgetData();
  }

  var sheet = getPqrsSheet();
  var data = sheet.getDataRange().getValues();
  var rows = parseSheetToPqrsRows(data);

  return ContentService.createTextOutput(
    JSON.stringify({ rows: rows })
  ).setMimeType(ContentService.MimeType.JSON);
}

// Dump a monthly informe for inspection
function dumpInforme() {
  // January 2026 XLSX - open it via Drive
  var file = DriveApp.getFileById('1ZBaZpvgZ3SuJRzOpRD5TUERWUzXXzp-n');
  // Convert XLSX to Google Sheets to read it
  var blob = file.getBlob();
  var converted = Drive.Files.insert(
    { title: 'temp-informe-read', mimeType: 'application/vnd.google-apps.spreadsheet' },
    blob, { convert: true }
  );
  var ss = SpreadsheetApp.openById(converted.id);
  var sheets = ss.getSheets();
  var result = {};
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var data = sheet.getDataRange().getValues();
    result[sheet.getName()] = data.slice(0, 50).map(function(row) {
      return row.map(function(cell) {
        if (cell instanceof Date) return cell.toISOString();
        return cell;
      });
    });
  }
  // Clean up temp file
  DriveApp.getFileById(converted.id).setTrashed(true);

  return ContentService.createTextOutput(
    JSON.stringify(result, null, 2)
  ).setMimeType(ContentService.MimeType.JSON);
}

// Return budget + actuals from reporting spreadsheet
function serveBudgetData() {
  var REPORTING_ID = '1MI6BHRy7Y5abCb1jI1YQcEq19-bAuTDvddznDNfwcaA';
  var ss = SpreadsheetApp.openById(REPORTING_ID);

  var result = { budget: [], ejecucion: [], meta: {} };

  // Budget (monthly planned)
  var budgetSheet = ss.getSheetByName('Presupuesto');
  if (budgetSheet) {
    result.budget = parseBudgetSheet(budgetSheet.getDataRange().getValues());
  }

  // Ejecucion (actuals from latest informe)
  var execSheet = ss.getSheetByName('Ejecucion');
  if (execSheet) {
    result.ejecucion = parseEjecucionSheet(execSheet.getDataRange().getValues());
  }

  // Meta
  var metaSheet = ss.getSheetByName('Meta');
  if (metaSheet) {
    result.meta = parseMetaSheet(metaSheet.getDataRange().getValues());
  }

  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}
