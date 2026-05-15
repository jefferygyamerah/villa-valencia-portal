/*
 * APROVIVA resident financial dashboard
 *
 * This file is intentionally read-only: it consumes a validated JSON snapshot
 * and replaces the legacy budget panel with a plain-language resident view.
 */
(function () {
  'use strict';

  var config = window.APROVIVA_CONFIG || {};
  var SNAPSHOT_URL = config.FINANCIAL_SNAPSHOT_URL || 'data/financial-report-snapshot.json';
  var FINANCE_DRIVE_URL = config.DRIVE_LINKS && config.DRIVE_LINKS.finanzas
    ? config.DRIVE_LINKS.finanzas
    : 'https://drive.google.com/drive/folders/1-gF8X8k4hIpcgZ4KhxvpxsPmclyRX8-3';

  function getEl(id) {
    return document.getElementById(id);
  }

  function initFinanceDashboard() {
    injectFinanceStyles();
    rewriteFinanceSectionCopy();

    var root = getEl('budget-dashboard');
    if (!root) return;

    root.className = 'financial-dashboard';
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="dash-loading" id="financialLoading">Último reporte validado: cargando...</div>' +
      '<div id="financialContent" style="display:none;"></div>' +
      '<div class="dash-error" id="financialError" style="display:none;">' +
        '<div>No pudimos cargar el último reporte financiero validado. Intenta otra vez en unos segundos.</div>' +
        '<div class="dash-error-actions"><button class="dash-retry-btn" type="button" onclick="window._retryFinancialReport()">Reintentar</button></div>' +
      '</div>' +
      '<a class="view-all" href="' + escapeAttr(FINANCE_DRIVE_URL) + '" target="_blank" rel="noopener" style="margin-top:1rem;">Ver informes fuente en Drive →</a>';

    loadFinancialReport();
  }

  function rewriteFinanceSectionCopy() {
    var title = getEl('finanzas');
    if (title) title.innerHTML = '💰 Finanzas APROVIVA';

    var helper = title && title.nextElementSibling && title.nextElementSibling.classList.contains('section-helper')
      ? title.nextElementSibling
      : null;
    if (helper) {
      helper.textContent = 'Resumen financiero para residentes, basado en el informe mensual validado. Muestra saldos agregados y evita publicar casas, nombres o movimientos bancarios individuales.';
    }
  }

  function loadFinancialReport() {
    var loading = getEl('financialLoading');
    var content = getEl('financialContent');
    var error = getEl('financialError');
    if (!loading || !content || !error) return;

    loading.style.display = '';
    content.style.display = 'none';
    content.innerHTML = '';
    error.style.display = 'none';

    fetch(SNAPSHOT_URL, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('snapshot unavailable');
        return response.json();
      })
      .then(function (snapshot) {
        var validation = validateFinancialSnapshot(snapshot);
        if (!validation.ok) throw new Error(validation.message);
        loading.style.display = 'none';
        error.style.display = 'none';
        content.style.display = '';
        renderFinancialReport(snapshot, content);
      })
      .catch(function () {
        loading.style.display = 'none';
        content.style.display = 'none';
        error.style.display = 'block';
        error.innerHTML = '<div>No pudimos cargar el último reporte financiero validado. La publicación se bloquea si los totales no concilian.</div>' +
          '<div class="dash-error-actions"><button class="dash-retry-btn" type="button" onclick="window._retryFinancialReport()">Reintentar</button></div>';
      });
  }

  function validateFinancialSnapshot(snapshot) {
    if (!snapshot || !snapshot.cash || !snapshot.liquidity || !snapshot.incomeExpense || !snapshot.receivables) {
      return { ok: false, message: 'snapshot incompleto' };
    }

    var cashExpected = snapshot.liquidity.openingBankBalance +
      snapshot.liquidity.collections - snapshot.liquidity.payments;
    if (!withinMoney(cashExpected, snapshot.liquidity.endingBankBalance)) {
      return { ok: false, message: 'movimiento de efectivo no concilia' };
    }

    var cats = snapshot.receivables.categories || [];
    var grossReceivables = cats.reduce(function (sum, item) {
      return sum + (item.total || 0);
    }, 0);
    var netReceivables = grossReceivables -
      (snapshot.receivables.ownerCredits || 0) +
      (snapshot.receivables.otherReceivables || 0);
    if (!withinMoney(netReceivables, snapshot.receivables.netTotal)) {
      return { ok: false, message: 'cuentas por cobrar no concilian' };
    }

    var resultExpected = snapshot.incomeExpense.incomeYtd -
      snapshot.incomeExpense.operatingExpensesYtd -
      snapshot.incomeExpense.projectsYtd;
    if (!withinMoney(resultExpected, snapshot.incomeExpense.netResultYtd)) {
      return { ok: false, message: 'resultado acumulado no concilia' };
    }

    if (!withinMoney(snapshot.reconciliation && snapshot.reconciliation.difference, 0)) {
      return { ok: false, message: 'conciliación bancaria pendiente' };
    }

    return { ok: true };
  }

  function renderFinancialReport(snapshot, container) {
    var receivables = snapshot.receivables || {};
    var cash = snapshot.cash || {};
    var liquidity = snapshot.liquidity || {};
    var incomeExpense = snapshot.incomeExpense || {};
    var budget = snapshot.budgetExecution || {};
    var projects = snapshot.projects || {};
    var payables = snapshot.payables || {};
    var over90Share = receivables.grossMainTotal > 0
      ? receivables.over90MainTotal / receivables.grossMainTotal
      : 0;

    container.innerHTML =
      '<div class="financial-hero">' +
        '<div>' +
          '<div class="financial-eyebrow">Último reporte validado</div>' +
          '<h3>' + esc(snapshot.reportMonth || 'Informe financiero') + '</h3>' +
          '<p>' + esc(snapshot.summary || '') + '</p>' +
        '</div>' +
        '<div class="financial-hero-status ' + (cash.reconciliationDifference === 0 ? 'is-ok' : 'is-watch') + '">' +
          '<span>¿Está conciliado?</span>' +
          '<strong>' + (cash.reconciliationDifference === 0 ? 'Sí' : 'Revisar') + '</strong>' +
          '<small>Diferencia: ' + fmtMoney(cash.reconciliationDifference || 0) + '</small>' +
        '</div>' +
      '</div>' +
      '<div class="financial-kpis">' +
        financialKpi('Dinero disponible', fmtMoney(cash.bookAvailable), 'Banco: ' + fmtMoney(cash.bankStatementBalance), 'blue') +
        financialKpi('Pagos recibidos', fmtMoney(liquidity.collections), 'Cobros del mes', 'green') +
        financialKpi('Gastos pagados', fmtMoney(liquidity.payments), 'Salidas del mes', 'orange') +
        financialKpi('Resultado acumulado', fmtMoney(incomeExpense.netResultYtd), 'Ingresos menos gastos y proyectos', incomeExpense.netResultYtd >= 0 ? 'green' : 'red') +
        financialKpi('Deudas pendientes', fmtMoney(receivables.netTotal), fmtMoney(receivables.over90MainTotal) + ' con más de 90 días', 'red') +
        financialKpi('Proyectos', fmtPct(projects.percentUsed), fmtMoney(projects.actualYtd) + ' usado de ' + fmtMoney(projects.annualBudget), 'orange') +
      '</div>' +
      '<div class="financial-grid">' +
        '<section class="financial-panel">' +
          '<div class="financial-panel-title">Semáforo financiero</div>' +
          '<div class="traffic-list">' +
            trafficItem('cash', 'Dinero disponible', 'Atención', 'La cuenta sigue con saldo alto, pero marzo redujo caja en ' + fmtMoney(Math.abs(liquidity.cashChange || 0)) + '.') +
            trafficItem('collections', 'Cobranza', 'Crítico', fmtPct(over90Share) + ' de las cuentas principales por cobrar está en más de 90 días.') +
            trafficItem('budget', 'Presupuesto', 'Atención', 'Gastos operativos en ' + fmtPct(budget.operatingExpenses && budget.operatingExpenses.percentUsed) + ' y proyectos en ' + fmtPct(budget.projects && budget.projects.percentUsed) + '.') +
            trafficItem('trust', 'Conciliación', 'Bien', 'La conciliación bancaria cierra con diferencia ' + fmtMoney(snapshot.reconciliation.difference || 0) + '.') +
          '</div>' +
        '</section>' +
        '<section class="financial-panel">' +
          '<div class="financial-panel-title">Presupuesto usado</div>' +
          renderBudgetMeters(budget) +
        '</section>' +
      '</div>' +
      '<section class="financial-panel">' +
        '<div class="financial-panel-title">Morosidad agregada</div>' +
        '<p class="financial-note">Vista para residentes: solo totales por categoría, sin casas ni nombres.</p>' +
        renderAgingBars(receivables.categories || []) +
        renderReceivableCards(receivables.categories || []) +
      '</section>' +
      '<div class="financial-grid">' +
        '<section class="financial-panel">' +
          '<div class="financial-panel-title">Proyectos</div>' +
          renderProjects(projects.items || []) +
        '</section>' +
        '<section class="financial-panel">' +
          '<div class="financial-panel-title">Tendencia 2026</div>' +
          renderFinancialTrend(snapshot.history || []) +
        '</section>' +
      '</div>' +
      '<section class="financial-panel financial-trust">' +
        '<div class="financial-panel-title">Confianza del reporte</div>' +
        '<div class="trust-grid">' +
          trustFact('Fuente', '<a href="' + escapeAttr(snapshot.sourceDriveFileUrl || '#') + '" target="_blank" rel="noopener">' + esc(snapshot.sourceDriveFileName || 'Workbook') + '</a>') +
          trustFact('PDF publicado', '<a href="' + escapeAttr(snapshot.sourcePdfFileUrl || '#') + '" target="_blank" rel="noopener">' + esc(snapshot.sourcePdfFileName || 'PDF') + '</a>') +
          trustFact('Cuentas por pagar', fmtMoney(payables.providerPayables), 'Proveedores pendientes') +
          trustFact('Validación', renderValidationChecks(snapshot.validations || [])) +
        '</div>' +
        '<p class="financial-note">' + esc((snapshot.reconciliation && snapshot.reconciliation.assuranceNote) || '') + '</p>' +
      '</section>';
  }

  function financialKpi(label, value, sub, tone) {
    return '<div class="financial-kpi financial-kpi--' + tone + '">' +
      '<span>' + esc(label) + '</span>' +
      '<strong>' + esc(value) + '</strong>' +
      '<small>' + esc(sub || '') + '</small>' +
      '</div>';
  }

  function trafficItem(kind, label, status, body) {
    var tone = kind === 'trust' ? 'green' : kind === 'collections' ? 'red' : 'orange';
    return '<div class="traffic-item traffic-item--' + tone + '">' +
      '<div><strong>' + esc(label) + '</strong><span>' + esc(body) + '</span></div>' +
      '<em>' + esc(status) + '</em>' +
      '</div>';
  }

  function renderBudgetMeters(budget) {
    return [
      budgetMeter('Ingresos', budget.income),
      budgetMeter('Gastos operativos', budget.operatingExpenses),
      budgetMeter('Proyectos', budget.projects)
    ].join('');
  }

  function budgetMeter(label, item) {
    item = item || {};
    var pct = Math.max(0, Math.min((item.percentUsed || 0) * 100, 100));
    return '<div class="finance-meter">' +
      '<div class="finance-meter-head"><strong>' + esc(label) + '</strong><span>' + fmtPct(item.percentUsed) + '</span></div>' +
      '<div class="finance-meter-track"><div class="finance-meter-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<small>' + fmtMoney(item.actualYtd || 0) + ' usado · queda ' + fmtMoney(item.remaining || 0) + '</small>' +
      '</div>';
  }

  function renderAgingBars(categories) {
    var buckets = [
      { key: '0-30', label: '0-30 días' },
      { key: '31-60', label: '31-60 días' },
      { key: '61-90', label: '61-90 días' },
      { key: 'over90', label: '+90 días' }
    ];
    var totals = {};
    var total = 0;
    for (var i = 0; i < buckets.length; i++) totals[buckets[i].key] = 0;
    categories.forEach(function (cat) {
      buckets.forEach(function (bucket) {
        var value = (cat.aging && cat.aging[bucket.key]) || 0;
        totals[bucket.key] += value;
        total += value;
      });
    });
    return '<div class="aging-bars">' + buckets.map(function (bucket) {
      var amount = totals[bucket.key] || 0;
      var pct = total > 0 ? (amount / total) * 100 : 0;
      return '<div class="aging-row">' +
        '<span>' + esc(bucket.label) + '</span>' +
        '<div class="aging-track"><div class="aging-fill" style="width:' + Math.max(2, pct).toFixed(1) + '%"></div></div>' +
        '<strong>' + fmtMoney(amount) + '</strong>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderReceivableCards(categories) {
    return '<div class="receivable-cards">' + categories.map(function (cat) {
      var over90 = cat.aging ? (cat.aging.over90 || 0) : 0;
      return '<div class="receivable-card">' +
        '<span>' + esc(cat.plainLabel || cat.label) + '</span>' +
        '<strong>' + fmtMoney(cat.total || 0) + '</strong>' +
        '<small>+90 días: ' + fmtMoney(over90) + '</small>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderProjects(items) {
    if (!items.length) {
      return '<p class="financial-note">No hay proyectos reportados para este período.</p>';
    }
    return items.map(function (item) {
      var pct = Math.max(0, Math.min((item.percentUsed || 0) * 100, 100));
      var tone = item.status === 'over' ? 'is-over' : 'is-watch';
      var status = item.status === 'over' ? 'Sobre presupuesto' : 'En seguimiento';
      return '<div class="project-card ' + tone + '">' +
        '<div class="project-head"><strong>' + esc(item.name) + '</strong><span>' + status + '</span></div>' +
        '<div class="finance-meter-track"><div class="finance-meter-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<small>' + fmtMoney(item.actualYtd || 0) + ' usado de ' + fmtMoney(item.budget || 0) + ' · saldo ' + fmtMoney(item.remaining || 0) + '</small>' +
      '</div>';
    }).join('');
  }

  function renderFinancialTrend(history) {
    if (!history.length) return '<p class="financial-note">Sin historial publicado.</p>';
    var maxCash = history.reduce(function (max, item) {
      return Math.max(max, item.bankEnding || 0);
    }, 1);
    return '<div class="finance-trend">' + history.map(function (item) {
      var height = Math.max(14, ((item.bankEnding || 0) / maxCash) * 130);
      return '<div class="finance-trend-col">' +
        '<div class="finance-trend-bar" style="height:' + height.toFixed(0) + 'px"></div>' +
        '<strong>' + esc(item.month) + '</strong>' +
        '<span>' + fmtMoney(item.bankEnding || 0) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function trustFact(label, value, sub) {
    return '<div class="trust-fact"><span>' + esc(label) + '</span><strong>' + value + '</strong>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
  }

  function renderValidationChecks(validations) {
    return '<ul class="validation-list">' + validations.map(function (item) {
      return '<li class="' + (item.passed ? 'passed' : 'failed') + '">' + esc(item.label) + '</li>';
    }).join('') + '</ul>';
  }

  function fmtMoney(value) {
    var n = Number(value || 0);
    var sign = n < 0 ? '-' : '';
    return sign + 'B/. ' + Math.abs(n).toLocaleString('es-PA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function fmtPct(value) {
    var n = Number(value || 0) * 100;
    return n.toLocaleString('es-PA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + '%';
  }

  function withinMoney(a, b) {
    return Math.abs(Number(a || 0) - Number(b || 0)) < 0.02;
  }

  function esc(value) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(value || '')));
    return div.innerHTML;
  }

  function escapeAttr(value) {
    return String(value || '').replace(/"/g, '&quot;');
  }

  function injectFinanceStyles() {
    if (document.getElementById('resident-finance-styles')) return;
    var style = document.createElement('style');
    style.id = 'resident-finance-styles';
    style.textContent = [
      '.financial-dashboard{background:var(--white);border-radius:12px;padding:1.5rem;margin-bottom:2.5rem;box-shadow:0 1px 6px rgba(26,107,184,0.06)}',
      '.financial-hero{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:1rem;align-items:stretch;margin-bottom:1.25rem}',
      '.financial-eyebrow{color:var(--blue);font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.35rem}',
      '.financial-hero h3{font-family:\'Playfair Display\',serif;font-size:1.5rem;color:var(--blue-dark);margin-bottom:.35rem}',
      '.financial-hero p{color:var(--text-light);font-size:.88rem;line-height:1.6}',
      '.financial-hero-status{border-radius:10px;padding:1rem;display:flex;flex-direction:column;justify-content:center;border:1px solid var(--border);background:var(--gray)}',
      '.financial-hero-status.is-ok{background:var(--green-bg);border-color:rgba(22,163,74,.25)}',
      '.financial-hero-status.is-watch{background:#fff7ed;border-color:rgba(217,119,6,.25)}',
      '.financial-hero-status span,.financial-hero-status small{color:var(--text-light);font-size:.72rem}',
      '.financial-hero-status strong{color:var(--blue-dark);font-size:1.6rem;line-height:1.15;margin:.2rem 0}',
      '.financial-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9rem;margin-bottom:1.2rem}',
      '.financial-kpi{border-radius:10px;padding:1rem;background:var(--gray);border:1px solid transparent;min-width:0}',
      '.financial-kpi span,.financial-kpi small{display:block;color:var(--text-light);font-size:.7rem;line-height:1.4}',
      '.financial-kpi span{font-weight:800;letter-spacing:.04em;text-transform:uppercase}',
      '.financial-kpi strong{display:block;color:var(--blue-dark);font-size:1.35rem;line-height:1.2;margin:.25rem 0;overflow-wrap:anywhere}',
      '.financial-kpi--green strong{color:var(--green)}.financial-kpi--red strong{color:var(--red)}.financial-kpi--orange strong{color:#d97706}',
      '.financial-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}',
      '.financial-panel{background:var(--gray);border-radius:10px;padding:1.15rem;margin-bottom:1rem}',
      '.financial-panel-title{color:var(--text);font-size:.82rem;font-weight:800;letter-spacing:.05em;margin-bottom:.9rem;text-transform:uppercase}',
      '.financial-note{color:var(--text-light);font-size:.76rem;line-height:1.5;margin-bottom:.85rem}',
      '.traffic-list{display:grid;gap:.65rem}.traffic-item{display:flex;justify-content:space-between;gap:.8rem;padding:.8rem;border-radius:10px;background:var(--white);border-left:4px solid var(--blue)}',
      '.traffic-item strong,.traffic-item span{display:block}.traffic-item strong{font-size:.82rem;margin-bottom:.2rem}.traffic-item span{color:var(--text-light);font-size:.74rem;line-height:1.45}',
      '.traffic-item em{align-self:flex-start;border-radius:999px;font-size:.68rem;font-style:normal;font-weight:800;padding:.25rem .55rem;white-space:nowrap}',
      '.traffic-item--green{border-left-color:var(--green)}.traffic-item--green em{background:var(--green-bg);color:var(--green)}.traffic-item--orange{border-left-color:#d97706}.traffic-item--orange em{background:#fff7ed;color:#d97706}.traffic-item--red{border-left-color:var(--red)}.traffic-item--red em{background:var(--red-bg);color:var(--red)}',
      '.finance-meter{margin-bottom:.85rem}.finance-meter:last-child{margin-bottom:0}.finance-meter-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;font-size:.8rem;margin-bottom:.4rem}',
      '.finance-meter-head span,.finance-meter small,.project-card small{color:var(--text-light);font-size:.72rem}',
      '.finance-meter-track,.aging-track{height:10px;background:var(--white);border-radius:999px;overflow:hidden}.finance-meter-fill,.aging-fill{height:100%;background:var(--blue);border-radius:999px}',
      '.aging-bars{display:grid;gap:.65rem;margin-bottom:1rem}.aging-row{display:grid;grid-template-columns:88px minmax(0,1fr) 120px;gap:.7rem;align-items:center;font-size:.76rem}.aging-row span{color:var(--text-light)}.aging-row strong{text-align:right;font-size:.76rem}',
      '.receivable-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}.receivable-card{background:var(--white);border-radius:10px;padding:.85rem}.receivable-card span,.receivable-card small{color:var(--text-light);display:block;font-size:.7rem;line-height:1.35}.receivable-card strong{display:block;font-size:1rem;margin:.25rem 0;color:var(--blue-dark)}',
      '.project-card{background:var(--white);border-radius:10px;padding:.9rem;margin-bottom:.75rem}.project-card:last-child{margin-bottom:0}.project-card.is-over .finance-meter-fill{background:var(--red)}.project-card.is-watch .finance-meter-fill{background:#d97706}',
      '.project-head{display:flex;justify-content:space-between;gap:.75rem;margin-bottom:.5rem;font-size:.78rem}.project-head span{color:var(--text-light);font-size:.68rem;font-weight:800;text-transform:uppercase;white-space:nowrap}',
      '.finance-trend{display:flex;align-items:flex-end;gap:.75rem;min-height:180px;padding-top:.5rem}.finance-trend-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:.35rem;min-width:0}.finance-trend-bar{width:100%;max-width:62px;background:linear-gradient(180deg,var(--blue),var(--blue-dark));border-radius:8px 8px 3px 3px}.finance-trend-col strong,.finance-trend-col span{font-size:.68rem;text-align:center}.finance-trend-col span{color:var(--text-light)}',
      '.financial-trust{margin-bottom:0}.trust-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}.trust-fact{background:var(--white);border-radius:10px;padding:.9rem}.trust-fact span,.trust-fact small{color:var(--text-light);display:block;font-size:.7rem;line-height:1.35}.trust-fact strong{display:block;font-size:.82rem;line-height:1.35;margin-top:.25rem;overflow-wrap:anywhere}.trust-fact a{color:var(--blue)}',
      '.validation-list{list-style:none;padding:0;margin:.25rem 0 0}.validation-list li{color:var(--text-light);font-size:.7rem;line-height:1.35;margin-bottom:.25rem;padding-left:1rem;position:relative}.validation-list li:before{content:\'\';position:absolute;left:0;top:.42rem;width:6px;height:6px;border-radius:50%;background:var(--red)}.validation-list li.passed:before{background:var(--green)}',
      '@media (max-width:700px){.financial-hero,.financial-grid,.trust-grid,.receivable-cards{grid-template-columns:1fr}.financial-kpis{grid-template-columns:repeat(2,1fr)}.aging-row{grid-template-columns:1fr;gap:.3rem}.aging-row strong{text-align:left}}',
      '@media (max-width:640px){.financial-kpis{grid-template-columns:1fr}.financial-dashboard{padding:1rem;border-radius:14px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  window._retryFinancialReport = loadFinancialReport;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFinanceDashboard);
  } else {
    initFinanceDashboard();
  }
})();
