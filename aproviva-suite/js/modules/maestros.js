/**
 * Datos Maestros - master data view + create.
 * Scenario 11.
 */
(function () {
  var STATE = {
    items: [],
    locations: [],
    buildings: [],
    admins: [],
  };

  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="maestros-page">' +
        '<h2 class="page-title">Datos maestros</h2>' +
        '<p class="page-subtitle">Cat\u00e1logos operativos para inventario, recorridos y administraci\u00f3n de Villa Valencia. Mant\u00e9n datos cortos, consistentes y sin informaci\u00f3n sensible innecesaria.</p>' +
        '<div id="m-summary" class="m-summary kpi-grid">' +
          '<div class="kpi-card"><div class="kpi-label">Art\u00edculos</div><div class="kpi-value">...</div><div class="kpi-sub">Cat\u00e1logo de inventario</div></div>' +
          '<div class="kpi-card"><div class="kpi-label">Ubicaciones</div><div class="kpi-value">...</div><div class="kpi-sub">Puntos de operaci\u00f3n</div></div>' +
          '<div class="kpi-card"><div class="kpi-label">Admin</div><div class="kpi-value">...</div><div class="kpi-sub">Acceso visible limitado</div></div>' +
        '</div>' +
        '<div class="page-section m-next">' +
          '<div><h3 class="section-title">Siguiente acci\u00f3n</h3><p class="muted">Crea solo lo necesario para registrar conteos, recorridos o hallazgos sin texto libre repetido.</p></div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-primary-sm" id="m-new-item">+ Art\u00edculo</button>' +
            '<button class="btn btn-ghost" id="m-new-loc">+ Ubicaci\u00f3n</button>' +
          '</div>' +
        '</div>' +
        '<div class="m-catalog-grid">' +
          '<div class="page-section m-panel"><div class="row between wrap"><div><h3 class="section-title">Art\u00edculos</h3><p class="muted">Nombre, SKU y reorden para compras del conjunto.</p></div></div>' +
            '<div id="m-items" class="mt-1"><div class="loading">Cargando art\u00edculos...</div></div>' +
          '</div>' +
          '<div class="page-section m-panel"><div class="row between wrap"><div><h3 class="section-title">Ubicaciones</h3><p class="muted">Lugares estables para conteos, recorridos y hallazgos.</p></div></div>' +
            '<div id="m-locs" class="mt-1"><div class="loading">Cargando ubicaciones...</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="page-section m-panel"><h3 class="section-title">Edificios</h3>' +
          '<div id="m-buildings"><div class="loading">...</div></div>' +
        '</div>' +
        '<div class="page-section m-panel"><div class="row between wrap"><div><h3 class="section-title">Administradores</h3><p class="muted">Vista resumida: el correo se oculta parcialmente por privacidad.</p></div>' + window.UI.badge('Datos internos', 'info') + '</div>' +
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
      STATE.items = results[0] || [];
      STATE.locations = results[1] || [];
      STATE.buildings = results[2] || [];
      STATE.admins = results[3] || [];
      renderSummary();
      renderItems(STATE.items);
      renderLocs(STATE.locations);
      renderBuildings(STATE.buildings);
      renderAdmins(STATE.admins);
    } catch (e) {
      window.UI.errorBox('m-items', e);
    }
  }

  function activeCount(rows) {
    return (rows || []).filter(function (r) { return r.is_active !== false; }).length;
  }

  function renderSummary() {
    var el = document.getElementById('m-summary');
    if (!el) return;
    el.innerHTML = '' +
      summaryCard('Art\u00edculos', STATE.items.length, activeCount(STATE.items) + ' activos') +
      summaryCard('Ubicaciones', STATE.locations.length, activeCount(STATE.locations) + ' activas') +
      summaryCard('Administradores', STATE.admins.length, activeCount(STATE.admins) + ' activos');
  }

  function summaryCard(label, value, sub) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div><div class="kpi-value">' + window.UI.esc(value) + '</div><div class="kpi-sub">' + window.UI.esc(sub) + '</div></div>';
  }

  function statusBadge(row) {
    return window.UI.badge(row.is_active === false ? 'Inactivo' : 'Activo', row.is_active === false ? 'neutral' : 'success');
  }

  function emptyCatalog(label) {
    return '<p class="empty">Sin ' + window.UI.esc(label) + '. Usa la acci\u00f3n superior para crear el primer registro.</p>';
  }

  function renderItems(rows) {
    if (!rows || !rows.length) {
      document.getElementById('m-items').innerHTML = emptyCatalog('art\u00edculos');
      return;
    }
    document.getElementById('m-items').innerHTML = '<div class="m-card-list">' + rows.map(function (r) {
      var meta = [];
      if (r.category) meta.push(r.category);
      if (r.unit) meta.push('Unidad: ' + r.unit);
      return '' +
        '<article class="m-card">' +
          '<div class="row between wrap">' +
            '<div><strong>' + window.UI.esc(r.name) + '</strong><div class="muted">' + window.UI.esc(r.sku || 'Sin SKU') + '</div></div>' +
            statusBadge(r) +
          '</div>' +
          '<div class="m-card-meta">' +
            (meta.length ? window.UI.esc(meta.join(' · ')) : '<span class="muted">Sin categor\u00eda</span>') +
          '</div>' +
          '<div class="m-card-footer"><span>Reorden</span><strong>' + window.UI.esc(r.default_reorder_point === null || r.default_reorder_point === undefined ? 's/d' : r.default_reorder_point) + '</strong></div>' +
        '</article>';
    }).join('') + '</div>';
  }

  function renderLocs(rows) {
    if (!rows || !rows.length) {
      document.getElementById('m-locs').innerHTML = emptyCatalog('ubicaciones');
      return;
    }
    document.getElementById('m-locs').innerHTML = '<div class="m-card-list">' + rows.map(function (r) {
      return '' +
        '<article class="m-card">' +
          '<div class="row between wrap">' +
            '<div><strong>' + window.UI.esc(r.name) + '</strong><div class="muted">' + window.UI.esc(r.code || 'Sin c\u00f3digo') + '</div></div>' +
            statusBadge(r) +
          '</div>' +
          '<div class="m-card-meta">' + window.UI.esc(r.area || 'Sin \u00e1rea definida') + '</div>' +
          (r.description ? '<p class="m-card-note">' + window.UI.esc(r.description) + '</p>' : '') +
        '</article>';
    }).join('') + '</div>';
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
    document.getElementById('m-admins').innerHTML = window.UI.table((rows || []).map(function (r) {
      return {
        email: maskEmail(r.email),
        display_name: r.display_name || 'Sin nombre',
        is_active: r.is_active,
        last_seen_at: r.last_seen_at,
      };
    }), [
      { key: 'display_name', label: 'Nombre' },
      { key: 'email', label: 'Correo' },
      { key: 'is_active', label: 'Estado', render: function (r) { return statusBadge(r); }, html: true },
      { key: 'last_seen_at', label: '\u00daltimo acceso', render: function (r) { return r.last_seen_at ? window.UI.fmtDate(r.last_seen_at) : 's/d'; } },
    ]);
  }

  function maskEmail(email) {
    if (!email || email.indexOf('@') < 1) return 'Oculto';
    var parts = email.split('@');
    var name = parts[0];
    return name.slice(0, 2) + '***@' + parts.slice(1).join('@');
  }

  function openNewItem() {
    var host = document.getElementById('m-modal-host');
    host.innerHTML = '' +
      '<section class="page m-form-sheet"><h3 class="section-title">Nuevo art\u00edculo</h3><p class="muted">Usa nombres cortos y un SKU estable para evitar duplicados en inventario.</p>' +
        '<form id="m-item-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>Nombre</label><input name="name" required></div>' +
          '<div class="form-field"><label>SKU</label><input name="sku" required autocapitalize="characters"></div>' +
          '<div class="form-field"><label>Categor\u00eda</label><input name="category" placeholder="consumibles, herramientas..."></div>' +
          '<div class="form-field"><label>Unidad</label><input name="unit" placeholder="bolsa, litro, unidad"></div>' +
          '<div class="form-field"><label>Punto de reorden</label><input type="number" name="default_reorder_point" min="0" step="1"></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n operativa</label><textarea name="description" rows="2" maxlength="180" placeholder="Opcional. Sin datos personales ni proveedores."></textarea><span class="hint">Opcional; m\u00e1ximo 180 caracteres.</span></div>' +
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
      '<section class="page m-form-sheet"><h3 class="section-title">Nueva ubicaci\u00f3n</h3><p class="muted">Registra puntos fijos y reconocibles para recorridos, conteos y reportes.</p>' +
        '<form id="m-loc-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>Nombre</label><input name="name" required></div>' +
          '<div class="form-field"><label>C\u00f3digo</label><input name="code" required autocapitalize="characters"></div>' +
          '<div class="form-field"><label>\u00c1rea</label><input name="area" placeholder="Calles, \u00c1rea social..."></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n operativa</label><textarea name="description" rows="2" maxlength="180" placeholder="Opcional. Ej.: referencia f\u00edsica, no personas."></textarea><span class="hint">Evita nombres de residentes, tel\u00e9fonos o datos privados.</span></div>' +
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
