/**
 * UI helpers: toast, modal, table render, escape, format.
 */
(function () {
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(msg, kind) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.className = 'toast show ' + (kind || 'info');
    t.textContent = msg;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      t.className = 'toast';
    }, 4000);
  }

  function fmtDate(iso, opts) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (opts && opts.dateOnly) return d.toLocaleDateString('es-PA');
      return d.toLocaleString('es-PA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { return iso; }
  }

  function table(rows, columns) {
    if (!rows || !rows.length) {
      return '<p class="empty">Sin registros.</p>';
    }
    var html = '<div class="table-wrap"><table class="data-table"><thead><tr>';
    columns.forEach(function (c) { html += '<th>' + esc(c.label) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>';
      columns.forEach(function (c) {
        var v = c.render ? c.render(r) : (r[c.key] === undefined || r[c.key] === null ? '' : r[c.key]);
        var label = c.label || c.key || '';
        html += '<td data-label="' + esc(label) + '">' + (c.html ? v : esc(v)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function loading(target, label) {
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) el.innerHTML = '<div class="loading">' + esc(label || 'Cargando...') + '</div>';
  }

  function errorBox(target, err) {
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    var msg = (err && err.message) ? err.message : String(err || 'Error');
    var detail = (err && err.body) ? JSON.stringify(err.body) : '';
    if (el) {
      el.innerHTML = '<div class="error-box"><strong>Error.</strong> ' + esc(msg) +
        (detail ? '<pre class="error-detail">' + esc(detail) + '</pre>' : '') + '</div>';
    }
  }

  function badge(text, kind) {
    return '<span class="badge badge-' + (kind || 'info') + '">' + esc(text) + '</span>';
  }

  /** Max size aligned with apps-script/Code.gs PQRS_PHOTO_MAX_BYTES */
  var DRIVE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

  function fileToBase64Payload(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result || '');
        var idx = s.indexOf('base64,');
        resolve(idx >= 0 ? s.slice(idx + 7) : '');
      };
      r.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
      r.readAsDataURL(file);
    });
  }

  /**
   * Upload an image to Google Drive via the portal Apps Script (Code.gs doPost → savePqrsPhoto).
   * Returns { url, fileId } or throws.
   */
  async function uploadPhotoToDrive(file, opts) {
    if (!file || !file.size) {
      return { url: null, fileId: null };
    }
    if (file.size > DRIVE_PHOTO_MAX_BYTES) {
      throw new Error('La foto supera 5 MB.');
    }
    var cfg = window.APROVIVA_SUITE_CONFIG || {};
    var endpoint = cfg.PHOTO_UPLOAD_URL;
    if (!endpoint) throw new Error('Falta PHOTO_UPLOAD_URL en configuraci\u00f3n.');
    opts = opts || {};
    var base64 = await fileToBase64Payload(file);
    if (!base64) throw new Error('Archivo vac\u00edo o no v\u00e1lido.');
    var safeRef = String(opts.caseRef || 'GEMBA').replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 60);
    var payload = {
      _type: 'pqrs_photo',
      base64: base64,
      fileName: String(file.name || 'gemba.jpg').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120),
      mimeType: String(file.type || 'image/jpeg').toLowerCase(),
      caseRef: safeRef,
      casa: String(opts.casa || cfg.BUILDING_CODE || 'VV').replace(/[\\/:*?"<>|]/g, '_').slice(0, 20),
    };
    var res = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    var json = {};
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('Respuesta inv\u00e1lida del servidor de fotos.');
    }
    if (!json.ok) {
      throw new Error(json.message || json.error || 'Error al subir la foto a Drive.');
    }
    return { url: json.url || null, fileId: json.fileId || null };
  }

  window.UI = {
    esc: esc,
    toast: toast,
    fmtDate: fmtDate,
    table: table,
    loading: loading,
    errorBox: errorBox,
    badge: badge,
    uploadPhotoToDrive: uploadPhotoToDrive,
  };
})();
