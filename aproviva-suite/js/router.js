/**
 * Tiny hash router. Routes register a render(container) function and an
 * optional requiredModule. Unknown / unauthorized routes redirect to login.
 */
(function () {
  var routes = {};

  function register(name, def) {
    routes[name] = def;
  }

  function navigate(name) {
    if (window.location.hash === '#/' + name) {
      render();
    } else {
      window.location.hash = '#/' + name;
    }
  }

  function currentRoute() {
    var hash = window.location.hash || '#/';
    if (hash === '#' || hash === '#/') {
      return window.AUTH.readSession() ? 'inicio' : 'login';
    }
    var name = hash.replace(/^#\//, '');
    if (!name) name = 'inicio';
    return name.split('?')[0];
  }

  function setShellAuthed(on) {
    var shell = document.getElementById('app-shell');
    if (shell) shell.classList.toggle('app-shell--authed', !!on);
  }

  function render() {
    var name = currentRoute();
    var session = window.AUTH.readSession();
    var container = document.getElementById('app-content');
    if (!container) return;

    if (name === 'login') {
      setShellAuthed(false);
      routes.login.render(container);
      updateNav(null);
      return;
    }

    if (!session) {
      setShellAuthed(false);
      window.location.hash = '#/login';
      return;
    }

    setShellAuthed(true);

    var route = routes[name];
    if (!route) {
      container.innerHTML = '<section class="page"><h2>P\u00e1gina no encontrada</h2><p>Ruta: ' + window.UI.esc(name) + '</p></section>';
      updateNav(session);
      return;
    }

    if (route.requiredModule && !window.AUTH.canAccess(route.requiredModule)) {
      container.innerHTML = '<section class="page"><h2>Acceso restringido</h2><p>Esta secci\u00f3n requiere acceso de Junta / Administraci\u00f3n.</p></section>';
      updateNav(session);
      return;
    }

    updateNav(session);
    try {
      route.render(container, session);
    } catch (e) {
      console.error('Route render error:', e);
      window.UI.errorBox(container, e);
    }
  }

  function updateNav(session) {
    var nav = document.getElementById('app-nav');
    var roleBadge = document.getElementById('app-role-badge');
    var logoutBtn = document.getElementById('app-logout');
    if (!nav) return;

    if (!session) {
      nav.style.display = 'none';
      if (roleBadge) roleBadge.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
      return;
    }
    nav.style.display = '';
    if (roleBadge) {
      roleBadge.style.display = '';
      roleBadge.textContent = session.label;
      roleBadge.className = 'role-badge role-' + session.role;
    }
    if (logoutBtn) logoutBtn.style.display = '';

    var current = currentRoute();
    var items = [
      { name: 'inicio', label: 'Inicio', module: null },
      { name: 'inventario', label: 'Inventario', module: 'inventario' },
      { name: 'gemba', label: 'Recorridos', module: 'gemba' },
      { name: 'mapa', label: 'Mapa', module: 'gemba' },
      { name: 'incidencias', label: 'Incidencias', module: 'incidencias' },
      { name: 'proyectos', label: 'Proyectos', module: 'proyectos' },
      { name: 'maestros', label: 'Datos maestros', module: 'maestros' },
      { name: 'reportes', label: 'Reportes', module: 'reportes' },
      { name: 'junta', label: 'Gobernanza', module: 'junta' },
    ].filter(function (i) {
      return !i.module || window.AUTH.canAccess(i.module);
    });

    nav.innerHTML = items.map(function (i) {
      var cls = 'nav-link' + (i.name === current ? ' active' : '');
      var cur = i.name === current ? ' aria-current="page"' : '';
      return '<a class="' + cls + '" href="#/' + i.name + '"' + cur + '>' + window.UI.esc(i.label) + '</a>';
    }).join('');
  }

  function start() {
    window.addEventListener('hashchange', render);
    var logoutBtn = document.getElementById('app-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.AUTH.logout();
    });
    render();
  }

  window.ROUTER = {
    register: register,
    navigate: navigate,
    render: render,
    start: start,
    currentRoute: currentRoute,
  };
})();
