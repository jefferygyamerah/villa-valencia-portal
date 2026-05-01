import { test, expect } from '@playwright/test';

test.describe('Mapa PQRS (standalone)', () => {
  test('loads page and map root', async ({ page }) => {
    await page.goto('/aproviva-suite/mapa-pqrs.html');
    await expect(page).toHaveTitle(/Villa Valencia|mapa|PQRS/i);
    await expect(page.getByTestId('mapa-pqrs-summary')).toContainText(/Referencia para PQRS/i);
    await expect(page.getByTestId('mapa-pqrs-readonly-badge')).toContainText(/Solo lectura/i);
    await expect(page.getByTestId('mapa-pqrs-legend')).toContainText(/Ruta de recorrido/i);
    // Leaflet creates .leaflet-container when initialized
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  });
});
