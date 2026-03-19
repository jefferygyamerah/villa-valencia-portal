/**
 * APROVIVA Portal – Main page logic
 */
(function () {
  'use strict';

  var config = window.APROVIVA_CONFIG;

  function populateDriveLinks() {
    var links = config.DRIVE_LINKS;
    var els = document.querySelectorAll('[data-drive]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-drive');
      if (links[key] && links[key].indexOf('YOUR_') === -1) {
        els[i].href = links[key];
        els[i].target = '_blank';
        els[i].rel = 'noopener';
      } else {
        els[i].removeAttribute('href');
        els[i].style.opacity = '0.5';
        els[i].title = 'Enlace pendiente de configurar';
      }
    }
  }

  function setupPqrsButton() {
    var btn = document.getElementById('pqrs-submit');
    if (!btn) return;

    var isConfigured = config.PQRS_FORM_URL &&
      config.PQRS_FORM_URL.indexOf('YOUR_') === -1;

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!isConfigured) {
        alert('El formulario PQRS aún no está configurado.');
        return;
      }
      var url = config.PQRS_FORM_URL;
      var user = window.APROVIVA_AUTH.getUser();
      if (user && !user.demo) {
        url += (url.indexOf('?') === -1 ? '?' : '&') +
          'emailAddress=' + encodeURIComponent(user.email);
      }
      window.open(url, '_blank', 'noopener');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.APROVIVA_AUTH.initAuthUI();
    populateDriveLinks();
    setupPqrsButton();
  });
})();
