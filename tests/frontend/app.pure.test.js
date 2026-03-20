const {
  formatDate,
  escapeHtml,
  fmtNum,
  isScriptConfigured,
  getLastInformeMonth,
  computeDashboardKpis,
  computeBudgetSummary,
  computeMonthlyTrend,
  validatePqrsFields,
} = require('../../js/app.pure');

// ── Priority 1: Utility Functions ──

describe('escapeHtml', () => {
  test('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  test('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('handles null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  test('handles undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  test('handles numbers', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  test('preserves safe strings', () => {
    expect(escapeHtml('Casa 104 - Villa Valencia')).toBe('Casa 104 - Villa Valencia');
  });

  test('escapes mixed content', () => {
    expect(escapeHtml('<b>"Hola" & \'adiós\'</b>')).toBe(
      '&lt;b&gt;&quot;Hola&quot; &amp; &#039;adiós&#039;&lt;/b&gt;'
    );
  });
});

describe('formatDate', () => {
  test('formats a valid ISO date', () => {
    // Use UTC to avoid timezone issues in tests
    const result = formatDate('2026-03-15T12:00:00Z');
    expect(result).toMatch(/15 mar/);
  });

  test('formats January date', () => {
    const result = formatDate('2026-01-01T12:00:00Z');
    expect(result).toMatch(/1 ene/);
  });

  test('formats December date', () => {
    const result = formatDate('2026-12-25T12:00:00Z');
    expect(result).toMatch(/25 dic/);
  });

  test('returns empty string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  test('returns a string for null (Date(null) is epoch)', () => {
    // Date(null) is valid (epoch), so it returns a formatted date
    const result = formatDate(null);
    expect(typeof result).toBe('string');
  });

  test('returns a string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  test('handles Date object-like timestamp', () => {
    const result = formatDate(new Date(2026, 5, 10).toISOString());
    expect(result).toMatch(/10 jun/);
  });
});

describe('fmtNum', () => {
  test('formats zero', () => {
    expect(fmtNum(0)).toBe('0');
  });

  test('formats small number', () => {
    expect(fmtNum(200)).toBe('200');
  });

  test('formats large number with grouping', () => {
    const result = fmtNum(23600);
    // Different locales may use comma, period, or thin space
    expect(result.replace(/[\s.,]/g, '')).toBe('23600');
  });

  test('formats negative number', () => {
    const result = fmtNum(-5000);
    expect(result).toContain('5');
    expect(result).toMatch(/-/);
  });

  test('handles NaN', () => {
    expect(fmtNum(NaN)).toBe('0');
  });

  test('handles non-number', () => {
    expect(fmtNum('abc')).toBe('0');
  });

  test('truncates decimals', () => {
    const result = fmtNum(1234.56);
    // Should have 0 decimal places
    expect(result.replace(/[\s.,]/g, '')).toBe('1235');
  });
});

describe('isScriptConfigured', () => {
  test('returns true for valid URL', () => {
    expect(isScriptConfigured({
      APPS_SCRIPT_URL: 'https://script.google.com/macros/s/abc123/exec'
    })).toBe(true);
  });

  test('returns false for placeholder URL', () => {
    expect(isScriptConfigured({
      APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL'
    })).toBe(false);
  });

  test('returns falsy for empty URL', () => {
    expect(isScriptConfigured({ APPS_SCRIPT_URL: '' })).toBeFalsy();
  });

  test('returns falsy for null config', () => {
    expect(isScriptConfigured(null)).toBeFalsy();
  });

  test('returns falsy for missing URL property', () => {
    expect(isScriptConfigured({})).toBeFalsy();
  });
});

describe('getLastInformeMonth', () => {
  test('returns correct month number for Enero', () => {
    expect(getLastInformeMonth({ ultimoInforme: 'Enero' })).toBe(1);
  });

  test('returns correct month number for Diciembre', () => {
    expect(getLastInformeMonth({ ultimoInforme: 'Diciembre' })).toBe(12);
  });

  test('is case-insensitive', () => {
    expect(getLastInformeMonth({ ultimoInforme: 'marzo' })).toBe(3);
    expect(getLastInformeMonth({ ultimoInforme: 'JUNIO' })).toBe(6);
  });

  test('trims whitespace', () => {
    expect(getLastInformeMonth({ ultimoInforme: '  Febrero  ' })).toBe(2);
  });

  test('returns 0 for empty string', () => {
    expect(getLastInformeMonth({ ultimoInforme: '' })).toBe(0);
  });

  test('returns 0 for unrecognized month', () => {
    expect(getLastInformeMonth({ ultimoInforme: 'January' })).toBe(0);
  });

  test('returns 0 for null meta', () => {
    expect(getLastInformeMonth(null)).toBe(0);
  });

  test('returns 0 for missing ultimoInforme', () => {
    expect(getLastInformeMonth({})).toBe(0);
  });
});

// ── Priority 3: Form Validation ──

describe('validatePqrsFields', () => {
  test('valid when all required fields present', () => {
    const result = validatePqrsFields({
      resumen: 'Test',
      descripcion: 'Some issue',
      tipo: 'Queja',
      ubicacion: 'Piscina',
      casa: '42',
    });
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test('invalid when descripcion missing', () => {
    const result = validatePqrsFields({
      tipo: 'Queja',
      ubicacion: 'Piscina',
      casa: '42',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('descripcion');
  });

  test('invalid when multiple fields missing', () => {
    const result = validatePqrsFields({});
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['descripcion', 'tipo', 'ubicacion', 'casa']);
  });

  test('treats whitespace-only as missing', () => {
    const result = validatePqrsFields({
      descripcion: '   ',
      tipo: 'Queja',
      ubicacion: 'Piscina',
      casa: '42',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('descripcion');
  });

  test('resumen is optional', () => {
    const result = validatePqrsFields({
      descripcion: 'Problem',
      tipo: 'Solicitud',
      ubicacion: 'Cancha',
      casa: '1',
    });
    expect(result.valid).toBe(true);
  });
});

// ── Priority 4: Dashboard Calculation Logic ──

describe('computeDashboardKpis', () => {
  const rows = [
    { urgencia: 'Alta', tipo: 'Queja', ubicacion: 'Piscina' },
    { urgencia: 'Alta', tipo: 'Queja', ubicacion: 'Piscina' },
    { urgencia: 'Media', tipo: 'Solicitud', ubicacion: 'Cancha' },
    { urgencia: 'Baja', tipo: 'Solicitud', ubicacion: 'Parque' },
    { urgencia: '', tipo: '', ubicacion: '' },
  ];

  test('counts total rows', () => {
    expect(computeDashboardKpis(rows).total).toBe(5);
  });

  test('counts urgency levels', () => {
    const kpis = computeDashboardKpis(rows);
    expect(kpis.alta).toBe(2);
    expect(kpis.media).toBe(1);
    expect(kpis.baja).toBe(1);
  });

  test('aggregates by tipo', () => {
    const kpis = computeDashboardKpis(rows);
    expect(kpis.tipoCounts['Queja']).toBe(2);
    expect(kpis.tipoCounts['Solicitud']).toBe(2);
    expect(kpis.tipoCounts['Sin tipo']).toBe(1);
  });

  test('aggregates by ubicacion', () => {
    const kpis = computeDashboardKpis(rows);
    expect(kpis.ubicacionCounts['Piscina']).toBe(2);
    expect(kpis.ubicacionCounts['Cancha']).toBe(1);
    expect(kpis.ubicacionCounts['Sin ubicación']).toBe(1);
  });

  test('handles empty rows', () => {
    const kpis = computeDashboardKpis([]);
    expect(kpis.total).toBe(0);
    expect(kpis.alta).toBe(0);
    expect(Object.keys(kpis.tipoCounts)).toHaveLength(0);
  });

  test('urgency matching is case-insensitive', () => {
    const kpis = computeDashboardKpis([
      { urgencia: 'ALTA', tipo: 'X', ubicacion: 'Y' },
      { urgencia: 'alta', tipo: 'X', ubicacion: 'Y' },
    ]);
    expect(kpis.alta).toBe(2);
  });
});

describe('computeBudgetSummary', () => {
  const budgetData = [
    { tipo: 'Ingresos', categoria: 'Ingresos', mesNum: 1, monto: 23600 },
    { tipo: 'Ingresos', categoria: 'Ingresos', mesNum: 2, monto: 23600 },
    { tipo: 'Gastos', categoria: 'Servicios Básicos', mesNum: 1, monto: 5000 },
    { tipo: 'Gastos', categoria: 'Servicios Básicos', mesNum: 2, monto: 5000 },
    { tipo: 'Gastos', categoria: 'Gastos de Funcionamiento', mesNum: 1, monto: 3000 },
    { tipo: 'Gastos', categoria: 'Gastos de Funcionamiento', mesNum: 2, monto: 3000 },
  ];

  const ejecucionData = [
    { categoria: 'Servicios Básicos', ejecutadoMes: 4800, ejecutadoAcumulado: 4800 },
    { categoria: 'Gastos de Funcionamiento', ejecutadoMes: 2500, ejecutadoAcumulado: 2500 },
  ];

  test('computes annual totals when no month selected', () => {
    const result = computeBudgetSummary(budgetData, [], 0, 0);
    expect(result.totalIngresos).toBe(47200);
    expect(result.totalGastos).toBe(16000);
  });

  test('filters by month when month selected', () => {
    const result = computeBudgetSummary(budgetData, [], 1, 0);
    expect(result.totalIngresos).toBe(23600);
    expect(result.totalGastos).toBe(8000);
  });

  test('computes category breakdown', () => {
    const result = computeBudgetSummary(budgetData, [], 1, 0);
    expect(result.catBudget['Servicios Básicos']).toBe(5000);
    expect(result.catBudget['Gastos de Funcionamiento']).toBe(3000);
  });

  test('computes actuals when available', () => {
    const result = computeBudgetSummary(budgetData, ejecucionData, 1, 1);
    expect(result.showActuals).toBe(true);
    expect(result.totalEjecGastos).toBe(7300);
    expect(result.catEjec['Servicios Básicos']).toBe(4800);
  });

  test('uses ejecutadoAcumulado for annual view', () => {
    const result = computeBudgetSummary(budgetData, ejecucionData, 0, 1);
    expect(result.totalEjecGastos).toBe(7300);
  });

  test('no actuals when ejecucion empty', () => {
    const result = computeBudgetSummary(budgetData, [], 1, 1);
    expect(result.showActuals).toBe(false);
    expect(result.totalEjecGastos).toBe(0);
  });

  test('no actuals for future month', () => {
    const result = computeBudgetSummary(budgetData, ejecucionData, 2, 1);
    expect(result.showActuals).toBe(false);
  });

  test('compareBudget limited to months with data in annual view', () => {
    const result = computeBudgetSummary(budgetData, ejecucionData, 0, 1);
    // lastMonth=1, so only month 1 budget should count for comparison
    expect(result.compareBudget).toBe(8000);
  });

  test('execution percentage calculation', () => {
    const result = computeBudgetSummary(budgetData, ejecucionData, 1, 1);
    // 7300/8000 = 91.25% → rounds to 91
    expect(result.pctGlobal).toBe(91);
  });

  test('zero percentage when no budget', () => {
    const result = computeBudgetSummary([], [], 0, 0);
    expect(result.pctGlobal).toBe(0);
  });
});

describe('computeMonthlyTrend', () => {
  const catOrder = ['Servicios Básicos', 'Gastos de Funcionamiento'];
  const budgetData = [
    { tipo: 'Gastos', categoria: 'Servicios Básicos', mesNum: 1, monto: 5000 },
    { tipo: 'Gastos', categoria: 'Servicios Básicos', mesNum: 2, monto: 6000 },
    { tipo: 'Gastos', categoria: 'Gastos de Funcionamiento', mesNum: 1, monto: 3000 },
    { tipo: 'Ingresos', categoria: 'Ingresos', mesNum: 1, monto: 23600 },
  ];

  test('produces 12 months of data', () => {
    const result = computeMonthlyTrend(budgetData, catOrder);
    expect(result.monthCats).toHaveLength(12);
  });

  test('aggregates categories per month', () => {
    const result = computeMonthlyTrend(budgetData, catOrder);
    expect(result.monthCats[0]['Servicios Básicos']).toBe(5000);
    expect(result.monthCats[0]['Gastos de Funcionamiento']).toBe(3000);
    expect(result.monthCats[1]['Servicios Básicos']).toBe(6000);
  });

  test('excludes Ingresos', () => {
    const result = computeMonthlyTrend(budgetData, catOrder);
    expect(result.monthCats[0]['Ingresos']).toBeUndefined();
  });

  test('maxMonth is the largest monthly total', () => {
    const result = computeMonthlyTrend(budgetData, catOrder);
    // Month 1: 5000+3000=8000, Month 2: 6000=6000
    expect(result.maxMonth).toBe(8000);
  });

  test('activeCats only includes categories with data', () => {
    const result = computeMonthlyTrend(budgetData, catOrder);
    expect(result.activeCats).toContain('Servicios Básicos');
    expect(result.activeCats).toContain('Gastos de Funcionamiento');
  });

  test('empty data produces zero totals', () => {
    const result = computeMonthlyTrend([], catOrder);
    expect(result.maxMonth).toBe(0);
    expect(result.activeCats).toHaveLength(0);
  });
});
