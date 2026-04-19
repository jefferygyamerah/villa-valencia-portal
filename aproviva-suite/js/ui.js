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
        html += '<td>' + (c.html ? v : esc(v)) + '</td>';
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

  window.UI = {
    esc: esc,
    toast: toast,
    fmtDate: fmtDate,
    table: table,
    loading: loading,
    errorBox: errorBox,
    badge: badge,
  };
})();
