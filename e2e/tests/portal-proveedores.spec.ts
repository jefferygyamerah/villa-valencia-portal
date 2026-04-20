import { test, expect } from '@playwright/test';

test.describe('Proveedores', () => {
  test('loads grid and category filters', async ({ page }) => {
    await page.goto('/proveedores.html');
    await expect(page.getByRole('heading', { name: /Proveedores de Confianza/i })).toBeVisible();
    await expect(page.locator('#providerGrid .provider-card')).toHaveCount(12);
    await expect(page.locator('#gridCount')).toContainText('12');
  });

  test('search input filters providers by name', async ({ page }) => {
    await page.goto('/proveedores.html');
    await page.locator('#searchInput').fill('Dario');
    await expect(page.locator('#providerGrid .provider-card')).toHaveCount(1);
    await expect(page.locator('#gridCount')).toContainText('1');
    await expect(page.locator('#providerGrid')).toContainText('Dario');
  });

  test('category filter reduces list', async ({ page }) => {
    await page.goto('/proveedores.html');
    await page.getByRole('button', { name: /Aires Acondicionados/i }).click();
    await expect(page.locator('#providerGrid .provider-card')).toHaveCount(2);
  });

  test('clearing search restores full grid in category', async ({ page }) => {
    await page.goto('/proveedores.html');
    await page.locator('#searchInput').fill('zzzznomatch');
    await expect(page.locator('#providerGrid .provider-card')).toHaveCount(0);
    await page.locator('#searchInput').fill('');
    await expect(page.locator('#providerGrid .provider-card')).toHaveCount(12);
  });
});
