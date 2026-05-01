/**
 * Incidencias - incident triage, assignment, escalation, and closure history.
 */
(function () {
  var STATE = { tickets: [], filter: 'open', session: null };

  async function render(container, session) {
    STATE.session = session;
    container.innerHTML = '' +
      '<section class="page" data-testid="incidencias-page">' +
        '<div class="module-premium-hero" data-testid="inc-premium-hero">' +
          '<div class="module-hero-copy"><div class="vv-eyebrow">Operación · Incidencias</div>' +
            '<h2 class="page-title">Incidencias</h2>' +
            '<p class="page-subtitle">Reporte rápido, triage y siguiente acción operativa con bitácora visible.</p>' +
          '</div>' +
          '<div class="module-hero-actions">' +
            '<select id="inc-filter" class="btn btn-ghost">' +
              '<option value="open">Abiertas</option>' +
              '<option value="all">Todas</option>' +
              '<option value="closed">Cerradas</option>' +
            '</select>' +
            '<button class="btn btn-primary-sm" id="inc-new" type="button">+ Nueva incidencia</button>' +
          '</div>' +
        '</div>' +
        '<div class="vv-privacy-card module-privacy-card" data-testid="inc-privacy-note"><div class="vv-eyebrow">Evidencia segura</div><p>Describe hechos operativos, ubicación y responsable. Evita teléfonos, datos personales o conversaciones privadas.</p></div>' +
        '<div class="inc-next-step" id="inc-next-step"></div>' +
        '<div class="kpi-grid" id="inc-kpis"><div class="loading">...</div></div>' +
        '<div class="page-section">' +
          '<div id="inc-list"></div>' +
        '</div>' +
      '</section>' +
      '<div id="inc-modal-host"></div>';

    document.getElementById('inc-filter').addEventListener('change', function (e) {
      STATE.filter = e.target.value;
      renderList();
    });
    document.getElementById('inc-new').addEventListener('click', openNewModal);

    await load();
  }

  async function load() {
    try {
      var bid = window.APROVIVA_SUITE_CONFIG.BUILDING_ID;
      var rows = await window.SB.select('incident_tickets', { select: '*', building_id: 'eq.' + bid, order: 'created_at.desc', limit: '100' });
      STATE.tickets = (rows || []).filter(function (ticket) {
        return visibleForSession(ticket, STATE.session);
      });
      renderKpis();
      renderNextStep();
      renderList();
    } catch (e) {
      window.UI.errorBox('inc-list', e);
    }
  }

  function visibleForSession(ticket, session) {
    if (!session || session.role !== 'conserje') return true;
    return raisedBySession(ticket, session) || assignedToSession(ticket, session);
  }

  function raisedBySession(ticket, session) {
    var meta = parseMeta(ticket.metadata);
    return roleMatches(meta.actorRole || meta.reporterRole || meta.createdByRole, session.role) ||
      labelMatches(meta.actorLabel || meta.reporterLabel || meta.createdByLabel, session.label);
  }

  function assignedToSession(ticket, session) {
    var meta = parseMeta(ticket.metadata);
    return roleMatches(meta.assigneeRole || meta.assignedRole || meta.assigned_to_role, session.role) ||
      labelMatches(meta.assigneeLabel || meta.assignedLabel || meta.assignedTo || meta.assigned_to_label, session.label) ||
      labelMatches(ticket.assignee_name || ticket.assigned_to_label, session.label) ||
      roleMatches(ticket.assignee_role || ticket.assigned_to_role, session.role);
  }

  function roleMatches(value, role) {
    return normalize(value) === normalize(role);
  }

  function labelMatches(value, label) {
    if (!value || !label) return false;
    return normalize(value) === normalize(label);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function parseMeta(meta) {
    if (!meta) return {};
    if (typeof meta === 'string') {
      try { return JSON.parse(meta) || {}; } catch (e) { return {}; }
    }
    if (typeof meta === 'object') return Object.assign({}, meta);
    return {};
  }

  function historyFor(ticket) {
    var meta = parseMeta(ticket.metadata);
    var raw = [];
    if (Array.isArray(meta.incident_history)) raw = meta.incident_history.slice();
    else if (Array.isArray(meta.history)) raw = meta.history.slice();
    if (!raw.length && ticket.created_at) {
      raw.push({
        action: 'created',
        label: 'Incidencia creada',
        at: ticket.created_at,
        actor_label: meta.actorLabel || ticket.source || 'Sistema',
      });
    }
    if (ticket.resolved_at && !raw.some(function (h) { return h.action === 'resolved' || h.action === 'close_assigned'; })) {
      raw.push({ action: 'resolved', label: 'Incidencia resuelta', at: ticket.resolved_at });
    }
    return raw.sort(function (a, b) {
      return new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime();
    });
  }

  function appendHistory(ticket, action, label, note, evidenceUrl, target) {
    var meta = parseMeta(ticket.metadata);
    var history = historyFor(ticket);
    var session = window.AUTH.readSession() || {};
    history.push({
      action: action,
      label: label,
      note: note || '',
      evidence_url: evidenceUrl || '',
      actor_role: session.role || '',
      actor_label: session.label || '',
      target_role: target && target.role ? target.role : '',
      target_label: target && target.label ? target.label : '',
      at: new Date().toISOString(),
    });
    meta.incident_history = history;
    return meta;
  }

  function renderKpis() {
    var open = STATE.tickets.filter(function (t) { return !isClosed(t); });
    var critical = open.filter(function (t) { return t.severity === 'critical' || t.severity === 'high'; });
    var triage = open.filter(function (t) { return t.status === 'received' || !t.status; });
    var resolved24h = STATE.tickets.filter(function (t) {
      if (!t.resolved_at) return false;
      return new Date(t.resolved_at).getTime() > Date.now() - 24 * 3600 * 1000;
    });
    document.getElementById('inc-kpis').innerHTML = '' +
      kpi('Total', STATE.tickets.length) +
      kpi('Por tomar', triage.length) +
      kpi('Criticas/Altas', critical.length) +
      kpi('Resueltas (24h)', resolved24h.length);
  }

  function renderNextStep() {
    var open = STATE.tickets.filter(function (t) { return !isClosed(t); });
    var urgent = open.filter(function (t) { return t.severity === 'critical' || t.severity === 'high'; });
    var waiting = open.filter(function (t) { return t.status === 'received' || !t.status; });
    var msg = 'Registrar evidencia o cerrar lo que ya fue atendido.';
    if (STATE.session && STATE.session.role === 'conserje') msg = 'Atender solo incidencias reportadas por conserjeria o asignadas a conserjeria.';
    if (urgent.length) msg = 'Atender primero ' + urgent.length + ' incidencia(s) critica/alta.';
    else if (waiting.length) msg = 'Tomar ' + waiting.length + ' incidencia(s) recibida(s).';
    else if (!open.length) msg = 'Sin incidencias abiertas. Mantener monitoreo.';
    document.getElementById('inc-next-step').innerHTML = '' +
      '<div class="inc-next-label">Siguiente paso</div>' +
      '<div class="inc-next-copy">' + window.UI.esc(msg) + '</div>';
  }

  function renderList() {
    var rows = STATE.tickets;
    if (STATE.filter === 'open') rows = rows.filter(function (t) { return !isClosed(t); });
    if (STATE.filter === 'closed') rows = rows.filter(function (t) { return isClosed(t); });

    if (!rows.length) {
      document.getElementById('inc-list').innerHTML = '<p class="empty">Sin incidencias en este filtro.</p>';
      return;
    }
    document.getElementById('inc-list').innerHTML = '<div class="inc-card-list">' + rows.map(ticketCard).join('') + '</div>';
    document.getElementById('inc-list').onclick = onAction;
  }

  function ticketCard(r) {
    var closed = isClosed(r);
    var actions = '<button class="btn btn-ghost" data-act="detail" data-id="' + window.UI.esc(r.id) + '">Ver detalle</button>';
    if (!closed && canManageLifecycle()) {
      actions += '<button class="btn btn-primary-sm" data-act="' + window.UI.esc(nextAction(r.status)) + '" data-id="' + window.UI.esc(r.id) + '">' + window.UI.esc(nextActionLabel(r.status)) + '</button>' +
        '<button class="btn btn-ghost" data-act="reassign" data-id="' + window.UI.esc(r.id) + '">Reasignar</button>' +
        '<button class="btn btn-ghost" data-act="send_back" data-id="' + window.UI.esc(r.id) + '">Devolver</button>' +
        '<button class="btn btn-ghost" data-act="escalate" data-id="' + window.UI.esc(r.id) + '">Escalar</button>';
    } else if (!closed && canCloseForSession(r)) {
      actions += '<button class="btn btn-primary-sm" data-act="close_assigned" data-id="' + window.UI.esc(r.id) + '">Cerrar con nota</button>';
    } else if (closed) {
      actions += '<span class="muted">Cerrada</span>';
    } else {
      actions += '<span class="muted">En seguimiento</span>';
    }
    return '' +
      '<article class="inc-ticket-card" data-testid="inc-ticket-' + window.UI.esc(r.ticket_number || r.id || 'row') + '">' +
        '<div class="inc-ticket-top">' +
          '<span class="inc-ticket-num">' + window.UI.esc(r.ticket_number || 'INC') + '</span>' +
          '<span class="inc-ticket-date">' + window.UI.esc(window.UI.fmtDate(r.created_at)) + '</span>' +
        '</div>' +
        '<div class="inc-ticket-title">' + window.UI.esc(r.title || 'Incidencia sin titulo') + '</div>' +
        '<div class="inc-ticket-meta">' +
          window.UI.badge(statusLabel(r.status), statusKind(r.status)) +
          window.UI.badge(sevLabel(r.severity), sevKind(r.severity)) +
          assignmentBadge(r) +
        '</div>' +
        '<div class="inc-ticket-detail">' +
          '<span>' + window.UI.esc(r.category || 'Operacion') + '</span>' +
          '<span>' + window.UI.esc(r.location_label || 'Ubicacion pendiente') + '</span>' +
        '</div>' +
        '<div class="inc-ticket-actions">' + actions + '</div>' +
      '</article>';
  }

  function assignmentBadge(ticket) {
    var meta = parseMeta(ticket.metadata);
    var label = meta.assigneeLabel || meta.assignedLabel || ticket.assignee_name || '';
    if (!label && meta.assigneeRole) label = roleLabel(meta.assigneeRole);
    return label ? window.UI.badge('Asignada: ' + label, 'info') : '';
  }

  function canManageLifecycle() {
    var session = STATE.session || window.AUTH.readSession();
    return !!(session && (session.role === 'supervisor' || session.role === 'gerencia'));
  }

  function canCloseForSession(ticket) {
    var session = STATE.session || window.AUTH.readSession();
    return !!(session && session.role === 'conserje' && (raisedBySession(ticket, session) || assignedToSession(ticket, session)));
  }

  function isClosed(ticket) {
    return ticket.status === 'resolved' || ticket.status === 'closed';
  }

  function sevKind(s) {
    if (s === 'critical' || s === 'high') return 'danger';
    if (s === 'medium') return 'warning';
    return 'neutral';
  }

  function statusKind(s) {
    if (s === 'resolved' || s === 'closed') return 'success';
    if (s === 'in_progress') return 'info';
    if (s === 'received' || !s) return 'warning';
    if (s === 'blocked') return 'danger';
    return 'neutral';
  }

  function sevLabel(s) {
    if (s === 'critical') return 'Critica';
    if (s === 'high') return 'Alta';
    if (s === 'medium') return 'Media';
    if (s === 'low') return 'Baja';
    return 'Sin severidad';
  }

  function statusLabel(s) {
    if (s === 'resolved') return 'Resuelta';
    if (s === 'closed') return 'Cerrada';
    if (s === 'in_progress') return 'En proceso';
    if (s === 'blocked') return 'Bloqueada';
    if (s === 'received' || !s) return 'Recibida';
    return s;
  }

  function nextActionLabel(s) {
    if (s === 'received' || !s) return 'Tomar';
    if (s === 'in_progress') return 'Resolver';
    return 'Avanzar';
  }

  function nextAction(s) {
    if (s === 'received' || !s) return 'take';
    if (s === 'in_progress') return 'resolve';
    return 'take';
  }

  async function onAction(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    var ticket = STATE.tickets.find(function (t) { return String(t.id) === String(id); });
    if (!ticket) return;
    if (act === 'detail') {
      openDetailModal(ticket);
      return;
    }
    openLifecycleModal(ticket, act);
  }

  function openDetailModal(ticket) {
    var host = document.getElementById('inc-modal-host');
    var history = historyFor(ticket);
    host.innerHTML = '' +
      '<section class="page inc-detail-sheet" data-testid="inc-detail-sheet">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h3 class="section-title">Detalle de incidencia</h3>' +
            '<p class="muted">' + window.UI.esc(ticket.ticket_number || 'INC') + ' · ' + window.UI.esc(statusLabel(ticket.status)) + '</p>' +
          '</div>' +
          '<button class="btn btn-ghost" id="inc-detail-close" type="button">Cerrar</button>' +
        '</div>' +
        '<div class="inc-detail-grid">' +
          detailItem('Titulo', ticket.title || 'Sin titulo') +
          detailItem('Ubicacion', ticket.location_label || 'Pendiente') +
          detailItem('Categoria', ticket.category || 'Operacion') +
          detailItem('Severidad', sevLabel(ticket.severity)) +
        '</div>' +
        '<div class="inc-detail-description">' + window.UI.esc(ticket.description || 'Sin descripcion registrada.') + '</div>' +
        '<h4 class="section-title">Bitacora</h4>' +
        '<div class="inc-history-list">' + renderHistory(history) + '</div>' +
        detailActions(ticket) +
      '</section>';
    document.getElementById('inc-detail-close').addEventListener('click', function () { host.innerHTML = ''; });
    host.onclick = function (e) {
      var actionBtn = e.target.closest('button[data-detail-act]');
      if (!actionBtn) return;
      openLifecycleModal(ticket, actionBtn.getAttribute('data-detail-act'));
    };
  }

  function detailItem(label, value) {
    return '<div class="inc-detail-item"><span>' + window.UI.esc(label) + '</span><strong>' + window.UI.esc(value) + '</strong></div>';
  }

  function detailActions(ticket) {
    if (isClosed(ticket)) return '';
    var html = '<div class="inc-detail-actions">';
    if (canManageLifecycle()) {
      html += '<button class="btn btn-primary-sm" data-detail-act="' + window.UI.esc(nextAction(ticket.status)) + '" type="button">' + window.UI.esc(nextActionLabel(ticket.status)) + '</button>' +
        '<button class="btn btn-ghost" data-detail-act="reassign" type="button">Reasignar</button>' +
        '<button class="btn btn-ghost" data-detail-act="send_back" type="button">Devolver</button>' +
        '<button class="btn btn-ghost" data-detail-act="escalate" type="button">Escalar</button>';
    } else if (canCloseForSession(ticket)) {
      html += '<button class="btn btn-primary-sm" data-detail-act="close_assigned" type="button">Cerrar con nota</button>';
    }
    return html + '</div>';
  }

  function renderHistory(history) {
    if (!history.length) return '<p class="empty">Sin bitacora todavia.</p>';
    return history.map(function (h) {
      var actor = h.actor_label || h.actorLabel || h.actor_role || '';
      var target = h.target_label || h.targetLabel || h.target_role || '';
      var evidence = h.evidence_url ? '<a href="' + window.UI.esc(h.evidence_url) + '" target="_blank" rel="noopener">Evidencia</a>' : '';
      return '<div class="inc-history-item">' +
        '<div><strong>' + window.UI.esc(h.label || h.action || 'Movimiento') + '</strong>' +
          '<span>' + window.UI.esc(window.UI.fmtDate(h.at)) + (actor ? ' · ' + window.UI.esc(actor) : '') + (target ? ' → ' + window.UI.esc(target) : '') + '</span></div>' +
        (h.note ? '<p>' + window.UI.esc(h.note) + '</p>' : '') +
        evidence +
      '</div>';
    }).join('');
  }

  function openLifecycleModal(ticket, action) {
    var host = document.getElementById('inc-modal-host');
    var cfg = actionConfig(ticket, action);
    var targetField = '';
    if (cfg.targetMode === 'select') {
      targetField = '<div class="form-field"><label>Enviar a</label><select name="target_role">' + roleOptionsHtml(cfg.defaultTarget) + '</select></div>';
    }
    host.innerHTML = '' +
      '<section class="page inc-action-sheet" data-testid="inc-action-sheet">' +
        '<div class="row between wrap">' +
          '<div>' +
            '<h3 class="section-title">' + window.UI.esc(cfg.title) + '</h3>' +
            '<p class="muted">' + window.UI.esc(ticket.ticket_number || 'INC') + ' · ' + window.UI.esc(ticket.title || '') + '</p>' +
          '</div>' +
          '<button class="btn btn-ghost" id="inc-action-close" type="button">Cancelar</button>' +
        '</div>' +
        '<form id="inc-action-form" class="form-grid cols-2" novalidate>' +
          targetField +
          '<div class="form-field" style="grid-column:1/-1;"><label>Comentario' + (cfg.requiresNote ? ' requerido' : '') + '</label>' +
            '<textarea name="note" rows="3" placeholder="' + window.UI.esc(cfg.placeholder) + '"></textarea></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Evidencia opcional</label>' +
            '<input type="url" name="evidence_url" placeholder="https://..."></div>' +
          '<div class="inc-privacy-note" style="grid-column:1/-1;">Registra solo contexto operativo. No incluyas datos personales, telefonos ni cuentas.</div>' +
          '<div class="btn-row inc-form-actions" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">' + window.UI.esc(cfg.submitLabel) + '</button>' +
            '<button class="btn btn-ghost" type="button" id="inc-action-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('inc-action-close').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('inc-action-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('inc-action-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var note = String(fd.get('note') || '').trim();
      var evidence = String(fd.get('evidence_url') || '').trim();
      if (cfg.requiresNote && !note) {
        window.UI.toast('Agrega un comentario para dejar trazabilidad.', 'warning');
        return;
      }
      await applyLifecycleAction(ticket, action, note, evidence, String(fd.get('target_role') || cfg.defaultTarget || ''));
    });
  }

  function actionConfig(ticket, action) {
    if (action === 'resolve') return {
      title: 'Resolver incidencia',
      submitLabel: 'Resolver',
      requiresNote: true,
      placeholder: 'Que se hizo, quien verifico y que queda pendiente.',
    };
    if (action === 'close_assigned') return {
      title: 'Cerrar incidencia asignada',
      submitLabel: 'Cerrar con nota',
      requiresNote: true,
      placeholder: 'Describe la atencion realizada en sitio.',
    };
    if (action === 'reassign') return {
      title: 'Reasignar incidencia',
      submitLabel: 'Reasignar',
      requiresNote: true,
      placeholder: 'Explica por que cambia el responsable.',
      targetMode: 'select',
      defaultTarget: parseMeta(ticket.metadata).assigneeRole || 'supervisor',
    };
    if (action === 'send_back') return {
      title: 'Devolver a conserjeria',
      submitLabel: 'Devolver',
      requiresNote: true,
      placeholder: 'Indica que debe completar o verificar conserjeria.',
      defaultTarget: 'conserje',
    };
    if (action === 'escalate') return {
      title: 'Escalar para Junta',
      submitLabel: 'Escalar',
      requiresNote: true,
      placeholder: 'Resume la decision requerida y el contexto operativo.',
      defaultTarget: 'junta',
    };
    return {
      title: 'Tomar incidencia',
      submitLabel: 'Tomar',
      requiresNote: false,
      placeholder: 'Nota opcional de primer triage.',
    };
  }

  async function applyLifecycleAction(ticket, action, note, evidenceUrl, targetRole) {
    try {
      var cfg = actionConfig(ticket, action);
      var target = targetRole ? { role: targetRole, label: roleLabel(targetRole) } : null;
      var label = cfg.submitLabel;
      var meta = appendHistory(ticket, action, label, note, evidenceUrl, target);
      var patch = { metadata: meta };

      if (action === 'take') {
        patch.status = 'in_progress';
        patch.resident_visible_status = 'In progress';
      } else if (action === 'resolve' || action === 'close_assigned') {
        patch.status = 'resolved';
        patch.resolved_at = new Date().toISOString();
        patch.resident_visible_status = 'Resolved';
      } else if (action === 'send_back') {
        patch.status = 'received';
        patch.resident_visible_status = 'Received';
        meta.assigneeRole = 'conserje';
        meta.assigneeLabel = roleLabel('conserje');
      } else if (action === 'reassign') {
        patch.status = 'in_progress';
        patch.resident_visible_status = 'In progress';
        meta.assigneeRole = targetRole;
        meta.assigneeLabel = roleLabel(targetRole);
      } else if (action === 'escalate') {
        meta.escalatedAt = new Date().toISOString();
        meta.escalationTarget = 'junta';
        await createEscalation(ticket, note, evidenceUrl, meta);
      }

      await window.SB.update('incident_tickets', { id: 'eq.' + ticket.id }, patch);
      window.UI.toast(successMessage(action), 'success');
      document.getElementById('inc-modal-host').innerHTML = '';
      await load();
    } catch (err) {
      window.UI.toast('Error: ' + err.message, 'error');
    }
  }

  async function createEscalation(ticket, note, evidenceUrl, meta) {
    var session = window.AUTH.readSession() || {};
    await window.SB.insert('escalation_events', {
      severity: ticket.severity || 'medium',
      status: 'open',
      source_type: 'incident_ticket',
      source_id: ticket.id,
      title: 'Escalacion: ' + (ticket.title || ticket.ticket_number || 'incidencia'),
      details: 'Escalada desde incidencia ' + (ticket.ticket_number || ticket.id) + ' por ' + (session.label || session.role || 'operacion') + '. ' + note,
      payload: {
        actorRole: session.role,
        actorLabel: session.label,
        ticket_number: ticket.ticket_number,
        building_id: ticket.building_id,
        category: ticket.category,
        location_label: ticket.location_label,
        status: ticket.status,
        evidence_url: evidenceUrl || '',
        source_context: sourceContext(ticket),
        incident_history: meta.incident_history || [],
      },
    });
  }

  function successMessage(action) {
    if (action === 'resolve' || action === 'close_assigned') return 'Incidencia cerrada con bitacora.';
    if (action === 'reassign') return 'Incidencia reasignada.';
    if (action === 'send_back') return 'Incidencia devuelta con comentario.';
    if (action === 'escalate') return 'Escalacion creada con contexto.';
    return 'Incidencia tomada.';
  }

  function sourceContext(ticket) {
    return [
      ticket.ticket_number || 'INC',
      ticket.category || 'Operacion',
      ticket.location_label || 'ubicacion pendiente',
    ].join(' · ');
  }

  function roleOptionsHtml(selected) {
    var roles = (window.APROVIVA_SUITE_CONFIG.MASTER_DATA && window.APROVIVA_SUITE_CONFIG.MASTER_DATA.roles) || [];
    return roles.map(function (r) {
      var sel = selected === r.value ? ' selected' : '';
      return '<option value="' + window.UI.esc(r.value) + '"' + sel + '>' + window.UI.esc(r.label) + '</option>';
    }).join('');
  }

  function roleLabel(role) {
    var roles = (window.APROVIVA_SUITE_CONFIG.MASTER_DATA && window.APROVIVA_SUITE_CONFIG.MASTER_DATA.roles) || [];
    for (var i = 0; i < roles.length; i++) {
      if (roles[i].value === role) return roles[i].label;
    }
    return role || '';
  }

  function mergedUbicacionLabels(locRows) {
    var seen = {};
    var out = [];
    window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS.UBICACIONES_FIJAS.forEach(function (u) {
      if (!seen[u]) { seen[u] = 1; out.push(u); }
    });
    (locRows || []).forEach(function (l) {
      var n = (l && l.name) ? l.name : '';
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

  async function openNewModal() {
    var session = window.AUTH.readSession();
    var staff = window.AUTH.isStaff();
    var host = document.getElementById('inc-modal-host');
    var locRows = [];
    try {
      locRows = await window.SB.select('inventory_locations', { select: 'name', is_active: 'eq.true', order: 'name.asc' }) || [];
    } catch (e) {}

    if (staff) {
      var motivoOpts = window.APROVIVA_SUITE_CONFIG.STAFF_QUICK_PICKS.MOTIVOS_INCIDENTE.map(function (m) {
        return '<option value="' + window.UI.esc(m.id) + '">' + window.UI.esc(m.title) + '</option>';
      }).join('');
      var ubicOpts = mergedUbicacionLabels(locRows).map(function (u) {
        return '<option value="' + window.UI.esc(u) + '">' + window.UI.esc(u) + '</option>';
      }).join('');
      var severityOpts = window.APROVIVA_SUITE_CONFIG.buildPrioritySelectOptionsHtml('medium', true);
      host.innerHTML = '' +
        '<section class="page" data-testid="inc-new-form">' +
          '<h3 class="section-title">Nueva incidencia</h3>' +
          '<p class="muted">Conserjeria: seleccione motivo, ubicacion y prioridad. Sin datos personales.</p>' +
          '<form id="inc-form" class="form-grid cols-2" data-staff="1" novalidate>' +
            '<div class="form-field"><label>Motivo</label>' +
              '<select name="motivo_id" required>' + motivoOpts + '</select></div>' +
            '<div class="form-field"><label>Ubicacion</label>' +
              '<select name="location" required>' + ubicOpts + '</select></div>' +
            '<div class="form-field"><label>Severidad</label>' +
              '<select name="severity" required>' + severityOpts + '</select></div>' +
            '<div class="form-field"><label>Visible al residente</label>' +
              '<select name="visible">' +
                '<option value="false" selected>No</option>' +
                '<option value="true">Si</option>' +
              '</select></div>' +
            '<div class="inc-privacy-note" style="grid-column:1/-1;">No incluya nombres, telefonos ni datos privados en el reporte operativo.</div>' +
            '<div class="btn-row inc-form-actions" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit">Crear incidencia</button>' +
              '<button class="btn btn-ghost" type="button" id="inc-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    } else {
      var adminLocOpts = window.APROVIVA_SUITE_CONFIG.buildAreaSelectOptionsHtml();
      var adminSeverityOpts = window.APROVIVA_SUITE_CONFIG.buildPrioritySelectOptionsHtml('medium', true);
      host.innerHTML = '' +
        '<section class="page" data-testid="inc-new-form">' +
          '<h3 class="section-title">Nueva incidencia</h3>' +
          '<form id="inc-form" class="form-grid cols-2" novalidate>' +
            '<div class="form-field"><label>Categoria</label>' +
              '<select name="category" required>' +
                '<option value="Maintenance">Mantenimiento</option>' +
                '<option value="Security">Seguridad</option>' +
                '<option value="Inventory">Inventario</option>' +
                '<option value="Cleanliness">Limpieza</option>' +
                '<option value="Other">Otro</option>' +
              '</select></div>' +
            '<div class="form-field"><label>Severidad</label>' +
              '<select name="severity" required>' + adminSeverityOpts + '</select></div>' +
            '<div class="form-field"><label>Ubicacion</label>' +
              '<select name="location" required>' + adminLocOpts + '</select></div>' +
            '<div class="form-field"><label>Visible al residente</label>' +
              '<select name="visible">' +
                '<option value="false">No</option>' +
                '<option value="true">Si</option>' +
              '</select></div>' +
            '<div class="form-field" style="grid-column:1/-1;"><label>Titulo</label>' +
              '<input type="text" name="title" required></div>' +
            '<div class="form-field" style="grid-column:1/-1;"><label>Descripcion</label>' +
              '<textarea name="description" rows="3" placeholder="Que pasa, desde cuando y que se necesita." required></textarea></div>' +
            '<div class="inc-privacy-note" style="grid-column:1/-1;">Use datos operativos. Evite nombres, telefonos o informacion privada.</div>' +
            '<div class="btn-row inc-form-actions" style="grid-column:1/-1;">' +
              '<button class="btn btn-primary-sm" type="submit">Crear incidencia</button>' +
              '<button class="btn btn-ghost" type="button" id="inc-cancel">Cancelar</button>' +
            '</div>' +
          '</form>' +
        '</section>';
    }
    document.getElementById('inc-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('inc-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      window.UI.toast('Creando incidencia...', 'info');
      var sess = window.AUTH.readSession();
      var fd = new FormData(this);
      var ticketNum = 'INC-' + Math.floor(Math.random() * 900000 + 100000);
      var now = new Date().toISOString();
      var body;
      if (this.getAttribute('data-staff') === '1') {
        var mot = motivoIncidenteById(fd.get('motivo_id'));
        if (!mot) {
          window.UI.toast('Motivo no valido.', 'error');
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
          description: mot.description + ' Ubicacion: ' + ubicLabel + '.',
          resident_visible_status: fd.get('visible') === 'true' ? 'Received' : null,
          metadata: {
            actorRole: sess.role,
            actorLabel: sess.label,
            source: 'aproviva-suite',
            staff_motivo_id: fd.get('motivo_id'),
            incident_history: [{ action: 'created', label: 'Incidencia creada', actor_role: sess.role, actor_label: sess.label, at: now }],
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
          resident_visible_status: fd.get('visible') === 'true' ? 'Received' : null,
          metadata: {
            actorRole: sess.role,
            actorLabel: sess.label,
            source: 'aproviva-suite',
            incident_history: [{ action: 'created', label: 'Incidencia creada', actor_role: sess.role, actor_label: sess.label, at: now }],
          },
        };
      }
      try {
        await window.SB.insert('incident_tickets', body);
        window.UI.toast('Incidencia creada.', 'success');
        host.innerHTML = '';
        await load();
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    });
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.ROUTER.register('incidencias', { render: render, requiredModule: 'incidencias' });
})();
