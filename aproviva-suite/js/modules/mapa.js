/**
 * Mapa Villa Valencia — GeoJSON perimeter + route; waypoints (recorrido_map_waypoints);
 * hallazgos Gemba (v_inspection_findings_map); capas conmutables.
 */
(function () {
  var TABLE = 'recorrido_map_waypoints';
  var FINDINGS_VIEW = 'v_inspection_findings_map';
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var GEOJSON_URL = 'data/villa-valencia-site.geojson';

  function loadCss(href) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('link[href="' + href + '"]')) return resolve();
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = function () { resolve(); };
      l.onerror = function () { reject(new Error('CSS')); };
      document.head.appendChild(l);
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('JS')); };
      document.head.appendChild(s);
    });
  }

  function storageKey() {
    var bid = (window.APROVIVA_SUITE_CONFIG && window.APROVIVA_SUITE_CONFIG.BUILDING_ID) || 'default';
    return 'aproviva_map_waypoints_v1_' + bid;
  }

  function readLocalWaypoints() {
    try {
      var raw = localStorage.getItem(storageKey());
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocalWaypoints(arr) {
    localStorage.setItem(storageKey(), JSON.stringify(arr));
  }

  function reporterFromWaypoint(w) {
    var m = w.metadata || {};
    if (m.actor) return String(m.actor);
    if (m.vv_reported_by_label) return String(m.vv_reported_by_label);
    var cs = w.comments;
    if (cs && cs.length && cs[0].label) return String(cs[0].label);
    return '';
  }

  function observationSnippet(w, maxLen) {
    maxLen = maxLen || 160;
    var cs = w.comments;
    if (!cs || !cs.length) return '';
    var last = cs[cs.length - 1];
    var t = String(last.text || '').trim();
    if (t.length > maxLen) return t.slice(0, maxLen - 1) + '\u2026';
    return t;
  }

  function hasWaypointPhoto(w) {
    var cs = w.comments;
    if (!cs) return false;
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].photo_url) return true;
    }
    return false;
  }

  function lastActivityIso(w) {
    var cs = w.comments;
    if (cs && cs.length) {
      var last = cs[cs.length - 1];
      if (last.at) return last.at;
    }
    return w.updatedAt || w.createdAt || '';
  }

  function roleLabelEs(role) {
    var m = {
      conserje: 'Conserjer\u00eda',
      supervisor: 'Supervisi\u00f3n',
      gerencia: 'Gerencia',
      junta: 'Junta',
    };
    return m[role] || (role ? String(role) : '');
  }

  function reporterRoleFromWaypoint(w) {
    var m = w.metadata || {};
    if (m.vv_reported_by_role) return roleLabelEs(m.vv_reported_by_role);
    var cs = w.comments;
    if (cs && cs.length && cs[0].role) return roleLabelEs(cs[0].role);
    return '\u2014';
  }

  function normalizeRow(row) {
    if (!row || !row.id) return null;
    var meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    var st = meta.vv_point_status === 'conserje_resolved' ? 'conserje_resolved' : 'open';
    var comments = Array.isArray(meta.vv_comments) ? meta.vv_comments : [];
    return {
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      zonaLabel: row.zona_label || '',
      order: Number(row.sort_order) || 0,
      metadata: meta,
      pointStatus: st,
      comments: comments,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  async function patchWaypointMetadata(id, updater) {
    var rows = await window.SB.select(TABLE, { select: 'metadata', id: 'eq.' + id, limit: '1' });
    var meta = (rows && rows[0] && rows[0].metadata && typeof rows[0].metadata === 'object')
      ? Object.assign({}, rows[0].metadata)
      : {};
    var next = updater(meta) || meta;
    await window.SB.update(TABLE, { id: 'eq.' + id }, { metadata: next, updated_at: new Date().toISOString() });
  }

  /** HTML attribute for URLs (do not use esc() — it breaks & in query strings). */
  function escUrlAttr(u) {
    return String(u || '').replace(/"/g, '&quot;');
  }

  function appendCommentToMeta(meta, text, sess, photoUrl) {
    var m = meta && typeof meta === 'object' ? meta : {};
    var t = String(text || '').trim();
    var p = photoUrl ? String(photoUrl).trim() : '';
    if (!t && !p) return m;
    var arr = Array.isArray(m.vv_comments) ? m.vv_comments.slice() : [];
    arr.push({
      text: t || (p ? '(Foto en sitio)' : ''),
      role: sess.role,
      label: sess.label,
      at: new Date().toISOString(),
      photo_url: p || undefined,
    });
    m.vv_comments = arr;
    return m;
  }

  function extractSiteRingFromGeo(geo) {
    var feats = geo && geo.features;
    if (!feats) return null;
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i];
      if (f.properties && f.properties.kind === 'site_boundary' && f.geometry && f.geometry.type === 'Polygon') {
        return f.geometry.coordinates[0];
      }
    }
    return null;
  }

  function pointInSiteRing(lat, lng, ring) {
    if (!ring || ring.length < 3) return true;
    var x = lng;
    var y = lat;
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0];
      var yi = ring[i][1];
      var xj = ring[j][0];
      var yj = ring[j][1];
      var inter = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  }

  async function fetchWaypointsFromApi() {
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    var rows = await window.SB.select(TABLE, {
      select: '*',
      building_id: 'eq.' + bid,
      order: 'sort_order.asc',
    });
    var out = [];
    (rows || []).forEach(function (r) {
      var w = normalizeRow(r);
      if (w) out.push(w);
    });
    return out;
  }

  async function fetchFindingsForMap() {
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    try {
      var rows = await window.SB.select(FINDINGS_VIEW, {
        select: '*',
        building_id: 'eq.' + bid,
        order: 'created_at.desc',
        limit: '80',
      });
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }

  async function tryMigrateLocalToCloud(session) {
    var local = readLocalWaypoints();
    if (!local.length) return false;
    var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
    for (var i = 0; i < local.length; i++) {
      var w = local[i];
      await window.SB.insert(TABLE, {
        building_id: bid,
        zona_label: w.zonaLabel || w.zona_label || 'Punto',
        lat: Number(w.lat),
        lng: Number(w.lng),
        sort_order: w.order != null ? w.order : i + 1,
        metadata: {
          source: 'aproviva-suite',
          migratedFromLocalStorage: true,
          actor: session ? session.label : null,
          vv_reported_by_role: session ? session.role : null,
          vv_point_status: 'open',
          vv_comments: [],
        },
      });
    }
    localStorage.removeItem(storageKey());
    window.UI.toast('Puntos locales migrados a Supabase.', 'success');
    return true;
  }

  function zonaOptionsHtml() {
    var C = window.APROVIVA_SUITE_CONFIG;
    if (C.buildZonaSelectOptionsHtml) return C.buildZonaSelectOptionsHtml();
    var zones = (C.STAFF_QUICK_PICKS && C.STAFF_QUICK_PICKS.ZONAS_GEMBA) || [];
    return zones.map(function (z) {
      return '<option value="' + window.UI.esc(z) + '">' + window.UI.esc(z) + '</option>';
    }).join('');
  }

  function kindBadgeForLabel(label) {
    var C = window.APROVIVA_SUITE_CONFIG;
    if (!C.getPlaceByLabel) return '';
    var place = C.getPlaceByLabel(label);
    if (!place) return '';
    return window.UI.badge(C.placeKindShortLabel(place.kind), C.placeKindBadgeKind(place.kind));
  }

  function isMissingTableError(err) {
    if (!err) return false;
    if (err.status === 404) return true;
    var b = err.body;
    var s = typeof b === 'string' ? b : JSON.stringify(b || {});
    return /does not exist|42P01|not find/i.test(s);
  }

  function severityColor(sev) {
    if (sev === 'critical' || sev === 'high') return '#b91c1c';
    if (sev === 'medium') return '#b45309';
    return '#1e3a8a';
  }

  async function render(container, session) {
    var role = session && session.role;
    var canGemba = window.AUTH.canAccess('gemba');
    /** Supervisor + gerencia: drag waypoints, bulk clear, force delete. */
    var canManageRoute = role === 'supervisor' || window.AUTH.canAccess('maestros');
    /** Supervisión o gerencia colocan observaciones del recorrido en el mapa (alcance: solo este conjunto en este portal). */
    var canPlaceRoutePoints = canGemba && (role === 'supervisor' || role === 'gerencia');
    var canMarkFinding = canGemba;
    var cloudOk = true;
    var waypoints = [];
    var mapFindings = [];
    var cloudBanner = '';

    try {
      waypoints = await fetchWaypointsFromApi();
      if (!waypoints.length && readLocalWaypoints().length) {
        await tryMigrateLocalToCloud(session);
        waypoints = await fetchWaypointsFromApi();
      }
    } catch (err) {
      cloudOk = false;
      if (isMissingTableError(err)) {
        cloudBanner = '<div class="error-box mt-2">Ejecuta el SQL en Supabase: <code>aproviva-suite/supabase/migrations/20260420120000_recorrido_map_waypoints.sql</code> (SQL Editor).</div>';
      } else {
        cloudBanner = '<div class="error-box mt-2">No se pudo cargar puntos desde Supabase: ' + window.UI.esc(err.message || String(err)) + '</div>';
      }
      waypoints = readLocalWaypoints();
    }

    mapFindings = await fetchFindingsForMap();

    var toolbarHtml = '';
    if (canPlaceRoutePoints || canMarkFinding) {
      toolbarHtml = '<div class="mapa-toolbar row wrap mt-2">';
      if (canMarkFinding && cloudOk) {
        toolbarHtml += '<button type="button" class="btn btn-primary-sm" id="mapa-hallazgo-btn"' + (cloudOk ? '' : ' disabled') + '>Marcar hallazgo</button>';
      }
      if (canPlaceRoutePoints && cloudOk) {
        toolbarHtml +=
          '<button type="button" class="btn btn-ghost" id="mapa-mode-btn"' + (cloudOk ? '' : ' disabled') + '>Punto de ruta</button>';
      }
      if (canManageRoute && cloudOk) {
        toolbarHtml += '<button type="button" class="btn btn-ghost" id="mapa-clear-btn"' + (cloudOk ? '' : ' disabled') + '>Borrar puntos de ruta</button>';
      }
      toolbarHtml += '<span class="muted" id="mapa-mode-hint" style="display:none;"></span></div>';
    } else {
      toolbarHtml = '<p class="muted mt-1">Vista de consulta. La edici\u00f3n la hace quien tenga acceso a <strong>Recorridos</strong>.</p>';
    }

    container.innerHTML = '' +
      '<section class="page mapa-page" data-testid="mapa-page">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h2 class="page-title">Mapa del sitio</h2>' +
            '<p class="page-subtitle">Recorrido matutino: quien hace de <strong>admin de planta</strong> en <strong>Villa Valencia</strong> registra en el mapa lo observado (punto, comentario, foto a Drive). Este portal es <strong>solo este conjunto</strong>; la <strong>supervisi\u00f3n</strong> puede gestionar varios edificios u HOAs en otros despliegues. Conserjer\u00eda ve el mismo mapa, cierra con foto opcional y marca resuelto; supervisi\u00f3n o gerencia confirman y retiran el punto. Hallazgos Gemba y l\u00edmite' + (cloudOk ? ' (Supabase).' : ' (modo local hasta conectar tablas).') + '</p>' +
          '</div>' +
        '</div>' +
        cloudBanner +
        '<div class="mapa-layer-toggles mt-2">' +
          '<label><input type="checkbox" id="mapa-layer-wp" checked /> Puntos de recorrido</label>' +
          '<label><input type="checkbox" id="mapa-layer-find" checked /> Hallazgos</label>' +
        '</div>' +
        toolbarHtml +
        '<div class="vv-map-wrap mt-2">' +
          '<div id="vv-map" class="vv-map" role="application" aria-label="Mapa Villa Valencia"></div>' +
        '</div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Registro de observaciones en mapa</h3>' +
          '<p class="muted mapa-registry-lead">Tabla de todos los puntos: qui\u00e9n report\u00f3, cu\u00e1ndo, ubicaci\u00f3n, texto m\u00e1s reciente, estado, evidencia fotogr\u00e1fica y \u00faltima actividad.</p>' +
          '<div id="mapa-waypoint-list"><div class="loading">Cargando mapa...</div></div>' +
        '</div>' +
      '</section>';

    try {
      await loadCss(LEAFLET_CSS);
      await loadScript(LEAFLET_JS);
    } catch (e) {
      document.getElementById('mapa-waypoint-list').innerHTML = '<div class="error-box">No se pudo cargar Leaflet.</div>';
      return;
    }

    var L = window.L;
    if (!L || !document.getElementById('vv-map')) return;

    if (window.__vvLeafletMap) {
      try { window.__vvLeafletMap.remove(); } catch (e2) {}
      window.__vvLeafletMap = null;
    }

    var map = L.map('vv-map', { scrollWheelZoom: true, zoomControl: true });
    window.__vvLeafletMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    var waypointLayer = L.layerGroup().addTo(map);
    var findingsLayer = L.layerGroup().addTo(map);
    var geoLayer = L.layerGroup().addTo(map);
    /** GeoJSON polygon ring [[lng,lat],...] for Villa Valencia boundary (new marks inside only). */
    var siteBoundaryRing = null;

    var layerWp = document.getElementById('mapa-layer-wp');
    var layerFind = document.getElementById('mapa-layer-find');
    if (layerWp) {
      layerWp.addEventListener('change', function () {
        if (layerWp.checked) map.addLayer(waypointLayer); else map.removeLayer(waypointLayer);
      });
    }
    if (layerFind) {
      layerFind.addEventListener('change', function () {
        if (layerFind.checked) map.addLayer(findingsLayer); else map.removeLayer(findingsLayer);
      });
    }

    function statusLabelWp(st) {
      if (st === 'conserje_resolved') return 'Pendiente supervisi\u00f3n';
      return 'Abierto';
    }

    function openWaypointDetailModal(wp) {
      if (!cloudOk) return;
      var host = document.getElementById('suite-modal-host');
      if (!host) return;
      var st = wp.pointStatus || 'open';
      var comments = wp.comments || [];
      var htmlComments = comments.map(function (c) {
        var img = c.photo_url
          ? '<div class="mapa-wp-photo"><a href="' + escUrlAttr(c.photo_url) + '" target="_blank" rel="noopener">Ver foto en Drive</a>' +
            '<img src="' + escUrlAttr(c.photo_url) + '" alt="" class="mapa-wp-photo__img" loading="lazy" /></div>'
          : '';
        return '<div class="mapa-wp-comment">' +
          '<span class="muted">' + window.UI.esc(c.label || c.role || '') + ' \u00b7 ' + window.UI.esc(window.UI.fmtDate(c.at) || '') + '</span>' +
          (c.text ? '<p>' + window.UI.esc(c.text) + '</p>' : '') +
          img +
          '</div>';
      }).join('');
      host.innerHTML = '' +
        '<section class="page mapa-wp-modal" data-testid="mapa-wp-detail">' +
          '<h3 class="section-title">' + window.UI.esc(wp.zonaLabel || 'Punto') + '</h3>' +
          '<p class="muted">Estado: <strong>' + window.UI.esc(statusLabelWp(st)) + '</strong></p>' +
          '<div class="mapa-wp-comments">' + (htmlComments || '<p class="muted">Sin comentarios a\u00fan.</p>') + '</div>' +
          (canGemba
            ? '<div class="form-field"><label>Comentario</label>' +
                '<textarea id="mapa-wp-new-cmt" class="mapa-wp-textarea" rows="3" placeholder="Observaci\u00f3n del recorrido (Villa Valencia)"></textarea></div>' +
                '<div class="form-field"><label>Foto (opcional, Google Drive)</label>' +
                '<input type="file" id="mapa-wp-new-photo" class="mapa-wp-file" accept="image/*" /></div>' +
                '<div class="btn-row"><button type="button" class="btn btn-primary-sm" id="mapa-wp-send-cmt">Publicar comentario</button></div>'
            : '') +
          (role === 'conserje' && st === 'open'
            ? '<div class="form-field"><label>Foto de cierre (opcional, Drive)</label>' +
                '<input type="file" id="mapa-wp-resolve-photo" class="mapa-wp-file" accept="image/*" /></div>' +
                '<div class="btn-row"><button type="button" class="btn btn-secondary" id="mapa-wp-conserje-done">Marcar resuelto en sitio</button></div>'
            : '') +
          ((role === 'supervisor' || window.AUTH.canAccess('maestros')) && st === 'conserje_resolved'
            ? '<div class="btn-row"><button type="button" class="btn btn-primary-sm" id="mapa-wp-sup-confirm">Confirmar cierre y quitar del mapa</button></div>'
            : '') +
          ((role === 'supervisor' || window.AUTH.canAccess('maestros')) && st === 'open'
            ? '<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" id="mapa-wp-force-del">Quitar sin esperar conserjer\u00eda</button></div>'
            : '') +
          '<div class="btn-row"><button type="button" class="btn btn-ghost" id="mapa-wp-close">Cerrar</button></div>' +
        '</section>';
      document.getElementById('mapa-wp-close').addEventListener('click', function () { host.innerHTML = ''; });
      var sendCmt = document.getElementById('mapa-wp-send-cmt');
      if (sendCmt) {
        sendCmt.addEventListener('click', async function () {
          var ta = document.getElementById('mapa-wp-new-cmt');
          var txt = ta ? ta.value : '';
          var fileEl = document.getElementById('mapa-wp-new-photo');
          var file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
          try {
            var photoUrl = null;
            if (file && window.UI.uploadPhotoToDrive) {
              sendCmt.disabled = true;
              var up = await window.UI.uploadPhotoToDrive(file, { caseRef: 'MAPWP-' + String(wp.id) });
              photoUrl = up && up.url ? up.url : null;
              sendCmt.disabled = false;
            }
            if (!String(txt || '').trim() && !photoUrl) {
              window.UI.toast('Escribe un comentario o adjunta una foto.', 'warning');
              return;
            }
            await patchWaypointMetadata(wp.id, function (meta) {
              return appendCommentToMeta(meta, txt, session, photoUrl);
            });
            waypoints = await fetchWaypointsFromApi();
            renderWaypointMarkers();
            window.UI.toast('Comentario guardado.', 'success');
            host.innerHTML = '';
          } catch (e) {
            sendCmt.disabled = false;
            window.UI.toast('Error: ' + (e.message || e), 'error');
          }
        });
      }
      var conserjeDone = document.getElementById('mapa-wp-conserje-done');
      if (conserjeDone) {
        conserjeDone.addEventListener('click', async function () {
          var fileEl = document.getElementById('mapa-wp-resolve-photo');
          var file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
          try {
            var photoUrl = null;
            if (file && window.UI.uploadPhotoToDrive) {
              conserjeDone.disabled = true;
              var up = await window.UI.uploadPhotoToDrive(file, { caseRef: 'MAPWP-RES-' + String(wp.id) });
              photoUrl = up && up.url ? up.url : null;
              conserjeDone.disabled = false;
            }
            await patchWaypointMetadata(wp.id, function (meta) {
              var m = meta && typeof meta === 'object' ? Object.assign({}, meta) : {};
              m.vv_point_status = 'conserje_resolved';
              var line = 'Marcado resuelto en sitio por conserjer\u00eda.' + (photoUrl ? ' Foto de verificaci\u00f3n adjunta.' : '');
              return appendCommentToMeta(m, line, session, photoUrl);
            });
            waypoints = await fetchWaypointsFromApi();
            renderWaypointMarkers();
            window.UI.toast('Pendiente confirmaci\u00f3n de supervisi\u00f3n.', 'success');
            host.innerHTML = '';
          } catch (e) {
            conserjeDone.disabled = false;
            window.UI.toast('Error: ' + (e.message || e), 'error');
          }
        });
      }
      var supConf = document.getElementById('mapa-wp-sup-confirm');
      if (supConf) {
        supConf.addEventListener('click', async function () {
          if (!confirm('\u00bfQuitar este punto del mapa?')) return;
          try {
            await window.SB.remove(TABLE, { id: 'eq.' + wp.id });
            waypoints = await fetchWaypointsFromApi();
            renderWaypointMarkers();
            window.UI.toast('Punto cerrado y eliminado del mapa.', 'success');
            host.innerHTML = '';
          } catch (e) {
            window.UI.toast('Error: ' + (e.message || e), 'error');
          }
        });
      }
      var forceDel = document.getElementById('mapa-wp-force-del');
      if (forceDel) {
        forceDel.addEventListener('click', async function () {
          if (!confirm('\u00bfEliminar este punto sin resoluci\u00f3n formal?')) return;
          try {
            await window.SB.remove(TABLE, { id: 'eq.' + wp.id });
            waypoints = await fetchWaypointsFromApi();
            renderWaypointMarkers();
            window.UI.toast('Punto eliminado.', 'info');
            host.innerHTML = '';
          } catch (e) {
            window.UI.toast('Error: ' + (e.message || e), 'error');
          }
        });
      }
    }

    function renderList() {
      var box = document.getElementById('mapa-waypoint-list');
      if (!waypoints.length) {
        box.innerHTML = '<p class="empty">Sin puntos en el registro' + (canPlaceRoutePoints && cloudOk
          ? '. Coloca <strong>Punto de ruta</strong> en el mapa (dentro del l\u00edmite) o <strong>Marcar hallazgo</strong> para Gemba.'
          : (canGemba && cloudOk
            ? '. Supervisi\u00f3n o gerencia colocan las observaciones en este conjunto; t\u00fa puedes abrir cada punto para comentar o marcar resuelto en sitio.'
            : '.')) + '</p>';
        return;
      }
      var byRecency = waypoints.slice().sort(function (a, b) {
        var ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        var tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      var rowsHtml = byRecency.map(function (w, idx) {
        var zl = w.zonaLabel || 'Punto';
        var st = w.pointStatus || 'open';
        var rep = reporterFromWaypoint(w) || '\u2014';
        var roleCol = reporterRoleFromWaypoint(w);
        var obs = observationSnippet(w, 200);
        if (!obs) obs = '\u2014';
        var created = w.createdAt ? window.UI.fmtDate(w.createdAt) : '\u2014';
        var lastAct = lastActivityIso(w);
        var lastActStr = lastAct ? window.UI.fmtDate(lastAct) : '\u2014';
        var photoMark = hasWaypointPhoto(w)
          ? '<span class="badge badge-info">S\u00ed</span>'
          : '<span class="muted">\u2014</span>';
        var nNotes = (w.comments && w.comments.length) ? w.comments.length : 0;
        var orderMap = waypoints.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        var mapIdx = orderMap.findIndex(function (x) { return String(x.id) === String(w.id); });
        var numOnMap = mapIdx >= 0 ? mapIdx + 1 : idx + 1;
        return '<tr data-wp-row="' + window.UI.esc(w.id) + '">' +
          '<td data-label="# mapa"><span class="mapa-wp-num">' + String(numOnMap) + '</span></td>' +
          '<td data-label="Report\u00f3">' + window.UI.esc(rep) + '</td>' +
          '<td data-label="Rol (reporte)">' + window.UI.esc(roleCol) + '</td>' +
          '<td data-label="Fecha y hora (registro)">' + window.UI.esc(created) + '</td>' +
          '<td data-label="Ubicaci\u00f3n">' + window.UI.esc(zl) + ' ' + kindBadgeForLabel(zl) + '</td>' +
          '<td data-label="Coordenadas" class="mapa-registry-coords">' + Number(w.lat).toFixed(5) + ', ' + Number(w.lng).toFixed(5) + '</td>' +
          '<td data-label="Observaci\u00f3n (m\u00e1s reciente)" class="mapa-registry-obs">' + window.UI.esc(obs) + '</td>' +
          '<td data-label="Notas (n\u00ba)">' + String(nNotes) + '</td>' +
          '<td data-label="Estado">' + window.UI.esc(statusLabelWp(st)) + '</td>' +
          '<td data-label="Evidencia foto">' + photoMark + '</td>' +
          '<td data-label="\u00daltima actividad">' + window.UI.esc(lastActStr) + '</td>' +
          '<td data-label="Acciones" class="mapa-registry-actions">' +
            (canGemba && cloudOk
              ? '<button type="button" class="btn btn-ghost btn-sm" data-wp-open="' + window.UI.esc(w.id) + '">Detalle</button> '
              : '') +
            (canManageRoute && cloudOk
              ? '<button type="button" class="btn btn-ghost btn-sm" data-wp-del="' + window.UI.esc(w.id) + '">Quitar</button>'
              : '') +
          '</td>' +
        '</tr>';
      }).join('');
      box.innerHTML = '' +
        '<div class="table-wrap mapa-registry-wrap">' +
          '<table class="data-table mapa-wp-registry" data-testid="mapa-waypoint-registry">' +
            '<thead><tr>' +
              '<th># mapa</th>' +
              '<th>Report\u00f3</th>' +
              '<th>Rol</th>' +
              '<th>Fecha y hora</th>' +
              '<th>Ubicaci\u00f3n</th>' +
              '<th>Coordenadas</th>' +
              '<th>Observaci\u00f3n</th>' +
              '<th>Notas</th>' +
              '<th>Estado</th>' +
              '<th>Fotos</th>' +
              '<th>\u00daltima actividad</th>' +
              '<th></th>' +
            '</tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
          '</table>' +
        '</div>';

      if (canGemba && cloudOk) {
        box.querySelectorAll('[data-wp-open]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-wp-open');
            var w = waypoints.filter(function (x) { return String(x.id) === String(id); })[0];
            if (w) openWaypointDetailModal(w);
          });
        });
      }
      if (canManageRoute && cloudOk) {
        box.querySelectorAll('[data-wp-del]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var id = btn.getAttribute('data-wp-del');
            try {
              await window.SB.remove(TABLE, { id: 'eq.' + id });
              waypoints = waypoints.filter(function (x) { return x.id !== id; });
              renderWaypointMarkers();
              window.UI.toast('Punto eliminado.', 'success');
            } catch (e) {
              window.UI.toast('Error: ' + (e.message || e), 'error');
            }
          });
        });
      }
    }

    function renderFindingMarkers() {
      findingsLayer.clearLayers();
      mapFindings.forEach(function (f) {
        var lat = f.lat != null ? Number(f.lat) : NaN;
        var lng = f.lng != null ? Number(f.lng) : NaN;
        if (isNaN(lat) || isNaN(lng)) return;
        var col = severityColor(f.severity);
        var icon = L.divIcon({
          className: 'mapa-finding-marker',
          html: '<span style="background:' + col + ';width:14px;height:14px;border-radius:50%;display:block;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);"></span>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        var m = L.marker([lat, lng], { icon: icon });
        var desc = (f.description || '').slice(0, 160);
        m.bindPopup(
          '<strong>Hallazgo</strong><br>' +
          window.UI.esc(f.finding_type || '') + ' · ' + window.UI.esc(f.severity || '') +
          (desc ? '<br>' + window.UI.esc(desc) : '')
        );
        m.addTo(findingsLayer);
      });
    }

    function waypointMarkerIcon(idx, pointStatus) {
      var bg = pointStatus === 'conserje_resolved' ? '#d97706' : '#1d4ed8';
      return L.divIcon({
        className: 'mapa-wp-marker',
        html: '<span class="mapa-wp-marker__badge" style="background:' + bg + '">' + String(idx + 1) + '</span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
    }

    function renderWaypointMarkers() {
      waypointLayer.clearLayers();
      waypoints
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
        .forEach(function (w, idx) {
          var lat = Number(w.lat);
          var lng = Number(w.lng);
          if (isNaN(lat) || isNaN(lng)) return;
          var st = w.pointStatus || 'open';
          var icon = waypointMarkerIcon(idx, st);
          var m = L.marker([lat, lng], {
            draggable: canManageRoute && cloudOk,
            title: (w.zonaLabel || '') + ' · ' + statusLabelWp(st),
            icon: icon,
          });
          m.on('click', function () {
            openWaypointDetailModal(w);
          });
          if (canManageRoute && cloudOk) {
            m.on('dragend', async function () {
              var ll = m.getLatLng();
              try {
                await window.SB.update(TABLE, { id: 'eq.' + w.id }, {
                  lat: ll.lat,
                  lng: ll.lng,
                  updated_at: new Date().toISOString(),
                });
                w.lat = ll.lat;
                w.lng = ll.lng;
                renderList();
                window.UI.toast('Ubicaci\u00f3n actualizada.', 'success');
              } catch (e) {
                window.UI.toast('Error al guardar: ' + (e.message || e), 'error');
              }
            });
          }
          m.addTo(waypointLayer);
        });
      renderList();
    }

    var res = await fetch(GEOJSON_URL);
    if (!res.ok) throw new Error('No se encontr\u00f3 ' + GEOJSON_URL);
    var geo = await res.json();
    siteBoundaryRing = extractSiteRingFromGeo(geo);

    var gj = L.geoJSON(geo, {
      style: function (feat) {
        var k = feat && feat.properties && feat.properties.kind;
        if (k === 'site_boundary') {
          return { color: '#1e3a8a', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.12 };
        }
        return { color: '#0ea5e9', weight: 4, opacity: 0.85 };
      },
      onEachFeature: function (feat, layer) {
        if (feat.properties && feat.properties.name) {
          layer.bindPopup(window.UI.esc(feat.properties.name));
        }
      },
    }).addTo(geoLayer);

    try {
      map.fitBounds(gj.getBounds(), { padding: [24, 24], maxZoom: 18 });
    } catch (e3) {
      map.setView([9.032, -79.422], 17);
    }

    setTimeout(function () { map.invalidateSize(); }, 200);

    renderWaypointMarkers();
    renderFindingMarkers();

    var placeMode = null;
    var clickHandler = null;

    function clearMapClickMode() {
      placeMode = null;
      var hint = document.getElementById('mapa-mode-hint');
      if (hint) {
        hint.style.display = 'none';
        hint.textContent = '';
      }
      if (clickHandler) {
        map.off('click', clickHandler);
        clickHandler = null;
      }
      var modeBtn = document.getElementById('mapa-mode-btn');
      var hzBtn = document.getElementById('mapa-hallazgo-btn');
      if (modeBtn) {
        modeBtn.textContent = 'Punto de ruta';
        modeBtn.classList.add('btn-ghost');
        modeBtn.classList.remove('btn-primary-sm');
      }
      if (hzBtn) {
        hzBtn.textContent = 'Marcar hallazgo';
        hzBtn.classList.add('btn-primary-sm');
        hzBtn.classList.remove('btn-ghost');
      }
    }

    function bindRoutePopupSave(lat, lng, popup) {
      setTimeout(function () {
        var saveBtn = document.getElementById('mapa-new-save');
        if (!saveBtn) return;
        saveBtn.addEventListener('click', async function () {
          var zonaEl = document.getElementById('mapa-new-zona');
          var zona = zonaEl ? zonaEl.value : '';
          if (siteBoundaryRing && !pointInSiteRing(lat, lng, siteBoundaryRing)) {
            window.UI.toast('Coloca el punto dentro del l\u00edmite de Villa Valencia.', 'warning');
            return;
          }
          var maxOrder = waypoints.reduce(function (m, x) { return Math.max(m, x.order || 0); }, 0);
          try {
            var inserted = await window.SB.insert(TABLE, {
              building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
              zona_label: zona,
              lat: lat,
              lng: lng,
              sort_order: maxOrder + 1,
              metadata: {
                source: 'aproviva-suite',
                actor: session.label,
                vv_reported_by_role: session.role,
                vv_point_status: 'open',
                vv_comments: [],
              },
            });
            var raw = Array.isArray(inserted) ? inserted[0] : inserted;
            var nw = normalizeRow(raw);
            if (nw) waypoints.push(nw);
            map.closePopup(popup);
            renderWaypointMarkers();
            clearMapClickMode();
            window.UI.toast('Punto guardado en Supabase.', 'success');
          } catch (e) {
            window.UI.toast('Error: ' + (e.message || e), 'error');
          }
        });
      }, 0);
    }

    function bindHallazgoPopupContinue(lat, lng, popup) {
      setTimeout(function () {
        var cont = document.getElementById('mapa-hallazgo-continue');
        if (!cont) return;
        cont.addEventListener('click', async function () {
          var zonaEl = document.getElementById('mapa-hallazgo-zona');
          var zona = zonaEl ? zonaEl.value : '';
          map.closePopup(popup);
          clearMapClickMode();
          if (window.GEMBA && window.GEMBA.openFindingFromMapClick) {
            await window.GEMBA.openFindingFromMapClick(lat, lng, zona);
          } else {
            window.UI.toast('M\u00f3dulo Gemba no cargado.', 'error');
          }
        });
      }, 0);
    }

    if (canPlaceRoutePoints && cloudOk && document.getElementById('mapa-mode-btn')) {
      document.getElementById('mapa-mode-btn').addEventListener('click', function () {
        var btn = this;
        if (placeMode === 'route') {
          clearMapClickMode();
          return;
        }
        clearMapClickMode();
        placeMode = 'route';
        var hint = document.getElementById('mapa-mode-hint');
        if (hint) {
          hint.style.display = '';
          hint.textContent = 'Toca el mapa para colocar un punto de ruta.';
        }
        btn.textContent = 'Cancelar punto de ruta';
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary-sm');
        clickHandler = function (ev) {
          var lat = ev.latlng.lat;
          var lng = ev.latlng.lng;
          if (siteBoundaryRing && !pointInSiteRing(lat, lng, siteBoundaryRing)) {
            window.UI.toast('Marca solo dentro del l\u00edmite de Villa Valencia.', 'warning');
            return;
          }
          var wrap = document.createElement('div');
          wrap.className = 'mapa-popup-form';
          wrap.innerHTML = '' +
            '<label class="form-field" style="margin:0 0 0.5rem;">Zona / punto</label>' +
            '<select id="mapa-new-zona" class="mapa-select">' + zonaOptionsHtml() + '</select>' +
            '<button type="button" class="btn btn-primary-sm mt-1" id="mapa-new-save">Guardar punto</button>';
          var popup = L.popup({ minWidth: 240 }).setLatLng(ev.latlng).setContent(wrap);
          popup.openOn(map);
          bindRoutePopupSave(lat, lng, popup);
        };
        map.on('click', clickHandler);
      });
    }

    if (canManageRoute && cloudOk && document.getElementById('mapa-clear-btn')) {
      document.getElementById('mapa-clear-btn').addEventListener('click', async function () {
        if (!confirm('\u00bfBorrar todos los puntos de recorrido en Supabase para este edificio?')) return;
        try {
          await window.SB.remove(TABLE, { building_id: 'eq.' + window.APROVIVA_SUITE_CONFIG.BUILDING_ID });
          waypoints = [];
          renderWaypointMarkers();
          window.UI.toast('Puntos borrados en Supabase.', 'warning');
        } catch (e) {
          window.UI.toast('Error: ' + (e.message || e), 'error');
        }
      });
    }

    if (canMarkFinding && cloudOk) {
      var hBtn = document.getElementById('mapa-hallazgo-btn');
      if (hBtn) {
        hBtn.addEventListener('click', function () {
          var btn = this;
          if (placeMode === 'finding') {
            clearMapClickMode();
            return;
          }
          clearMapClickMode();
          placeMode = 'finding';
          var hint = document.getElementById('mapa-mode-hint');
          if (hint) {
            hint.style.display = '';
            hint.textContent = 'Toca el mapa; elige zona y contin\u00faa al formulario de hallazgo.';
          }
          btn.textContent = 'Cancelar hallazgo';
          btn.classList.remove('btn-primary-sm');
          btn.classList.add('btn-ghost');
          clickHandler = function (ev) {
            var lat = ev.latlng.lat;
            var lng = ev.latlng.lng;
            if (siteBoundaryRing && !pointInSiteRing(lat, lng, siteBoundaryRing)) {
              window.UI.toast('Marca solo dentro del l\u00edmite de Villa Valencia.', 'warning');
              return;
            }
            var wrap = document.createElement('div');
            wrap.className = 'mapa-popup-form';
            wrap.innerHTML = '' +
              '<label class="form-field" style="margin:0 0 0.5rem;">Zona (referencia)</label>' +
              '<select id="mapa-hallazgo-zona" class="mapa-select">' + zonaOptionsHtml() + '</select>' +
              '<button type="button" class="btn btn-primary-sm mt-1" id="mapa-hallazgo-continue">Continuar al formulario</button>';
            var popup = L.popup({ minWidth: 260 }).setLatLng(ev.latlng).setContent(wrap);
            popup.openOn(map);
            bindHallazgoPopupContinue(lat, lng, popup);
          };
          map.on('click', clickHandler);
        });
      }
    }

    window.addEventListener('hashchange', function onHash() {
      if (window.ROUTER.currentRoute() !== 'mapa' && window.__vvLeafletMap) {
        try { window.__vvLeafletMap.remove(); } catch (e4) {}
        window.__vvLeafletMap = null;
        window.removeEventListener('hashchange', onHash);
      }
    });
  }

  window.APROVIVA_MAP = {
    fetchWaypoints: fetchWaypointsFromApi,
    getStorageKey: storageKey,
  };

  window.ROUTER.register('mapa', { render: render, requiredModule: 'gemba' });
})();
