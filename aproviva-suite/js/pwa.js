/**
 * Install hints + service worker registration (Add to Home Screen on mobile).
 */
(function () {
  var deferredPrompt = null;

  function registerSw() {
    if (!('serviceWorker' in navigator)) return;
    /* Relative to this HTML document (aproviva-suite/index.html → aproviva-suite/sw.js). */
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {});
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('aproviva-install-available'));
  });

  window.APROVIVA_INSTALL = {
    prompt: function () {
      if (!deferredPrompt) return Promise.resolve(false);
      return deferredPrompt.prompt().then(function () {
        return deferredPrompt.userChoice;
      }).finally(function () {
        deferredPrompt = null;
      });
    },
    canPrompt: function () {
      return !!deferredPrompt;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerSw);
  } else {
    registerSw();
  }
})();
