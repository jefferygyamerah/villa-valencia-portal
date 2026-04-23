/**
 * Supabase REST client - thin wrapper over fetch().
 * Uses the publishable key for all calls; RLS enforces row-level rules.
 */
(function () {
  var cfg = window.APROVIVA_SUITE_CONFIG;

  function url(path, params) {
    var u = cfg.SUPABASE_URL + '/rest/v1/' + path;
    if (params && Object.keys(params).length) {
      var qs = Object.keys(params)
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      u += (u.indexOf('?') === -1 ? '?' : '&') + qs;
    }
    return u;
  }

  function headers(extra) {
    var h = {
      'apikey': cfg.SUPABASE_PUBLIC_KEY,
      'Authorization': 'Bearer ' + cfg.SUPABASE_PUBLIC_KEY,
      'Content-Type': 'application/json',
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  async function request(method, path, body, params, opts) {
    opts = opts || {};
    var init = { method: method, headers: headers(opts.headers || {}) };
    if (body !== undefined && body !== null) init.body = JSON.stringify(body);
    var res = await fetch(url(path, params), init);
    var text = await res.text();
    var json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
    if (!res.ok) {
      var err = new Error('Supabase ' + res.status + ' on ' + path);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  window.SB = {
    select: function (table, params) {
      return request('GET', table, null, params || {});
    },
    insert: function (table, row) {
      return request('POST', table, Array.isArray(row) ? row : [row], null, {
        headers: { 'Prefer': 'return=representation' },
      });
    },
    update: function (table, params, patch) {
      return request('PATCH', table, patch, params, {
        headers: { 'Prefer': 'return=representation' },
      });
    },
    remove: function (table, params) {
      return request('DELETE', table, null, params, {
        headers: { 'Prefer': 'return=representation' },
      });
    },
    rpc: function (fn, args) {
      return request('POST', 'rpc/' + fn, args || {});
    },
  };
})();
