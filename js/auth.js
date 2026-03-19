/**
 * APROVIVA Auth Module
 * Google Identity Services integration with demo mode fallback.
 */
(function () {
  'use strict';

  var config = window.APROVIVA_CONFIG;
  var SESSION_KEY = 'aproviva_user';
  var DEMO_KEY = 'aproviva_demo';

  function decodeJwtPayload(token) {
    var base64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return JSON.parse(atob(base64));
  }

  function getUser() {
    var raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function isAuthenticated() {
    return getUser() !== null;
  }

  function isDemoMode() {
    return sessionStorage.getItem(DEMO_KEY) === 'true';
  }

  function setUser(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    document.dispatchEvent(new CustomEvent('aproviva:auth-changed'));
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(DEMO_KEY);
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    window.location.reload();
  }

  function enterDemoMode() {
    sessionStorage.setItem(DEMO_KEY, 'true');
    setUser({
      email: 'demo@villavalencia.com',
      name: 'Modo Demo',
      picture: null,
      demo: true,
    });
  }

  function handleCredential(response) {
    var payload = decodeJwtPayload(response.credential);

    if (config.ALLOWED_DOMAIN && !payload.email.endsWith('@' + config.ALLOWED_DOMAIN)) {
      var errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = 'Solo cuentas @' + config.ALLOWED_DOMAIN + ' tienen acceso.';
        errEl.style.display = 'block';
      }
      return;
    }

    setUser({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      demo: false,
    });
  }

  function loadGsi(callback) {
    if (window.google && google.accounts) {
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function initAuthUI() {
    var overlay = document.getElementById('loginOverlay');
    var protectedContent = document.getElementById('protected-content');
    var authArea = document.getElementById('auth-area');

    if (isAuthenticated()) {
      unlockUI(overlay, protectedContent, authArea);
      return;
    }

    // Show overlay, hide content
    if (overlay) overlay.style.display = 'flex';
    if (protectedContent) protectedContent.classList.add('hidden');

    // Render Google Sign-In button
    var isPlaceholder = !config.GOOGLE_CLIENT_ID ||
      config.GOOGLE_CLIENT_ID.indexOf('YOUR_') === 0;

    if (!isPlaceholder) {
      loadGsi(function () {
        google.accounts.id.initialize({
          client_id: config.GOOGLE_CLIENT_ID,
          callback: handleCredential,
          auto_select: false,
        });
        var btnContainer = document.getElementById('g-signin-btn');
        if (btnContainer) {
          google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: 300,
            text: 'continue_with',
            locale: 'es',
          });
        }
      });
    }

    // If no real client ID, hide the Google button container and show a note
    if (isPlaceholder) {
      var btnContainer = document.getElementById('g-signin-btn');
      if (btnContainer) {
        btnContainer.innerHTML =
          '<p style="font-size:0.8rem;color:#5a6a85;padding:0.5rem 0;">' +
          'Google Sign-In no configurado a\u00fan.</p>';
      }
    }

    // Demo button
    var demoBtn = document.getElementById('demo-btn');
    if (demoBtn) {
      if (config.DEMO_MODE_ENABLED) {
        demoBtn.style.display = '';
        demoBtn.onclick = function () {
          enterDemoMode();
        };
      } else {
        demoBtn.style.display = 'none';
      }
    }
  }

  function unlockUI(overlay, protectedContent, authArea) {
    if (overlay) overlay.style.display = 'none';
    if (protectedContent) protectedContent.classList.remove('hidden');

    var user = getUser();
    if (authArea && user) {
      var displayName = user.demo ? 'Demo' : user.name.split(' ')[0];
      authArea.innerHTML =
        '<span style="font-size:0.82rem;color:var(--text-light);margin-right:0.5rem;">' +
        escapeHtml(displayName) + '</span>' +
        '<button class="btn-login" onclick="APROVIVA_AUTH.logout()" style="font-size:0.78rem;padding:0.4rem 0.9rem;">' +
        'Salir</button>';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Listen for auth changes (e.g. after login)
  document.addEventListener('aproviva:auth-changed', function () {
    var overlay = document.getElementById('loginOverlay');
    var protectedContent = document.getElementById('protected-content');
    var authArea = document.getElementById('auth-area');
    unlockUI(overlay, protectedContent, authArea);
  });

  // Public API
  window.APROVIVA_AUTH = {
    initAuthUI: initAuthUI,
    isAuthenticated: isAuthenticated,
    isDemoMode: isDemoMode,
    getUser: getUser,
    logout: logout,
    enterDemoMode: enterDemoMode,
  };
})();
