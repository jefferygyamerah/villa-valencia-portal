/**
 * Portal APROVIVA — Google Apps Script
 *
 * Maneja envíos de PQRS y sugerencias de proveedores.
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

// POST — despacha según tipo de payload
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

// GET — devuelve datos de PQRS para el dashboard
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
      JSON.stringify({ status: 'ok', message: 'Triggers instalados' })
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

// Volcado de un informe mensual para inspección
function dumpInforme() {
  // Enero 2026 XLSX — abrir vía Drive
  var file = DriveApp.getFileById('1ZBaZpvgZ3SuJRzOpRD5TUERWUzXXzp-n');
  // Convertir XLSX a Google Sheets para leerlo
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
  // Eliminar archivo temporal
  DriveApp.getFileById(converted.id).setTrashed(true);

  return ContentService.createTextOutput(
    JSON.stringify(result, null, 2)
  ).setMimeType(ContentService.MimeType.JSON);
}

// Devuelve presupuesto + datos reales desde la hoja de reportes
function serveBudgetData() {
  var REPORTING_ID = '1MI6BHRy7Y5abCb1jI1YQcEq19-bAuTDvddznDNfwcaA';
  var ss = SpreadsheetApp.openById(REPORTING_ID);

  var result = { budget: [], ejecucion: [], meta: {} };

  // Presupuesto (planificado mensual)
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

  // Ejecución (datos reales del último informe)
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

  // Metadatos
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
