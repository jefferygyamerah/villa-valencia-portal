import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

const JUNTA_ROUTES = [
  'inicio',
  'inventario',
  'gemba',
  'mapa',
  'incidencias',
  'proyectos',
  'maestros',
  'reportes',
  'junta',
] as const;

test.describe('APROVIVA suite (PIN JD26)', () => {
  test('every junta module route renders without 404 or access denied', async ({ page }) => {
    await loginWithPin(page, 'JD26');

    for (const name of JUNTA_ROUTES) {
      await page.goto(`/aproviva-suite/index.html#/${name}`);
      await page.locator('#app-content').waitFor({ state: 'visible' });
      await expect(page.locator('#app-content')).not.toContainText('Página no encontrada');
      await expect(page.locator('#app-content')).not.toContainText('Acceso restringido');
    }
  });

  test('proyectos shows CSV template and import controls', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/proyectos');
    await expect(page.locator('#proj-csv-template')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#proj-csv-upload')).toBeVisible({ timeout: 20_000 });
  });

  test('nav links are present and navigable', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    const nav = page.locator('#app-nav');
    await expect(nav.getByRole('link', { name: 'Proyectos' })).toBeVisible();
    await nav.getByRole('link', { name: 'Mapa' }).click();
    await expect(page).toHaveURL(/#\/mapa/);
    await expect(page.locator('#app-content')).not.toContainText('Página no encontrada');
  });

  test('logout returns to login', async ({ page }) => {
    await loginWithPin(page, 'JD26');
    await page.locator('#app-logout').click();
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.locator('#pin-input')).toBeVisible();
  });
});

test.describe('APROVIVA suite (PIN 2026 staff)', () => {
  test('restricted sections show access message', async ({ page }) => {
    await loginWithPin(page, '2026');

    for (const name of ['proyectos', 'maestros', 'reportes', 'junta'] as const) {
      await page.goto(`/aproviva-suite/index.html#/${name}`);
      await expect(page.locator('#app-content')).toContainText('Acceso restringido');
    }
  });

  test('staff can open inventario', async ({ page }) => {
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
