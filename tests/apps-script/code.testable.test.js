const {
  parsePostPayload,
  buildPqrsRow,
  buildProviderRow,
  parseSheetToPqrsRows,
  routeGetAction,
  parseBudgetSheet,
  parseEjecucionSheet,
  parseMetaSheet,
  detectInformeCategory,
  isSkippableRow,
  extractMonthFromHeader,
  buildBudgetFlatTable,
} = require('../../apps-script/code.testable');

// ── Priority 2: POST Dispatch ──

describe('parsePostPayload', () => {
  test('defaults to pqrs type when _type missing', () => {
    const result = parsePostPayload('{"descripcion":"test"}');
    expect(result.type).toBe('pqrs');
    expect(result.data.descripcion).toBe('test');
  });

  test('routes to provider when _type=provider', () => {
    const result = parsePostPayload('{"_type":"provider","nombre":"Juan"}');
    expect(result.type).toBe('provider');
    expect(result.data.nombre).toBe('Juan');
  });

  test('throws on invalid JSON', () => {
    expect(() => parsePostPayload('not json')).toThrow();
  });
});

// ── Priority 2: Row Building ──

describe('buildPqrsRow', () => {
  const ts = new Date('2026-03-15T10:00:00Z');

  test('builds complete row', () => {
    const row = buildPqrsRow({
      resumen: 'Fuga de agua',
      descripcion: 'Hay una fuga en el área común',
      tipo: 'Queja',
      ubicacion: 'Piscina',
      urgencia: 'Alta',
      casa: '42',
    }, ts);

    expect(row).toEqual([
      ts, 'Fuga de agua', 'Hay una fuga en el área común',
      'Queja', 'Piscina', 'Alta', '42',
    ]);
  });

  test('defaults missing fields to empty strings', () => {
    const row = buildPqrsRow({}, ts);
    expect(row).toEqual([ts, '', '', '', '', '', '']);
  });

  test('row has correct column count', () => {
    const row = buildPqrsRow({}, ts);
    expect(row).toHaveLength(7);
  });
});

describe('buildProviderRow', () => {
  const ts = new Date('2026-03-15T10:00:00Z');

  test('builds complete row', () => {
    const row = buildProviderRow({
      nombre: 'Juan Pérez',
      categoria: 'plomeria',
      servicio: 'Plomería general',
      telefono: '6123-4567',
      correo: 'juan@test.com',
      casa: '10',
      recomendadoPor: 'María',
      comentario: 'Buen trabajo',
    }, ts);

    expect(row).toEqual([
      ts, 'Juan Pérez', 'plomeria', 'Plomería general',
      '6123-4567', 'juan@test.com', '10', 'María', 'Buen trabajo',
    ]);
  });

  test('defaults missing fields to empty strings', () => {
    const row = buildProviderRow({}, ts);
    expect(row).toEqual([ts, '', '', '', '', '', '', '', '']);
  });

  test('row has correct column count', () => {
    const row = buildProviderRow({}, ts);
    expect(row).toHaveLength(9);
  });
});

// ── Priority 2: Sheet Data Parsing ──

describe('parseSheetToPqrsRows', () => {
  test('skips header row', () => {
    const data = [
      ['Timestamp', 'Resumen', 'Descripción', 'Tipo', 'Ubicación', 'Urgencia', 'Casa'],
      [new Date('2026-01-15T12:00:00Z'), 'Test', 'Desc', 'Queja', 'Piscina', 'Alta', 42],
    ];
    const rows = parseSheetToPqrsRows(data);
    expect(rows).toHaveLength(1);
  });

  test('converts Date timestamp to ISO string', () => {
    const data = [
      ['Header'],
      [new Date('2026-01-15T12:00:00Z'), 'R', 'D', 'T', 'U', 'Urg', '42'],
    ];
    const rows = parseSheetToPqrsRows(data);
    expect(rows[0].timestamp).toBe('2026-01-15T12:00:00.000Z');
  });

  test('converts non-Date timestamp to string', () => {
    const data = [
      ['Header'],
      ['2026-01-15', 'R', 'D', 'T', 'U', 'Urg', '42'],
    ];
    const rows = parseSheetToPqrsRows(data);
    expect(rows[0].timestamp).toBe('2026-01-15');
  });

  test('converts casa to string', () => {
    const data = [
      ['Header'],
      [new Date(), '', '', '', '', '', 42],
    ];
    const rows = parseSheetToPqrsRows(data);
    expect(rows[0].casa).toBe('42');
  });

  test('handles empty sheet (header only)', () => {
    const data = [['Header']];
    const rows = parseSheetToPqrsRows(data);
    expect(rows).toHaveLength(0);
  });

  test('defaults missing values to empty string', () => {
    const data = [
      ['Header'],
      [new Date(), null, undefined, '', null, null, null],
    ];
    const rows = parseSheetToPqrsRows(data);
    expect(rows[0].resumen).toBe('');
    expect(rows[0].descripcion).toBe('');
    expect(rows[0].casa).toBe('');
  });
});

// ── Priority 2: GET Routing ──

describe('routeGetAction', () => {
  test('routes budget action', () => {
    expect(routeGetAction('budget')).toBe('serveBudgetData');
  });

  test('routes setup-reporting action', () => {
    expect(routeGetAction('setup-reporting')).toBe('setupReporting');
  });

  test('routes install-triggers action', () => {
    expect(routeGetAction('install-triggers')).toBe('installTriggers');
  });

  test('routes dump-informe action', () => {
    expect(routeGetAction('dump-informe')).toBe('dumpInforme');
  });

  test('defaults to pqrsDashboard for unknown action', () => {
    expect(routeGetAction('unknown')).toBe('pqrsDashboard');
  });

  test('defaults to pqrsDashboard for undefined', () => {
    expect(routeGetAction(undefined)).toBe('pqrsDashboard');
  });
});

// ── Priority 2: Budget Data Parsing ──

describe('parseBudgetSheet', () => {
  test('parses budget rows correctly', () => {
    const data = [
      ['Tipo', 'Categoría', 'Concepto', 'Mes', 'Mes_Num', 'Presupuestado'],
      ['Gastos', 'Servicios Básicos', 'Agua', 'Enero', 1, 500],
      ['Ingresos', 'Ingresos', 'Cuotas', 'Enero', 1, 23600],
    ];
    const rows = parseBudgetSheet(data);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      tipo: 'Gastos',
      categoria: 'Servicios Básicos',
      concepto: 'Agua',
      mes: 'Enero',
      mesNum: 1,
      monto: 500,
    });
  });

  test('converts monto to number', () => {
    const data = [
      ['Header'],
      ['Gastos', 'Cat', 'Concepto', 'Ene', '3', '1500.50'],
    ];
    const rows = parseBudgetSheet(data);
    expect(rows[0].monto).toBe(1500.5);
  });

  test('defaults missing values', () => {
    const data = [
      ['Header'],
      [null, null, null, null, null, null],
    ];
    const rows = parseBudgetSheet(data);
    expect(rows[0]).toEqual({
      tipo: '', categoria: '', concepto: '', mes: '', mesNum: 0, monto: 0,
    });
  });
});

describe('parseEjecucionSheet', () => {
  test('parses ejecucion rows correctly', () => {
    const data = [
      ['Categoría', 'Concepto', 'Pres_Anual', 'Ejec_Mes', 'Ejec_Acum', 'Pct', 'Saldo'],
      ['Servicios Básicos', 'Agua', 6000, 480, 480, 8, 5520],
    ];
    const rows = parseEjecucionSheet(data);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      categoria: 'Servicios Básicos',
      concepto: 'Agua',
      presupuestoAnual: 6000,
      ejecutadoMes: 480,
      ejecutadoAcumulado: 480,
      pctEjecucion: 8,
      saldoRestante: 5520,
    });
  });
});

describe('parseMetaSheet', () => {
  test('parses ultimo informe', () => {
    const data = [
      ['Último informe', 'Enero'],
      ['Última actualización', '2026-01-31'],
    ];
    const meta = parseMetaSheet(data);
    expect(meta.ultimoInforme).toBe('Enero');
    expect(meta.ultimaActualizacion).toBe('2026-01-31');
  });

  test('handles Date value for actualizacion', () => {
    const date = new Date('2026-01-31T10:00:00Z');
    const data = [
      ['Última actualización', date],
    ];
    const meta = parseMetaSheet(data);
    expect(meta.ultimaActualizacion).toBe('2026-01-31T10:00:00.000Z');
  });

  test('handles empty sheet', () => {
    const meta = parseMetaSheet([]);
    expect(meta).toEqual({});
  });
});

// ── Priority 2: Informe Parsing Helpers ──

describe('detectInformeCategory', () => {
  test('detects Ingresos', () => {
    expect(detectInformeCategory('Ingresos', false)).toBe('Ingresos');
  });

  test('skips Total de Ingresos', () => {
    expect(detectInformeCategory('Total de Ingresos', false)).toBeNull();
  });

  test('detects Servicios Básicos header (no amount)', () => {
    expect(detectInformeCategory('Servicios Básicos', false)).toBe('Servicios Básicos');
  });

  test('ignores Servicios Básicos when it has an amount (line item)', () => {
    expect(detectInformeCategory('Servicios Básicos', true)).toBeNull();
  });

  test('detects Gastos de Funcionamiento', () => {
    expect(detectInformeCategory('Gastos de Funcionamiento', false)).toBe('Gastos de Funcionamiento');
  });

  test('detects Mantenimientos Preventivos', () => {
    expect(detectInformeCategory('Mantenimientos Preventivos', false)).toBe('Mantenimientos Preventivos');
  });

  test('detects Mantenimientos Correctivos', () => {
    expect(detectInformeCategory('Mantenimientos Correctivos', false)).toBe('Mantenimientos Correctivos');
  });

  test('detects Otros Gastos', () => {
    expect(detectInformeCategory('Otros Gastos', false)).toBe('Otros Gastos');
  });

  test('detects Gastos de Personal', () => {
    expect(detectInformeCategory('Gastos de Personal', false)).toBe('Gastos de Personal');
  });

  test('returns null for regular line items', () => {
    expect(detectInformeCategory('Agua', false)).toBeNull();
    expect(detectInformeCategory('Electricidad', true)).toBeNull();
  });
});

describe('isSkippableRow', () => {
  test('skips "Total de Gastos"', () => {
    expect(isSkippableRow('Total de Gastos')).toBe(true);
  });

  test('skips "TOTAL GASTOS"', () => {
    expect(isSkippableRow('TOTAL GASTOS')).toBe(true);
  });

  test('skips "Total de Servicios Básicos"', () => {
    expect(isSkippableRow('Total de Servicios Básicos')).toBe(true);
  });

  test('does not skip regular items', () => {
    expect(isSkippableRow('Agua')).toBe(false);
    expect(isSkippableRow('Electricidad')).toBe(false);
  });
});

describe('extractMonthFromHeader', () => {
  test('extracts month from standard header', () => {
    expect(extractMonthFromHeader('Al 31 de Enero de 2026')).toBe('Enero');
  });

  test('extracts Diciembre', () => {
    expect(extractMonthFromHeader('Al 31 de Diciembre de 2026')).toBe('Diciembre');
  });

  test('case-insensitive match', () => {
    expect(extractMonthFromHeader('al 28 de febrero de 2026')).toBe('febrero');
  });

  test('returns empty for no match', () => {
    expect(extractMonthFromHeader('Some random text')).toBe('');
  });

  test('returns empty for empty string', () => {
    expect(extractMonthFromHeader('')).toBe('');
  });
});

// ── Priority 2: Flat Table Building ──

describe('buildBudgetFlatTable', () => {
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  test('includes header row', () => {
    const result = buildBudgetFlatTable([], months);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([
      'Tipo', 'Categoría', 'Concepto', 'Mes', 'Mes_Num', 'Presupuestado',
    ]);
  });

  test('creates 12 rows per budget item', () => {
    const budgetRows = [{
      concepto: 'Agua',
      categoria: 'Servicios Básicos',
      annual: 6000,
      monthly: [500,500,500,500,500,500,500,500,500,500,500,500],
    }];
    const result = buildBudgetFlatTable(budgetRows, months);
    // 1 header + 12 month rows
    expect(result).toHaveLength(13);
  });

  test('sets tipo=Ingresos for income category', () => {
    const budgetRows = [{
      concepto: 'Cuotas',
      categoria: 'Ingresos',
      annual: 23600 * 12,
      monthly: Array(12).fill(23600),
    }];
    const result = buildBudgetFlatTable(budgetRows, months);
    expect(result[1][0]).toBe('Ingresos');
  });

  test('sets tipo=Gastos for expense categories', () => {
    const budgetRows = [{
      concepto: 'Agua',
      categoria: 'Servicios Básicos',
      annual: 6000,
      monthly: Array(12).fill(500),
    }];
    const result = buildBudgetFlatTable(budgetRows, months);
    expect(result[1][0]).toBe('Gastos');
  });

  test('month names and numbers are correct', () => {
    const budgetRows = [{
      concepto: 'Test',
      categoria: 'Otros Gastos',
      annual: 1200,
      monthly: Array(12).fill(100),
    }];
    const result = buildBudgetFlatTable(budgetRows, months);
    expect(result[1][3]).toBe('Enero');
    expect(result[1][4]).toBe(1);
    expect(result[12][3]).toBe('Diciembre');
    expect(result[12][4]).toBe(12);
  });
});
