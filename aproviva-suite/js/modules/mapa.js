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

  function normalizeRow(row) {
    if (!row || !row.id) return null;
    return {
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      zonaLabel: row.zona_label || '',
      order: Number(row.sort_order) || 0,
    };
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
    var canEditWaypoints = window.AUTH.canAccess('maestros');
    var canMarkFinding = window.AUTH.canAccess('gemba');
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
    if (canEditWaypoints || canMarkFinding) {
      toolbarHtml = '<div class="mapa-toolbar row wrap mt-2">';
      if (canMarkFinding && cloudOk) {
        toolbarHtml += '<button type="button" class="btn btn-primary-sm" id="mapa-hallazgo-btn"' + (cloudOk ? '' : ' disabled') + '>Marcar hallazgo</button>';
      }
      if (canEditWaypoints && cloudOk) {
        toolbarHtml +=
          '<button type="button" class="btn btn-ghost" id="mapa-mode-btn"' + (cloudOk ? '' : ' disabled') + '>Punto de ruta</button>' +
          '<button type="button" class="btn btn-ghost" id="mapa-clear-btn"' + (cloudOk ? '' : ' disabled') + '>Borrar puntos de ruta</button>';
      }
      toolbarHtml += '<span class="muted" id="mapa-mode-hint" style="display:none;"></span></div>';
    } else {
      toolbarHtml = '<p class="muted mt-1">Vista de consulta. La edici\u00f3n la hace quien tenga acceso a <strong>Recorridos</strong> o <strong>Datos maestros</strong>.</p>';
    }

    container.innerHTML = '' +
      '<section class="page mapa-page" data-testid="mapa-page">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h2 class="page-title">Mapa del sitio</h2>' +
            '<p class="page-subtitle">L\u00edmite del conjunto, ruta, puntos de recorrido y hallazgos Gemba' + (cloudOk ? ' (Supabase).' : ' (modo local hasta conectar tablas).') + '</p>' +
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
          '<h3 class="section-title">Puntos de recorrido</h3>' +
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

    function renderList() {
      var box = document.getElementById('mapa-waypoint-list');
      if (!waypoints.length) {
        box.innerHTML = '<p class="empty">Sin puntos de ruta' + (canEditWaypoints && cloudOk ? '. Usa <strong>Punto de ruta</strong> y toca el mapa, o <strong>Marcar hallazgo</strong> para un hallazgo Gemba.' : '.') + '</p>';
        return;
      }
      var sorted = waypoints.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      box.innerHTML = '<ul class="mapa-wp-list">' + sorted.map(function (w) {
        var zl = w.zonaLabel || 'Punto';
        return '<li class="mapa-wp-item">' +
          '<span class="mapa-wp-labelwrap">' +
            '<span class="mapa-wp-label">' + window.UI.esc(zl) + '</span>' +
            kindBadgeForLabel(zl) +
          '</span>' +
          '<span class="muted mapa-wp-coord">' + Number(w.lat).toFixed(5) + ', ' + Number(w.lng).toFixed(5) + '</span>' +
          (canEditWaypoints && cloudOk
            ? '<button type="button" class="btn btn-ghost" data-wp-del="' + window.UI.esc(w.id) + '">Quitar</button>'
            : '') +
        '</li>';
      }).join('') + '</ul>';

      if (canEditWaypoints && cloudOk) {
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

    function renderWaypointMarkers() {
      waypointLayer.clearLayers();
      waypoints
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
        .forEach(function (w, idx) {
          var lat = Number(w.lat);
          var lng = Number(w.lng);
          if (isNaN(lat) || isNaN(lng)) return;
          var m = L.marker([lat, lng], { draggable: canEditWaypoints && cloudOk, title: w.zonaLabel || '' });
          var kb = kindBadgeForLabel(w.zonaLabel || '');
          m.bindPopup(
            '<strong>' + window.UI.esc(w.zonaLabel || 'Punto') + '</strong>' +
            (kb ? '<br>' + kb : '') +
            '<br>#' + (idx + 1)
          );
          if (canEditWaypoints && cloudOk) {
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
          var maxOrder = waypoints.reduce(function (m, x) { return Math.max(m, x.order || 0); }, 0);
          try {
            var inserted = await window.SB.insert(TABLE, {
              building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
              zona_label: zona,
              lat: lat,
              lng: lng,
              sort_order: maxOrder + 1,
              metadata: { source: 'aproviva-suite', actor: session.label },
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

    if (canEditWaypoints && cloudOk) {
      document.getElementById('mapa-mode-btn').addEventListener('click', function () {
        var btn = this;
        if (placeMode === 'route') {
          clearMapClickMode();
          return;
        }
        clearMapClickMode();
        placeMode = 'route';
        var hint = document.getElementById('mapa-mode-hint');
        hint.style.display = '';
        hint.textContent = 'Toca el mapa para colocar un punto de ruta.';
        btn.textContent = 'Cancelar punto de ruta';
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary-sm');
        clickHandler = function (ev) {
          var lat = ev.latlng.lat;
          var lng = ev.latlng.lng;
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
          hint.style.display = '';
          hint.textContent = 'Toca el mapa; elige zona y contin\u00faa al formulario de hallazgo.';
          btn.textContent = 'Cancelar hallazgo';
          btn.classList.remove('btn-primary-sm');
          btn.classList.add('btn-ghost');
          clickHandler = function (ev) {
            var lat = ev.latlng.lat;
            var lng = ev.latlng.lng;
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
