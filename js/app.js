/**
 * APROVIVA Portal – Main page logic
 */
(function () {
  'use strict';

  var config = window.APROVIVA_CONFIG;

  function isScriptConfigured() {
    return config.APPS_SCRIPT_URL &&
      config.APPS_SCRIPT_URL.indexOf('YOUR_') === -1;
  }

  // ── Drive links ──
  function populateDriveLinks() {
    var links = config.DRIVE_LINKS;
    var els = document.querySelectorAll('[data-drive]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-drive');
      if (links[key] && links[key].indexOf('YOUR_') === -1) {
        els[i].href = links[key];
        els[i].target = '_blank';
        els[i].rel = 'noopener';
      } else {
        els[i].removeAttribute('href');
        els[i].style.opacity = '0.5';
        els[i].title = 'Enlace pendiente de configurar';
      }
    }
  }

  // ── PQRS Modal ──
  function openPqrs() {
    document.getElementById('pqrsModal').classList.add('open');
  }

  function closePqrs() {
    document.getElementById('pqrsModal').classList.remove('open');
    document.getElementById('pqrsForm').style.display = '';
    document.getElementById('pqrsSuccess').classList.remove('show');
    var fields = ['pqrs-resumen', 'pqrs-descripcion', 'pqrs-tipo',
                  'pqrs-ubicacion', 'pqrs-urgencia', 'pqrs-casa'];
    for (var i = 0; i < fields.length; i++) {
      var el = document.getElementById(fields[i]);
      if (el) el.value = '';
    }
  }

  function submitPqrs() {
    var resumen = document.getElementById('pqrs-resumen').value.trim();
    var descripcion = document.getElementById('pqrs-descripcion').value.trim();
    var tipo = document.getElementById('pqrs-tipo').value;
    var ubicacion = document.getElementById('pqrs-ubicacion').value;
    var urgencia = document.getElementById('pqrs-urgencia').value;
    var casa = document.getElementById('pqrs-casa').value.trim();

    if (!descripcion || !tipo || !ubicacion || !casa) {
      alert('Por favor completa los campos obligatorios (*).');
      return;
    }

    var btn = document.querySelector('#pqrsForm .btn-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    if (!isScriptConfigured()) {
      showPqrsSuccess();
      return;
    }

    var payload = {
      resumen: resumen,
      descripcion: descripcion,
      tipo: tipo,
      ubicacion: ubicacion,
      urgencia: urgencia,
      casa: casa
    };

    fetch(config.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    }).then(function () {
      showPqrsSuccess();
      loadDashboard();
    }).catch(function () {
      showPqrsSuccess();
    });
  }

  function showPqrsSuccess() {
    document.getElementById('pqrsForm').style.display = 'none';
    document.getElementById('pqrsSuccess').classList.add('show');
    var btn = document.querySelector('#pqrsForm .btn-submit');
    btn.disabled = false;
    btn.textContent = 'Enviar reporte \u2192';
  }

  function setupPqrsBackdrop() {
    var modal = document.getElementById('pqrsModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closePqrs();
      });
    }
  }

  // ── Dashboard ──
  function loadDashboard() {
    var loading = document.getElementById('dashLoading');
    var content = document.getElementById('dashContent');
    var error = document.getElementById('dashError');

    if (!loading) return;

    if (!isScriptConfigured()) {
      loading.style.display = 'none';
      error.style.display = 'block';
      error.textContent = 'Configura APPS_SCRIPT_URL en js/config.js para ver el dashboard.';
      return;
    }

    fetch(config.APPS_SCRIPT_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        loading.style.display = 'none';
        content.style.display = '';
        renderDashboard(data.rows || []);
      })
      .catch(function () {
        loading.style.display = 'none';
        error.style.display = 'block';
      });
  }

  function renderDashboard(rows) {
    // KPIs
    var total = rows.length;
    var alta = 0, media = 0, baja = 0;
    var tipoCounts = {};
    var ubicacionCounts = {};

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var urg = (r.urgencia || '').toLowerCase();
      if (urg === 'alta') alta++;
      else if (urg === 'media') media++;
      else if (urg === 'baja') baja++;

      var t = r.tipo || 'Sin tipo';
      tipoCounts[t] = (tipoCounts[t] || 0) + 1;

      var u = r.ubicacion || 'Sin ubicación';
      ubicacionCounts[u] = (ubicacionCounts[u] || 0) + 1;
    }

    setText('kpi-total', total);
    setText('kpi-alta', alta);
    setText('kpi-media', media);
    setText('kpi-baja', baja);

    renderBarChart('chart-tipo', tipoCounts, total);
    renderBarChart('chart-ubicacion', ubicacionCounts, total);
    renderRecent(rows);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderBarChart(containerId, counts, total) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var sorted = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });

    var max = sorted.length ? counts[sorted[0]] : 1;
    var html = '';

    for (var i = 0; i < sorted.length; i++) {
      var label = sorted[i];
      var count = counts[label];
      var pct = Math.round((count / max) * 100);
      html += '<div class="dash-bar-row">' +
        '<div class="dash-bar-label">' + escapeHtml(label) + '</div>' +
        '<div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="dash-bar-count">' + count + '</div>' +
        '</div>';
    }

    el.innerHTML = html || '<div style="font-size:0.8rem;color:var(--text-light)">Sin datos</div>';
  }

  function renderRecent(rows) {
    var el = document.getElementById('dash-recent');
    if (!el) return;

    var recent = rows.slice(-10).reverse();
    var html = '';

    for (var i = 0; i < recent.length; i++) {
      var r = recent[i];
      var date = r.timestamp ? formatDate(r.timestamp) : '';
      var urg = (r.urgencia || '').toLowerCase();
      var urgClass = urg === 'alta' ? 'dash-urg-alta' :
                     urg === 'media' ? 'dash-urg-media' :
                     urg === 'baja' ? 'dash-urg-baja' : '';
      var desc = r.resumen || r.descripcion || 'Sin descripción';

      html += '<div class="dash-recent-row">' +
        '<div class="dash-recent-date">' + escapeHtml(date) + '</div>' +
        '<div class="dash-recent-tipo">' + escapeHtml(r.tipo || '') + '</div>' +
        '<div class="dash-recent-desc">' + escapeHtml(desc) + '</div>' +
        (urgClass ? '<div class="dash-recent-urgencia ' + urgClass + '">' + escapeHtml(r.urgencia) + '</div>' : '') +
        '</div>';
    }

    el.innerHTML = html || '<div style="font-size:0.8rem;color:var(--text-light);padding:1rem 0">Sin reportes a&uacute;n</div>';
  }

  function formatDate(ts) {
    try {
      var d = new Date(ts);
      var day = d.getDate();
      var months = ['ene','feb','mar','abr','may','jun',
                    'jul','ago','sep','oct','nov','dic'];
      return day + ' ' + months[d.getMonth()];
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Init ──
  window._openPqrs = openPqrs;
  window._closePqrs = closePqrs;
  window._submitPqrs = submitPqrs;

  document.addEventListener('DOMContentLoaded', function () {
    populateDriveLinks();
    setupPqrsBackdrop();
    loadDashboard();
  });
})();
