/**
 * APROVIVA Portal – Proveedores page logic
 *
 * Pure/shared functions are loaded from proveedores.pure.js via window.APROVIVA.
 */
(function () {
  'use strict';

  var A = window.APROVIVA;

  // Shared data and functions from proveedores.pure.js
  var PROVIDERS = A.PROVIDERS;
  var categoryLabel = A.categoryLabel;
  var filterProviders = A.filterProviders;
  var findProviderById = A.findProviderById;
  var validateSuggestFields = A.validateSuggestFields;
  var providerCountText = A.providerCountText;

  // escapeHtml comes from app.pure.js (loaded on all pages)
  var escapeHtml = A.escapeHtml;

  var currentCat = 'all';

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
    var search = document.getElementById('searchInput').value;
    var filtered = filterProviders(PROVIDERS, currentCat, search);

    var grid = document.getElementById('providerGrid');
    if (filtered.length) {
      grid.innerHTML = filtered.map(renderCard).join('');
    } else {
      grid.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">\uD83D\uDD0D</div>' +
        '<h3>Sin resultados</h3><p>Intenta con otra b\u00fasqueda.</p></div>';
    }
    document.getElementById('gridCount').textContent = providerCountText(filtered.length);
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
    var p = findProviderById(PROVIDERS, id);
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

    var validation = validateSuggestFields({
      nombre: nombre,
      categoria: categoria,
      servicio: servicio,
      telefono: telefono,
      casa: casa
    });

    if (!validation.valid) {
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
    applyFilters();
    setupCardClicks();
    setupModalBackdrops();
  });
})();
