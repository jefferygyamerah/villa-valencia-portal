/**
 * APROVIVA Portal – Main page logic
 *
 * Dual-backend split (temporary):
 *   - PQRS submit + status lookup → config.PH_MANAGEMENT_API_BASE
 *     (Next.js + Supabase backend at ph-management.vercel.app, returns
 *     a real caseReference like VV-PQRS-YYYYMMDD-NNNNNN).
 *   - Transparency dashboard, budget data, provider directory →
 *     config.APPS_SCRIPT_URL (Google Apps Script, sheet-backed).
 *
 * The dashboard does not yet read from ph-management, so a freshly
 * submitted PQRS won't appear in the dashboard until that cutover.
 */
(function () {
  'use strict';

  var config = window.APROVIVA_CONFIG;
  var pqrsFields = [
    'pqrs-resumen',
    'pqrs-descripcion',
    'pqrs-tipo',
    'pqrs-ubicacion',
    'pqrs-urgencia',
    'pqrs-casa',
    'pqrs-correo'
  ];
  var STATUS_LABELS = {
    recibido: 'Recibido',
    en_progreso: 'En progreso',
    resuelto: 'Resuelto'
  };
  var lastSubmittedCaseId = '';

  function isScriptConfigured() {
    return config.APPS_SCRIPT_URL &&
      config.APPS_SCRIPT_URL.indexOf('YOUR_') === -1;
  }

  function isPhManagementConfigured() {
    return !!(config.PH_MANAGEMENT_API_BASE &&
      config.PH_MANAGEMENT_API_BASE.indexOf('YOUR_') === -1);
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function setText(id, val) {
    var el = getEl(id);
    if (el) el.textContent = val;
  }

  function setFieldError(id, message) {
    var input = getEl(id);
    var error = getEl(id + '-error');
    if (input) {
      input.classList.toggle('is-invalid', !!message);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
    if (error) {
      error.textContent = message || '';
      error.classList.toggle('show', !!message);
    }
  }

  function clearPqrsErrors() {
    for (var i = 0; i < pqrsFields.length; i++) {
      setFieldError(pqrsFields[i], '');
    }
    var status = getEl('pqrs-form-status');
    if (status) {
      status.textContent = '';
      status.className = 'form-status';
    }
  }

  function showPqrsStatus(type, message) {
    var status = getEl('pqrs-form-status');
    if (!status) return;
    status.className = 'form-status show ' + type;
    status.textContent = message;
  }

  function setSubmitState(isBusy) {
    var btn = document.querySelector('#pqrsForm .btn-submit');
    if (!btn) return;
    btn.disabled = !!isBusy;
    btn.textContent = isBusy ? 'Enviando...' : 'Enviar reporte →';
  }

  function showPqrsForm() {
    var form = getEl('pqrsForm');
    var success = getEl('pqrsSuccess');
    if (form) form.style.display = '';
    if (success) success.classList.remove('show');
    clearPqrsErrors();
    setSubmitState(false);
  }

  function resetPqrsForm() {
    for (var i = 0; i < pqrsFields.length; i++) {
      var el = getEl(pqrsFields[i]);
      if (el) el.value = '';
    }
    showPqrsForm();
  }

  function validatePqrs() {
    var descripcion = getEl('pqrs-descripcion');
    var tipo = getEl('pqrs-tipo');
    var ubicacion = getEl('pqrs-ubicacion');
    var casa = getEl('pqrs-casa');
    var correo = getEl('pqrs-correo');
    var valid = true;
    var firstInvalid = null;

    clearPqrsErrors();

    if (!descripcion || !descripcion.value.trim()) {
      setFieldError('pqrs-descripcion', 'Cuéntanos un poco más para poder revisar el caso.');
      valid = false;
      firstInvalid = firstInvalid || descripcion;
    }
    if (!tipo || !tipo.value) {
      setFieldError('pqrs-tipo', 'Selecciona el tipo de reporte.');
      valid = false;
      firstInvalid = firstInvalid || tipo;
    }
    if (!ubicacion || !ubicacion.value) {
      setFieldError('pqrs-ubicacion', 'Indica la ubicación del reporte.');
      valid = false;
      firstInvalid = firstInvalid || ubicacion;
    }
    if (!casa || !casa.value.trim()) {
      setFieldError('pqrs-casa', 'Escribe el número de casa para ubicarte.');
      valid = false;
      firstInvalid = firstInvalid || casa;
    }
    if (correo && correo.value.trim() && !isValidEmail(correo.value.trim())) {
      setFieldError('pqrs-correo', 'Revisa el formato del correo electrónico.');
      valid = false;
      firstInvalid = firstInvalid || correo;
    }

    if (!valid) {
      showPqrsStatus('error', 'Revisa los campos marcados en rojo antes de enviar.');
      if (firstInvalid && typeof firstInvalid.focus === 'function') {
        firstInvalid.focus();
      }
    }

    return valid;
  }

  function openSection(sectionId) {
    var el = getEl(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openActionNotice(title, body) {
    setText('actionNoticeTitle', title || 'Aviso');
    setText('actionNoticeBody', body || 'Este acceso no tiene un destino disponible en este momento.');
    var modal = getEl('actionNoticeModal');
    if (modal) modal.classList.add('open');
  }

  function closeActionNotice() {
    var modal = getEl('actionNoticeModal');
    if (modal) modal.classList.remove('open');
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
        els[i].removeAttribute('aria-disabled');
      } else {
        els[i].href = '#';
        els[i].removeAttribute('target');
        els[i].removeAttribute('rel');
        els[i].setAttribute('aria-disabled', 'true');
        els[i].style.opacity = '0.82';
        els[i].title = 'Enlace pendiente de configurar';
      }
    }
  }

  // ── PQRS Modal ──
  function openPqrs() {
    var modal = getEl('pqrsModal');
    if (modal) modal.classList.add('open');
    showPqrsForm();
  }

  function closePqrs() {
    var modal = getEl('pqrsModal');
    if (modal) modal.classList.remove('open');
    resetPqrsForm();
  }

  function submitPqrs() {
    var resumenEl = getEl('pqrs-resumen');
    var descripcionEl = getEl('pqrs-descripcion');
    var tipoEl = getEl('pqrs-tipo');
    var ubicacionEl = getEl('pqrs-ubicacion');
    var urgenciaEl = getEl('pqrs-urgencia');
    var casaEl = getEl('pqrs-casa');
    var correoEl = getEl('pqrs-correo');

    if (!validatePqrs()) {
      return;
    }

    var resumen = resumenEl ? resumenEl.value.trim() : '';
    var descripcion = descripcionEl ? descripcionEl.value.trim() : '';
    var tipo = tipoEl ? tipoEl.value : '';
    var ubicacion = ubicacionEl ? ubicacionEl.value : '';
    var urgencia = urgenciaEl ? urgenciaEl.value : '';
    var casa = casaEl ? casaEl.value.trim() : '';
    var correo = correoEl ? correoEl.value.trim() : '';

    setSubmitState(true);
    showPqrsStatus('success', 'Enviando tu reporte...');

    if (!isPhManagementConfigured()) {
      setSubmitState(false);
      showPqrsStatus('error', 'El sistema de envío todavía no está configurado.');
      return;
    }

    // subject ← resumen if non-empty, else first 80 chars of descripcion.
    var subject = resumen;
    if (!subject) {
      subject = descripcion.slice(0, 80).trim();
    }

    // Compose description with portal-specific metadata that the new API
    // doesn't model as columns (tipo / urgencia / casa).
    var metaParts = [];
    if (tipo) metaParts.push('Tipo: ' + tipo);
    if (urgencia) metaParts.push('Urgencia: ' + urgencia);
    if (casa) metaParts.push('Casa: ' + casa);
    var composedDescription = metaParts.length
      ? '[' + metaParts.join(' | ') + ']\n\n' + descripcion
      : descripcion;

    // location ← "ubicacion — Casa N" if both, else whichever is present.
    var locationValue = '';
    if (ubicacion && casa) {
      locationValue = ubicacion + ' — Casa ' + casa;
    } else if (ubicacion) {
      locationValue = ubicacion;
    } else if (casa) {
      locationValue = 'Casa ' + casa;
    }

    var payload = {
      subject: subject,
      description: composedDescription
    };
    if (locationValue) payload.location = locationValue;
    if (correo) payload.email = correo;

    fetch(config.PH_MANAGEMENT_API_BASE + '/api/pqrs/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.text().then(function (rawText) {
        var parsed = parseResponseBody(rawText);

        if (!response.ok) {
          var apiMessage = parsed && parsed.message
            ? parsed.message
            : 'No pudimos enviar tu reporte. Revisa tu conexión e inténtalo de nuevo.';
          setSubmitState(false);
          showPqrsStatus('error', apiMessage);
          return;
        }

        // Prefer the API's caseReference field directly. getCaseIdFromResponse
        // is kept as a vestigial fallback for any legacy response shapes.
        var caseRef = (parsed && parsed.caseReference)
          ? String(parsed.caseReference)
          : getCaseIdFromResponse(parsed, rawText);
        showPqrsSuccess(caseRef);

        // Intentionally NOT calling loadDashboard() here: the dashboard still
        // reads from APPS_SCRIPT_URL (Google Apps Script) and won't see the
        // submission we just sent to ph-management. Revisit when the
        // dashboard is also cut over to the ph-management API.
      });
    }).catch(function () {
      setSubmitState(false);
      showPqrsStatus('error', 'No pudimos enviar tu reporte. Revisa tu conexión e inténtalo de nuevo.');
    });
  }

  function showPqrsSuccess(caseId) {
    var form = getEl('pqrsForm');
    var success = getEl('pqrsSuccess');
    var reference = getEl('pqrs-case-reference');

    lastSubmittedCaseId = caseId || '';

    if (form) form.style.display = 'none';
    if (success) success.classList.add('show');
    if (reference) {
      reference.textContent = lastSubmittedCaseId
        ? ('Referencia del caso: ' + lastSubmittedCaseId)
        : 'Referencia del caso: generada, pero no disponible en la respuesta.';
    }
    setSubmitState(false);
    clearPqrsErrors();
  }

  function parseResponseBody(rawText) {
    if (!rawText) return null;

    try {
      return JSON.parse(rawText);
    } catch (e) {
      return null;
    }
  }

  // Vestigial: the new ph-management API always returns a `caseReference`
  // field, so submitPqrs reads that directly. This fallback only fires for
  // unexpected response shapes (e.g. legacy Apps Script responses).
  function getCaseIdFromResponse(parsed, rawText) {
    if (parsed && typeof parsed === 'object') {
      if (parsed.caseReference) return String(parsed.caseReference);
      if (parsed.caseId) return String(parsed.caseId);
      if (parsed.id) return String(parsed.id);
      if (parsed.case_id) return String(parsed.case_id);
    }

    if (rawText) {
      var match = String(rawText).match(/(PQRS-[A-Za-z0-9\-]+)/i);
      if (match && match[1]) return match[1];
    }

    return '';
  }

  function lookupPqrsStatus() {
    var input = getEl('pqrs-status-id');
    var feedback = getEl('pqrs-status-feedback');
    var caseId = input ? input.value.trim() : '';

    if (!feedback) return;

    if (!caseId) {
      feedback.className = 'pqrs-status-feedback show error';
      feedback.textContent = 'Ingresa una referencia de caso para consultar.';
      if (input && typeof input.focus === 'function') input.focus();
      return;
    }

    if (!isPhManagementConfigured()) {
      feedback.className = 'pqrs-status-feedback show error';
      feedback.textContent = 'La consulta de estado no está disponible porque el sistema todavía no está configurado.';
      return;
    }

    feedback.className = 'pqrs-status-feedback show';
    feedback.textContent = 'Consultando estado...';

    var url = config.PH_MANAGEMENT_API_BASE +
      '/api/pqrs/lookup?caseRef=' + encodeURIComponent(caseId);

    fetch(url)
      .then(function (response) {
        return response.text().then(function (rawText) {
          var parsed = parseResponseBody(rawText);

          if (response.status === 404) {
            feedback.className = 'pqrs-status-feedback show error';
            feedback.textContent = 'No encontramos un caso con esa referencia. Verifica el código y vuelve a intentarlo.';
            return;
          }

          if (!response.ok || !parsed || !parsed.ok) {
            feedback.className = 'pqrs-status-feedback show error';
            feedback.textContent = 'No pudimos consultar el estado en este momento. Intenta nuevamente en unos segundos.';
            return;
          }

          renderLookupStatusSuccess(parsed);
        });
      })
      .catch(function () {
        feedback.className = 'pqrs-status-feedback show error';
        feedback.textContent = 'No pudimos consultar el estado en este momento. Intenta nuevamente en unos segundos.';
      });
  }

  function renderLookupStatusSuccess(data) {
    var feedback = getEl('pqrs-status-feedback');
    if (!feedback) return;

    var caseReference = data.caseReference || '';
    var status = data.status || '';
    var statusLabel = STATUS_LABELS[status] || status || 'Recibido';
    var lastUpdatedAt = data.lastUpdatedAt || '';
    var updatedText = lastUpdatedAt
      ? (' Última actualización: ' + formatStatusDate(lastUpdatedAt) + '.')
      : '';

    feedback.className = 'pqrs-status-feedback show success';
    feedback.textContent = 'Caso ' + caseReference + ': ' + statusLabel + '.' + updatedText;
  }

  function consultPqrsStatusFromSuccess() {
    var input = getEl('pqrs-status-id');
    if (input && lastSubmittedCaseId) {
      input.value = lastSubmittedCaseId;
    }
    openSection('pqrs-status-panel');
    lookupPqrsStatus();
  }

  function formatStatusDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-PA');
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setupPqrsBackdrop() {
    var modal = getEl('pqrsModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closePqrs();
      });
    }
  }

  function setupPortalActions() {
    document.addEventListener('click', function (e) {
      var driveEl = e.target.closest && e.target.closest('[data-drive]');
      if (driveEl) {
        e.preventDefault();
        var key = driveEl.getAttribute('data-drive');
        var url = config.DRIVE_LINKS && config.DRIVE_LINKS[key];
        if (url && url.indexOf('YOUR_') === -1) {
          window.open(url, '_blank', 'noopener');
        } else {
          openActionNotice('Documento no disponible', 'Este acceso aún no tiene un enlace configurado. Vuelve más tarde o avísale a la administración.');
        }
        return;
      }

      var actionEl = e.target.closest && e.target.closest('[data-action]');
      if (actionEl) {
        var action = actionEl.getAttribute('data-action');
        if (action === 'open-pqrs') {
          e.preventDefault();
          openPqrs();
          return;
        }
      }

      var sectionLink = e.target.closest && e.target.closest('a[href^="#"]');
      if (sectionLink) {
        var href = sectionLink.getAttribute('href');
        if (href && href.length > 1) {
          e.preventDefault();
          openSection(href.slice(1));
        }
      }
    });

    ['pqrs-resumen', 'pqrs-descripcion', 'pqrs-tipo', 'pqrs-ubicacion', 'pqrs-casa', 'pqrs-correo'].forEach(function (id) {
      var el = getEl(id);
      if (!el) return;
      var eventName = (el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(eventName, function () {
        setFieldError(id, '');
        var status = getEl('pqrs-form-status');
        if (status && status.className.indexOf('error') !== -1) {
          status.className = 'form-status';
          status.textContent = '';
        }
      });
    });

    var statusInput = getEl('pqrs-status-id');
    if (statusInput) {
      statusInput.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          lookupPqrsStatus();
        }
      });
    }
  }

  function retryDashboard() {
    loadDashboard();
  }

  function retryBudget() {
    loadBudget();
  }

  // ── Dashboard ──
  function loadDashboard() {
    var loading = getEl('dashLoading');
    var content = getEl('dashContent');
    var error = getEl('dashError');

    if (!loading) return;

    if (!isScriptConfigured()) {
      loading.style.display = 'none';
      content.style.display = 'none';
      error.style.display = 'block';
      error.innerHTML = '<div>La información todavía no está conectada. Revisa la configuración del Apps Script.</div>' +
        '<div class="dash-error-actions"><button class="dash-retry-btn" type="button" onclick="window._retryDashboard()">Reintentar</button></div>';
      return;
    }

    fetch(config.APPS_SCRIPT_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        loading.style.display = 'none';
        error.style.display = 'none';
        content.style.display = '';
        renderDashboard(data.rows || []);
      })
      .catch(function () {
        loading.style.display = 'none';
        content.style.display = 'none';
        error.style.display = 'block';
        error.innerHTML = '<div>No pudimos cargar los datos del tablero ahora mismo. Puedes intentarlo otra vez.</div>' +
          '<div class="dash-error-actions"><button class="dash-retry-btn" type="button" onclick="window._retryDashboard()">Reintentar</button></div>';
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

  function renderBarChart(containerId, counts, total) {
    var el = getEl(containerId);
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

    el.innerHTML = html || '<div style="font-size:0.8rem;color:var(--text-light)">Todavia no hay suficiente informacion para mostrar esta distribucion.</div>';
  }

  function renderRecent(rows) {
    var el = getEl('dash-recent');
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

    el.innerHTML = html || '<div style="font-size:0.8rem;color:var(--text-light);padding:1rem 0">Todavia no hay reportes recientes. Cuando entren nuevos casos, apareceran aqui con su prioridad y ubicacion.</div>';
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

  // ── Budget Dashboard ──
  var budgetData = [];
  var ejecucionData = [];
  var budgetMeta = {};
  var selectedMonth = 0;

  var CAT_COLORS = {
    'Servicios B\u00e1sicos': '#1A6BB8',
    'Gastos de Funcionamiento': '#F5C842',
    'Mantenimientos Preventivos': '#16a34a',
    'Mantenimientos Correctivos': '#d97706',
    'Otros Gastos': '#8b5cf6',
    'Gastos de Personal': '#ec4899'
  };
  var MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun',
                     'Jul','Ago','Sep','Oct','Nov','Dic'];
  var MONTH_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var MONTH_ALIASES = {
    'ene': 1, 'enero': 1,
    'feb': 2, 'febrero': 2,
    'mar': 3, 'marzo': 3,
    'abr': 4, 'abril': 4,
    'may': 5, 'mayo': 5,
    'jun': 6, 'junio': 6,
    'jul': 7, 'julio': 7,
    'ago': 8, 'agosto': 8,
    'sep': 9, 'sept': 9, 'set': 9, 'septiembre': 9, 'setiembre': 9,
    'oct': 10, 'octubre': 10,
    'nov': 11, 'noviembre': 11,
    'dic': 12, 'diciembre': 12
  };
  var CAT_ORDER = ['Servicios B\u00e1sicos', 'Gastos de Funcionamiento',
    'Gastos de Personal', 'Mantenimientos Preventivos',
    'Mantenimientos Correctivos', 'Otros Gastos'];

  function normalizeMonthToken(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    if (typeof text.normalize === 'function') {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return text.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  }

  function getLastInformeMonth() {
    var normalized = normalizeMonthToken(budgetMeta.ultimoInforme);
    if (!normalized) return 0;

    if (MONTH_ALIASES[normalized]) {
      return MONTH_ALIASES[normalized];
    }

    var parts = normalized.split(/[^a-z]+/);
    for (var i = 0; i < parts.length; i++) {
      if (MONTH_ALIASES[parts[i]]) return MONTH_ALIASES[parts[i]];
    }
    return 0;
  }

  function loadBudget() {
    var loading = getEl('budgetLoading');
    var content = getEl('budgetContent');
    var error = getEl('budgetError');
    if (!loading) return;

    if (!isScriptConfigured()) {
      loading.style.display = 'none';
      content.style.display = 'none';
      error.style.display = 'block';
      error.innerHTML = '<div>El presupuesto todavía no está conectado. Revisa la configuración del Apps Script.</div>' +
        '<div class="dash-error-actions"><button class="dash-retry-btn" type="button" onclick="window._retryBudget()">Reintentar</button></div>';
      return;
    }

    fetch(config.APPS_SCRIPT_URL + '?action=budget')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        budgetData = data.budget || [];
        ejecucionData = data.ejecucion || [];
        budgetMeta = data.meta || {};
        if (selectedMonth > 0) {
          var lastMonth = getLastInformeMonth();
          if (lastMonth > 0 && selectedMonth > lastMonth) {
            selectedMonth = 0;
          }
        }
        loading.style.display = 'none';
        error.style.display = 'none';
        content.style.display = '';
        renderMonthBar();
        renderBudget();
      })
      .catch(function () {
        loading.style.display = 'none';
        content.style.display = 'none';
        error.style.display = 'block';
        error.innerHTML = '<div>No pudimos cargar el presupuesto en este momento. Intenta otra vez en unos segundos.</div>' +
          '<div class="dash-error-actions"><button class="dash-retry-btn" type="button" onclick="window._retryBudget()">Reintentar</button></div>';
      });
  }

  function renderMonthBar() {
    var bar = getEl('budgetMonthBar');
    if (!bar) return;
    var lastMonth = getLastInformeMonth();
    var html = '<button class="budget-month-btn' +
      (selectedMonth === 0 ? ' active' : '') +
      '" onclick="window._selectMonth(0)">Todo</button>';
    for (var m = 0; m < 12; m++) {
      var monthNum = m + 1;
      var hasData = lastMonth === 0 || monthNum <= lastMonth;
      var classes = 'budget-month-btn';
      if (monthNum === selectedMonth) classes += ' active';
      if (!hasData) classes += ' disabled';
      html += '<button class="' + classes + '" onclick="window._selectMonth(' +
        monthNum + ')">' + MONTH_NAMES[m] + '</button>';
    }
    bar.innerHTML = html;
  }

  function selectMonth(m) {
    var lastMonth = getLastInformeMonth();
    if (m > 0 && lastMonth > 0 && m > lastMonth) return;
    selectedMonth = m;
    renderMonthBar();
    renderBudget();
  }

  function monthHasActuals(m) {
    var lastMonth = getLastInformeMonth();
    return m > 0 && m <= lastMonth;
  }

  function renderBudget() {
    var lastMonth = getLastInformeMonth();
    var showActuals = ejecucionData.length > 0 &&
      (selectedMonth === 0 || monthHasActuals(selectedMonth));
    var filtered = budgetData.filter(function (r) {
      if (selectedMonth > 0) return r.mesNum === selectedMonth;
      if (showActuals && lastMonth > 0) return r.mesNum <= lastMonth;
      return true;
    });

    // Budget totals
    var totalIngresos = 0, totalGastos = 0;
    var catBudget = {};
    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      if (r.tipo === 'Ingresos') {
        totalIngresos += r.monto;
      } else {
        totalGastos += r.monto;
        catBudget[r.categoria] = (catBudget[r.categoria] || 0) + r.monto;
      }
    }

    // Actual totals from ejecucion
    // ejecutadoMes = single month, ejecutadoAcumulado = cumulative
    // When viewing a specific month that has data: use ejecutadoMes
    // When viewing "Todo": use ejecutadoAcumulado (cumulative through last informe)
    var totalEjecGastos = 0;
    var catEjec = {};
    if (showActuals) {
      var useField = (selectedMonth > 0) ? 'ejecutadoMes' : 'ejecutadoAcumulado';
      for (var i = 0; i < ejecucionData.length; i++) {
        var e = ejecucionData[i];
        var val = e[useField] || 0;
        if (e.categoria !== 'Ingresos') {
          totalEjecGastos += val;
          catEjec[e.categoria] = (catEjec[e.categoria] || 0) + val;
        }
      }
    }

    var compareBudget = totalGastos;

    var pctGlobal = compareBudget > 0
      ? Math.round((totalEjecGastos / compareBudget) * 100) : 0;
    var period = selectedMonth > 0
      ? MONTH_FULL[selectedMonth - 1]
      : ((showActuals && lastMonth > 0) ? 'Hasta ' + MONTH_FULL[lastMonth - 1] : 'Anual');
    var infoLine = budgetMeta.ultimoInforme
      ? 'Informe: ' + budgetMeta.ultimoInforme
      : '';
    var executionSub = 'Sin datos reales';
    if (showActuals) {
      if (selectedMonth > 0) {
        executionSub = 'vs presupuesto de ' + MONTH_FULL[selectedMonth - 1];
      } else if (lastMonth > 0) {
        executionSub = 'vs presupuesto a ' + MONTH_FULL[lastMonth - 1];
      } else {
        executionSub = 'vs presupuesto anual';
      }
    }

    // KPIs
    var kpis = getEl('budgetKpis');
    kpis.innerHTML =
      kpiCard('B/. ' + fmtNum(totalIngresos), 'Presupuesto de ingresos', period) +
      kpiCard('B/. ' + fmtNum(totalGastos), 'Presupuesto de gastos', period) +
      (showActuals
        ? kpiCard('B/. ' + fmtNum(totalEjecGastos),
            selectedMonth > 0 ? 'Gasto ejecutado' : 'Ejecutado acumulado',
            infoLine, totalEjecGastos > compareBudget ? 'negative' : '')
        : kpiCard('B/. ' + fmtNum(totalIngresos - totalGastos),
            (totalIngresos - totalGastos) >= 0 ? 'Super\u00e1vit Proyectado' : 'D\u00e9ficit Proyectado',
            period, (totalIngresos - totalGastos) >= 0 ? 'positive' : 'negative')) +
      kpiCard(showActuals ? pctGlobal + '%' : '\u2014',
        'Ejecuci\u00f3n',
        executionSub);

    // Category cards
    var cats = getEl('budgetCategories');
    var maxCat = 0;
    for (var c = 0; c < CAT_ORDER.length; c++) {
      var v = catBudget[CAT_ORDER[c]] || 0;
      if (v > maxCat) maxCat = v;
    }

    var catHtml = '';
    for (var c = 0; c < CAT_ORDER.length; c++) {
      var cat = CAT_ORDER[c];
      var budgeted = catBudget[cat] || 0;
      var executed = catEjec[cat] || 0;
      if (!budgeted && !executed) continue;

      var pctExec = budgeted > 0 ? Math.round((executed / budgeted) * 100) : null;
      var overBudget = (budgeted > 0 && executed > budgeted) ||
        (budgeted === 0 && executed > 0);
      var pctBar = 0;
      var barColor = CAT_COLORS[cat] || 'var(--blue)';

      if (showActuals) {
        if (pctExec === null) {
          pctBar = executed > 0 ? 100 : 0;
        } else {
          pctBar = Math.max(0, Math.min(pctExec, 100));
        }
        barColor = overBudget ? 'var(--red)' : 'var(--green)';
      } else {
        pctBar = maxCat > 0 ? Math.round((budgeted / maxCat) * 100) : 0;
      }

      catHtml += '<div class="budget-cat-card" onclick="window._toggleCat(\'' +
        cat.replace(/'/g, "\\'") + '\')">' +
        '<div class="budget-cat-header">' +
        '<span class="budget-cat-name">' + escapeHtml(cat) + '</span>' +
        '<span class="budget-cat-amount">B/. ' + fmtNum(budgeted) + '</span></div>' +
        '<div class="budget-cat-bar"><div class="budget-cat-fill" style="width:' +
        pctBar + '%;background:' + barColor + '"></div></div>';

      if (showActuals) {
        var pctExecText = pctExec === null ? 'N/A' : (pctExec + '%');
        catHtml += '<div class="budget-cat-pct" style="color:' +
          (overBudget ? 'var(--red)' : 'var(--green)') + '">' +
          'Ejecutado: B/. ' + fmtNum(executed) + ' (' + pctExecText + ')</div>';
      } else {
        catHtml += '<div class="budget-cat-pct">' +
          (totalGastos > 0 ? Math.round((budgeted / totalGastos) * 100) : 0) +
          '% del total</div>';
      }
      catHtml += '</div>';
    }
    cats.innerHTML = catHtml;

    // Monthly trend
    renderTrend();

    // Reset detail
    var detail = getEl('budgetDetail');
    detail.innerHTML = '';
  }

  function kpiCard(value, label, sub, cls) {
    return '<div class="budget-kpi">' +
      '<div class="budget-kpi-value ' + (cls || '') + '">' + value + '</div>' +
      '<div class="budget-kpi-label">' + label + '</div>' +
      (sub ? '<div class="budget-kpi-sub">' + sub + '</div>' : '') +
      '</div>';
  }

  function renderTrend() {
    var trend = getEl('budgetTrend');
    if (!trend) return;

    var monthCats = [];
    var maxMonth = 0;
    for (var m = 1; m <= 12; m++) {
      var monthData = {};
      var monthTotal = 0;
      for (var i = 0; i < budgetData.length; i++) {
        var r = budgetData[i];
        if (r.mesNum === m && r.tipo !== 'Ingresos') {
          monthData[r.categoria] = (monthData[r.categoria] || 0) + r.monto;
          monthTotal += r.monto;
        }
      }
      monthCats.push(monthData);
      if (monthTotal > maxMonth) maxMonth = monthTotal;
    }

    var activeCats = CAT_ORDER.filter(function (c) {
      for (var m = 0; m < 12; m++) {
        if (monthCats[m][c]) return true;
      }
      return false;
    });

    var html = '';
    for (var m = 0; m < 12; m++) {
      html += '<div class="budget-trend-col">' +
        '<div class="budget-trend-stack" style="height:140px">';
      for (var c = 0; c < activeCats.length; c++) {
        var val = monthCats[m][activeCats[c]] || 0;
        if (val <= 0) continue;
        var segH = maxMonth > 0 ? Math.round((val / maxMonth) * 140) : 0;
        if (segH === 0) segH = 1;
        html += '<div class="budget-trend-seg" style="height:' + segH +
          'px;background:' + (CAT_COLORS[activeCats[c]] || '#ccc') + '"></div>';
      }
      html += '</div><div class="budget-trend-label">' + MONTH_NAMES[m] + '</div></div>';
    }

    var legendHtml = '';
    for (var c = 0; c < activeCats.length; c++) {
      legendHtml += '<div class="budget-legend-item"><div class="budget-legend-dot" style="background:' +
        (CAT_COLORS[activeCats[c]] || '#ccc') + '"></div>' + escapeHtml(activeCats[c]) + '</div>';
    }

    trend.innerHTML = html;
    var panel = trend.parentElement;
    var legend = getEl('budgetTrendLegend');
    if (!legend) {
      legend = document.createElement('div');
      legend.id = 'budgetTrendLegend';
      legend.className = 'budget-trend-legend';
      panel.appendChild(legend);
    }
    legend.className = 'budget-trend-legend';
    legend.innerHTML = legendHtml;
  }

  function toggleCat(cat) {
    var detail = getEl('budgetDetail');
    if (!detail) return;

    if (detail.getAttribute('data-cat') === cat) {
      detail.innerHTML = '';
      detail.removeAttribute('data-cat');
      return;
    }
    detail.setAttribute('data-cat', cat);

    var hasActuals = ejecucionData.length > 0 &&
      (selectedMonth === 0 || monthHasActuals(selectedMonth));
    var lastMonth = getLastInformeMonth();
    var execField = selectedMonth > 0 ? 'ejecutadoMes' : 'ejecutadoAcumulado';

    // Get budget items
    var budgetItems = {};
    var bFiltered = budgetData.filter(function (r) {
      return r.categoria === cat && r.tipo !== 'Ingresos' &&
        (
          (selectedMonth > 0 && r.mesNum === selectedMonth) ||
          (selectedMonth === 0 && hasActuals && lastMonth > 0 && r.mesNum <= lastMonth) ||
          (selectedMonth === 0 && (!hasActuals || lastMonth === 0))
        );
    });
    for (var i = 0; i < bFiltered.length; i++) {
      budgetItems[bFiltered[i].concepto] =
        (budgetItems[bFiltered[i].concepto] || 0) + bFiltered[i].monto;
    }

    // Get actual items
    var execItems = {};
    for (var i = 0; i < ejecucionData.length; i++) {
      if (ejecucionData[i].categoria === cat) {
        execItems[ejecucionData[i].concepto] = ejecucionData[i];
      }
    }

    // Merge all concepts
    var allConcepts = {};
    for (var k in budgetItems) allConcepts[k] = true;
    for (var k in execItems) allConcepts[k] = true;
    var sorted = Object.keys(allConcepts).sort(function (a, b) {
      return (budgetItems[b] || 0) - (budgetItems[a] || 0);
    });

    var html = '<table class="budget-detail-table"><thead><tr>' +
      '<th>Concepto</th><th>Presupuestado</th>';
    if (hasActuals) {
      html += '<th>' + (selectedMonth > 0 ? 'Ejecutado mes' : 'Ejecutado acumulado') + '</th><th>%</th>';
    }
    html += '</tr></thead><tbody>';

    for (var s = 0; s < sorted.length; s++) {
      var name = sorted[s];
      var budg = budgetItems[name] || 0;
      var exec = execItems[name] ? (execItems[name][execField] || 0) : 0;
      var pct = budg > 0 ? Math.round((exec / budg) * 100) : (exec > 0 ? 'N/A' : 0);
      var overBudget = exec > budg && budg > 0;

      html += '<tr><td>' + escapeHtml(name) + '</td>' +
        '<td>B/. ' + fmtNum(budg) + '</td>';
      if (hasActuals) {
        var pctText = typeof pct === 'number' ? (pct + '%') : pct;
        html += '<td style="color:' + (overBudget ? 'var(--red)' : '') +
          '">B/. ' + fmtNum(exec) + '</td>' +
          '<td style="color:' + (overBudget ? 'var(--red)' : 'var(--green)') +
          '">' + pctText + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    detail.innerHTML = html;
  }

  function fmtNum(n) {
    return n.toLocaleString('es-PA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  window._selectMonth = selectMonth;
  window._toggleCat = toggleCat;

  // ── Init ──
  window._openPqrs = openPqrs;
  window._closePqrs = closePqrs;
  window._submitPqrs = submitPqrs;
  window._resetPqrsForm = resetPqrsForm;
  window._lookupPqrsStatus = lookupPqrsStatus;
  window._consultPqrsStatusFromSuccess = consultPqrsStatusFromSuccess;
  window._retryDashboard = retryDashboard;
  window._retryBudget = retryBudget;
  window._closeActionNotice = closeActionNotice;

  document.addEventListener('DOMContentLoaded', function () {
    populateDriveLinks();
    setupPqrsBackdrop();
    setupPortalActions();
    loadDashboard();
    loadBudget();
  });
})();
