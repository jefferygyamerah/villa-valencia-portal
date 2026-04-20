import { test, expect } from '@playwright/test';

test.describe('Portal residentes (index.html)', () => {
  test('loads hero, accesos, PQRS panel and finanzas section', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/APROVIVA/);
    await expect(page.getByRole('heading', { name: /Bienvenido a Villa Valencia/i })).toBeVisible();
    await expect(page.locator('#accesos')).toBeVisible();
    await expect(page.locator('#pqrs')).toBeVisible();
    await expect(page.locator('#finanzas')).toBeVisible();
  });

  test('opens PQRS modal from Radicar button', async ({ page }) => {
    await page.goto('/index.html');
    await page.locator('[data-action="open-pqrs"]').click();
    await expect(page.locator('#pqrsModal')).toBeVisible();
    await expect(page.locator('#pqrs-resumen')).toBeVisible();
  });

  test('nav anchor to accesos scrolls / section exists', async ({ page }) => {
    await page.goto('/index.html#accesos');
    await expect(page.locator('#accesos')).toBeVisible();
  });

  test('link to proveedores page works', async ({ page }) => {
    await page.goto('/index.html');
    const prov = page.locator('a[href="proveedores.html"]');
    await expect(prov.first()).toBeVisible();
  });

  test('link to suite map embed (PQRS reference) works', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('a[href="aproviva-suite/mapa-pqrs.html"]').first()).toBeVisible();
  });
});
