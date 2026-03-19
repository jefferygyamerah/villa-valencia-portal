/**
 * APROVIVA Portal — Google Apps Script
 *
 * Handles PQRS submissions and provider suggestions.
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
  var data = JSON.parse(e.postData.contents);
  var type = data._type || 'pqrs';

  if (type === 'provider') {
    return saveProvider(data);
  }
  return savePqrs(data);
}

function savePqrs(data) {
  var sheet = getPqrsSheet();
  sheet.appendRow([
    new Date(),
    data.resumen || '',
    data.descripcion || '',
    data.tipo || '',
    data.ubicacion || '',
    data.urgencia || '',
    data.casa || ''
  ]);
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function saveProvider(data) {
  var sheet = getProvidersSheet();
  sheet.appendRow([
    new Date(),
    data.nombre || '',
    data.categoria || '',
    data.servicio || '',
    data.telefono || '',
    data.correo || '',
    data.casa || '',
    data.recomendadoPor || '',
    data.comentario || ''
  ]);
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

  var sheet = getPqrsSheet();
  var data = sheet.getDataRange().getValues();
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    rows.push({
      timestamp: data[i][0] instanceof Date
        ? data[i][0].toISOString()
        : String(data[i][0]),
      resumen: data[i][1] || '',
      descripcion: data[i][2] || '',
      tipo: data[i][3] || '',
      ubicacion: data[i][4] || '',
      urgencia: data[i][5] || '',
      casa: String(data[i][6] || '')
    });
  }

  return ContentService.createTextOutput(
    JSON.stringify({ rows: rows })
  ).setMimeType(ContentService.MimeType.JSON);
}
