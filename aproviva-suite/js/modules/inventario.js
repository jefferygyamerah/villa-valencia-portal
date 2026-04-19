/**
 * Inventario - cycle count, alerts, master view.
 * Scenarios 1 (routine count), 2 (low/missing/damaged), 3 (admin review).
 */
(function () {
  var STATE = { items: [], locations: [], movements: [] };

  async function render(container, session) {
    container.innerHTML = '' +
      '<section class="page" data-testid="inventario-page">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h2 class="page-title">Inventario</h2>' +
            '<p class="page-subtitle">Conteo c\u00edclico, alertas y registro de novedades.</p>' +
          '</div>' +
          '<div class="row wrap" style="gap:0.5rem;">' +
            '<button class="btn btn-primary-sm" id="inv-count-btn" type="button">Registrar conteo</button>' +
            '<button class="btn btn-ghost" id="inv-issue-btn" type="button">Reportar novedad</button>' +
          '</div>' +
        '</div>' +
        '<div class="kpi-grid" id="inv-kpis"><div class="loading">Cargando KPIs...</div></div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Alertas activas</h3>' +
          '<div id="inv-alerts"><div class="loading">Cargando alertas...</div></div>' +
        '</div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Cat\u00e1logo y \u00faltimos saldos</h3>' +
          '<div id="inv-catalog"><div class="loading">Cargando cat\u00e1logo...</div></div>' +
        '</div>' +
        '<div class="page-section">' +
          '<h3 class="section-title">Movimientos recientes</h3>' +
          '<div id="inv-movements"><div class="loading">Cargando movimientos...</div></div>' +
        '</div>' +
      '</section>' +
      '<div id="inv-modal-host"></div>';

    document.getElementById('inv-count-btn').addEventListener('click', function () { openCountModal(session); });
    document.getElementById('inv-issue-btn').addEventListener('click', function () { openIssueModal(session); });

    await loadAll();
  }

  async function loadAll() {
    try {
      var results = await Promise.all([
        window.SB.select('inventory_items', { select: '*', is_active: 'eq.true', order: 'name.asc' }),
        window.SB.select('inventory_locations', { select: '*', is_active: 'eq.true', order: 'name.asc' }),
        window.SB.select('inventory_movements', { select: '*', order: 'movement_at.desc', limit: '50' }),
      ]);
      STATE.items = results[0] || [];
      STATE.locations = results[1] || [];
      STATE.movements = results[2] || [];
      renderKpis();
      renderAlerts();
      renderCatalog();
      renderMovements();
    } catch (e) {
      window.UI.errorBox('inv-kpis', e);
    }
  }

  function latestPerItem() {
    var latest = {};
    STATE.movements.forEach(function (m) {
      var k = m.inventory_item_id;
      if (!latest[k] || m.movement_at > latest[k].movement_at) latest[k] = m;
    });
    return latest;
  }

  function renderKpis() {
    var alerts = computeAlerts();
    document.getElementById('inv-kpis').innerHTML = '' +
      kpi('Art\u00edculos activos', STATE.items.length) +
      kpi('Ubicaciones', STATE.locations.length) +
      kpi('Alertas cr\u00edticas', alerts.filter(function (a) { return a.level === 'critical'; }).length) +
      kpi('Alertas reorden', alerts.filter(function (a) { return a.level === 'reorder'; }).length) +
      kpi('Conteos (\u00faltimos 50)', STATE.movements.filter(function (m) { return m.movement_type === 'counted'; }).length);
  }

  function computeAlerts() {
    var latest = latestPerItem();
    var alerts = [];
    STATE.items.forEach(function (it) {
      var last = latest[it.id];
      if (!last) {
        alerts.push({ item: it, level: 'no-count', label: 'Sin conteo' });
        return;
      }
      var qty = Number(last.balance_after);
      var reorder = Number(it.default_reorder_point) || 0;
      if (qty <= 0) alerts.push({ item: it, level: 'critical', label: 'Sin existencia', qty: qty, last: last });
      else if (qty <= reorder * 0.5) alerts.push({ item: it, level: 'critical', label: 'Cr\u00edtico', qty: qty, last: last });
      else if (qty <= reorder) alerts.push({ item: it, level: 'reorder', label: 'Reorden', qty: qty, last: last });
    });
    return alerts.sort(function (a, b) {
      var rank = { 'critical': 0, 'reorder': 1, 'no-count': 2 };
      return (rank[a.level] || 9) - (rank[b.level] || 9);
    });
  }

  function renderAlerts() {
    var alerts = computeAlerts();
    var box = document.getElementById('inv-alerts');
    if (!alerts.length) {
      box.innerHTML = '<p class="empty">Sin alertas activas.</p>';
      return;
    }
    box.innerHTML = alerts.map(function (a) {
      var cls = a.level === 'critical' ? 'critical' : '';
      var qtyTxt = (a.qty !== undefined) ? (a.qty + ' ' + (a.item.unit || '')) : 's/d';
      return '<div class="alert-row ' + cls + '">' +
        '<div><strong>' + window.UI.esc(a.item.name) + '</strong> &middot; <span class="muted">' + window.UI.esc(a.item.sku) + '</span></div>' +
        '<div class="row" style="gap:0.5rem;">' +
          window.UI.badge(a.label, a.level === 'critical' ? 'danger' : (a.level === 'reorder' ? 'warning' : 'neutral')) +
          '<span class="muted">' + window.UI.esc(qtyTxt) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderCatalog() {
    var latest = latestPerItem();
    var rows = STATE.items.map(function (it) {
      var l = latest[it.id];
      return {
        name: it.name,
        sku: it.sku,
        category: it.category || '',
        unit: it.unit || '',
        reorder: it.default_reorder_point,
        last_qty: l ? Number(l.balance_after) : null,
        last_at: l ? l.movement_at : null,
      };
    });
    document.getElementById('inv-catalog').innerHTML = window.UI.table(rows, [
      { key: 'name', label: 'Art\u00edculo' },
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: 'Categor\u00eda' },
      { key: 'unit', label: 'Unidad' },
      { key: 'reorder', label: 'Reorden' },
      { key: 'last_qty', label: '\u00daltimo saldo', render: function (r) { return r.last_qty === null ? '<span class="muted">s/d</span>' : window.UI.esc(r.last_qty); }, html: true },
      { key: 'last_at', label: 'Fecha', render: function (r) { return r.last_at ? window.UI.fmtDate(r.last_at) : ''; } },
    ]);
  }

  function renderMovements() {
    var byId = {};
    STATE.items.forEach(function (i) { byId[i.id] = i; });
    var byLoc = {};
    STATE.locations.forEach(function (l) { byLoc[l.id] = l; });
    var rows = STATE.movements.slice(0, 25).map(function (m) {
      return {
        when: m.movement_at,
        item: byId[m.inventory_item_id] ? byId[m.inventory_item_id].name : '?',
        location: byLoc[m.inventory_location_id] ? byLoc[m.inventory_location_id].name : '',
        type: m.movement_type,
        qty: m.quantity,
        balance: m.balance_after,
        notes: m.notes || '',
      };
    });
    document.getElementById('inv-movements').innerHTML = window.UI.table(rows, [
      { key: 'when', label: 'Fecha', render: function (r) { return window.UI.fmtDate(r.when); } },
      { key: 'item', label: 'Art\u00edculo' },
      { key: 'location', label: 'Ubicaci\u00f3n' },
      { key: 'type', label: 'Tipo', render: function (r) { return window.UI.badge(r.type, r.type === 'counted' ? 'info' : (r.type === 'replenished' ? 'success' : 'neutral')); }, html: true },
      { key: 'qty', label: 'Cant.' },
      { key: 'balance', label: 'Saldo' },
      { key: 'notes', label: 'Notas' },
    ]);
  }

  function mergedUbicacionLabels() {
    var seen = {};
    var out = [];
    var fixed = window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS.UBICACIONES_FIJAS;
    fixed.forEach(function (u) {
      if (!seen[u]) { seen[u] = 1; out.push(u); }
    });
    STATE.locations.forEach(function (l) {
      var n = l.name || '';
      if (n && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out;
  }

  function motivoIncidenteById(id) {
    var list = window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS.MOTIVOS_INCIDENTE;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function openCountModal(session) {
    var host = document.getElementById('inv-modal-host');
    host.innerHTML = renderCountForm(session);
    bindCountForm();
  }

  function openIssueModal(session) {
    var host = document.getElementById('inv-modal-host');
    host.innerHTML = renderIssueForm(session);
    bindIssueForm();
  }

  function renderCountForm(session) {
    var staff = session && session.role === 'staff';
    var notesBlock;
    if (staff) {
      var opts = window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS.CONTEO_NOTAS.map(function (o) {
        return '<option value="' + window.UI.esc(o.value) + '">' + window.UI.esc(o.label) + '</option>';
      }).join('');
      notesBlock =
        '<div class="form-field" style="grid-column:1/-1;"><label>Observaci\u00f3n r\u00e1pida</label>' +
          '<select name="notes">' + opts + '</select>' +
          '<div class="hint">Conserjer\u00eda: solo opciones predefinidas (sin texto libre).</div></div>';
    } else {
      notesBlock =
        '<div class="form-field" style="grid-column:1/-1;"><label>Observaciones</label>' +
          '<textarea name="notes" rows="2" placeholder="Opcional"></textarea></div>';
    }
    return '' +
      '<section class="page" data-testid="inv-count-form">' +
        '<h3 class="section-title">Registrar conteo</h3>' +
        '<form id="count-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>Art\u00edculo</label>' +
            '<select name="item" required>' +
              '<option value="">Seleccionar...</option>' +
              STATE.items.map(function (i) { return '<option value="' + i.id + '">' + window.UI.esc(i.name) + ' (' + window.UI.esc(i.sku) + ')</option>'; }).join('') +
            '</select></div>' +
          '<div class="form-field"><label>Ubicaci\u00f3n</label>' +
            '<select name="loc" required>' +
              '<option value="">Seleccionar...</option>' +
              STATE.locations.map(function (l) { return '<option value="' + l.id + '">' + window.UI.esc(l.name) + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="form-field"><label>Cantidad contada</label>' +
            '<input type="number" name="qty" min="0" step="0.01" required inputmode="decimal"></div>' +
          '<div class="form-field"><label>Saldo despu\u00e9s del conteo</label>' +
            '<input type="number" name="balance" min="0" step="0.01" required inputmode="decimal">' +
            '<div class="hint">Por defecto igual a la cantidad contada si no hay m\u00e1s ubicaciones.</div></div>' +
          notesBlock +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Guardar</button>' +
            '<button class="btn btn-ghost" type="button" id="count-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
  }

  function bindCountForm() {
    var form = document.getElementById('count-form');
    var qty = form.querySelector('[name=qty]');
    var bal = form.querySelector('[name=balance]');
    qty.addEventListener('input', function () { if (!bal.value) bal.value = qty.value; });
    document.getElementById('count-cancel').addEventListener('click', function () {
      document.getElementById('inv-modal-host').innerHTML = '';
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(form);
      var body = {
        inventory_item_id: fd.get('item'),
        inventory_location_id: fd.get('loc'),
        movement_type: 'counted',
        quantity: Number(fd.get('qty')),
        balance_after: Number(fd.get('balance') || fd.get('qty')),
        notes: fd.get('notes') || null,
        metadata: { actorRole: session.role, actorLabel: session.label, source: 'aproviva-suite' },
      };
      try {
        await window.SB.insert('inventory_movements', body);
        window.UI.toast('Conteo guardado.', 'success');
        document.getElementById('inv-modal-host').innerHTML = '';
        await loadAll();
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
        console.error(err);
      }
    });
  }

  function renderIssueForm(session) {
    var staff = session && session.role === 'staff';
    if (staff) {
      var motivoOpts = window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS.MOTIVOS_INCIDENTE.map(function (m) {
        return '<option value="' + window.UI.esc(m.id) + '">' + window.UI.esc(m.title) + '</option>';
      }).join('');
      var ubicOpts = mergedUbicacionLabels().map(function (u) {
        return '<option value="' + window.UI.esc(u) + '">' + window.UI.esc(u) + '</option>';
      }).join('');
      return '' +
        '<section class="page" data-testid="inv-issue-form">' +
          '<h3 class="section-title">Reportar novedad</h3>' +
          '<p class="muted">Conserjer\u00eda: elige motivo y ubicaci\u00f3n (sin texto libre).</p>' +
          '<form id="issue-form" class="form-grid cols-2" data-staff="1">' +
            '<div class="form-field"><label>Motivo</label>' +
              '<select name="motivo_id" required>' + motivoOpts + '</select></div>' +
            '<div class="form-field"><label>Ubicaci\u00f3n</label>' +
              '<select name="location" required>' + ubicOpts + '</select></div>' +
            '<div class="form-field"><label>Severidad</label>' +
              '<select name="severity" required>' +
                '<option value="low">Baja</option>' +
                '<option value="medium" selected>Media</option>' +
                '<option value="high">Alta</option>' +
                '<option value="critical">Cr\u00edtica</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Art\u00edculo (si aplica)</label>' +
              '<select name="item">' +
                '<option value="">N/A</option>' +
                STATE.items.map(function (i) { return '<option value="' + i.id + '">' + window.UI.esc(i.name) + '</option>'; }).join('') +
              '</select></div>' +
            '<div class="btn-row" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit">Reportar</button>' +
              '<button class="btn btn-ghost" type="button" id="issue-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    }
    return '' +
      '<section class="page" data-testid="inv-issue-form">' +
        '<h3 class="section-title">Reportar novedad de inventario</h3>' +
        '<p class="muted">Crea un incidente operativo (faltante, da\u00f1o, p\u00e9rdida) ligado al art\u00edculo.</p>' +
        '<form id="issue-form" class="form-grid cols-2">' +
          '<div class="form-field"><label>Categor\u00eda</label>' +
            '<select name="category" required>' +
              '<option value="Inventory">Inventario</option>' +
              '<option value="Maintenance">Mantenimiento</option>' +
              '<option value="Security">Seguridad</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Severidad</label>' +
            '<select name="severity" required>' +
              '<option value="low">Baja</option>' +
              '<option value="medium" selected>Media</option>' +
              '<option value="high">Alta</option>' +
              '<option value="critical">Cr\u00edtica</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Art\u00edculo (opcional)</label>' +
            '<select name="item">' +
              '<option value="">N/A</option>' +
              STATE.items.map(function (i) { return '<option value="' + i.id + '">' + window.UI.esc(i.name) + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="form-field"><label>Ubicaci\u00f3n / lugar</label>' +
            '<input type="text" name="location" placeholder="Ej: Garita, Cuarto de bombas" required></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>T\u00edtulo</label>' +
            '<input type="text" name="title" required placeholder="Ej: Faltan 5 bolsas en estaci\u00f3n piscina"></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Descripci\u00f3n</label>' +
            '<textarea name="description" rows="3" required></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Reportar</button>' +
            '<button class="btn btn-ghost" type="button" id="issue-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
  }

  function bindIssueForm() {
    document.getElementById('issue-cancel').addEventListener('click', function () {
      document.getElementById('inv-modal-host').innerHTML = '';
    });
    document.getElementById('issue-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var session = window.AUTH.readSession();
      var fd = new FormData(this);
      var ticketNum = 'INC-' + Math.floor(Math.random() * 900000 + 100000);
      var body;
      if (this.getAttribute('data-staff') === '1') {
        var mid = fd.get('motivo_id');
        var mot = motivoIncidenteById(mid);
        if (!mot) {
          window.UI.toast('Motivo no v\u00e1lido.', 'error');
          return;
        }
        var ubicLabel = fd.get('location');
        body = {
          building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
          ticket_number: ticketNum,
          source: 'internal',
          category: mot.category,
          location_label: ubicLabel,
          severity: fd.get('severity'),
          status: 'received',
          title: mot.title,
          description: mot.description + ' Ubicaci\u00f3n: ' + ubicLabel + '.',
          resident_visible_status: 'Received',
          metadata: {
            actorRole: session.role,
            actorLabel: session.label,
            source: 'aproviva-suite',
            staff_motivo_id: mid,
            inventory_item_id: fd.get('item') || null,
          },
        };
      } else {
        body = {
          building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
          ticket_number: ticketNum,
          source: 'internal',
          category: fd.get('category'),
          location_label: fd.get('location'),
          severity: fd.get('severity'),
          status: 'received',
          title: fd.get('title'),
          description: fd.get('description'),
          resident_visible_status: 'Received',
          metadata: {
            actorRole: session.role,
            actorLabel: session.label,
            source: 'aproviva-suite',
            inventory_item_id: fd.get('item') || null,
          },
        };
      }
      try {
        await window.SB.insert('incident_tickets', body);
        window.UI.toast('Novedad reportada como ' + ticketNum + '.', 'success');
        document.getElementById('inv-modal-host').innerHTML = '';
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
        console.error(err);
      }
    });
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.ROUTER.register('inventario', { render: render, requiredModule: 'inventario' });
})();
