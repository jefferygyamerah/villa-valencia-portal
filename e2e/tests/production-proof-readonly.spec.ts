import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

test.describe('Villa Valencia production proof pack (read-only)', () => {
  test('public resident path exposes premium PQRS trust and map context', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.getByRole('heading', { name: /Bienvenido a Villa Valencia/i })).toBeVisible();
    await expect(page.getByTestId('portal-role-path-strip')).toContainText(/Residentes/i);
    await expect(page.getByTestId('portal-pqrs-journey')).toContainText(/Seguimiento/i);
    await expect(page.getByTestId('portal-pqrs-privacy-note')).toContainText(/Privacidad/i);
    await page.getByRole('button', { name: /Radicar PQRS/i }).click();
    await expect(page.getByTestId('portal-pqrs-modal')).toBeVisible();
    await expect(page.getByTestId('portal-pqrs-modal-privacy-note')).toContainText(/evidencia operativa/i);
  });

  test('standalone PQRS map is read-only and loads reference map', async ({ page }) => {
    await page.goto('/aproviva-suite/mapa-pqrs.html');
    await expect(page.getByTestId('mapa-pqrs-summary')).toContainText(/Referencia para PQRS/i);
    await expect(page.getByTestId('mapa-pqrs-readonly-badge')).toContainText(/Solo lectura/i);
    await expect(page.getByTestId('mapa-pqrs-legend')).toContainText(/Ruta de recorrido/i);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  });

  test('suite login is demo-safe and governance surfaces render without writes', async ({ page }) => {
    await page.goto('/aproviva-suite/index.html#/login');
    await expect(page.getByTestId('suite-login-security-note')).toContainText(/Acceso privado/i);
    await expect(page.getByTestId('suite-demo-access')).toContainText(/Modo demo \/ QA/i);

    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/junta');
    await expect(page.getByTestId('junta-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('junta-scorecard')).toBeVisible({ timeout: 30_000 });

    await page.goto('/aproviva-suite/index.html#/reportes');
    await expect(page.getByTestId('reportes-premium-hero')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Paquete Junta', exact: true }).click();
    await expect(page.getByTestId('board-packet')).toContainText(/Paquete ejecutivo para Junta/i);
    await expect(page.getByTestId('board-packet')).toContainText(/No incluye datos personales/i);
  });

  test('field modules render premium shell without triggering write actions', async ({ page }) => {
    await loginWithPin(page, 'SUP26');

    await page.goto('/aproviva-suite/index.html#/inventario');
    await expect(page.getByTestId('inventario-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('inv-privacy-note')).toContainText(/insumos operativos/i);

    await page.goto('/aproviva-suite/index.html#/gemba');
    await expect(page.getByTestId('gemba-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('gemba-privacy-note')).toContainText(/Evidencia operativa/i);

    await page.goto('/aproviva-suite/index.html#/mapa');
    await expect(page.getByTestId('mapa-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mapa-privacy-note')).toContainText(/Mapa seguro/i);

    await page.goto('/aproviva-suite/index.html#/incidencias');
    await expect(page.getByTestId('inc-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('inc-privacy-note')).toContainText(/Evidencia segura/i);
  });
});
