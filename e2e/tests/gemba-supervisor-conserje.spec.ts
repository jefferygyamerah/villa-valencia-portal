import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

/**
 * Recorrido production flow: Plan Maestro -> Puntos de Inspección -> Ejecución -> Hallazgo.
 */
test.describe('Gemba — recorrido inspection-plan flow', () => {
  test('admin creates Plan Maestro with Puntos de Inspección', async ({ page }) => {
    await loginWithPin(page, 'GER26');
    await page.goto('/aproviva-suite/index.html#/gemba');
    await page.locator('[data-testid="gemba-page"]').waitFor({ state: 'visible', timeout: 30_000 });

    await expect(page.getByRole('heading', { name: 'Recorridos de inspección' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo Plan Maestro' }).click();
    const panel = page.locator('[data-testid="gemba-templates-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(panel).toContainText('Puntos de Inspección');

    const planName = `Plan Maestro E2E ${Date.now()}`;
    await panel.locator('input[name="name"]').fill(planName);
    await panel.locator('textarea[name="points_text"]').fill('Revisar garita\nVerificar iluminación de acceso');
    await panel.getByRole('button', { name: 'Guardar Plan Maestro' }).click();
    await expect(panel.locator('#tpl-list')).toContainText(planName, { timeout: 30_000 });
    await expect(panel.locator('#tpl-list')).toContainText('2 punto(s)', { timeout: 10_000 });
  });

  test('SUP26 starts execution; CONS26 sees plan points and completion gate', async ({ browser }) => {
    const sup = await browser.newContext();
    const cons = await browser.newContext();
    const supPage = await sup.newPage();
    const consPage = await cons.newPage();

    await loginWithPin(supPage, 'SUP26');
    await loginWithPin(consPage, '2026');

    await supPage.goto('/aproviva-suite/index.html#/gemba');
    await supPage.locator('[data-testid="gemba-page"]').waitFor({ state: 'visible', timeout: 30_000 });

    await supPage.locator('#gemba-start-btn').click();
    const form = supPage.locator('[data-testid="gemba-start-form"]');
    await form.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(form.locator('[data-testid="gemba-template-picker"]')).toContainText('Plan Maestro');

    const titleText =
      (await form.locator('select[name="title"] option:checked').first().textContent())?.trim() || '';
    expect(titleText.length).toBeGreaterThan(0);

    await form.locator('select[name="area"]').selectOption({ index: 0 });
    await form.locator('select[name="round_type"]').selectOption('ad_hoc');
    await form.getByRole('button', { name: 'Iniciar Ejecución' }).click();

    // Primary success signal: the active list updates (do not require #suite-modal-host empty; error path can leave form mounted).
    await expect(supPage.locator('#gemba-active')).not.toContainText('Sin recorridos abiertos', {
      timeout: 30_000,
    });
    await expect(supPage.locator('#gemba-active')).toContainText(titleText, { timeout: 15_000 });

    await consPage.goto('/aproviva-suite/index.html#/gemba');
    await consPage.locator('[data-testid="gemba-page"]').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(consPage.locator('#gemba-active')).not.toContainText('Sin recorridos abiertos', {
      timeout: 25_000,
    });
    await expect(consPage.locator('#gemba-active')).toContainText(titleText, { timeout: 15_000 });
    await expect(consPage.locator('#gemba-active')).toContainText(/0\/\d+/, { timeout: 10_000 });

    await consPage.locator('#gemba-active').getByRole('button', { name: 'Completar' }).first().click();
    await expect(consPage.locator('body')).toContainText('Completa todos los Puntos de Inspección requeridos', {
      timeout: 10_000,
    });

    await consPage.locator('#gemba-active').getByRole('button', { name: 'Ejecutar puntos' }).first().click();
    const exec = consPage.locator('[data-testid="gemba-execution-panel"]');
    await exec.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(exec.locator('[data-testid="gemba-plan-points"]')).toContainText('Pendiente');
    await exec.getByRole('button', { name: 'OK' }).first().click();
    await expect(exec.locator('[data-testid="gemba-plan-points"]')).toContainText('OK', { timeout: 15_000 });

    await sup.close();
    await cons.close();
  });

  test('conserje records Hallazgo against a Punto de Inspección', async ({ page }) => {
    await loginWithPin(page, '2026');
    await page.goto('/aproviva-suite/index.html#/gemba');
    await page.locator('[data-testid="gemba-page"]').waitFor({ state: 'visible', timeout: 30_000 });

    await page.locator('#gemba-start-btn').click();
    const form = page.locator('[data-testid="gemba-start-form"]');
    await form.waitFor({ state: 'visible', timeout: 15_000 });
    await form.locator('input[name="open_finding_after"]').setChecked(true);
    await form.getByRole('button', { name: 'Iniciar Ejecución' }).click();

    const exec = page.locator('[data-testid="gemba-execution-panel"]');
    await exec.waitFor({ state: 'visible', timeout: 30_000 });
    await exec.getByRole('button', { name: 'Hallazgo' }).first().click();

    const finding = page.locator('[data-testid="gemba-finding-form"]');
    await finding.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(finding).toContainText('Punto de Inspección');
    await finding.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('#gemba-findings')).toContainText('Hallazgo', { timeout: 30_000 });
  });
});
