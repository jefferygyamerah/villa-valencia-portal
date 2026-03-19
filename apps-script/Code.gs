/**
 * APROVIVA PQRS — Google Apps Script
 *
 * Attach this script to the PQRS spreadsheet:
 *   1. Open spreadsheet > Extensions > Apps Script
 *   2. Paste this code (replace any existing code)
 *   3. Click Deploy > New deployment
 *   4. Type: Web app
 *   5. Execute as: Me
 *   6. Who has access: Anyone
 *   7. Copy the URL and paste it into js/config.js as APPS_SCRIPT_URL
 *
 * Sheet columns (row 1 = headers):
 *   A: Timestamp | B: Resumen | C: Descripcion | D: Tipo
 *   E: Ubicacion | F: Urgencia | G: Casa
 */

var SHEET_NAME = 'Portal';

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Timestamp', 'Resumen', 'Descripción', 'Tipo',
      'Ubicación', 'Urgencia', 'Casa'
    ]);
  }
  return sheet;
}

// POST — receive a new PQRS report
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = getSheet();

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

// GET — return all PQRS rows as JSON for the dashboard
function doGet() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
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
