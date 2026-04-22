import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

/**
 * Two-role smoke: supervisión inicia un recorrido; conserjería lo ve en activos.
 * Simulates parallel “supervisor creates / conserje picks up” on the shared operational list.
 */
test.describe('Gemba — supervisor creates, conserje sees active round', () => {
  test('SUP26 starts round; CONS26 sees it under Recorridos en curso', async ({ browser }) => {
    const sup = await browser.newContext();
    const cons = await browser.newContext();
    const supPage = await sup.newPage();
    const consPage = await cons.newPage();

    await loginWithPin(supPage, 'SUP26');
    await loginWithPin(consPage, '2026');

    await supPage.goto('/aproviva-suite/index.html#/gemba');
    await supPage.locator('[data-testid="gemba-page"]').waitFor({ state: 'visible', timeout: 30_000 });

    await supPage.getByRole('button', { name: 'Iniciar recorrido' }).click();
    const form = supPage.locator('[data-testid="gemba-start-form"]');
    await form.waitFor({ state: 'visible', timeout: 15_000 });

    const titleText =
      (await form.locator('select[name="title"] option:checked').first().textContent())?.trim() || '';
    expect(titleText.length).toBeGreaterThan(0);

    await form.locator('select[name="area"]').selectOption({ index: 0 });
    await form.locator('select[name="round_type"]').selectOption('ad_hoc');
    await form.getByRole('button', { name: 'Iniciar' }).click();

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

    await sup.close();
    await cons.close();
  });
});
