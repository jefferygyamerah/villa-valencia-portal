/**
 * Gemba (Recorridos) - templates, execution, finding logs, exception detection.
 * Scenarios 4 (configure), 5 (execute), 6 (report issue), 7 (route), 10 (missed).
 */
(function () {
  var STATE = { rounds: [], findings: [], locations: [] };

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

    document.getElementById('gemba-start-btn').addEventListener('click', openStartModal);
    var newTpl = document.getElementById('gemba-new-tpl');
    if (newTpl) newTpl.addEventListener('click', openTemplateModal);

    await loadAll();
  }

  function openTemplateModal() {
    window.UI.toast('Las plantillas de recorrido configurables llegar\u00e1n en una siguiente versi\u00f3n. Por ahora usa Iniciar recorrido.', 'info');
  }

  async function loadAll() {
    try {
      var results = await Promise.all([
        window.SB.select('inspection_rounds', { select: '*', order: 'scheduled_for.desc.nullslast', limit: '40' }),
        window.SB.select('inspection_findings', { select: '*', order: 'created_at.desc', limit: '40' }),
        window.SB.select('inventory_locations', { select: '*', is_active: 'eq.true', order: 'name.asc' }),
      ]);
      STATE.rounds = results[0] || [];
      STATE.findings = results[1] || [];
      STATE.locations = results[2] || [];
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
    ]);
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

  function staffPicks() {
    return window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS || {
      RECORRIDO_TITULOS: ['Recorrido general'],
      ZONAS_GEMBA: ['Zona general'],
      UBICACIONES_FIJAS: ['Zona general'],
      HALLAZGO_FRASE: [{ value: 'std', label: 'Seguimiento est\u00e1ndar', text: '' }],
    };
  }

  function openStartModal() {
    var session = window.AUTH.readSession();
    var staff = session && session.role === 'staff';
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
                '<option value="ad_hoc">Puntual</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Programado (opcional)</label>' +
              '<input type="datetime-local" name="scheduled_for"></div>' +
            '<div class="btn-row" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit">Iniciar</button>' +
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
              '<button class="btn btn-primary-sm" type="submit">Iniciar</button>' +
              '<button class="btn btn-ghost" type="button" id="round-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    }
    host.innerHTML = inner;
    document.getElementById('round-cancel').addEventListener('click', closeSuiteModal);
    document.getElementById('round-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var formEl = this;
      if (!formEl.checkValidity()) {
        formEl.reportValidity();
        return;
      }
      var sess = window.AUTH.readSession();
      var fd = new FormData(formEl);
      var body = {
        round_number: 'GEM-' + Math.floor(Math.random() * 900000 + 100000),
        title: fd.get('title'),
        area: fd.get('area'),
        round_type: fd.get('round_type'),
        status: 'in_progress',
        scheduled_for: fd.get('scheduled_for') ? new Date(fd.get('scheduled_for')).toISOString() : null,
        started_at: new Date().toISOString(),
        metadata: { actorRole: sess.role, actorLabel: sess.label, source: 'aproviva-suite' },
      };
      try {
        await window.SB.insert('inspection_rounds', body);
        window.UI.toast('Recorrido iniciado.', 'success');
        closeSuiteModal();
        await loadAll();
      } catch (err) {
        window.UI.toast('Error: ' + insertErrorMessage(err), 'error');
      }
    });
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
    var staff = session && session.role === 'staff';
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
        setTimeout(openStartModal, 200);
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
          '<form id="finding-form" class="form-grid cols-2" data-staff-finding="1">' +
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
