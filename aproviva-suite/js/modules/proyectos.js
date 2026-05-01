/**
 * Proyectos / Acciones - work_assignments.
 * Gerencia: CSV import + full lifecycle. Supervisor: list + advance + crear.
 * Junta: backlog intake (metadata requested_by_role) + read-only list of items they requested.
 */
(function () {
  var STATE = { rows: [], filter: 'open' };

  function parseMeta(m) {
    if (!m) return {};
    if (typeof m === 'object') return m;
    try {
      return JSON.parse(m);
    } catch (e) {
      return {};
    }
  }

  function canAdvanceWork(session) {
    return !!(session && (session.role === 'supervisor' || session.role === 'gerencia'));
  }

  function canImportCsv(session) {
    return !!(session && session.role === 'gerencia');
  }

  function isJunta(session) {
    return !!(session && session.role === 'junta');
  }

  var TASK_TYPES = ['corrective', 'preventive', 'inspection', 'project'];
  var PRIORITIES = ['low', 'normal', 'high', 'critical'];
  var STATUSES = ['open', 'in_progress', 'blocked', 'completed', 'closed', 'cancelled'];

  function parseCSVLine(line) {
    var out = [];
    var cur = '';
    var i = 0;
    var q = false;
    for (; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            q = false;
          }
        } else {
          cur += c;
        }
      } else if (c === '"') {
        q = true;
      } else if (c === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) {
      return String(l).replace(/\ufeff/g, '').trim() !== '';
    });
    if (!lines.length) return { headers: [], rows: [] };
    var headers = parseCSVLine(lines[0].replace(/^\ufeff/, '')).map(function (h) {
      return String(h).trim().toLowerCase().replace(/^\ufeff/g, '');
    });
    var rows = [];
    for (var r = 1; r < lines.length; r++) {
      var cells = parseCSVLine(lines[r]);
      if (cells.length === 1 && !String(cells[0]).trim()) continue;
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = cells[c] != null ? String(cells[c]).trim() : '';
      }
      rows.push(obj);
    }
    return { headers: headers, rows: rows };
  }

  function normEnum(val, allowed, fallback) {
    var v = String(val || '').trim().toLowerCase();
    if (allowed.indexOf(v) >= 0) return v;
    return fallback;
  }

  function rowToBody(raw, session, rowIndex) {
    var title = String(raw.title || '').trim();
    var area = controlledAreaValue(raw.area);
    var assignee = controlledAssigneeValue(raw.assignee_name || raw.asignado);
    var description = String(raw.description || raw.descripcion || '').trim();
    if (!title || !area || !assignee || !description) {
      return { error: 'Fila ' + (rowIndex + 2) + ': faltan title, area, assignee_name o description.' };
    }
    var taskType = normEnum(raw.task_type, TASK_TYPES, 'corrective');
    var priority = normEnum(raw.priority, PRIORITIES, 'normal');
    var status = normEnum(raw.status, STATUSES, 'open');
    var dueRaw = String(raw.due_at || raw.vence || '').trim();
    var dueAt = null;
    if (dueRaw) {
      var d = new Date(dueRaw + (dueRaw.length <= 10 ? 'T12:00:00' : ''));
      if (!isNaN(d.getTime())) dueAt = d.toISOString();
    }
    var assignNum = String(raw.assignment_number || raw.numero || '').trim();
    if (!assignNum) {
      assignNum = 'WO-' + Math.floor(Math.random() * 900000 + 100000);
    }
    return {
      body: {
        assignment_number: assignNum,
        building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
        assignee_name: assignee,
        area: area,
        task_type: taskType,
        title: title,
        description: description,
        status: status,
        priority: priority,
        verification_required: false,
        due_at: dueAt,
        metadata: {
          actorRole: session.role,
          actorLabel: session.label,
          source: 'aproviva-suite-csv-import',
          importRow: rowIndex + 2,
        },
      },
    };
  }

  async function importCSVRows(parsed, session) {
    var bodies = [];
    var errors = [];
    for (var i = 0; i < parsed.rows.length; i++) {
      var conv = rowToBody(parsed.rows[i], session, i);
      if (conv.error) {
        errors.push(conv.error);
        continue;
      }
      bodies.push(conv.body);
    }
    if (errors.length && !bodies.length) {
      window.UI.toast(errors[0], 'error');
      return { ok: 0, fail: errors.length, errors: errors };
    }
    var chunkSize = 25;
    var ok = 0;
    for (var c = 0; c < bodies.length; c += chunkSize) {
      var chunk = bodies.slice(c, c + chunkSize);
      try {
        await window.SB.insert('work_assignments', chunk);
        ok += chunk.length;
      } catch (err) {
        for (var j = 0; j < chunk.length; j++) {
          try {
            await window.SB.insert('work_assignments', chunk[j]);
            ok++;
          } catch (e2) {
            errors.push('Lote fila ~' + (c + j + 1) + ': ' + (e2.message || String(e2)));
          }
        }
      }
    }
    if (errors.length) {
      console.warn('Import CSV advertencias', errors);
    }
    return { ok: ok, fail: errors.length, errors: errors };
  }

  function downloadTemplate() {
    var url = 'data/work-assignments-import-template.csv';
    var a = document.createElement('a');
    a.href = url;
    a.download = 'work-assignments-import-template.csv';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.UI.toast('Plantilla descargada.', 'success');
  }

  function wireCsvImport(session) {
    if (!canImportCsv(session)) return;
    var fileInput = document.getElementById('proj-csv-input');
    var btnUp = document.getElementById('proj-csv-upload');
    var btnTpl = document.getElementById('proj-csv-template');
    if (!fileInput || !btnUp || !btnTpl) return;
    btnTpl.addEventListener('click', downloadTemplate);
    btnUp.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', async function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      var text = await f.text();
      var parsed;
      try {
        parsed = parseCSV(text);
      } catch (e) {
        window.UI.toast('CSV inv\u00e1lido: ' + (e.message || e), 'error');
        return;
      }
      var need = ['title', 'area', 'assignee_name', 'description'];
      var miss = need.filter(function (k) { return parsed.headers.indexOf(k) === -1; });
      if (miss.length) {
        window.UI.toast('Faltan columnas obligatorias en la primera fila: ' + miss.join(', '), 'error');
        return;
      }
      if (!parsed.rows.length) {
        window.UI.toast('El archivo no tiene filas de datos.', 'error');
        return;
      }
      if (!confirm('Importar ' + parsed.rows.length + ' \u00f3rden(es) de trabajo desde CSV?')) return;
      window.UI.toast('Importando...', 'info');
      var res = await importCSVRows(parsed, session);
      if (res.ok) {
        window.UI.toast('Importadas ' + res.ok + ' orden(es).' + (res.fail ? ' Con ' + res.fail + ' error(es).' : ''), res.fail ? 'warning' : 'success');
      } else if (res.fail) {
        window.UI.toast('Importaci\u00f3n fallida. Revisa la consola o el formato.', 'error');
      }
      await load(session);
    });
  }

  async function render(container, session) {
    var junta = isJunta(session);
    var csvBlock = canImportCsv(session)
      ? '<button class="btn btn-ghost" type="button" id="proj-csv-template">Plantilla CSV</button>' +
        '<button class="btn btn-ghost" type="button" id="proj-csv-upload">Importar</button>' +
        '<input type="file" id="proj-csv-input" accept=".csv,text/csv" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;" />'
      : '';

    var intro = junta
      ? '<p class="page-subtitle">Backlog de solicitudes para que operaciones priorice y ejecute.</p>'
      : '<p class="page-subtitle">\u00d3rdenes de trabajo, responsables y seguimiento operativo.</p>';

    var title = junta ? 'Backlog operativo' : 'Proyectos / Acciones';
    var newBtnLabel = junta ? 'Enviar solicitud' : 'Nueva orden';
    var actionTitle = junta ? 'Siguiente paso para junta' : (canImportCsv(session) ? 'Siguiente paso para gerencia' : 'Siguiente paso operativo');
    var actionCopy = junta
      ? 'Registra una solicitud breve. Queda abierta para asignaci\u00f3n sin exponer datos privados.'
      : (canImportCsv(session)
        ? 'Crea una orden puntual o importa una tanda desde CSV cuando ya tengas responsables y \u00e1reas definidos.'
        : 'Revisa tus abiertas y usa Avanzar cuando una orden pase a ejecuci\u00f3n o quede completada.');

    container.innerHTML = '' +
      '<section class="page" data-testid="proyectos-page">' +
        '<div class="row between wrap proj-head">' +
          '<div>' +
            '<h2 class="page-title">' + title + '</h2>' +
            intro +
          '</div>' +
          '<div class="row wrap proj-toolbar">' +
            '<select id="proj-filter" class="btn btn-ghost">' +
              '<option value="open">Abiertos</option>' +
              '<option value="all">Todos</option>' +
              '<option value="closed">Cerrados</option>' +
            '</select>' +
            csvBlock +
            '<button class="btn btn-primary-sm" id="proj-new" type="button" data-testid="' + (junta ? 'proj-backlog-form' : 'proj-new-order') + '">' + newBtnLabel + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="page-section proj-next">' +
          '<div>' +
            '<span class="vv-eyebrow">' + actionTitle + '</span>' +
            '<p>' + actionCopy + '</p>' +
          '</div>' +
          '<span class="vv-status vv-status-info"><i></i>' + (junta ? 'Backlog' : 'Ejecuci\u00f3n') + '</span>' +
        '</div>' +
        '<div class="kpi-grid" id="proj-kpis"><div class="loading">...</div></div>' +
        '<div class="page-section">' +
          '<div id="proj-list"></div>' +
        '</div>' +
      '</section>' +
      '<div id="proj-modal-host"></div>';

    document.getElementById('proj-filter').addEventListener('change', function (e) { STATE.filter = e.target.value; renderList(session); });
    document.getElementById('proj-new').addEventListener('click', function () { openNew(session); });
    wireCsvImport(session);
    await load(session);
  }

  async function load(session) {
    try {
      var rows = await window.SB.select('work_assignments', { select: '*', order: 'due_at.asc.nullslast', limit: '200' });
      rows = rows || [];
      STATE.rows = rows;
      renderKpis();
      renderList(session);
    } catch (e) {
      window.UI.errorBox('proj-list', e);
    }
  }

  function renderKpis() {
    var open = STATE.rows.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled'; });
    var overdue = open.filter(function (r) { return r.due_at && new Date(r.due_at).getTime() < Date.now(); });
    var highPriority = open.filter(function (r) { return r.priority === 'high' || r.priority === 'critical'; });
    var capital = STATE.rows.filter(function (r) { return r.task_type === 'project' || parseMeta(r.metadata).capital_project === true; });
    document.getElementById('proj-kpis').innerHTML = '' +
      kpi('Total', STATE.rows.length) +
      kpi('Abiertos', open.length) +
      kpi('Atrasados', overdue.length) +
      kpi('Alta prioridad', highPriority.length) +
      kpi('Capitales', capital.length);
  }

  function renderList(session) {
    var rows = STATE.rows;
    if (STATE.filter === 'open') rows = rows.filter(function (r) { return r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled'; });
    if (STATE.filter === 'closed') rows = rows.filter(function (r) { return r.status === 'completed' || r.status === 'closed'; });

    var sess = session || window.AUTH.readSession();
    var showAdvance = canAdvanceWork(sess);
    var host = document.getElementById('proj-list');

    if (!rows.length) {
      host.innerHTML = '<p class="empty">Sin \u00f3rdenes.</p>';
    } else if (isJunta(sess)) {
      var capital = rows.filter(function (r) { return r.task_type === 'project' || parseMeta(r.metadata).capital_project === true; });
      var backlog = rows.filter(function (r) { return capital.indexOf(r) === -1; });
      host.innerHTML = '' +
        '<div class="page-section"><h3 class="section-title">Proyectos capitales</h3>' +
          '<p class="muted">Milestones/RAG se derivan del historial de avances y prioridad hasta que exista una tabla dedicada.</p>' +
          (capital.length ? '<div class="proj-work-list">' + capital.map(function (r) { return workCard(r, false, true); }).join('') + '</div>' : '<p class="empty">Sin proyectos capitales registrados.</p>') +
        '</div>' +
        '<div class="page-section"><h3 class="section-title">Backlog operativo</h3>' +
          '<p class="muted">Acciones operativas por due\u00f1o, estado, prioridad, vencimiento y \u00faltimo comentario.</p>' +
          (backlog.length ? '<div class="proj-work-list">' + backlog.map(function (r) { return workCard(r, false, false); }).join('') + '</div>' : '<p class="empty">Sin backlog operativo.</p>') +
        '</div>';
    } else {
      host.innerHTML = '<div class="proj-work-list">' + rows.map(function (r) {
        return workCard(r, showAdvance);
      }).join('') + '</div>';
    }
    host.onclick = function (e) { onAction(e); };
  }

  function controlledAreaValue(value) {
    var v = String(value || '').trim();
    var places = (window.APROVIVA_SUITE_CONFIG.MASTER_DATA && window.APROVIVA_SUITE_CONFIG.MASTER_DATA.areas) || [];
    var match = places.filter(function (p) {
      return p && (p.label === v || p.id === v);
    })[0];
    return match ? match.label : v;
  }

  function controlledAssigneeValue(value) {
    var v = String(value || '').trim();
    var roles = (window.APROVIVA_SUITE_CONFIG.MASTER_DATA && window.APROVIVA_SUITE_CONFIG.MASTER_DATA.roles) || [];
    var match = roles.filter(function (r) {
      return r && (r.label === v || r.value === v);
    })[0];
    return match ? match.label : v;
  }

  function labelForStatus(s) {
    if (s === 'open' || !s) return 'Abierta';
    if (s === 'in_progress') return 'En curso';
    if (s === 'blocked') return 'Bloqueada';
    if (s === 'completed') return 'Completada';
    if (s === 'closed') return 'Cerrada';
    if (s === 'cancelled') return 'Cancelada';
    return s;
  }

  function labelForPriority(p) {
    if (p === 'critical') return 'Cr\u00edtica';
    if (p === 'high') return 'Alta';
    if (p === 'low') return 'Baja';
    return 'Normal';
  }

  function labelForType(t) {
    if (t === 'preventive') return 'Preventiva';
    if (t === 'inspection') return 'Inspecci\u00f3n';
    if (t === 'project') return 'Proyecto';
    return 'Correctiva';
  }

  function workCard(r, showAdvance, boardProject) {
    var isClosed = r.status === 'completed' || r.status === 'closed';
    var due = r.due_at ? new Date(r.due_at) : null;
    var late = due && due.getTime() < Date.now() && !isClosed;
    var next = r.status === 'open' || !r.status ? 'Iniciar' : (r.status === 'in_progress' ? 'Completar' : 'Avanzar');
    var dueHtml = r.due_at
      ? '<span class="' + (late ? 'proj-due is-late' : 'proj-due') + '">' + (late ? 'Vencida ' : 'Vence ') + window.UI.esc(window.UI.fmtDate(r.due_at, { dateOnly: true })) + '</span>'
      : '<span class="muted">Sin fecha</span>';
    var meta = parseMeta(r.metadata);
    var hist = Array.isArray(meta.history) ? meta.history : [];
    var last = hist.length ? hist[hist.length - 1] : null;
    var rag = r.priority === 'critical' || r.status === 'blocked' ? 'Rojo' : (late || r.priority === 'high' ? 'Amarillo' : 'Verde');
    var action = isClosed
      ? '<span class="muted">Cerrada</span>'
      : (showAdvance
        ? '<button class="btn btn-ghost btn-sm" data-act="advance" data-id="' + window.UI.esc(r.id) + '" data-current="' + window.UI.esc(r.status) + '">' + next + '</button>' +
          '<button class="btn btn-primary-sm" data-act="update" data-id="' + window.UI.esc(r.id) + '">Actualizar</button>'
        : '');
    return '<article class="proj-work-card">' +
      '<div class="proj-card-main">' +
        '<div class="proj-card-top">' +
          '<span class="muted">' + window.UI.esc(r.assignment_number || 'WO') + '</span>' +
          window.UI.badge(labelForStatus(r.status), statusKind(r.status)) +
        '</div>' +
        '<h3>' + window.UI.esc(r.title || 'Orden sin t\u00edtulo') + '</h3>' +
        '<p>' + window.UI.esc(r.area || 'Sin \u00e1rea') + ' \u00b7 ' + window.UI.esc(labelForType(r.task_type)) + '</p>' +
        '<div class="proj-card-meta">' +
          window.UI.badge(labelForPriority(r.priority || 'normal'), priKind(r.priority)) +
          (boardProject ? window.UI.badge('RAG: ' + rag, rag === 'Rojo' ? 'danger' : (rag === 'Amarillo' ? 'warning' : 'success')) : '') +
          dueHtml +
        '</div>' +
        (last ? '<p class="muted">Último avance: ' + window.UI.esc(last.note || last.kind || '') + '</p>' : '') +
      '</div>' +
      '<div class="proj-card-side">' +
        '<span class="muted">Responsable</span>' +
        '<strong>' + window.UI.esc(r.assignee_name || 'Por asignar') + '</strong>' +
        action +
      '</div>' +
    '</article>';
  }

  function priKind(p) {
    if (p === 'critical' || p === 'high') return 'danger';
    if (p === 'normal') return 'info';
    return 'neutral';
  }

  function statusKind(s) {
    if (s === 'completed' || s === 'closed') return 'success';
    if (s === 'in_progress') return 'info';
    if (s === 'blocked') return 'danger';
    return 'neutral';
  }

  function nextStatus(s) {
    if (s === 'open' || !s) return 'in_progress';
    if (s === 'in_progress') return 'completed';
    return s;
  }

  async function onAction(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.getAttribute('data-act') === 'advance') {
      var id = btn.getAttribute('data-id');
      var current = btn.getAttribute('data-current');
      var next = nextStatus(current);
      try {
        var patch = { status: next, metadata: appendWorkHistory(rowById(id), 'status', 'Estado actualizado a ' + labelForStatus(next)) };
        await window.SB.update('work_assignments', { id: 'eq.' + id }, patch);
        window.UI.toast('Orden avanzada a ' + next + '.', 'success');
        await load(window.AUTH.readSession());
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    } else if (btn.getAttribute('data-act') === 'update') {
      openUpdate(btn.getAttribute('data-id'), window.AUTH.readSession());
    }
  }

  function rowById(id) {
    return STATE.rows.filter(function (r) { return String(r.id) === String(id); })[0] || null;
  }

  function appendWorkHistory(row, kind, note, extra) {
    var sess = window.AUTH.readSession() || {};
    var meta = parseMeta(row && row.metadata);
    var hist = Array.isArray(meta.history) ? meta.history.slice() : [];
    hist.push(Object.assign({
      kind: kind,
      note: note,
      at: new Date().toISOString(),
      actorRole: sess.role,
      actorLabel: sess.label,
    }, extra || {}));
    meta.history = hist;
    return meta;
  }

  function openUpdate(id, session) {
    var row = rowById(id);
    if (!row) return;
    var host = document.getElementById('proj-modal-host');
    host.innerHTML = '' +
      '<section class="page" data-testid="proj-update-form">' +
        '<h3 class="section-title">Actualizar orden</h3>' +
        '<p class="muted">' + window.UI.esc(row.assignment_number || 'WO') + ' · ' + window.UI.esc(row.title || '') + '</p>' +
        '<form id="proj-update" class="form-grid cols-2" novalidate>' +
          '<div class="form-field"><label>Estado</label><select name="status">' +
            STATUSES.map(function (s) { return '<option value="' + s + '"' + (s === row.status ? ' selected' : '') + '>' + window.UI.esc(labelForStatus(s)) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-field"><label>Prioridad</label><select name="priority">' +
            PRIORITIES.map(function (p) { return '<option value="' + p + '"' + (p === row.priority ? ' selected' : '') + '>' + window.UI.esc(labelForPriority(p)) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-field"><label>Vence</label><input type="date" name="due_at" value="' + window.UI.esc(row.due_at ? String(row.due_at).slice(0, 10) : '') + '"></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Comentario de avance</label><textarea name="note" rows="3" required></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Guardar avance</button>' +
            '<button class="btn btn-ghost" type="button" id="proj-update-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('proj-update-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('proj-update').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      try {
        await window.SB.update('work_assignments', { id: 'eq.' + id }, {
          status: fd.get('status'),
          priority: fd.get('priority'),
          due_at: fd.get('due_at') ? new Date(fd.get('due_at')).toISOString() : null,
          metadata: appendWorkHistory(row, 'progress', fd.get('note'), {
            status: fd.get('status'),
            priority: fd.get('priority'),
          }),
        });
        window.UI.toast('Avance guardado.', 'success');
        host.innerHTML = '';
        await load(session || window.AUTH.readSession());
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    });
  }

  function openJuntaBacklog(session) {
    var host = document.getElementById('proj-modal-host');
    var areaOpts = window.APROVIVA_SUITE_CONFIG.buildAreaSelectOptionsHtml();
    var priorityOpts = window.APROVIVA_SUITE_CONFIG.buildPrioritySelectOptionsHtml('normal', false);
    host.innerHTML = '' +
      '<section class="page" data-testid="proj-junta-backlog-modal">' +
        '<h3 class="section-title">Nueva tarea para operaciones</h3>' +
        '<p class="muted">Usa datos operativos: \u00e1rea, prioridad y contexto. Evita incluir datos personales.</p>' +
        '<form id="proj-form" class="form-grid cols-2" novalidate>' +
          '<div class="form-field"><label>T\u00edtulo</label>' +
            '<input type="text" name="title" required></div>' +
          '<div class="form-field"><label>\u00c1rea</label>' +
            '<select name="area" required>' + areaOpts + '</select></div>' +
          '<div class="form-field"><label>Prioridad</label>' +
            '<select name="priority">' + priorityOpts + '</select></div>' +
          '<div class="form-field"><label>Vence (opcional)</label>' +
            '<input type="date" name="due_at"></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Contexto operativo</label>' +
            '<textarea name="description" rows="3" required></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Enviar al backlog</button>' +
            '<button class="btn btn-ghost" type="button" id="proj-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('proj-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('proj-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var body = {
        assignment_number: 'WO-' + Math.floor(Math.random() * 900000 + 100000),
        building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
        assignee_name: 'Por asignar (Junta)',
        area: fd.get('area'),
        task_type: 'corrective',
        title: fd.get('title'),
        description: fd.get('description'),
        status: 'open',
        priority: fd.get('priority'),
        verification_required: false,
        due_at: fd.get('due_at') ? new Date(fd.get('due_at')).toISOString() : null,
        metadata: {
          requested_by_role: 'junta',
          requested_by: session.label,
          actorRole: session.role,
          actorLabel: session.label,
          source: 'aproviva-suite-junta-backlog',
        },
      };
      try {
        await window.SB.insert('work_assignments', body);
        window.UI.toast('Solicitud enviada al backlog.', 'success');
        host.innerHTML = '';
        await load(session);
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    });
  }

  function openNew(session) {
    if (session && session.role === 'junta') {
      openJuntaBacklog(session);
      return;
    }
    openNewFull(session);
  }

  function openNewFull(session) {
    var host = document.getElementById('proj-modal-host');
    var areaOpts = window.APROVIVA_SUITE_CONFIG.buildAreaSelectOptionsHtml();
    var assigneeOpts = window.APROVIVA_SUITE_CONFIG.buildAssigneeSelectOptionsHtml([], session && session.label);
    var priorityOpts = window.APROVIVA_SUITE_CONFIG.buildPrioritySelectOptionsHtml('normal', false);
    host.innerHTML = '' +
      '<section class="page" data-testid="proj-new-form">' +
        '<h3 class="section-title">Nueva orden de trabajo</h3>' +
        '<p class="muted">Define responsable, \u00e1rea y siguiente fecha objetivo. Mant\u00e9n la descripci\u00f3n accionable.</p>' +
        '<form id="proj-form" class="form-grid cols-2" novalidate>' +
          '<div class="form-field"><label>T\u00edtulo</label>' +
            '<input type="text" name="title" required></div>' +
          '<div class="form-field"><label>\u00c1rea</label>' +
            '<select name="area" required>' + areaOpts + '</select></div>' +
          '<div class="form-field"><label>Asignado a</label>' +
            '<select name="assignee_name" required>' + assigneeOpts + '</select></div>' +
          '<div class="form-field"><label>Tipo de tarea</label>' +
            '<select name="task_type">' +
              '<option value="corrective">Correctiva</option>' +
              '<option value="preventive">Preventiva</option>' +
              '<option value="inspection">Inspecci\u00f3n</option>' +
              '<option value="project">Proyecto</option>' +
            '</select></div>' +
          '<div class="form-field"><label>Prioridad</label>' +
            '<select name="priority">' + priorityOpts + '</select></div>' +
          '<div class="form-field"><label>Vence</label>' +
            '<input type="date" name="due_at"></div>' +
          '<div class="form-field" style="grid-column:1/-1;"><label>Trabajo requerido</label>' +
            '<textarea name="description" rows="3" required></textarea></div>' +
          '<div class="btn-row" style="grid-column:1/-1;">' +
            '<button class="btn btn-primary-sm" type="submit">Crear</button>' +
            '<button class="btn btn-ghost" type="button" id="proj-cancel">Cancelar</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    document.getElementById('proj-cancel').addEventListener('click', function () { host.innerHTML = ''; });
    document.getElementById('proj-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var sess = session || window.AUTH.readSession();
      var fd = new FormData(this);
      var body = {
        assignment_number: 'WO-' + Math.floor(Math.random() * 900000 + 100000),
        building_id: window.APROVIVA_SUITE_CONFIG.BUILDING_ID,
        assignee_name: fd.get('assignee_name'),
        area: fd.get('area'),
        task_type: fd.get('task_type'),
        title: fd.get('title'),
        description: fd.get('description'),
        status: 'open',
        priority: fd.get('priority'),
        verification_required: false,
        due_at: fd.get('due_at') ? new Date(fd.get('due_at')).toISOString() : null,
        metadata: { actorRole: sess.role, actorLabel: sess.label, source: 'aproviva-suite' },
      };
      try {
        await window.SB.insert('work_assignments', body);
        window.UI.toast('Orden creada.', 'success');
        host.innerHTML = '';
        await load(sess);
      } catch (err) {
        window.UI.toast('Error: ' + err.message, 'error');
      }
    });
  }

  function kpi(label, value) {
    return '<div class="kpi-card"><div class="kpi-label">' + window.UI.esc(label) + '</div>' +
           '<div class="kpi-value">' + window.UI.esc(value) + '</div></div>';
  }

  window.ROUTER.register('proyectos', { render: render, requiredModule: 'proyectos' });
})();
