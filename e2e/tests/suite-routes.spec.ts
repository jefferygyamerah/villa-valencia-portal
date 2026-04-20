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

  test('proyectos shows backlog intake, not CSV import toolbar', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/proyectos');
    await expect(page.getByTestId('proj-backlog-form')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#proj-csv-template')).toHaveCount(0);
    await expect(page.locator('#proj-csv-upload')).toHaveCount(0);
  });

  test('nav links exclude inventario and mapa', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    const nav = page.locator('#app-nav');
    await expect(nav.getByRole('link', { name: 'Proyectos' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Reportes' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Gobernanza' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Inventario' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Mapa' })).toHaveCount(0);
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
