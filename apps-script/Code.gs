/**
 * APROVIVA Portal — Google Apps Script
 *
 * Handles PQRS submissions and provider suggestions.
 */

var PQRS_SHEET = 'Portal';
var PROVIDERS_SHEET = 'Proveedores';

// Drive folder where resident-uploaded PQRS photos land. The Apps Script's
// owning account must have Editor access to this folder.
var PQRS_PHOTOS_FOLDER_ID = '1cNlw5VwQ4ZPcvyRm7I68aMruFjn8IhjK';

// Hard limits enforced server-side to prevent abuse. Mirror the client checks.
var PQRS_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
var PQRS_PHOTO_ALLOWED_MIME = {
  'image/jpeg': true,
  'image/jpg': true,
  'image/png': true,
  'image/webp': true,
  'image/heic': true,
  'image/heif': true,
  'application/pdf': true
};

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
  if (type === 'pqrs_photo') {
    return savePqrsPhoto(data);
  }
  return savePqrs(data);
}

// Resident PQRS photo upload. Drops the file in the configured Drive folder,
// makes it readable by anyone with the link (so the URL embedded in the case
// description actually opens for admins), and returns the shareable URL.
function savePqrsPhoto(data) {
  try {
    var base64 = String(data.base64 || '');
    var fileName = String(data.fileName || 'foto.jpg').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    var mimeType = String(data.mimeType || 'application/octet-stream').toLowerCase();
    var caseRef = String(data.caseRef || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    var casa = String(data.casa || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);

    if (!base64) {
      return jsonOut({ ok: false, error: 'missing_base64' });
    }
    if (!PQRS_PHOTO_ALLOWED_MIME[mimeType]) {
      return jsonOut({ ok: false, error: 'unsupported_mime', mimeType: mimeType });
    }

    var bytes = Utilities.base64Decode(base64);
    if (bytes.length > PQRS_PHOTO_MAX_BYTES) {
      return jsonOut({ ok: false, error: 'too_large', bytes: bytes.length });
    }

    var stamp = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyyMMdd-HHmmss');
    var prefix = caseRef ? caseRef : ('Casa-' + (casa || 'NA') + '__' + stamp);
    var finalName = prefix + '__' + fileName;

    var folder;
    try {
      folder = DriveApp.getFolderById(PQRS_PHOTOS_FOLDER_ID);
    } catch (folderErr) {
      return jsonOut({
        ok: false,
        error: 'folder_inaccessible',
        message: 'La cuenta del Apps Script no puede ver la carpeta de fotos en Drive.',
        detail: String(folderErr && folderErr.message || folderErr)
      });
    }

    var blob = Utilities.newBlob(bytes, mimeType, finalName);
    var file = folder.createFile(blob);

    // Anyone-with-link viewer access: required so the URL embedded in the
    // ph-management case description is clickable for the admin without them
    // needing to be added as a Drive collaborator.
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Non-fatal; file still uploaded. Admin may need to open Drive directly.
    }

    return jsonOut({
      ok: true,
      url: file.getUrl(),
      fileId: file.getId(),
      name: file.getName(),
      mimeType: mimeType,
      bytes: bytes.length
    });
  } catch (err) {
    return jsonOut({
      ok: false,
      error: 'upload_failed',
      message: String(err && err.message || err)
    });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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

  if (action === 'executive-summary') {
    return serveExecutiveSummary();
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

function serveExecutiveSummary() {
  var REPORTING_ID = '1MI6BHRy7Y5abCb1jI1YQcEq19-bAuTDvddznDNfwcaA';
  var ss = SpreadsheetApp.openById(REPORTING_ID);
  var summarySheet = ss.getSheetByName('Resumen');
  if (!summarySheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', error: 'Resumen sheet not found. Run refreshBudgetData first.' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var values = summarySheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    rows.push({
      indicador: values[i][0],
      valor: values[i][1],
      detalle: values[i][2] || ''
    });
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', rows: rows })
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
    var data = budgetSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      result.budget.push({
        tipo: data[i][0] || '',
        categoria: data[i][1] || '',
        concepto: data[i][2] || '',
        mes: data[i][3] || '',
        mesNum: Number(data[i][4]) || 0,
        monto: Number(data[i][5]) || 0
      });
    }
  }

  // Ejecucion (actuals from latest informe)
  var execSheet = ss.getSheetByName('Ejecucion');
  if (execSheet) {
    var eData = execSheet.getDataRange().getValues();
    for (var i = 1; i < eData.length; i++) {
      result.ejecucion.push({
        categoria: eData[i][0] || '',
        concepto: eData[i][1] || '',
        presupuestoAnual: Number(eData[i][2]) || 0,
        ejecutadoMes: Number(eData[i][3]) || 0,
        ejecutadoAcumulado: Number(eData[i][4]) || 0,
        pctEjecucion: Number(eData[i][5]) || 0,
        saldoRestante: Number(eData[i][6]) || 0
      });
    }
  }

  // Meta
  var metaSheet = ss.getSheetByName('Meta');
  if (metaSheet) {
    var mData = metaSheet.getDataRange().getValues();
    for (var i = 0; i < mData.length; i++) {
      var key = String(mData[i][0] || '').trim();
      var val = mData[i][1];
      if (key === 'Último informe') result.meta.ultimoInforme = val || '';
      if (key === 'Última actualización') {
        result.meta.ultimaActualizacion = val instanceof Date ? val.toISOString() : String(val);
      }
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}
