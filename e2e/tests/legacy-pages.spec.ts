import { test, expect } from '@playwright/test';

/** Alternate / mock HTML entry points shipped in the repo. */
const LEGACY_PAGES = [
  'aproviva-portal.html',
  'aproviva-proveedores.html',
  'mock-finanzas-dashboard.html',
] as const;

test.describe('Legacy / alternate HTML pages', () => {
  for (const name of LEGACY_PAGES) {
    test(`${name} loads`, async ({ page }) => {
      await page.goto(`/${name}`);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
