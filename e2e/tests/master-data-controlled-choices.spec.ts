import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

test.describe('Wave 2 master data controlled choices', () => {
  test('maestros location area uses the shared site-place catalog', async ({ page }) => {
    await loginWithPin(page, 'GER26');
    await page.goto('/aproviva-suite/index.html#/maestros');
    await page.getByTestId('maestros-page').waitFor({ state: 'visible', timeout: 30_000 });

    await page.getByRole('button', { name: '+ Ubicación' }).click();
    const form = page.locator('#m-loc-form');
    await expect(form.locator('select[name="area"]')).toBeVisible();
    await expect(form.locator('select[name="area"]')).toContainText('Garita');
    await expect(form.locator('input[name="area"]')).toHaveCount(0);
  });

  test('gemba execution and plan forms use controlled areas and frequencies', async ({ page }) => {
    await loginWithPin(page, 'SUP26');
    await page.goto('/aproviva-suite/index.html#/gemba');
    await page.getByTestId('gemba-page').waitFor({ state: 'visible', timeout: 30_000 });

    await page.getByRole('button', { name: 'Nuevo Plan Maestro' }).click();
    const template = page.getByTestId('gemba-templates-panel');
    await expect(template.locator('select[name="area"]')).toBeVisible();
    await expect(template.locator('select[name="area"]')).toContainText('Piscina');
    await expect(template.locator('select[name="round_type"]')).toContainText('Diario');

    await page.locator('#tpl-modal-close').click();
    await page.locator('#gemba-start-btn').click();
    const start = page.getByTestId('gemba-start-form');
    await expect(start.locator('select[name="area"]')).toBeVisible();
    await expect(start.locator('select[name="area"]')).toContainText('Garita');
    await expect(start.locator('select[name="round_type"]')).toContainText('Semanal');
  });

  test('incidencias and proyectos route with controlled location, area, assignee, and priority fields', async ({ page }) => {
    await loginWithPin(page, 'GER26');

    await page.goto('/aproviva-suite/index.html#/incidencias');
    await page.getByTestId('incidencias-page').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('#inc-new').click();
    const incident = page.getByTestId('inc-new-form');
    await expect(incident.locator('select[name="location"]')).toBeVisible();
    await expect(incident.locator('select[name="location"]')).toContainText('Garita');
    await expect(incident.locator('select[name="severity"]')).toContainText('Crítica');

    await page.goto('/aproviva-suite/index.html#/proyectos');
    await page.getByTestId('proyectos-page').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByTestId('proj-new-order').click();
    const workOrder = page.getByTestId('proj-new-form');
    await expect(workOrder.locator('select[name="area"]')).toBeVisible();
    await expect(workOrder.locator('select[name="area"]')).toContainText('Piscina');
    await expect(workOrder.locator('select[name="assignee_name"]')).toContainText('Supervision operativa');
    await expect(workOrder.locator('select[name="priority"]')).toContainText('Normal');
  });
});
