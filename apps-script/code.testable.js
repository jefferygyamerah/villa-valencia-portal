/**
 * Testable extraction of Apps Script logic.
 * Wraps Code.gs and Reporting.gs functions with dependency injection
 * so they can be tested without Google API access.
 */

/**
 * Parse doPost payload and determine routing.
 * Returns { type: 'pqrs'|'provider', data: object }
 */
function parsePostPayload(contents) {
  var data = JSON.parse(contents);
  var type = data._type || 'pqrs';
  return { type: type, data: data };
}

/**
 * Build a PQRS row from submitted data.
 * Returns array matching sheet column order.
 */
function buildPqrsRow(data, timestamp) {
  return [
    timestamp,
    data.resumen || '',
    data.descripcion || '',
    data.tipo || '',
    data.ubicacion || '',
    data.urgencia || '',
    data.casa || ''
  ];
}

/**
 * Build a provider suggestion row from submitted data.
 * Returns array matching sheet column order.
 */
function buildProviderRow(data, timestamp) {
  return [
    timestamp,
    data.nombre || '',
    data.categoria || '',
    data.servicio || '',
    data.telefono || '',
    data.correo || '',
    data.casa || '',
    data.recomendadoPor || '',
    data.comentario || ''
  ];
}

/**
 * Parse sheet data into PQRS dashboard rows.
 * Input: 2D array from getDataRange().getValues() (with header row).
 * Returns array of row objects.
 */
function parseSheetToPqrsRows(data) {
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
  return rows;
}

/**
 * Route a doGet action parameter to the correct handler name.
 * Returns the handler name string.
 */
function routeGetAction(action) {
  var routes = {
    'setup-reporting': 'setupReporting',
    'install-triggers': 'installTriggers',
    'dump-informe': 'dumpInforme',
    'budget': 'serveBudgetData',
  };
  return routes[action] || 'pqrsDashboard';
}

/**
 * Parse budget sheet data into budget objects.
 * Input: 2D array from getDataRange().getValues() (with header row).
 */
function parseBudgetSheet(data) {
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      tipo: data[i][0] || '',
      categoria: data[i][1] || '',
      concepto: data[i][2] || '',
      mes: data[i][3] || '',
      mesNum: Number(data[i][4]) || 0,
      monto: Number(data[i][5]) || 0
    });
  }
  return rows;
}

/**
 * Parse ejecucion sheet data into actuals objects.
 */
function parseEjecucionSheet(data) {
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      categoria: data[i][0] || '',
      concepto: data[i][1] || '',
      presupuestoAnual: Number(data[i][2]) || 0,
      ejecutadoMes: Number(data[i][3]) || 0,
      ejecutadoAcumulado: Number(data[i][4]) || 0,
      pctEjecucion: Number(data[i][5]) || 0,
      saldoRestante: Number(data[i][6]) || 0
    });
  }
  return rows;
}

/**
 * Parse meta sheet key-value pairs.
 */
function parseMetaSheet(data) {
  var meta = {};
  for (var i = 0; i < data.length; i++) {
    var key = String(data[i][0] || '').trim();
    var val = data[i][1];
    if (key === 'Último informe') meta.ultimoInforme = val || '';
    if (key === 'Última actualización') {
      meta.ultimaActualizacion = val instanceof Date ? val.toISOString() : String(val);
    }
  }
  return meta;
}

/**
 * Detect category from informe row concept name.
 * Returns new category if this is a header row, or null if not.
 */
function detectInformeCategory(concepto, hasAmount) {
  if (concepto === 'Ingresos') return 'Ingresos';
  if (concepto === 'Total de Ingresos') return null; // skip
  if (concepto.indexOf('Gastos Generales') !== -1) return 'Gastos';
  if (concepto.indexOf('Gastos de Personal') !== -1) return 'Gastos de Personal';
  if (concepto.indexOf('Servicios Básicos') !== -1 && !hasAmount) return 'Servicios Básicos';
  if (concepto.indexOf('Gastos de Funcionamiento') !== -1 && !hasAmount) return 'Gastos de Funcionamiento';
  if (concepto.indexOf('Mantenimientos Preventivos') !== -1 && !hasAmount) return 'Mantenimientos Preventivos';
  if (concepto.indexOf('Mantenimientos Correctivos') !== -1 && !hasAmount) return 'Mantenimientos Correctivos';
  if (concepto.indexOf('Otros Gastos') !== -1 && !hasAmount) return 'Otros Gastos';
  return null;
}

/**
 * Check if a row is a total/summary row that should be skipped.
 */
function isSkippableRow(concepto) {
  return concepto.indexOf('Total de') !== -1 || concepto.indexOf('TOTAL') !== -1;
}

/**
 * Extract month name from informe header text.
 */
function extractMonthFromHeader(headerText) {
  var match = headerText.match(
    /(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)/i
  );
  return match ? match[0] : '';
}

/**
 * Build budget flat table rows from annual budget data.
 * Returns 2D array including header row.
 */
function buildBudgetFlatTable(budgetRows, months) {
  var headers = ['Tipo', 'Categoría', 'Concepto', 'Mes', 'Mes_Num', 'Presupuestado'];
  var flatRows = [headers];
  for (var i = 0; i < budgetRows.length; i++) {
    var r = budgetRows[i];
    var tipo = r.categoria === 'Ingresos' ? 'Ingresos' : 'Gastos';
    for (var m = 0; m < 12; m++) {
      flatRows.push([tipo, r.categoria, r.concepto, months[m], m + 1, r.monthly[m]]);
    }
  }
  return flatRows;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parsePostPayload: parsePostPayload,
    buildPqrsRow: buildPqrsRow,
    buildProviderRow: buildProviderRow,
    parseSheetToPqrsRows: parseSheetToPqrsRows,
    routeGetAction: routeGetAction,
    parseBudgetSheet: parseBudgetSheet,
    parseEjecucionSheet: parseEjecucionSheet,
    parseMetaSheet: parseMetaSheet,
    detectInformeCategory: detectInformeCategory,
    isSkippableRow: isSkippableRow,
    extractMonthFromHeader: extractMonthFromHeader,
    buildBudgetFlatTable: buildBudgetFlatTable,
  };
}
