/**
 * SOP - rendered Spanish role guide inside the authenticated suite.
 */
(function () {
  var ASSET = '/docs/assets/sop-villa-valencia/';

  var ROLES = [
    { rol: 'Residente', entrada: 'Portal público', pin: 'No requiere', modulos: 'PQRS, mapa y consulta de estado', no: 'No entrar a operación interna; no incluir datos privados de terceros.' },
    { rol: 'Conserjería / Personal', entrada: 'APROVIVA Operaciones', pin: '2026 o CONS26', modulos: 'Inicio, Recorridos, Inventario, Incidencias', no: 'No revisar Junta; no modificar datos maestros; no inventar conteos.' },
    { rol: 'Supervisión', entrada: 'APROVIVA Operaciones', pin: 'SUP26', modulos: 'Recorridos, Plan Maestro, Proyectos, Reportes, operación', no: 'No actuar como Junta; no registrar datos sensibles innecesarios.' },
    { rol: 'Gerencia / Administración', entrada: 'APROVIVA Operaciones', pin: 'GER26', modulos: 'Proyectos, Datos Maestros, Reportes, Inicio', no: 'No usar campos libres para chats privados o datos bancarios.' },
    { rol: 'Junta Directiva', entrada: 'APROVIVA Operaciones', pin: 'JD26', modulos: 'Inicio, Junta, Proyectos, Reportes / Paquete Junta', no: 'No ejecutar operación diaria ni alterar registros de campo.' },
  ];

  var SECTIONS = [
    {
      id: 'residentes',
      title: 'Residentes: radicar y consultar PQRS',
      intro: 'El residente usa el portal público para reportar solicitudes o problemas y guardar su referencia VV-PQRS.',
      shots: [
        ['01-portal-residentes-inicio.png', 'Portal Residentes · Inicio'],
        ['02-residente-radicar-pqrs.png', 'Formulario para radicar PQRS'],
        ['03-residente-mapa-pqrs.png', 'Mapa de referencia PQRS'],
      ],
      steps: [
        'Entrar al portal público: villavalencia.vercel.app.',
        'Presionar “Radicar PQRS”.',
        'Completar resumen, descripción, tipo, ubicación, urgencia y casa si aplica.',
        'Adjuntar foto solo si ayuda a entender el punto físico.',
        'Enviar y guardar la referencia VV-PQRS para seguimiento.',
      ],
      checklist: ['Descripción clara', 'Ubicación correcta', 'Sin datos privados de terceros', 'Referencia guardada'],
    },
    {
      id: 'conserjeria',
      title: 'Conserjería: operación diaria',
      intro: 'Conserjería ejecuta recorridos, conteos e incidencias con evidencia operativa de áreas comunes.',
      shots: [
        ['05-conserjeria-inicio.png', 'Inicio Conserjería'],
        ['06-conserjeria-recorridos.png', 'Recorridos'],
        ['07-conserjeria-inventario.png', 'Inventario'],
        ['08-conserjeria-incidencias.png', 'Incidencias'],
      ],
      steps: [
        'Entrar con PIN demo 2026 o CONS26.',
        'Revisar “Inicio” para ver la acción sugerida.',
        'Usar “Recorridos” para iniciar/continuar revisiones físicas.',
        'Usar “Inventario” solo cuando el conteo fue verificado en sitio.',
        'Usar “Incidencias” para reportar novedades con ubicación y descripción objetiva.',
      ],
      checklist: ['Recorridos completados o justificados', 'Hallazgos críticos reportados', 'Conteos físicos, no estimados', 'Sin nombres/teléfonos/datos privados'],
    },
    {
      id: 'supervision',
      title: 'Supervisión: control y seguimiento',
      intro: 'Supervisión valida que los recorridos, planes, incidencias y proyectos tengan seguimiento real.',
      shots: [
        ['09-supervision-inicio.png', 'Inicio Supervisión'],
        ['10-supervision-recorridos-plan-maestro.png', 'Plan Maestro / Recorridos'],
        ['11-supervision-proyectos.png', 'Proyectos'],
        ['12-supervision-reportes.png', 'Reportes'],
      ],
      steps: [
        'Entrar con PIN demo SUP26.',
        'Revisar recorridos activos, recientes o atrasados.',
        'Crear o ajustar Plan Maestro solo cuando corresponda.',
        'Revisar backlog/proyectos y confirmar responsable, prioridad y fecha.',
        'Escalar a Gerencia lo que requiera decisión o recurso.',
      ],
      checklist: ['Recorridos atrasados revisados', 'Hallazgos críticos con seguimiento', 'Proyectos con responsable', 'Reportes revisados'],
    },
    {
      id: 'gerencia',
      title: 'Gerencia / Administración: gobierno operativo',
      intro: 'Gerencia coordina backlog, datos maestros y reportes para mantener la operación ordenada.',
      shots: [
        ['13-gerencia-inicio.png', 'Inicio Gerencia'],
        ['14-gerencia-proyectos-backlog.png', 'Backlog / Proyectos'],
        ['15-gerencia-datos-maestros.png', 'Datos Maestros'],
        ['16-gerencia-reportes.png', 'Reportes'],
      ],
      steps: [
        'Entrar con PIN demo GER26.',
        'Usar “Proyectos” para priorizar backlog, responsables y fechas.',
        'Usar “Datos Maestros” para mantener catálogos cortos, limpios y sin duplicados.',
        'Usar “Reportes” para preparar lectura ejecutiva y decisiones para Junta.',
        'Evitar datos sensibles en notas libres y reportes ejecutivos.',
      ],
      checklist: ['Backlog priorizado', 'Datos maestros limpios', 'Reportes listos', 'Decisiones para Junta identificadas'],
    },
    {
      id: 'junta',
      title: 'Junta Directiva: decisiones y evidencia',
      intro: 'Junta lee riesgos, decisiones y evidencia resumida. No ejecuta operación diaria.',
      shots: [
        ['17-junta-inicio.png', 'Inicio Junta'],
        ['18-junta-tablero.png', 'Tablero Junta'],
        ['19-junta-paquete-ejecutivo.png', 'Paquete Ejecutivo'],
      ],
      steps: [
        'Entrar con PIN demo JD26.',
        'Ir a “Junta” para revisar KPIs, riesgos y escalaciones.',
        'Abrir detalles cuando un indicador requiera explicación.',
        'Ir a “Reportes” y presionar “Paquete Junta”.',
        'Usar el paquete para reunión, acta y decisiones sin datos personales innecesarios.',
      ],
      checklist: ['Riesgos entendidos', 'Decisiones claras', 'Evidencia suficiente', 'Paquete sin PII innecesaria'],
    },
  ];

  function esc(s) { return window.UI.esc(s); }

  function renderRoleRows() {
    return ROLES.map(function (r) {
      return '<tr><td data-label="Rol"><strong>' + esc(r.rol) + '</strong></td><td data-label="Entrada">' + esc(r.entrada) + '</td><td data-label="PIN demo"><code>' + esc(r.pin) + '</code></td><td data-label="Módulos">' + esc(r.modulos) + '</td><td data-label="No debe hacer">' + esc(r.no) + '</td></tr>';
    }).join('');
  }

  function renderSection(sec) {
    return '' +
      '<article class="sop-role-section" id="sop-' + esc(sec.id) + '">' +
        '<div class="sop-section-copy">' +
          '<div class="vv-eyebrow">Procedimiento por rol</div>' +
          '<h3>' + esc(sec.title) + '</h3>' +
          '<p>' + esc(sec.intro) + '</p>' +
          '<ol class="sop-steps">' + sec.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
          '<div class="sop-checklist"><strong>Checklist</strong><ul>' + sec.checklist.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
        '</div>' +
        '<div class="sop-shot-grid">' + sec.shots.map(function (shot) {
          return '<figure class="sop-shot"><a href="' + ASSET + esc(shot[0]) + '" target="_blank" rel="noopener noreferrer"><img src="' + ASSET + esc(shot[0]) + '" alt="' + esc(shot[1]) + '" loading="lazy"></a><figcaption>' + esc(shot[1]) + '</figcaption></figure>';
        }).join('') + '</div>' +
      '</article>';
  }

  function render(container, session) {
    container.innerHTML = '' +
      '<section class="page sop-page" data-testid="sop-page">' +
        '<div class="module-premium-hero sop-hero" data-testid="sop-premium-hero">' +
          '<div class="module-hero-copy"><div class="vv-eyebrow">Manual operativo · Todos los roles</div>' +
            '<h2 class="page-title">SOP APROVIVA Villa Valencia</h2>' +
            '<p class="page-subtitle">Guía paso a paso para residentes, conserjería, supervisión, gerencia y junta. Usa este manual para operar sin adivinar y sin exponer datos privados.</p>' +
          '</div>' +
          '<div class="module-hero-actions"><a class="btn btn-ghost" href="/docs/SOP-APROVIVA-VILLA-VALENCIA-ROLES-2026-05-01.md" target="_blank" rel="noopener noreferrer">Abrir Markdown</a><button class="btn btn-primary-sm" onclick="window.print()" type="button">Imprimir / PDF</button></div>' +
        '</div>' +
        '<div class="vv-privacy-card module-privacy-card" data-testid="sop-privacy-note"><div class="vv-eyebrow">Regla de oro</div><p>No registres cédulas, bancos, contraseñas, conversaciones privadas ni datos personales de terceros. Usa evidencia operativa: ubicación, hecho observado, estado y foto del punto cuando aplique.</p></div>' +
        '<nav class="sop-anchor-row" aria-label="Secciones SOP">' + SECTIONS.map(function (s) { return '<a href="#sop-' + esc(s.id) + '">' + esc(s.title.split(':')[0]) + '</a>'; }).join('') + '</nav>' +
        '<section class="page-section sop-table-section"><h3 class="section-title">Tabla rápida de roles</h3><div class="table-wrap"><table class="sop-role-table"><thead><tr><th>Rol</th><th>Entrada</th><th>PIN demo</th><th>Módulos</th><th>Qué NO debe hacer</th></tr></thead><tbody>' + renderRoleRows() + '</tbody></table></div></section>' +
        SECTIONS.map(renderSection).join('') +
        '<section class="page-section sop-help" data-testid="sop-troubleshooting"><h3 class="section-title">Troubleshooting básico</h3><div class="sop-help-grid">' +
          '<div><strong>PIN no entra</strong><span>Revisa mayúsculas, quita espacios y confirma el rol.</span></div>' +
          '<div><strong>No veo un módulo</strong><span>Es normal: cada rol ve solo lo autorizado.</span></div>' +
          '<div><strong>Mapa no carga</strong><span>Revisa internet, refresca y prueba Chrome.</span></div>' +
          '<div><strong>Referencia PQRS no aparece</strong><span>Copia exactamente el código VV-PQRS, sin espacios.</span></div>' +
          '<div><strong>Pantalla en blanco</strong><span>Refresca, abre incógnito y toma captura si persiste.</span></div>' +
          '<div><strong>Datos incorrectos</strong><span>No corrijas al azar; avisa a supervisión o gerencia.</span></div>' +
        '</div></section>' +
      '</section>';
  }

  window.ROUTER.register('sop', { render: render });
})();
