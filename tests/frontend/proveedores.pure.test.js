const {
  PROVIDERS,
  CATEGORY_LABELS,
  categoryLabel,
  filterProviders,
  findProviderById,
  validateSuggestFields,
  providerCountText,
} = require('../../js/proveedores.pure');

// ── Priority 1: Utility Functions ──

describe('categoryLabel', () => {
  test('returns label for known category', () => {
    expect(categoryLabel('aires')).toBe('Aires Acondicionados');
    expect(categoryLabel('plomeria')).toBe('Plomería');
  });

  test('returns raw key for unknown category', () => {
    expect(categoryLabel('unknown')).toBe('unknown');
  });

  test('all known categories have labels', () => {
    const knownCats = ['aires', 'catering', 'jardineria', 'linea-blanca',
      'plomeria', 'general', 'fumigacion', 'techo', 'solar', 'vidrios'];
    knownCats.forEach(cat => {
      expect(categoryLabel(cat)).not.toBe(cat);
    });
  });
});

describe('providerCountText', () => {
  test('singular for 1', () => {
    expect(providerCountText(1)).toBe('1 proveedor');
  });

  test('plural for 0', () => {
    expect(providerCountText(0)).toBe('0 proveedores');
  });

  test('plural for many', () => {
    expect(providerCountText(12)).toBe('12 proveedores');
  });
});

// ── Provider Data Integrity ──

describe('PROVIDERS data', () => {
  test('has 12 providers', () => {
    expect(PROVIDERS).toHaveLength(12);
  });

  test('all providers have required fields', () => {
    PROVIDERS.forEach(p => {
      expect(p.id).toBeDefined();
      expect(p.cat).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.service).toBeTruthy();
      expect(p.phone).toBeTruthy();
      expect(p.casa).toBeTruthy();
    });
  });

  test('all provider IDs are unique', () => {
    const ids = PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all categories have labels', () => {
    const cats = [...new Set(PROVIDERS.map(p => p.cat))];
    cats.forEach(cat => {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    });
  });
});

// ── Priority 1: Search & Filter ──

describe('filterProviders', () => {
  test('returns all when category=all and no search', () => {
    const result = filterProviders(PROVIDERS, 'all', '');
    expect(result).toHaveLength(12);
  });

  test('filters by category', () => {
    const result = filterProviders(PROVIDERS, 'aires', '');
    expect(result).toHaveLength(2);
    result.forEach(p => expect(p.cat).toBe('aires'));
  });

  test('filters by search term in name', () => {
    const result = filterProviders(PROVIDERS, 'all', 'Felix');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Felix');
  });

  test('search is case-insensitive', () => {
    const result = filterProviders(PROVIDERS, 'all', 'felix');
    expect(result).toHaveLength(1);
  });

  test('filters by search term in service', () => {
    const result = filterProviders(PROVIDERS, 'all', 'paneles solares');
    expect(result).toHaveLength(1);
    expect(result[0].cat).toBe('solar');
  });

  test('filters by search in category label', () => {
    const result = filterProviders(PROVIDERS, 'all', 'Fumigación');
    expect(result).toHaveLength(1);
    expect(result[0].cat).toBe('fumigacion');
  });

  test('combines category and search filters', () => {
    const result = filterProviders(PROVIDERS, 'aires', 'Raúl');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Raúl Moreno');
  });

  test('returns empty for non-matching search', () => {
    const result = filterProviders(PROVIDERS, 'all', 'zzzznotfound');
    expect(result).toHaveLength(0);
  });

  test('returns empty for non-matching category', () => {
    const result = filterProviders(PROVIDERS, 'nonexistent', '');
    expect(result).toHaveLength(0);
  });
});

describe('findProviderById', () => {
  test('finds existing provider', () => {
    const p = findProviderById(PROVIDERS, 1);
    expect(p).not.toBeNull();
    expect(p.name).toBe('Raúl Moreno');
  });

  test('returns null for non-existent ID', () => {
    expect(findProviderById(PROVIDERS, 999)).toBeNull();
  });

  test('finds last provider', () => {
    const p = findProviderById(PROVIDERS, 12);
    expect(p).not.toBeNull();
    expect(p.name).toBe('Vidrios y Aluminio Mega');
  });
});

// ── Priority 3: Form Validation ──

describe('validateSuggestFields', () => {
  test('valid with all required fields', () => {
    const result = validateSuggestFields({
      nombre: 'Juan',
      categoria: 'plomeria',
      servicio: 'Plomería general',
      telefono: '6123-4567',
      casa: '42',
    });
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test('invalid when name missing', () => {
    const result = validateSuggestFields({
      categoria: 'plomeria',
      servicio: 'Plomería',
      telefono: '6123-4567',
      casa: '42',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('nombre');
  });

  test('invalid when all fields missing', () => {
    const result = validateSuggestFields({});
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(5);
  });

  test('treats whitespace-only as missing', () => {
    const result = validateSuggestFields({
      nombre: '   ',
      categoria: 'plomeria',
      servicio: 'Plomería',
      telefono: '6123-4567',
      casa: '42',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('nombre');
  });

  test('optional fields do not affect validation', () => {
    const result = validateSuggestFields({
      nombre: 'Juan',
      categoria: 'plomeria',
      servicio: 'Plomería',
      telefono: '6123-4567',
      casa: '42',
      correo: '',
      recomendadoPor: '',
      comentario: '',
    });
    expect(result.valid).toBe(true);
  });
});
