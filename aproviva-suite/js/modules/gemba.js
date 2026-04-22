/**
 * Gemba (Recorridos) - templates, execution, finding logs, exception detection.
 * Scenarios 4 (configure), 5 (execute), 6 (report issue), 7 (route), 10 (missed).
 */
(function () {
  var STATE = {
    rounds: [],
    findings: [],
    locations: [],
    templates: [],
    templateStore: 'table',
    templateBuilding: null,
    /** Cached `admin_users.id` for inserts (DB requires inspector_admin_user_id). */
    inspectorAdminUserId: null,
  };

  async function resolveInspectorAdminUserId() {
    if (STATE.inspectorAdminUserId) return STATE.inspectorAdminUserId;
    var cfg = window.APROVIVA_SUITE_CONFIG || {};
    var fallbackCfg = cfg.DEFAULT_INSPECTOR_ADMIN_USER_ID;
    if (fallbackCfg) {
      STATE.inspectorAdminUserId = String(fallbackCfg).trim();
      return STATE.inspectorAdminUserId;
    }
    var id = null;
    try {
      var rows = await window.SB.select('admin_users', {
        select: 'id',
        is_active: 'eq.true',
        limit: '1',
      });
      id = rows && rows[0] && rows[0].id;
      if (!id) {
        rows = await window.SB.select('admin_users', { select: 'id', limit: '1' });
        id = rows && rows[0] && rows[0].id;
      }
    } catch (e) {
      console.warn('resolveInspectorAdminUserId admin_users', e);
    }
    if (!id) {
      try {
        var prev = await window.SB.select('inspection_rounds', {
          select: 'inspector_admin_user_id',
          order: 'created_at.desc',
          limit: '1',
        });
        id = prev && prev[0] && prev[0].inspector_admin_user_id;
      } catch (e2) {
        console.warn('resolveInspectorAdminUserId inspection_rounds', e2);
      }
    }
    if (id) STATE.inspectorAdminUserId = id;
    return id || null;
  }
  /** Legacy browser-only presets (Sc. 4) — one-time import to shared storage. */
  var TEMPLATES_KEY = 'vv_gemba_round_templates_v1';
  var TEMPLATE_METADATA_KEY = 'gemba_templates';

  function loadLocalTemplatesLegacy() {
    try {
      var raw = localStorage.getItem(TEMPLATES_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function normalizeRoundType(v) {
    if (v === 'daily' || v === 'weekly' || v === 'monthly') return v;
    return 'ad_hoc';
  }

  function normalizeTemplate(raw, fallbackId) {
    var name = String((raw && raw.name) || '').trim();
    var title = String((raw && raw.title) || '').trim();
    var area = String((raw && raw.area) || '').trim();
    if (!name || !title || !area) return null;
    return {
      id: String((raw && raw.id) || fallbackId || ''),
      name: name,
      title: title,
      area: area,
      round_type: normalizeRoundType(raw && raw.round_type),
      sort_order: Number((raw && raw.sort_order) || 0),
      is_active: raw && raw.is_active !== false,
    };
  }

  function sortedTemplates(rows) {
    return rows.slice().sort(function (a, b) {
      var ao = Number((a && a.sort_order) || 0);
      var bo = Number((b && b.sort_order) || 0);
      if (ao !== bo) return ao - bo;
      return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'es');
    });
  }

  function newTemplateId() {
    return 'tpl-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  async function fetchTemplatesFromBuildingMetadata() {
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    var rows = await window.SB.select('buildings', {
      select: 'id,metadata',
      id: 'eq.' + bid,
      limit: '1',
    });
    var b = rows && rows[0];
    if (!b) throw new Error('No se encontró el edificio para plantillas compartidas.');
    STATE.templateBuilding = b;
    var list = b.metadata && Array.isArray(b.metadata[TEMPLATE_METADATA_KEY]) ? b.metadata[TEMPLATE_METADATA_KEY] : [];
    var mapped = [];
    for (var i = 0; i < list.length; i++) {
      var t = normalizeTemplate(list[i], newTemplateId());
      if (t && t.is_active) mapped.push(t);
    }
    STATE.templates = sortedTemplates(mapped);
    STATE.templateStore = 'metadata';
  }

  async function saveTemplatesToBuildingMetadata(rows) {
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    if (!STATE.templateBuilding || !STATE.templateBuilding.id) {
      await fetchTemplatesFromBuildingMetadata();
    }
    var base = (STATE.templateBuilding && STATE.templateBuilding.metadata && typeof STATE.templateBuilding.metadata === 'object')
      ? STATE.templateBuilding.metadata
      : {};
    var metadata = {};
    for (var k in base) metadata[k] = base[k];
    metadata[TEMPLATE_METADATA_KEY] = rows.map(function (r, idx) {
      var t = normalizeTemplate(r, newTemplateId());
      if (!t) return null;
      return {
        id: t.id || newTemplateId(),
        name: t.name,
        title: t.title,
        area: t.area,
        round_type: t.round_type,
        sort_order: idx,
        is_active: true,
      };
    }).filter(Boolean);
    await window.SB.update('buildings', { id: 'eq.' + bid }, { metadata: metadata });
    STATE.templateBuilding = { id: bid, metadata: metadata };
  }

  async function fetchTemplates() {
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    try {
      var rows = await window.SB.select('gemba_round_templates', {
        select: '*',
        building_id: 'eq.' + bid,
        is_active: 'eq.true',
        order: 'sort_order.asc,name.asc',
      });
      STATE.templates = sortedTemplates(Array.isArray(rows) ? rows : []);
      STATE.templateStore = 'table';
      STATE.templateBuilding = null;
      return;
    } catch (e) {
      if (!e || e.status !== 404) console.warn('gemba_round_templates:', e);
    }
    try {
      await fetchTemplatesFromBuildingMetadata();
    } catch (metaErr) {
      STATE.templates = [];
      STATE.templateStore = 'table';
      console.warn('gemba_templates_metadata:', metaErr);
    }
  }

  function staffPicks() {
    return window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS || {
      RECORRIDO_TITULOS: ['Recorrido general'],
      ZONAS_GEMBA: ['Zona general'],
      UBICACIONES_FIJAS: ['Zona general'],
      HALLAZGO_FRASE: [{ value: 'std', label: 'Seguimiento est\u00e1ndar', text: '' }],
    };
  }

  function templateFormFieldsHtml() {
    var picks = staffPicks();
    var titOpts = picks.RECORRIDO_TITULOS.map(function (t) {
      return '<option value="' + window.UI.esc(t) + '">' + window.UI.esc(t) + '</option>';
    }).join('');
    var zonaOpts = window.APROVIVA_SUITE_CONFIG.buildZonaSelectOptionsHtml
      ? window.APROVIVA_SUITE_CONFIG.buildZonaSelectOptionsHtml()
      : picks.ZONAS_GEMBA.map(function (z) {
        return '<option value="' + window.UI.esc(z) + '">' + window.UI.esc(z) + '</option>';
      }).join('');
    return '' +
      '<div class="form-field"><label>Nombre corto</label>' +
        '<input name="name" required placeholder="Ej. Matutina piscina"></div>' +
      '<div class="form-field"><label>T\u00edtulo del recorrido</label>' +
        '<select name="title" required>' + titOpts + '</select></div>' +
      '<div class="form-field"><label>Zona / \u00e1rea</label>' +
        '<select name="area" required>' + zonaOpts + '</select></div>' +
      '<div class="form-field"><label>Tipo de ronda</label>' +
        '<select name="round_type">' +
          '<option value="daily">Diario</option>' +
          '<option value="weekly">Semanal</option>' +
          '<option value="monthly">Mensual</option>' +
          '<option value="ad_hoc" selected>Ad-hoc / puntual</option>' +
        '</select></div>';
  }

  function getModalHost() {
    return document.getElementById('suite-modal-host');
  }

  function closeSuiteModal() {
    var h = getModalHost();
    if (h) h.innerHTML = '';
  }

  function insertErrorMessage(err) {
    var msg = err && err.message ? err.message : String(err);
    if (err && err.body) {
      try {
        var j = typeof err.body === 'string' ? JSON.parse(err.body) : err.body;
        if (j && (j.message || j.error_description || j.hint)) {
          msg += ' — ' + (j.message || j.error_description || j.hint);
        } else if (typeof err.body === 'string') {
          msg += ' — ' + err.body.slice(0, 200);
        }
      } catch (e) {
        msg += ' — ' + String(err.body).slice(0, 200);
      }
    }
    return msg;
  }

  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="gemba-page">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h2 class="page-title">Recorridos (Gemba)</h2>' +
            '<p class="page-subtitle">Inspecciones programadas, ejecuci\u00f3n y hallazgos.</p>' +
          '</div>' +
          '<div class="row wrap" style="gap:0.5rem;">' +
            '<a class="btn btn-ghost" href="#/mapa">Mapa del sitio</a>' +
            (window.AUTH.canAccess('maestros')
              ? '<button class="btn btn-ghost" id="gemba-new-tpl" type="button">Nueva plantilla</button>'
              : '') +
            '<button class="btn btn-primary-sm" id="gemba-start-btn" type="button">Iniciar recorrido</button>' +
          '</div>' +
        '</div>' +
        '<div class="kpi-grid" id="gemba-kpis"><div class="loading">...</div></div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Recorridos en curso o atrasados</h3>' +
          '<div id="gemba-active"></div>' +
        '</div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Recorridos recientes</h3>' +
          '<div id="gemba-recent"></div>' +
        '</div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Hallazgos abiertos</h3>' +
          '<div id="gemba-findings"></div>' +
        '</div>' +
      '</section>';

    document.getElementById('gemba-start-btn').addEventListener('click', function () {
      openStartModal().catch(function (e) { window.UI.toast('Error: ' + (e.message || e), 'error'); });
    });
    var newTpl = document.getElementById('gemba-new-tpl');
    if (newTpl) {
      newTpl.addEventListener('click', function () {
        openTemplateModal().catch(function (e) { window.UI.toast('Error: ' + (e.message || e), 'error'); });
      });
    }

    await loadAll();
  }

  function tplListHtml() {
    var tpls = STATE.templates || [];
    if (!tpls.length) return '<p class="empty">Sin plantillas a\u00fan. Crea una abajo.</p>';
    return tpls.map(function (t) {
      return '<div class="row between" style="padding:0.45rem 0;border-bottom:1px solid var(--border);align-items:center;gap:0.5rem;">' +
        '<div><strong>' + window.UI.esc(t.name) + '</strong><br><span class="muted" style="font-size:0.82rem">' +
        window.UI.esc(t.title) + ' \u00b7 ' + window.UI.esc(t.area) + ' \u00b7 ' + window.UI.esc(t.round_type || 'ad_hoc') + '</span></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-del-tpl="' + window.UI.esc(String(t.id)) + '">Eliminar</button></div>';
    }).join('');
  }

  async function createTemplateShared(rawTemplate) {
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    var t = normalizeTemplate(rawTemplate, newTemplateId());
    if (!t) throw new Error('Completa nombre, título y zona para guardar la plantilla.');
    if (STATE.templateStore === 'metadata') {
      var rows = (STATE.templates || []).slice();
      rows.push({
        id: t.id || newTemplateId(),
        name: t.name,
        title: t.title,
        area: t.area,
        round_type: t.round_type,
        sort_order: rows.length,
        is_active: true,
      });
      await saveTemplatesToBuildingMetadata(rows);
      return;
    }
    await window.SB.insert('gemba_round_templates', {
      building_id: bid,
      name: t.name,
      title: t.title,
      area: t.area,
      round_type: t.round_type,
      sort_order: 0,
      is_active: true,
    });
  }

  async function deleteTemplateShared(id) {
    if (!id) return;
    if (STATE.templateStore === 'metadata') {
      var kept = (STATE.templates || []).filter(function (t) { return String(t.id) !== String(id); });
      await saveTemplatesToBuildingMetadata(kept);
      return;
    }
    await window.SB.remove('gemba_round_templates', { id: 'eq.' + id });
  }

  async function importLocalTemplatesLegacy() {
    var local = loadLocalTemplatesLegacy();
    if (!local.length) return;
    var n = 0;
    var lastErr = '';
    for (var i = 0; i < local.length; i++) {
      var t = local[i];
      try {
        await createTemplateShared({
          name: String(t.name || '').trim() || 'Importada',
          title: String(t.title || '').trim(),
          area: String(t.area || '').trim(),
          round_type: t.round_type || 'ad_hoc',
        });
        n++;
      } catch (e) {
        lastErr = insertErrorMessage(e);
      }
    }
    if (n) {
      try { localStorage.removeItem(TEMPLATES_KEY); } catch (e2) { /* ignore */ }
    }
    await fetchTemplates();
    var list = document.getElementById('tpl-list');
    if (list) list.innerHTML = tplListHtml();
    if (n) window.UI.toast('Importadas ' + n + ' plantilla(s) desde este navegador.', 'success');
    else if (lastErr) window.UI.toast('No se pudo importar: ' + lastErr, 'error');
  }

  async function openTemplateModal() {
    var host = getModalHost();
    if (!host) {
      window.UI.toast('Modal no disponible.', 'error');
      return;
    }
    await fetchTemplates();
    var legacy = loadLocalTemplatesLegacy();
    var storeBanner = STATE.templateStore === 'metadata'
      ? '<div class="error-box" style="margin-bottom:0.75rem">Modo compatibilidad activo: las plantillas se guardan en <code>buildings.metadata.gemba_templates</code> hasta aplicar la migración dedicada.</div>'
      : '';
    var importBanner = legacy.length
      ? '<div class="error-box" style="margin-bottom:0.75rem" id="tpl-import-banner">Hay plantillas solo en este navegador (local). ' +
          '<button type="button" class="btn btn-primary-sm" id="tpl-import-local">Importar al servidor compartido</button></div>'
      : '';
    host.innerHTML = '' +
      '<section class="page" data-testid="gemba-templates-panel">' +
        '<h3 class="section-title">Plantillas de recorrido</h3>' +
        '<p class="muted">Compartidas para todo el equipo. T\u00edtulo y zona usan el mismo cat\u00e1logo que conserjer\u00eda en <strong>Iniciar recorrido</strong>.</p>' +
        storeBanner +
        importBanner +
        '<div id="tpl-list">' + tplListHtml() + '</div>' +
        '<hr style="margin:1rem 0;border:none;border-top:1px solid var(--border);"/>' +
        '<h4 class="section-title" style="font-size:1rem;">Nueva plantilla</h4>' +
        '<form id="tpl-form" class="form-grid cols-2" novalidate>' +
        templateFormFieldsHtml() +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button type="submit" class="btn btn-primary-sm">Guardar plantilla</button>' +
            '<button type="button" class="btn btn-ghost" id="tpl-modal-close">Cerrar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    var impBtn = document.getElementById('tpl-import-local');
    if (impBtn) impBtn.addEventListener('click', function () { importLocalTemplatesLegacy(); });
    document.getElementById('tpl-modal-close').addEventListener('click', closeSuiteModal);
    document.getElementById('tpl-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = this;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var fd = new FormData(form);
      try {
        await createTemplateShared({
          name: String(fd.get('name') || '').trim(),
          title: String(fd.get('title') || '').trim(),
          area: String(fd.get('area') || '').trim(),
          round_type: fd.get('round_type') || 'ad_hoc',
        });
        window.UI.toast('Plantilla guardada.', 'success');
        await fetchTemplates();
        document.getElementById('tpl-list').innerHTML = tplListHtml();
        form.reset();
      } catch (err) {
        window.UI.toast('Error: ' + insertErrorMessage(err), 'error');
      }
    });
    document.getElementById('tpl-list').addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-del-tpl]');
      if (!btn) return;
      var id = btn.getAttribute('data-del-tpl');
      if (!id || !confirm('\u00bfEliminar esta plantilla para todos?')) return;
      try {
        await deleteTemplateShared(id);
        window.UI.toast('Plantilla eliminada.', 'info');
        await fetchTemplates();
        document.getElementById('tpl-list').innerHTML = tplListHtml();
      } catch (err) {
        window.UI.toast('Error: ' + insertErrorMessage(err), 'error');
      }
    });
  }

  function attachTemplatePicker(host, staff) {
    var tpls = STATE.templates || [];
    if (!tpls.length || !host) return;
    var form = host.querySelector('#round-form');
    if (!form) return;
    var wrap = document.createElement('div');
    wrap.className = 'form-field';
    wrap.style.gridColumn = '1/-1';
    wrap.setAttribute('data-testid', 'gemba-template-picker');
    wrap.innerHTML = '<label>Plantilla del equipo</label>' +
      '<select id="gemba-tpl-pick">' +
        '<option value="">\u2014 Manual \u2014</option>' +
        tpls.map(function (t) {
          return '<option value="' + window.UI.esc(String(t.id)) + '">' + window.UI.esc(t.name) + '</option>';
        }).join('') +
      '</select>' +
      '<div class="hint">Aplica t\u00edtulo, zona y frecuencia guardados por administraci\u00f3n (mismo cat\u00e1logo que los desplegables).</div>';
    form.insertBefore(wrap, form.firstChild);
    host.querySelector('#gemba-tpl-pick').addEventListener('change', function () {
      var id = this.value;
      if (!id) return;
      var t = tpls.filter(function (x) { return String(x.id) === id; })[0];
      if (!t) return;
      var titleEl = form.querySelector('[name=title]');
      var areaEl = form.querySelector('[name=area]');
      if (titleEl) titleEl.value = t.title;
      if (areaEl) areaEl.value = t.area;
      var rt = form.querySelector('[name=round_type]');
      if (rt && t.round_type) rt.value = t.round_type;
    });
  }

  async function loadAll() {
    try {
      var results = await Promise.all([
        fetchTemplates(),
        resolveInspectorAdminUserId(),
        window.SB.select('inspection_rounds', { select: '*', order: 'scheduled_for.desc.nullslast', limit: '40' }),
        window.SB.select('inspection_findings', { select: '*', order: 'created_at.desc', limit: '40' }),
        window.SB.select('inventory_locations', { select: '*', is_active: 'eq.true', order: 'name.asc' }),
      ]);
      STATE.rounds = results[2] || [];
      STATE.findings = results[3] || [];
      STATE.locations = results[4] || [];
      renderKpis();
      renderActive();
      renderRecent();
      renderFindings();
    } catch (e) {
      window.UI.errorBox('gemba-active', e);
    }
  }

  function renderKpis() {
    var now = Date.now();
    var open = STATE.rounds.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; });
    var overdue = open.filter(function (r) { return r.scheduled_for && new Date(r.scheduled_for).getTime() < now - 12 * 3600 * 1000; });
    var thisWeek = STATE.rounds.filter(function (r) {
      if (!r.completed_at) return false;
      return new Date(r.completed_at).getTime() > now - 7 * 24 * 3600 * 1000;
    });
    document.getElementById('gemba-kpis').innerHTML = '' +
      kpi('Abiertos', open.length) +
      kpi('Atrasados', overdue.length) +
      kpi('Completados (7d)', thisWeek.length) +
      kpi('Hallazgos abiertos', STATE.findings.filter(function (f) { return f.status !== 'resolved' && f.status !== 'closed'; }).length);
  }

  function renderActive() {
    var rows = STATE.rounds.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed'; });
    if (!rows.length) {
      document.getElementById('gemba-active').innerHTML = '<p class="empty">Sin recorridos abiertos.</p>';
      return;
    }
    document.getElementById('gemba-active').innerHTML = window.UI.table(rows, [
      { key: 'round_number', label: '#' },
      { key: 'title', label: 'T\u00edtulo' },
      { key: 'area', label: '\u00c1rea' },
      { key: 'round_type', label: 'Tipo' },
      { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, statusBadgeKind(r.status)); }, html: true },
      { key: 'scheduled_for', label: 'Programado', render: function (r) { return r.scheduled_for ? window.UI.fmtDate(r.scheduled_for) : ''; } },
      { key: 'actions', label: '', render: function (r) {
        return '<button class="btn btn-ghost" data-act="complete" data-id="' + window.UI.esc(r.id) + '">Marcar completado</button> ' +
               '<button class="btn btn-ghost" data-act="finding" data-id="' + window.UI.esc(r.id) + '">+ Hallazgo</button>';
      }, html: true },
    ]);
    document.getElementById('gemba-active').addEventListener('click', onTableAction);
  }

  function renderRecent() {
    var rows = STATE.rounds.filter(function (r) { return r.status === 'completed' || r.status === 'closed'; }).slice(0, 10);
    document.getElementById('gemba-recent').innerHTML = window.UI.table(rows, [
      { key: 'round_number', label: '#' },
      { key: 'title', label: 'T\u00edtulo' },
      { key: 'round_type', label: 'Tipo' },
      { key: 'completed_at', label: 'Completado', render: function (r) { return r.completed_at ? window.UI.fmtDate(r.completed_at) : ''; } },
    ]);
  }

  function findingToIncidentCategory(ft) {
    var map = { defect: 'Maintenance', missing: 'Inventory', damage: 'Maintenance', safety: 'Security', cleanliness: 'Cleanliness' };
    return map[ft] || 'Maintenance';
  }

  async function deriveFindingToIncident(f) {
    var sess = window.AUTH.readSession();
    if (!sess) return;
    var ticketNum = 'INC-' + Math.floor(Math.random() * 900000 + 100000);
    var zona = f.zona_label || (f.metadata && f.metadata.zona_label) || '\u2014';
    var desc = (f.description || '') + '\n\n[Derivado desde hallazgo Gemba id=' + f.id + ', recorrido=' + f.inspection_round_id + ']';
    var body = {
      building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
      ticket_number: ticketNum,
      source: 'gemba_finding',
      category: findingToIncidentCategory(f.finding_type),
      location_label: String(zona),
      severity: f.severity || 'medium',
      status: 'received',
      title: 'Seguimiento hallazgo Gemba (' + (f.finding_type || '') + ')',
      description: desc,
      resident_visible_status: null,
      metadata: {
        actorRole: sess.role,
        actorLabel: sess.label,
        source: 'aproviva-suite',
        inspection_finding_id: f.id,
        inspection_round_id: f.inspection_round_id,
      },
    };
    try {
      window.UI.toast('Creando incidencia...', 'info');
      await window.SB.insert('incident_tickets', body);
      window.UI.toast('Incidencia creada desde el hallazgo. Revisa Incidencias.', 'success');
    } catch (err) {
      window.UI.toast('Error: ' + insertErrorMessage(err), 'error');
    }
  }

  function renderFindings() {
    var byRound = {};
    STATE.rounds.forEach(function (r) { byRound[r.id] = r; });
    var rows = STATE.findings.filter(function (f) { return f.status !== 'resolved' && f.status !== 'closed'; });
    if (!rows.length) {
      document.getElementById('gemba-findings').innerHTML = '<p class="empty">Sin hallazgos abiertos.</p>';
      return;
    }
    document.getElementById('gemba-findings').innerHTML = window.UI.table(rows, [
      { key: 'description', label: 'Hallazgo' },
      { key: 'finding_type', label: 'Tipo' },
      { key: 'severity', label: 'Severidad', render: function (r) { return window.UI.badge(r.severity || 'low', sevBadgeKind(r.severity)); }, html: true },
      { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status || 'open', statusBadgeKind(r.status)); }, html: true },
      { key: 'round', label: 'Recorrido', render: function (r) { return byRound[r.inspection_round_id] ? byRound[r.inspection_round_id].round_number : '?'; } },
      { key: 'created_at', label: 'Creado', render: function (r) { return window.UI.fmtDate(r.created_at); } },
      { key: 'actions', label: '', render: function (r) {
        return '<button type="button" class="btn btn-ghost btn-sm" data-derive-finding="' + window.UI.esc(r.id) + '">Derivar a incidencia</button>';
      }, html: true },
    ]);
    var box = document.getElementById('gemba-findings');
    if (box && !box._gembaDeriveBound) {
      box._gembaDeriveBound = true;
      box.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-derive-finding]');
        if (!btn) return;
        var fid = btn.getAttribute('data-derive-finding');
        var f = STATE.findings.filter(function (x) { return x.id === fid; })[0];
        if (f) deriveFindingToIncident(f);
      });
    }
  }

  function statusBadgeKind(s) {
    if (s === 'completed' || s === 'resolved' || s === 'closed') return 'success';
    if (s === 'in_progress') return 'info';
    if (s === 'overdue' || s === 'failed') return 'danger';
    return 'neutral';
  }

  function sevBadgeKind(s) {
    if (s === 'critical' || s === 'high') return 'danger';
    if (s === 'medium') return 'warning';
    return 'neutral';
  }

  function onTableAction(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    if (act === 'complete') return completeRound(id);
    if (act === 'finding') return openFindingModal(id, null);
  }

  async function completeRound(id) {
    try {
      await window.SB.update('inspection_rounds', { id: 'eq.' + id }, { status: 'completed', completed_at: new Date().toISOString() });
      window.UI.toast('Recorrido completado.', 'success');
      await loadAll();
    } catch (e) {
      window.UI.toast('Error: ' + insertErrorMessage(e), 'error');
    }
  }

  async function openStartModal() {
    await fetchTemplates();
    var staff = window.AUTH.isStaff();
    var host = getModalHost();
    if (!host) {
      window.UI.toast('Modal no disponible.', 'error');
      return;
    }
    var inner;
    if (staff) {
      var picks = staffPicks();
      var titOpts = picks.RECORRIDO_TITULOS.map(function (t) {
        return '<option value="' + window.UI.esc(t) + '">' + window.UI.esc(t) + '</option>';
      }).join('');
      var zonaOpts = window.APROVIVA_SUITE_CONFIG.buildZonaSelectOptionsHtml
        ? window.APROVIVA_SUITE_CONFIG.buildZonaSelectOptionsHtml()
        : picks.ZONAS_GEMBA.map(function (z) {
          return '<option value="' + window.UI.esc(z) + '">' + window.UI.esc(z) + '</option>';
        }).join('');
      inner = '' +
        '<section class="page" data-testid="gemba-start-form">' +
          '<h3 class="section-title">Iniciar recorrido</h3>' +
          '<p class="muted">Conserjer\u00eda: elige plantillas (sin escribir).</p>' +
          '<form id="round-form" class="form-grid cols-2" data-staff-round="1" novalidate>' +
            '<div class="form-field"><label>Tipo de ronda</label>' +
              '<select name="title" required>' + titOpts + '</select></div>' +
            '<div class="form-field"><label>Zona</label>' +
              '<select name="area" required>' + zonaOpts + '</select></div>' +
            '<div class="form-field"><label>Frecuencia</label>' +
              '<select name="round_type" required>' +
                '<option value="daily">Diario</option>' +
                '<option value="weekly">Semanal</option>' +
                '<option value="monthly">Mensual</option>' +
                '<option value="ad_hoc">Puntual</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Programado (opcional)</label>' +
              '<input type="datetime-local" name="scheduled_for"></div>' +
            '<div class="btn-row" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit" id="round-submit">Iniciar</button>' +
              '<button class="btn btn-ghost" type="button" id="round-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    } else {
      inner = '' +
        '<section class="page" data-testid="gemba-start-form">' +
          '<h3 class="section-title">Iniciar nuevo recorrido</h3>' +
          '<form id="round-form" class="form-grid cols-2" novalidate>' +
            '<div class="form-field"><label>T\u00edtulo</label>' +
              '<input type="text" name="title" required placeholder="Ej: Recorrido matutino \u00e1rea social"></div>' +
            '<div class="form-field"><label>\u00c1rea</label>' +
              '<input type="text" name="area" required placeholder="Ej: Piscina, Garita, Calles"></div>' +
            '<div class="form-field"><label>Tipo</label>' +
              '<select name="round_type" required>' +
                '<option value="daily">Diario</option>' +
                '<option value="weekly">Semanal</option>' +
                '<option value="monthly">Mensual</option>' +
                '<option value="ad_hoc">Ad-hoc</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Programado para</label>' +
              '<input type="datetime-local" name="scheduled_for"></div>' +
            '<div class="btn-row" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit" id="round-submit">Iniciar</button>' +
              '<button class="btn btn-ghost" type="button" id="round-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    }
    host.innerHTML = inner;
    attachTemplatePicker(host, staff);
    var sched = document.querySelector('#round-form [name="scheduled_for"]');
    if (sched && !sched.value) {
      // datetime-local expects local time without timezone suffix.
      var now = new Date();
      var pad = function (n) { return String(n).padStart(2, '0'); };
      sched.value =
        now.getFullYear() + '-' +
        pad(now.getMonth() + 1) + '-' +
        pad(now.getDate()) + 'T' +
        pad(now.getHours()) + ':' +
        pad(now.getMinutes());
    }
    document.getElementById('round-cancel').addEventListener('click', closeSuiteModal);
    var roundForm = document.getElementById('round-form');
    var submittingRound = false;
    async function submitRoundForm(formEl, e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (submittingRound) return;
      if (!formEl.checkValidity()) {
        formEl.reportValidity();
        return;
      }
      submittingRound = true;
      window.UI.toast('Iniciando recorrido...', 'info');
      var sess = window.AUTH.readSession();
      if (!sess) {
        submittingRound = false;
        window.UI.toast('Sesión expirada. Inicia sesión nuevamente.', 'error');
        window.location.hash = '#/login';
        return;
      }
      var fd = new FormData(formEl);
      var inspectorId = await resolveInspectorAdminUserId();
      if (!inspectorId) {
        submittingRound = false;
        window.UI.toast(
          'No hay usuario administrador en el sistema. En Gerencia: Datos maestros → Administradores.',
          'error'
        );
        return;
      }
      var body = {
        round_number: 'GEM-' + Math.floor(Math.random() * 900000 + 100000),
        title: fd.get('title'),
        area: fd.get('area'),
        round_type: fd.get('round_type'),
        status: 'in_progress',
        scheduled_for: fd.get('scheduled_for') ? new Date(fd.get('scheduled_for')).toISOString() : null,
        started_at: new Date().toISOString(),
        inspector_admin_user_id: inspectorId,
        metadata: { actorRole: sess.role, actorLabel: sess.label, source: 'aproviva-suite' },
      };
      try {
        await window.SB.insert('inspection_rounds', body);
        window.UI.toast('Recorrido iniciado.', 'success');
        closeSuiteModal();
        await loadAll();
      } catch (err) {
        window.UI.toast('Error: ' + insertErrorMessage(err), 'error');
      } finally {
        submittingRound = false;
      }
    }
    roundForm.addEventListener('submit', function (e) { submitRoundForm(roundForm, e); });
  }

  function findingTypeLabel(code) {
    var map = {
      defect: 'Defecto',
      missing: 'Faltante',
      damage: 'Da\u00f1o',
      safety: 'Seguridad',
      cleanliness: 'Limpieza',
    };
    return map[code] || code;
  }

  function roundSelectHtml(openRounds) {
    return openRounds.map(function (r) {
      return '<option value="' + window.UI.esc(r.id) + '">' +
        window.UI.esc(String(r.round_number || '') + ' — ' + String(r.title || '').slice(0, 48)) +
        '</option>';
    }).join('');
  }

  function sitePlaceIdForZonaLabel(zonaLabel) {
    if (!zonaLabel || !window.APROVIVA_SUITE_CONFIG.SITE_PLACES) return null;
    var p = window.APROVIVA_SUITE_CONFIG.getPlaceByLabel(zonaLabel);
    return p ? p.id : null;
  }

  function openFindingModal(roundId, opts) {
    opts = opts || {};
    var findingOpts = opts;
    var session = window.AUTH.readSession();
    var staff = window.AUTH.isStaff();
    var host = getModalHost();
    if (!host) {
      window.UI.toast('Modal no disponible.', 'error');
      return;
    }

    var fromMap = !!findingOpts.fromMap;
    var openRounds = (findingOpts.openRounds || STATE.rounds).filter(function (r) {
      return r.status !== 'completed' && r.status !== 'closed';
    });

    if (fromMap && !openRounds.length) {
      host.innerHTML = '' +
        '<section class="page" data-testid="gemba-finding-empty">' +
          '<h3 class="section-title">Sin recorrido abierto</h3>' +
          '<p class="muted">Para registrar un hallazgo en el mapa, primero inicia un recorrido en curso.</p>' +
          '<div class="btn-row mt-2">' +
            '<button type="button" class="btn btn-primary-sm" id="finding-empty-start">Iniciar recorrido</button>' +
            '<button type="button" class="btn btn-ghost" id="finding-empty-cancel">Cerrar</button>' +
          '</div>' +
        '</section>';
      document.getElementById('finding-empty-cancel').addEventListener('click', closeSuiteModal);
      document.getElementById('finding-empty-start').addEventListener('click', function () {
        closeSuiteModal();
        window.location.hash = '#/gemba';
        setTimeout(function () {
          openStartModal().catch(function (e) { window.UI.toast('Error: ' + (e.message || e), 'error'); });
        }, 200);
      });
      return;
    }

    var roundField;
    if (fromMap) {
      roundField = '<div class="form-field" style="grid-column:1/-1;"><label>Recorrido</label>' +
        '<select name="round_id" required>' + roundSelectHtml(openRounds) + '</select>' +
        '<div class="hint">El hallazgo queda asociado a este recorrido.</div></div>';
    } else {
      roundField = '<input type="hidden" name="round_id" value="' + window.UI.esc(roundId) + '">';
    }

    var locOpts = STATE.locations.map(function (l) {
      return '<option value="' + l.id + '">' + window.UI.esc(l.name) + '</option>';
    }).join('');
    var picks = staffPicks();
    var zonaFijaOpts = window.APROVIVA_SUITE_CONFIG.buildZonaSelectOptionsHtml
      ? window.APROVIVA_SUITE_CONFIG.buildZonaSelectOptionsHtml()
      : picks.UBICACIONES_FIJAS.map(function (z) {
        var sel = findingOpts.suggestedZona && z === findingOpts.suggestedZona ? ' selected' : '';
        return '<option value="' + window.UI.esc(z) + '"' + sel + '>' + window.UI.esc(z) + '</option>';
      }).join('');
    var inner;
    if (staff) {
      var frases = picks.HALLAZGO_FRASE.map(function (f) {
        return '<option value="' + window.UI.esc(f.value) + '">' + window.UI.esc(f.label) + '</option>';
      }).join('');
      var ubicBlock = STATE.locations.length
        ? '<div class="form-field" style="grid-column:1/-1;"><label>Ubicaci\u00f3n en sitio</label>' +
            '<select name="location_id" required>' +
              '<option value="">Seleccionar punto...</option>' +
              locOpts +
            '</select></div>' +
          '<input type="hidden" name="ubic_fija" value="">'
        : '<div class="form-field" style="grid-column:1/-1;"><label>Zona</label>' +
            '<select name="ubic_fija" required>' + zonaFijaOpts + '</select>' +
            '<div class="hint">Cat\u00e1logo de puntos no cargado; usa zona predefinida.</div></div>' +
          '<input type="hidden" name="location_id" value="">';
      inner = '' +
        '<section class="page" data-testid="gemba-finding-form">' +
          '<h3 class="section-title">Registrar hallazgo</h3>' +
          '<p class="muted">Conserjer\u00eda: tipo, punto y seguimiento (sin texto libre).</p>' +
          '<form id="finding-form" class="form-grid cols-2" data-staff-finding="1" novalidate>' +
            roundField +
            '<div class="form-field"><label>Tipo</label>' +
              '<select name="finding_type" required>' +
                '<option value="defect">Defecto</option>' +
                '<option value="missing">Faltante</option>' +
                '<option value="damage">Da\u00f1o</option>' +
                '<option value="safety">Seguridad</option>' +
                '<option value="cleanliness">Limpieza</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Severidad</label>' +
              '<select name="severity" required>' +
                '<option value="low">Baja</option>' +
                '<option value="medium" selected>Media</option>' +
                '<option value="high">Alta</option>' +
                '<option value="critical">Cr\u00edtica</option>' +
              '</select></div>' +
            ubicBlock +
            '<div class="form-field" style="grid-column:1/-1;"><label>Seguimiento</label>' +
              '<select name="frase_id" required>' + frases + '</select></div>' +
            '<div class="form-field" style="grid-column:1/-1;"><label>Foto (opcional)</label>' +
              '<input type="file" id="finding-photo" name="photo_file" accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif" capture="environment" />' +
              '<div class="hint">Se sube a Google Drive (Apps Script / misma carpeta que PQRS).</div></div>' +
            '<div class="btn-row" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit" id="finding-submit">Guardar</button>' +
              '<button class="btn btn-ghost" type="button" id="finding-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    } else {
      inner = '' +
        '<section class="page" data-testid="gemba-finding-form">' +
          '<h3 class="section-title">Registrar hallazgo</h3>' +
          '<form id="finding-form" class="form-grid cols-2">' +
            roundField +
            '<div class="form-field"><label>Tipo</label>' +
              '<select name="finding_type" required>' +
                '<option value="defect">Defecto</option>' +
                '<option value="missing">Faltante</option>' +
                '<option value="damage">Da\u00f1o</option>' +
                '<option value="safety">Seguridad</option>' +
                '<option value="cleanliness">Limpieza</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Severidad</label>' +
              '<select name="severity" required>' +
                '<option value="low">Baja</option>' +
                '<option value="medium" selected>Media</option>' +
                '<option value="high">Alta</option>' +
                '<option value="critical">Cr\u00edtica</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Ubicaci\u00f3n</label>' +
              '<select name="location_id">' +
                '<option value="">N/A</option>' +
                locOpts +
              '</select></div>' +
            '<div class="form-field" style="grid-column:1/-1;"><label>Foto (opcional)</label>' +
              '<input type="file" id="finding-photo" name="photo_file" accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif" />' +
              '<div class="hint">Sube a Google Drive v\u00eda Apps Script (enlace queda en el registro).</div></div>' +
            '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n</label>' +
              '<textarea name="description" rows="3" required></textarea></div>' +
            '<div class="btn-row" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit" id="finding-submit">Guardar</button>' +
              '<button class="btn btn-ghost" type="button" id="finding-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    }
    host.innerHTML = inner;
    if (findingOpts.suggestedZona) {
      var uSel = host.querySelector('select[name="ubic_fija"]');
      if (uSel) {
        for (var si = 0; si < uSel.options.length; si++) {
          if (uSel.options[si].value === findingOpts.suggestedZona) {
            uSel.selectedIndex = si;
            break;
          }
        }
      }
    }
    document.getElementById('finding-cancel').addEventListener('click', closeSuiteModal);
    document.getElementById('finding-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = this;
      if (!formEl.checkValidity()) {
        formEl.reportValidity();
        return;
      }
      var sess = window.AUTH.readSession();
      var fd = new FormData(formEl);
      var locId = fd.get('location_id');
      var locName = '';
      if (locId) {
        var L = STATE.locations.find(function (x) { return x.id === locId; });
        locName = L ? L.name : '';
      } else if (fd.get('ubic_fija')) {
        locName = fd.get('ubic_fija');
      }
      var description;
      if (formEl.getAttribute('data-staff-finding') === '1') {
        var ft = fd.get('finding_type');
        var fr = fd.get('frase_id');
        var extra = '';
        var frList = staffPicks().HALLAZGO_FRASE;
        for (var j = 0; j < frList.length; j++) {
          if (frList[j].value === fr) { extra = frList[j].text; break; }
        }
        description = findingTypeLabel(ft) + ' en ' + locName + (extra ? '. ' + extra : '.');
      } else {
        description = fd.get('description');
      }

      var photoInput = document.getElementById('finding-photo');
      var file = photoInput && photoInput.files && photoInput.files[0];
      var photoUrl = null;
      var submitBtn = document.getElementById('finding-submit');
      try {
        if (file) {
          if (submitBtn) { submitBtn.disabled = true; }
          window.UI.toast('Subiendo foto a Google Drive...', 'info');
          var rid = fd.get('round_id');
          var roundRow = STATE.rounds.find(function (r) { return r.id === rid; });
          var caseRef = 'GEMBA-' + (roundRow && roundRow.round_number ? roundRow.round_number : 'FIND') + '-' + String(Date.now()).slice(-10);
          var up = await window.UI.uploadPhotoToDrive(file, { caseRef: caseRef });
          photoUrl = up.url;
        } else {
          window.UI.toast('Guardando hallazgo...', 'info');
        }
      } catch (upErr) {
        if (submitBtn) submitBtn.disabled = false;
        window.UI.toast(upErr.message || String(upErr), 'error');
        return;
      }
      if (submitBtn) submitBtn.disabled = false;

      var meta = {
        actorRole: sess.role,
        actorLabel: sess.label,
        drive_upload: file ? true : false,
      };
      if (findingOpts.fromMap && findingOpts.mapLat != null && findingOpts.mapLng != null) {
        meta.map_lat = findingOpts.mapLat;
        meta.map_lng = findingOpts.mapLng;
      }

      var body = {
        inspection_round_id: fd.get('round_id'),
        location_id: locId || null,
        finding_type: fd.get('finding_type'),
        severity: fd.get('severity'),
        status: 'open',
        description: description,
        photo_url: photoUrl,
        metadata: meta,
      };

      var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
      if (bid) body.building_id = bid;
      if (locName) body.zona_label = locName;
      var spid = sitePlaceIdForZonaLabel(locName);
      if (spid) body.site_place_id = spid;

      try {
        await window.SB.insert('inspection_findings', body);
        window.UI.toast('Hallazgo registrado.', 'success');
        closeSuiteModal();
        await loadAll();
      } catch (err) {
        window.UI.toast('Error: ' + insertErrorMessage(err), 'error');
      }
    });
  }

  async function openFindingFromMapClick(lat, lng, suggestedZona) {
    await loadAll();
    var openRounds = STATE.rounds.filter(function (r) {
      return r.status !== 'completed' && r.status !== 'closed';
    });
    openFindingModal(null, {
      fromMap: true,
      mapLat: lat,
      mapLng: lng,
      suggestedZona: suggestedZona || '',
      openRounds: openRounds,
    });
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.GEMBA = {
    openFindingFromMapClick: openFindingFromMapClick,
    openStartModal: openStartModal,
    closeModal: closeSuiteModal,
    loadAll: loadAll,
  };

  window.ROUTER.register('gemba', { render: render, requiredModule: 'gemba' });
})();
