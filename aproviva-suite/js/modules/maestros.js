/**
 * Datos Maestros - master data view + create.
 * Scenario 11.
 */
(function () {
  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="maestros-page">' +
        '<h2 class="page-title">Datos maestros</h2>' +
        '<p class="page-subtitle">Cat\u00e1logos centrales: art\u00edculos, ubicaciones, edificios, administradores.</p>' +
        '<div class="page-section"><h3 class="section-title">Art\u00edculos</h3>' +
          '<div class="row" style="gap:0.5rem;"><button class="btn btn-primary-sm" id="m-new-item">+ Nuevo art\u00edculo</button></div>' +
          '<div id="m-items" class="mt-2"><div class="loading">...</div></div>' +
        '</div>' +
        '<div class="page-section"><h3 class="section-title">Ubicaciones</h3>' +
          '<div class="row" style="gap:0.5rem;"><button class="btn btn-primary-sm" id="m-new-loc">+ Nueva ubicaci\u00f3n</button></div>' +
          '<div id="m-locs" class="mt-2"><div class="loading">...</div></div>' +
        '</div>' +
        '<div class="page-section"><h3 class="section-title">Edificios</h3>' +
          '<div id="m-buildings"><div class="loading">...</div></div>' +
        '</div>' +
        '<div class="page-section"><h3 class="section-title">Administradores</h3>' +
          '<div id="m-admins"><div class="loading">...</div></div>' +
        '</div>' +
      '</section>' +
      '<div id="m-modal-host"></div>';

    document.getElementById('m-new-item').addEventListener('click', openNewItem);
    document.getElementById('m-new-loc').addEventListener('click', openNewLoc);
    await loadAll();
  }

  async function loadAll() {
    try {
      var results = await Promise.all([
        window.SB.select('inventory_items', { select: '*', order: 'name.asc' }),
        window.SB.select('inventory_locations', { select: '*', order: 'name.asc' }),
        window.SB.select('buildings', { select: '*' }),
        window.SB.select('admin_users', { select: 'id,email,display_name,is_active,last_seen_at', order: 'email.asc' }),
      ]);
      renderItems(results[0]);
      renderLocs(results[1]);
      renderBuildings(results[2]);
      renderAdmins(results[3]);
    } catch (e) {
      window.UI.errorBox('m-items', e);
    }
  }

  function renderItems(rows) {
    document.getElementById('m-items').innerHTML = window.UI.table(rows || [], [
      { key: 'name', label: 'Nombre' },
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: 'Categor\u00eda' },
      { key: 'unit', label: 'Unidad' },
      { key: 'default_reorder_point', label: 'Reorden' },
      { key: 'is_active', label: 'Activo', render: function (r) { return window.UI.badge(r.is_active ? 'S\u00ed' : 'No', r.is_active ? 'success' : 'neutral'); }, html: true },
    ]);
  }

  function renderLocs(rows) {
    document.getElementById('m-locs').innerHTML = window.UI.table(rows || [], [
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'C\u00f3digo' },
      { key: 'area', label: '\u00c1rea' },
      { key: 'description', label: 'Descripci\u00f3n' },
      { key: 'is_active', label: 'Activo', render: function (r) { return window.UI.badge(r.is_active ? 'S\u00ed' : 'No', r.is_active ? 'success' : 'neutral'); }, html: true },
    ]);
  }

  function renderBuildings(rows) {
    document.getElementById('m-buildings').innerHTML = window.UI.table(rows || [], [
      { key: 'code', label: 'C\u00f3digo' },
      { key: 'name', label: 'Nombre' },
      { key: 'city', label: 'Ciudad' },
      { key: 'status', label: 'Estado', render: function (r) { return window.UI.badge(r.status, r.status === 'active' ? 'success' : 'neutral'); }, html: true },
    ]);
  }

  function renderAdmins(rows) {
    document.getElementById('m-admins').innerHTML = window.UI.table(rows || [], [
      { key: 'email', label: 'Email' },
      { key: 'display_name', label: 'Nombre' },
      { key: 'is_active', label: 'Activo', render: function (r) { return window.UI.badge(r.is_active ? 'S\u00ed' : 'No', r.is_active ? 'success' : 'neutral'); }, html: true },
      { key: 'last_seen_at', label: '\u00daltimo acceso', render: function (r) { return r.last_seen_at ? window.UI.fmtDate(r.last_seen_at) : ''; } },
    ]);
  }

  function openNewItem() {
    var host = document.getElementById('m-modal-host');
    host.innerHTML = '' +
      '<section class="page"><h3 class="section-title">Nuevo art\u00edculo</h3>' +
        '<form id="m-item-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>Nombre</label><input name="name" required></div>' +
          '<div class="form-field"><label>SKU</label><input name="sku" required></div>' +
          '<div class="form-field"><label>Categor\u00eda</label><input name="category" placeholder="consumibles, herramientas..."></div>' +
          '<div class="form-field"><label>Unidad</label><input name="unit" placeholder="bolsa, litro, unidad"></div>' +
          '<div class="form-field"><label>Punto de reorden</label><input type="number" name="default_reorder_point" min="0" step="1"></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n</label><textarea name="description" rows="2"></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm">Guardar</button>' +
            '<button class="btn btn-ghost" type="button" id="m-i-cancel">Cancelar</button>' +
          '</div></form></section>';
    document.getElementById('m-i-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('m-item-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(this);
      try {
        await window.SB.insert('inventory_items', {
          name: fd.get('name'), sku: fd.get('sku'),
          category: fd.get('category') || null,
          unit: fd.get('unit') || null,
          description: fd.get('description') || null,
          default_reorder_point: fd.get('default_reorder_point') ? Number(fd.get('default_reorder_point')) : null,
          is_active: true,
          metadata: { createdBy: session.label, source: 'aproviva-suite' },
        });
        window.UI.toast('Art\u00edculo creado.', 'success');
        host.innerHTML = '';
        await loadAll();
      } catch (err) { window.UI.toast('Error: ' + err.message, 'error'); }
    });
  }

  function openNewLoc() {
    var host = document.getElementById('m-modal-host');
    host.innerHTML = '' +
      '<section class="page"><h3 class="section-title">Nueva ubicaci\u00f3n</h3>' +
        '<form id="m-loc-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>Nombre</label><input name="name" required></div>' +
          '<div class="form-field"><label>C\u00f3digo</label><input name="code" required></div>' +
          '<div class="form-field"><label>\u00c1rea</label><input name="area" placeholder="Calles, \u00c1rea social..."></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n</label><textarea name="description" rows="2"></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm">Guardar</button>' +
            '<button class="btn btn-ghost" type="button" id="m-l-cancel">Cancelar</button>' +
          '</div></form></section>';
    document.getElementById('m-l-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('m-loc-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(this);
      try {
        await window.SB.insert('inventory_locations', {
          name: fd.get('name'), code: fd.get('code'),
          area: fd.get('area') || null,
          description: fd.get('description') || null,
          is_active: true,
          metadata: { createdBy: session.label, source: 'aproviva-suite' },
        });
        window.UI.toast('Ubicaci\u00f3n creada.', 'success');
        host.innerHTML = '';
        await loadAll();
      } catch (err) { window.UI.toast('Error: ' + err.message, 'error'); }
    });
  }

  window.ROUTER.register('maestros', { render: render, requiredModule: 'maestros' });
})();
