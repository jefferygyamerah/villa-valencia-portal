/**
 * Login route - PIN form.
 */
(function () {
  function render(container) {
    container.innerHTML = '' +
      '<div class="login-screen">' +
        '<div class="login-card">' +
          '<h1>APROVIVA Operaciones</h1>' +
          '<p class="login-sub">Ingresa tu PIN para entrar al sistema operativo de Villa Valencia.</p>' +
          '<input type="password" inputmode="text" id="pin-input" class="pin-input" placeholder="PIN" maxlength="8" autocomplete="off" />' +
          '<div class="login-error" id="login-error"></div>' +
          '<button class="btn-primary" id="pin-submit" type="button">Entrar</button>' +
          '<a class="login-back" href="../index.html">&larr; Volver al portal</a>' +
          '<div class="login-hints">' +
            'PIN <strong>2026</strong> &mdash; Personal / Conserjer\u00eda<br>' +
            'PIN <strong>JD26</strong> &mdash; Junta / Administraci\u00f3n' +
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
    setTimeout(function () { input.focus(); }, 50);
  }

  window.ROUTER.register('login', { render: render });
})();
