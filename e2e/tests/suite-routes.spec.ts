import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

const JUNTA_ROUTES = ['inicio', 'proyectos', 'reportes', 'junta'] as const;

const JUNTA_DENIED = ['inventario', 'gemba', 'mapa', 'incidencias', 'maestros'] as const;

test.describe('APROVIVA suite (PIN JD26 — Junta)', () => {
  test('allowed module routes render without 404 or access denied', async ({ page }) => {
    await loginWithPin(page, 'JD26');

    for (const name of JUNTA_ROUTES) {
      await page.goto(`/aproviva-suite/index.html#/${name}`);
      await page.locator('#app-content').waitFor({ state: 'visible' });
      await expect(page.locator('#app-content')).not.toContainText('Página no encontrada');
      await expect(page.locator('#app-content')).not.toContainText('Acceso restringido');
    }
  });

  test('operational routes show access denied', async ({ page }) => {
    await loginWithPin(page, 'JD26');

    for (const name of JUNTA_DENIED) {
      await page.goto(`/aproviva-suite/index.html#/${name}`);
      await expect(page.locator('#app-content')).toContainText('Acceso restringido');
    }
  });

  test('proyectos shows board backlog/capital sections, not CSV import toolbar', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/proyectos');
    await expect(page.getByTestId('proj-backlog-form')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#app-content')).toContainText('Proyectos capitales');
    await expect(page.locator('#app-content')).toContainText('Backlog operativo');
    await expect(page.locator('#proj-csv-template')).toHaveCount(0);
    await expect(page.locator('#proj-csv-upload')).toHaveCount(0);
  });

  test('nav links exclude inventario and mapa', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    const nav = page.locator('#app-nav');
    // Hash links + scroll: bottom tab bar on narrow viewports can keep items off-screen until brought into view.
    const proy = nav.locator('a[href="#/proyectos"]');
    const rep = nav.locator('a[href="#/reportes"]');
    const jta = nav.locator('a[href="#/junta"]');
    for (const link of [proy, rep, jta]) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
    }
    await expect(nav.getByRole('link', { name: 'Inventario' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Mapa' })).toHaveCount(0);
  });

  test('junta KPIs drill down to supporting detail', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/junta');
    await page.getByTestId('junta-page').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByRole('button', { name: /Escalaciones abiertas/i }).click();
    await expect(page.getByTestId('junta-kpi-detail')).toBeVisible();
    await expect(page.getByTestId('junta-kpi-detail')).toContainText('Detalle: Escalaciones abiertas');
  });

  test('reportes builds a board packet print surface', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/reportes');
    await page.getByTestId('reportes-page').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByRole('button', { name: 'Paquete Junta' }).click();
    await expect(page.getByTestId('board-packet')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('board-packet')).toContainText('Paquete ejecutivo para Junta');
    await expect(page.getByTestId('board-packet')).toContainText('Decisiones requeridas');
    await expect(page.getByTestId('board-packet')).toContainText('Scorecard de gobernanza');
    await expect(page.getByTestId('board-packet')).toContainText('No incluye datos personales');
  });


  test('logout returns to login', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    await page.locator('#app-logout').click();
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByTestId('suite-login-screen')).toBeVisible();
    await expect(page.locator('#pin-input')).toBeVisible();
  });
});

test.describe('APROVIVA suite (PIN GER26 — Gerencia)', () => {
  test('proyectos shows CSV template and import', async ({ page }) => {
    await loginWithPin(page, 'GER26');
    await page.goto('/aproviva-suite/index.html#/proyectos');
    await expect(page.locator('#proj-csv-template')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#proj-csv-upload')).toBeVisible({ timeout: 20_000 });
  });

  test('home KPIs drill down to supporting detail', async ({ page }) => {
    await loginWithPin(page, 'GER26');
    await page.goto('/aproviva-suite/index.html#/inicio');
    await page.getByRole('button', { name: /Incidencias abiertas/i }).click();
    await expect(page.getByTestId('home-kpi-detail')).toBeVisible();
    await expect(page.getByTestId('home-kpi-detail')).toContainText('Detalle: Incidencias abiertas');
  });

  test('gemba is oversight only for Plan Maestro creation', async ({ page }) => {
    await loginWithPin(page, 'GER26');
    await page.goto('/aproviva-suite/index.html#/gemba');
    await page.getByTestId('gemba-page').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Nuevo Plan Maestro' })).toHaveCount(0);
  });
});

test.describe('APROVIVA suite (PIN SUP26 — Supervisor)', () => {
  test('can open inventario and reportes; maestros and junta restricted', async ({ page }) => {
    await loginWithPin(page, 'SUP26');
    await page.goto('/aproviva-suite/index.html#/inventario');
    await expect(page.locator('#app-content')).not.toContainText('Acceso restringido');
    await page.goto('/aproviva-suite/index.html#/reportes');
    await expect(page.locator('#app-content')).not.toContainText('Acceso restringido');
    await page.goto('/aproviva-suite/index.html#/maestros');
    await expect(page.locator('#app-content')).toContainText('Acceso restringido');
    await page.goto('/aproviva-suite/index.html#/junta');
    await expect(page.locator('#app-content')).toContainText('Acceso restringido');
  });

  test('supervisor owns Plan Maestro setup', async ({ page }) => {
    await loginWithPin(page, 'SUP26');
    await page.goto('/aproviva-suite/index.html#/gemba');
    await page.getByTestId('gemba-page').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Nuevo Plan Maestro' })).toBeVisible();
  });
});

test.describe('APROVIVA suite (PIN 2026 — Conserjería)', () => {
  test('restricted governance and coordination sections', async ({ page }) => {
    await loginWithPin(page, '2026');

    for (const name of ['proyectos', 'maestros', 'reportes', 'junta'] as const) {
      await page.goto(`/aproviva-suite/index.html#/${name}`);
      await expect(page.locator('#app-content')).toContainText('Acceso restringido');
    }
  });

  test('can open inventario', async ({ page }) => {
    await loginWithPin(page, '2026');
    await page.goto('/aproviva-suite/index.html#/inventario');
    await expect(page.locator('#app-content')).not.toContainText('Acceso restringido');
    await expect(page.locator('#app-content')).not.toContainText('Página no encontrada');
  });
});

test.describe('Suite auth gate', () => {
  test('unauthenticated user is sent to login', async ({ page }) => {
    await page.goto('/aproviva-suite/index.html#/login');
    await page.evaluate(() => sessionStorage.removeItem('aproviva_session_v1'));
    await page.goto('/aproviva-suite/index.html#/inventario');
    await expect(page).toHaveURL(/#\/login/);
  });
});


test.describe('APROVIVA suite vision guardrails', () => {
  test('supervisor sees Proyectos in nav while conserjeria does not', async ({ browser }) => {
    const sup = await browser.newContext();
    const cons = await browser.newContext();
    const supPage = await sup.newPage();
    const consPage = await cons.newPage();

    await loginWithPin(supPage, 'SUP26');
    await loginWithPin(consPage, '2026');

    await expect(supPage.locator('#app-nav a[href="#/proyectos"]')).toBeVisible();
    await expect(consPage.locator('#app-nav a[href="#/proyectos"]')).toHaveCount(0);

    await sup.close();
    await cons.close();
  });


  test('mobile inicio avoids duplicate module grid and product trust copy', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithPin(page, '2026');
    await page.goto('/aproviva-suite/index.html#/inicio');

    await expect(page.getByTestId('villa-lens-card')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('home-modules')).toBeHidden();
    await expect(page.locator('#app-content')).not.toContainText('Límite de confianza');

    const order = await page.evaluate(() => {
      const install = document.querySelector('#install-section');
      const lens = document.querySelector('[data-testid="villa-lens-card"]');
      if (!install || !lens) return null;
      return Boolean(install.compareDocumentPosition(lens) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test('mapa only allows route points inside Villa Valencia boundary', async ({ page }) => {
    await loginWithPin(page, 'SUP26');
    await page.goto('/aproviva-suite/index.html#/mapa');

    await expect(page.getByTestId('mapa-page')).toBeVisible({ timeout: 30_000 });
    const routeBtn = page.getByRole('button', { name: 'Punto de ruta' });
    await expect(routeBtn).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => !!(window as any).__vvLeafletMap && !!(window as any).L);
    await page.waitForFunction(() => {
      const btn = document.querySelector('#mapa-mode-btn') as HTMLButtonElement | null;
      return !!btn && !btn.disabled;
    });

    await routeBtn.click();
    await expect(page.locator('#mapa-mode-btn')).toContainText('Cancelar punto de ruta');

    await page.evaluate(() => {
      const map = (window as any).__vvLeafletMap;
      const L = (window as any).L;
      map.fire('click', { latlng: L.latLng(9.0318, -79.4223) });
    });

    await expect(page.locator('#mapa-new-save')).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => {
      const map = (window as any).__vvLeafletMap;
      map.closePopup();
    });

    await page.evaluate(() => {
      const map = (window as any).__vvLeafletMap;
      const L = (window as any).L;
      map.fire('click', { latlng: L.latLng(9.0345, -79.425) });
    });

    await expect(page.locator('#toast')).toContainText(/Marca solo dentro del l.mite de Villa Valencia\./);
    await expect(page.locator('#mapa-new-save')).toHaveCount(0);
  });
});


