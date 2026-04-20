import { test, expect } from '@playwright/test';

test.describe('Mapa PQRS (standalone)', () => {
  test('loads page and map root', async ({ page }) => {
    await page.goto('/aproviva-suite/mapa-pqrs.html');
    await expect(page).toHaveTitle(/Villa Valencia|mapa|PQRS/i);
    // Leaflet creates .leaflet-container when initialized
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  });
});
