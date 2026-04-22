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
            '<button type="button" class="btn btn-ghost btn-sm" data-quick-pin="SUP26">Supervisi\u00f3n</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-quick-pin="GER26">Gerencia</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-quick-pin="JD26">Junta</button>' +
          '</div>' +
          '<a class="login-back" href="../index.html">&larr; Volver al portal</a>' +
          '<div class="login-hints">' +
            '<strong>Conserjer\u00eda</strong> &mdash; PIN <strong>2026</strong> o <strong>CONS26</strong><br>' +
            '<strong>Supervisi\u00f3n</strong> &mdash; PIN <strong>SUP26</strong> (en otros despliegues puede ver varios conjuntos u HOAs; aqu\u00ed solo <strong>Villa Valencia</strong>)<br>' +
            '<strong>Gerencia</strong> &mdash; PIN <strong>GER26</strong><br>' +
            '<strong>Junta</strong> &mdash; PIN <strong>JD26</strong> (gobernanza, reportes, backlog para operaciones)' +
          '</div>' +
          '<p class="login-scope-hint muted" style="margin-top:0.85rem;font-size:0.82rem;line-height:1.45;">' +
            '<strong>Alcance:</strong> este portal muestra solo <strong>Villa Valencia</strong>. El <strong>admin de planta</strong> es la operaci\u00f3n diaria de <em>un</em> conjunto (aqu\u00ed, este). La <strong>supervisi\u00f3n</strong> puede abarcar varios edificios u HOAs en otros entornos; <strong>gerencia</strong> y supervisi\u00f3n pueden ser el mismo perfil.' +
          '</p>' +
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
