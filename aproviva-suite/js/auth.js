/**
 * PIN-based session auth. POC-grade by design - the publishable key + RLS is the
 * actual security boundary, this just gates UI surface area per role.
 */
(function () {
  var cfg = window.APROVIVA_SUITE_CONFIG;
  var SESSION_KEY = 'aproviva_session_v1';

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeSession(s) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function loginWithPin(pin) {
    var entry = cfg.PINS[String(pin || '').trim()];
    if (!entry) return null;
    var session = {
      role: entry.role,
      label: entry.label,
      modules: entry.modules.slice(),
      loginAt: new Date().toISOString(),
    };
    writeSession(session);
    return session;
  }

  function requireSession() {
    var s = readSession();
    if (!s) {
      window.location.hash = '#/login';
      return null;
    }
    return s;
  }

  function canAccess(moduleName) {
    var s = readSession();
    return !!(s && s.modules && s.modules.indexOf(moduleName) !== -1);
  }

  function logout() {
    clearSession();
    window.location.hash = '#/login';
  }

  window.AUTH = {
    loginWithPin: loginWithPin,
    readSession: readSession,
    requireSession: requireSession,
    canAccess: canAccess,
    logout: logout,
  };
})();
