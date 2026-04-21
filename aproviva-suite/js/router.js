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

  function formatHeaderDate() {
    try {
      return 'Hoy: ' + new Date().toLocaleDateString('es-PA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
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
      container.innerHTML = '<section class="page"><h2>Acceso restringido</h2><p>Esta secci\u00f3n no est\u00e1 habilitada para tu PIN / rol.</p></section>';
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
    var headerDate = document.getElementById('app-header-date');
    if (!nav) return;

    if (!session) {
      nav.style.display = 'none';
      if (roleBadge) roleBadge.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (headerDate) headerDate.textContent = '';
      return;
    }
    nav.style.display = '';
    if (roleBadge) {
      roleBadge.style.display = '';
      roleBadge.textContent = session.label;
      roleBadge.className = 'role-badge role-' + session.role;
    }
    if (logoutBtn) logoutBtn.style.display = '';
    if (headerDate) headerDate.textContent = formatHeaderDate();

    var current = currentRoute();
    var items = [
      { name: 'inicio', label: 'Inicio', icon: '\ud83c\udfe0', module: null },
      { name: 'inventario', label: 'Inventario', icon: '\ud83d\udce6', module: 'inventario' },
      { name: 'gemba', label: 'Recorridos', icon: '\ud83d\udd0d', module: 'gemba' },
      { name: 'mapa', label: 'Mapa', icon: '\ud83d\uddfa\ufe0f', module: 'gemba' },
      { name: 'incidencias', label: 'Incidencias', icon: '\ud83d\udea8', module: 'incidencias' },
      { name: 'proyectos', label: 'Proyectos', icon: '\ud83c\udfd7\ufe0f', module: 'proyectos' },
      { name: 'maestros', label: 'Maestros', icon: '\ud83d\uddc2\ufe0f', module: 'maestros' },
      { name: 'reportes', label: 'Reportes', icon: '\ud83d\udcca', module: 'reportes' },
      { name: 'junta', label: 'Junta', icon: '\ud83e\udded', module: 'junta' },
    ].filter(function (i) {
      return !i.module || window.AUTH.canAccess(i.module);
    });

    nav.innerHTML = items.map(function (i) {
      var cls = 'nav-link' + (i.name === current ? ' active' : '');
      var cur = i.name === current ? ' aria-current="page"' : '';
      return '<a class="' + cls + '" href="#/' + i.name + '" title="' + window.UI.esc(i.label) + '"' + cur + '>' +
        '<span class="nav-ico" aria-hidden="true">' + (i.icon || '') + '</span>' +
        '<span class="nav-label">' + window.UI.esc(i.label) + '</span>' +
      '</a>';
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
