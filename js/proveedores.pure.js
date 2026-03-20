/**
 * Pure/testable functions extracted from proveedores.js
 */

var PROVIDERS = [
  { id:1,  cat:'aires',       icon:'\u2744\uFE0F', name:'Ra\u00fal Moreno',              service:'Limpieza, reparaci\u00f3n e instalaci\u00f3n de aires acondicionados', phone:'6588-7198', email:null,                       casa:'98'  },
  { id:2,  cat:'catering',    icon:'\uD83C\uDF7D\uFE0F', name:'Cheffy Le Cheff',          service:'Catering, comida y equipo para fiestas',                     phone:'269-1220',  email:'Ventas@cheffylecheff.com', casa:'60'  },
  { id:3,  cat:'jardineria',  icon:'\uD83C\uDF3F', name:'H\u00e9ctor Ca\u00f1ate',        service:'Jardiner\u00eda',                                            phone:'6461-7563', email:null,                       casa:'98'  },
  { id:4,  cat:'linea-blanca',icon:'\uD83E\uDEE7', name:'Antonio',                        service:'Lavadoras, secadoras \u2014 reparaci\u00f3n y mantenimiento', phone:'6983-8544', email:null,                       casa:'98'  },
  { id:5,  cat:'plomeria',    icon:'\uD83D\uDEB0', name:'Dario Hernandez',                service:'Plomer\u00eda',                                              phone:'6634-4065', email:null,                       casa:'104' },
  { id:6,  cat:'general',     icon:'\uD83D\uDD28', name:'Marcos Sanchez',                 service:'Trabajos generales: pintura, techo, alba\u00f1iler\u00eda',   phone:'6484-6335', email:null,                       casa:'104' },
  { id:7,  cat:'aires',       icon:'\u2744\uFE0F', name:'Felix',                          service:'Aires acondicionados \u2014 instalaci\u00f3n y mantenimiento',phone:'6813-4069', email:null,                       casa:'104' },
  { id:8,  cat:'fumigacion',  icon:'\uD83E\uDEB2', name:'Alexis Angulo',                  service:'Fumigaci\u00f3n',                                            phone:'6320-3154', email:null,                       casa:'104' },
  { id:9,  cat:'jardineria',  icon:'\uD83C\uDF3F', name:'Norbing Mercado',                service:'Jardiner\u00eda',                                            phone:'6580-2214', email:null,                       casa:'104' },
  { id:10, cat:'techo',       icon:'\uD83C\uDFE0', name:'Carlos Ya\u00f1ez',              service:'Techo y canales de techo',                                   phone:'6487-0098', email:null,                       casa:'104' },
  { id:11, cat:'solar',       icon:'\u2600\uFE0F', name:'W&A Engineering Solutions',      service:'Instalaci\u00f3n y mantenimiento de paneles solares',         phone:'6998-5838', email:null,                       casa:'66'  },
  { id:12, cat:'vidrios',     icon:'\uD83E\uDE9F', name:'Vidrios y Aluminio Mega',        service:'Ventanas y vidrios',                                         phone:'6415-8511', email:null,                       casa:'89'  },
];

var CATEGORY_LABELS = {
  'aires':'Aires Acondicionados', 'catering':'Catering / Eventos',
  'jardineria':'Jardinería', 'linea-blanca':'Línea Blanca',
  'plomeria':'Plomería',     'general':'Trabajos Generales',
  'fumigacion':'Fumigación', 'techo':'Techo y Canales',
  'solar':'Paneles Solares', 'vidrios':'Vidrios y Aluminio'
};

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || cat;
}

/**
 * Filter providers by category and search term.
 * Returns filtered array of provider objects.
 */
function filterProviders(providers, category, searchTerm) {
  var search = (searchTerm || '').toLowerCase();
  return providers.filter(function (p) {
    var matchCat = category === 'all' || p.cat === category;
    var matchSearch = !search ||
      p.name.toLowerCase().indexOf(search) !== -1 ||
      p.service.toLowerCase().indexOf(search) !== -1 ||
      categoryLabel(p.cat).toLowerCase().indexOf(search) !== -1;
    return matchCat && matchSearch;
  });
}

/**
 * Find a provider by ID.
 * Returns the provider object or null.
 */
function findProviderById(providers, id) {
  for (var i = 0; i < providers.length; i++) {
    if (providers[i].id === id) return providers[i];
  }
  return null;
}

/**
 * Validate provider suggestion fields.
 * Returns { valid: boolean, missing: string[] }
 */
function validateSuggestFields(fields) {
  var required = ['nombre', 'categoria', 'servicio', 'telefono', 'casa'];
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    var val = (fields[required[i]] || '').trim();
    if (!val) missing.push(required[i]);
  }
  return { valid: missing.length === 0, missing: missing };
}

/**
 * Format provider count text.
 */
function providerCountText(count) {
  return count + ' proveedor' + (count !== 1 ? 'es' : '');
}

var _exports = {
  PROVIDERS: PROVIDERS,
  CATEGORY_LABELS: CATEGORY_LABELS,
  categoryLabel: categoryLabel,
  filterProviders: filterProviders,
  findProviderById: findProviderById,
  validateSuggestFields: validateSuggestFields,
  providerCountText: providerCountText,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
} else if (typeof window !== 'undefined') {
  window.APROVIVA = window.APROVIVA || {};
  for (var _k in _exports) {
    if (_exports.hasOwnProperty(_k)) window.APROVIVA[_k] = _exports[_k];
  }
}
