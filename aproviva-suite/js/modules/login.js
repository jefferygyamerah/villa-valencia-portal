/**
 * Login route - PIN form.
 */
(function () {
  function render(container) {
    container.innerHTML = '' +
      '<div class="login-screen" data-testid="suite-login-screen">' +
        '<div class="login-card">' +
          '<h1>APROVIVA Operaciones</h1>' +
          '<p class="login-sub">Ingresa tu PIN para entrar al sistema operativo de Villa Valencia.</p>' +
          '<input type="password" inputmode="text" id="pin-input" class="pin-input" placeholder="PIN" maxlength="8" autocomplete="off" />' +
          '<div class="login-error" id="login-error"></div>' +
          '<button class="btn-primary" id="pin-submit" type="button">Entrar</button>' +
          '<div class="btn-row mt-2" id="quick-pin-buttons" style="justify-content:center;gap:0.35rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-quick-pin="2026">Conserjería</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-quick-pin="SUP26">Supervisión</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-quick-pin="GER26">Gerencia</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-quick-pin="JD26">Junta</button>' +
          '</div>' +
          '<a class="login-back" href="../index.html">&larr; Volver al portal</a>' +
          '<div class="login-hints">' +
            '<strong>Conserjer\u00eda</strong> &mdash; PIN <strong>2026</strong> o <strong>CONS26</strong><br>' +
            '<strong>Supervisi\u00f3n</strong> &mdash; PIN <strong>SUP26</strong><br>' +
            '<strong>Gerencia</strong> &mdash; PIN <strong>GER26</strong><br>' +
            '<strong>Junta</strong> &mdash; PIN <strong>JD26</strong> (gobernanza, reportes, backlog para operaciones)' +
          '</div>' +
        '</div>' +
      '</div>';

    var input = document.getElementById('pin-input');
    var btn = document.getElementById('pin-submit');
    var err = document.getElementById('login-error');

    function attempt() {
      var session = window.AUTH.loginWithPin(input.value);
      if (!session) {
        err.textContent = 'PIN incorrecto.';
        input.value = '';
        input.focus();
        return;
      }
      err.textContent = '';
      window.location.hash = '#/inicio';
    }

    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attempt();
    });
    var quick = document.getElementById('quick-pin-buttons');
    if (quick) {
      quick.addEventListener('click', function (e) {
        var b = e.target.closest('[data-quick-pin]');
        if (!b) return;
        input.value = b.getAttribute('data-quick-pin') || '';
        attempt();
      });
    }
    setTimeout(function () { input.focus(); }, 50);
  }

  window.ROUTER.register('login', { render: render });
})();
