import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

/**
 * Inventory module checks aligned with docs/suite-checks/19-apics-verification-checklist.md
 * (subset automated; full 19-point matrix includes other modules).
 */
test.describe('Inventario — APICS-style UI', () => {
  test.describe.configure({ timeout: 90_000 });
  test.beforeEach(async ({ page }) => {
    await loginWithPin(page, '2026');
    await page.goto('/aproviva-suite/index.html#/inventario');
    await page.locator('[data-testid="inventario-page"]').waitFor({ state: 'visible', timeout: 25_000 });
  });

  test('page shell and help panel present', async ({ page }) => {
    await expect(page.getByTestId('inventario-page')).toBeVisible();
    const help = page.getByTestId('inv-apics-help');
    await expect(help).toBeVisible();
    await help.locator('summary').click();
    await expect(help.locator('.inv-apics-body')).toContainText('varianza');
  });

  test('KPI grid loads', async ({ page }) => {
    const kpis = page.locator('#inv-kpis');
    await expect(kpis).not.toContainText('Cargando KPIs', { timeout: 25_000 });
    await expect(kpis).toBeVisible();
  });

  test('catalog shows vs reorden column when data loads', async ({ page }) => {
    // Catalog and movements can each render a .data-table; scope to the stock grid.
    await expect(page.locator('#inv-catalog .data-table thead')).toContainText('vs reorden', { timeout: 25_000 });
  });

  test('open count modal and cancel', async ({ page }) => {
    await page.getByRole('button', { name: 'Registrar conteo' }).click();
    await expect(page.getByTestId('inv-count-form-inner')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('inv-count-form-inner')).toHaveCount(0);
  });

  test('open issue modal (staff quick path)', async ({ page }) => {
    await page.getByRole('button', { name: 'Reportar novedad' }).click();
    await expect(page.getByTestId('inv-issue-form')).toBeVisible();
    await expect(page.locator('#issue-form[data-staff="1"]')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });
});

test.describe('Inventario — gerencia full issue form', () => {
  test.describe.configure({ timeout: 90_000 });
  test('non-staff sees free-text issue form', async ({ page }) => {
    await loginWithPin(page, 'GER26');
    await page.goto('/aproviva-suite/index.html#/inventario');
    await page.locator('[data-testid="inventario-page"]').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('button', { name: 'Reportar novedad' }).click();
    await expect(page.getByTestId('inv-issue-form')).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
  });
});
