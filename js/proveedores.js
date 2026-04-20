/**
 * APROVIVA Portal – Proveedores page logic
 */
(function () {
  'use strict';

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
    'jardineria':'Jardiner\u00eda', 'linea-blanca':'L\u00ednea Blanca',
    'plomeria':'Plomer\u00eda',     'general':'Trabajos Generales',
    'fumigacion':'Fumigaci\u00f3n', 'techo':'Techo y Canales',
    'solar':'Paneles Solares',      'vidrios':'Vidrios y Aluminio'
  };

  var currentCat = 'all';

  function categoryLabel(cat) {
    return CATEGORY_LABELS[cat] || cat;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function renderCard(p) {
    return '<div class="provider-card" data-id="' + p.id + '">' +
      '<div class="card-top">' +
        '<div class="card-avatar">' + p.icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="card-name">' + escapeHtml(p.name) + '</div>' +
          '<div class="card-service">' + p.icon + ' ' + escapeHtml(categoryLabel(p.cat)) + '</div>' +
        '</div>' +
        '<div class="badge-community">\u2713 Residente</div>' +
      '</div>' +
      '<div class="card-info">' +
        '<div class="info-row"><span class="info-icon">\uD83D\uDD27</span><span style="font-size:0.78rem;line-height:1.4">' + escapeHtml(p.service) + '</span></div>' +
        '<div class="info-row"><span class="info-icon">\uD83D\uDCDE</span><strong>' + escapeHtml(p.phone) + '</strong></div>' +
        (p.email ? '<div class="info-row"><span class="info-icon">\u2709\uFE0F</span><span style="font-size:0.76rem;word-break:break-all">' + escapeHtml(p.email) + '</span></div>' : '') +
        '<div class="casa-chip"><span>\uD83C\uDFE1</span> Recomendado por Casa ' + escapeHtml(p.casa) + '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<a class="btn-call" href="tel:' + p.phone.replace(/\D/g, '') + '" onclick="event.stopPropagation()">\uD83D\uDCDE Llamar</a>' +
        (p.email ? '<a class="btn-email" href="mailto:' + escapeHtml(p.email) + '" onclick="event.stopPropagation()" title="Enviar correo">\u2709\uFE0F</a>' : '') +
      '</div>' +
    '</div>';
  }

  function applyFilters() {
    var search = document.getElementById('searchInput').value.toLowerCase();
    var filtered = PROVIDERS.filter(function (p) {
      var matchCat = currentCat === 'all' || p.cat === currentCat;
      var matchSearch = !search ||
        p.name.toLowerCase().indexOf(search) !== -1 ||
        p.service.toLowerCase().indexOf(search) !== -1 ||
        categoryLabel(p.cat).toLowerCase().indexOf(search) !== -1;
      return matchCat && matchSearch;
    });

    var grid = document.getElementById('providerGrid');
    if (filtered.length) {
      grid.innerHTML = filtered.map(renderCard).join('');
    } else {
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">\uD83D\uDD0D</div>' +
        '<h3>Sin resultados</h3><p>Intenta con otra b\u00fasqueda.</p></div>';
    }
    document.getElementById('gridCount').textContent =
      filtered.length + ' proveedor' + (filtered.length !== 1 ? 'es' : '');
  }

  function filterCat(cat, btn) {
    currentCat = cat;
    var btns = document.querySelectorAll('.cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');

    var titles = {
      all:'Todos los Proveedores', aires:'Aires Acondicionados',
      catering:'Catering / Eventos', jardineria:'Jardiner\u00eda',
      'linea-blanca':'L\u00ednea Blanca', plomeria:'Plomer\u00eda',
      general:'Trabajos Generales', fumigacion:'Fumigaci\u00f3n',
      techo:'Techo y Canales', solar:'Paneles Solares', vidrios:'Vidrios y Aluminio'
    };
    document.getElementById('gridTitle').textContent = titles[cat] || 'Proveedores';
    applyFilters();
  }

  function openDetail(id) {
    var p = null;
    for (var i = 0; i < PROVIDERS.length; i++) {
      if (PROVIDERS[i].id === id) { p = PROVIDERS[i]; break; }
    }
    if (!p) return;

    document.getElementById('detailContent').innerHTML =
      '<div class="detail-header">' +
        '<div style="display:flex;gap:0.75rem;align-items:flex-start;flex:1">' +
          '<div class="detail-avatar">' + p.icon + '</div>' +
          '<div>' +
            '<div class="detail-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="card-service" style="margin-bottom:0.4rem">' + p.icon + ' ' + escapeHtml(categoryLabel(p.cat)) + '</div>' +
            '<div class="badge-community">\u2713 Recomendado por residente \u00b7 Casa ' + escapeHtml(p.casa) + '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="window._closeDetail()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-light);flex-shrink:0">\u2715</button>' +
      '</div>' +
      '<hr class="detail-divider"/>' +
      '<div class="detail-row"><span class="detail-label">\uD83D\uDD27 Servicio</span><span class="detail-val">' + escapeHtml(p.service) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">\uD83D\uDCDE Tel\u00e9fono</span><span class="detail-val">' + escapeHtml(p.phone) + '</span></div>' +
      (p.email ? '<div class="detail-row"><span class="detail-label">\u2709\uFE0F Correo</span><span class="detail-val" style="word-break:break-all">' + escapeHtml(p.email) + '</span></div>' : '') +
      '<div class="detail-row"><span class="detail-label">\uD83C\uDFE1 Recomendado</span><span class="detail-val">Casa ' + escapeHtml(p.casa) + ' \u00b7 Villa Valencia</span></div>' +
      '<div class="detail-actions">' +
        '<a class="btn-call" href="tel:' + p.phone.replace(/\D/g, '') + '" style="flex:1">\uD83D\uDCDE Llamar ahora</a>' +
        (p.email ? '<a class="btn-email" href="mailto:' + escapeHtml(p.email) + '" style="padding:0.55rem 1rem;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:0.35rem">\u2709\uFE0F Correo</a>' : '') +
      '</div>';

    document.getElementById('detailModal').classList.add('open');
  }

  function closeDetail() {
    document.getElementById('detailModal').classList.remove('open');
  }

  function openSuggest() {
    document.getElementById('suggestModal').classList.add('open');
  }

  function closeSuggest() {
    document.getElementById('suggestModal').classList.remove('open');
    document.getElementById('suggestForm').style.display = '';
    document.getElementById('suggestSuccess').classList.remove('show');
    var fields = ['sug-nombre', 'sug-categoria', 'sug-servicio', 'sug-telefono',
                  'sug-correo', 'sug-casa', 'sug-recomendador', 'sug-comentario'];
    for (var i = 0; i < fields.length; i++) {
      var el = document.getElementById(fields[i]);
      if (el) el.value = '';
    }
  }

  function submitSuggest() {
    var nombre = document.getElementById('sug-nombre').value.trim();
    var categoria = document.getElementById('sug-categoria').value;
    var servicio = document.getElementById('sug-servicio').value.trim();
    var telefono = document.getElementById('sug-telefono').value.trim();
    var casa = document.getElementById('sug-casa').value.trim();

    if (!nombre || !categoria || !servicio || !telefono || !casa) {
      alert('Por favor completa los campos obligatorios (*).');
      return;
    }

    var btn = document.querySelector('#suggestForm .btn-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var config = window.APROVIVA_CONFIG;
    var url = config && config.APPS_SCRIPT_URL;
    if (url && url.indexOf('YOUR_') === -1) {
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          _type: 'provider',
          nombre: nombre,
          categoria: categoria,
          servicio: servicio,
          telefono: telefono,
          correo: (document.getElementById('sug-correo').value || '').trim(),
          casa: casa,
          recomendadoPor: (document.getElementById('sug-recomendador').value || '').trim(),
          comentario: (document.getElementById('sug-comentario').value || '').trim()
        })
      }).then(showSuggestSuccess).catch(showSuggestSuccess);
    } else {
      showSuggestSuccess();
    }
  }

  function showSuggestSuccess() {
    document.getElementById('suggestForm').style.display = 'none';
    document.getElementById('suggestSuccess').classList.add('show');
    var btn = document.querySelector('#suggestForm .btn-submit');
    btn.disabled = false;
    btn.textContent = 'Enviar recomendaci\u00f3n \u2192';
  }

  // Event delegation for provider cards
  function setupCardClicks() {
    var grid = document.getElementById('providerGrid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var card = e.target.closest('.provider-card');
      if (!card) return;
      if (e.target.closest('a')) return; // let links handle themselves
      var id = parseInt(card.getAttribute('data-id'), 10);
      if (id) openDetail(id);
    });
  }

  // Close modals on backdrop click
  function setupModalBackdrops() {
    var suggest = document.getElementById('suggestModal');
    if (suggest) {
      suggest.addEventListener('click', function (e) {
        if (e.target === suggest) closeSuggest();
      });
    }
    var detail = document.getElementById('detailModal');
    if (detail) {
      detail.addEventListener('click', function (e) {
        if (e.target === detail) closeDetail();
      });
    }
  }

  // Expose functions needed by inline onclick handlers
  window._filterCat = filterCat;
  window._openSuggest = openSuggest;
  window._closeSuggest = closeSuggest;
  window._submitSuggest = submitSuggest;
  window._closeDetail = closeDetail;

  document.addEventListener('DOMContentLoaded', function () {
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    applyFilters();
    setupCardClicks();
    setupModalBackdrops();
  });
})();
