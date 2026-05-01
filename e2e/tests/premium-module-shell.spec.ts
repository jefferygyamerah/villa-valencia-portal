import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

test.describe('APROVIVA product-wide premium module shell', () => {
  test('field modules show premium hero and privacy/evidence notes', async ({ page }) => {
    await loginWithPin(page, 'SUP26');

    await page.goto('/aproviva-suite/index.html#/gemba');
    await expect(page.getByTestId('gemba-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('gemba-privacy-note')).toContainText(/Evidencia operativa/i);

    await page.goto('/aproviva-suite/index.html#/mapa');
    await expect(page.getByTestId('mapa-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mapa-privacy-note')).toContainText(/Mapa seguro/i);
    await expect(page.getByTestId('mapa-toolbar')).toBeVisible({ timeout: 30_000 });

    await page.goto('/aproviva-suite/index.html#/incidencias');
    await expect(page.getByTestId('inc-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('inc-privacy-note')).toContainText(/Evidencia segura/i);

    await page.goto('/aproviva-suite/index.html#/inventario');
    await expect(page.getByTestId('inventario-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('inv-privacy-note')).toContainText(/insumos operativos/i);
  });

  test('management modules show premium hero and privacy/source posture', async ({ page }) => {
    await loginWithPin(page, 'GER26');

    await page.goto('/aproviva-suite/index.html#/inicio');
    await expect(page.getByTestId('villa-lens-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-privacy-card')).toContainText(/protegidos|privacidad|sensibles/i);
    await expect(page.getByTestId('home-kpi-strip')).toBeVisible();

    await page.goto('/aproviva-suite/index.html#/proyectos');
    await expect(page.getByTestId('proyectos-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('proyectos-privacy-card')).toContainText(/Backlog seguro/i);

    await page.goto('/aproviva-suite/index.html#/maestros');
    await expect(page.getByTestId('maestros-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('maestros-privacy-card')).toContainText(/Higiene de datos/i);

    await page.goto('/aproviva-suite/index.html#/reportes');
    await expect(page.getByTestId('reportes-premium-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('reportes-premium-hero')).toContainText(/Preparar paquete Junta/i);
  });

  test('mobile premium shell avoids horizontal overflow on core modules', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithPin(page, 'SUP26');

    for (const route of ['inventario', 'gemba', 'incidencias', 'proyectos'] as const) {
      await page.goto(`/aproviva-suite/index.html#/${route}`);
      await page.locator('.module-premium-hero').first().waitFor({ state: 'visible', timeout: 30_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow, `${route} should not horizontally overflow`).toBe(false);
    }
  });
});
