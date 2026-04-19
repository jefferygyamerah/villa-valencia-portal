/**
 * Read-only site map: same GeoJSON + Supabase waypoints as #/mapa (recorrido).
 * Used by mapa-pqrs.html for residents (PQRS reference).
 */
(function () {
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  async function fetchWaypoints(cfg) {
    var qs =
      'select=*&building_id=eq.' + encodeURIComponent(cfg.BUILDING_ID) +
      '&order=sort_order.asc';
    var u = cfg.SUPABASE_URL + '/rest/v1/' + cfg.WAYPOINT_TABLE + '?' + qs;
    var res = await fetch(u, {
      headers: {
        apikey: cfg.SUPABASE_PUBLIC_KEY,
        Authorization: 'Bearer ' + cfg.SUPABASE_PUBLIC_KEY,
      },
    });
    if (!res.ok) return [];
    var rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  function init(opts) {
    opts = opts || {};
    var cfg = window.VV_MAP_EMBED_CONFIG;
    if (!cfg) {
      console.error('VV_MAP_EMBED_CONFIG missing');
      return;
    }
    var containerId = opts.containerId || 'vv-embed-map';
    var geoPath = opts.geojsonPath || cfg.GEOJSON_PATH || 'data/villa-valencia-site.geojson';

    loadCss(LEAFLET_CSS).then(function () { return loadScript(LEAFLET_JS); }).then(async function () {
      var L = window.L;
      var el = document.getElementById(containerId);
      if (!L || !el) return;

      el.innerHTML = '';
      el.className = (el.className ? el.className + ' ' : '') + 'vv-map vv-map-embed';

      var map = L.map(el, { scrollWheelZoom: true, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      var geoLayer = L.layerGroup().addTo(map);
      var wpLayer = L.layerGroup().addTo(map);

      var gRes = await fetch(geoPath);
      if (!gRes.ok) {
        el.innerHTML = '<p class="map-embed-error">No se pudo cargar el mapa base.</p>';
        return;
      }
      var geo = await gRes.json();
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
            layer.bindPopup(esc(feat.properties.name));
          }
        },
      }).addTo(geoLayer);

      try {
        map.fitBounds(gj.getBounds(), { padding: [20, 20], maxZoom: 18 });
      } catch (e) {
        map.setView([9.032, -79.422], 17);
      }

      var rows = await fetchWaypoints(cfg);
      rows.forEach(function (r, idx) {
        var lat = Number(r.lat);
        var lng = Number(r.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        var label = r.zona_label || 'Punto';
        var m = L.marker([lat, lng], { draggable: false });
        var kindLine = '';
        var cfgSuite = window.APROVIVA_SUITE_CONFIG;
        if (cfgSuite && cfgSuite.getPlaceByLabel && cfgSuite.placeKindShortLabel) {
          var pl = cfgSuite.getPlaceByLabel(label);
          if (pl) kindLine = '<br><span class="map-embed-kind">' + esc(cfgSuite.placeKindShortLabel(pl.kind)) + '</span>';
        }
        m.bindPopup('<strong>' + esc(label) + '</strong>' + kindLine + '<br>#' + (idx + 1));
        m.addTo(wpLayer);
      });

      setTimeout(function () { map.invalidateSize(); }, 200);
    }).catch(function (e) {
      console.error(e);
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = '<p class="map-embed-error">Mapa no disponible.</p>';
    });
  }

  window.VVMapEmbed = { init: init };
})();
