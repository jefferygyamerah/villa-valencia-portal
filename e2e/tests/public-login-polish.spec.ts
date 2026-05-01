import { test, expect } from '@playwright/test';

test.describe('Public and login premium polish', () => {
  test('suite login hides demo PIN shortcuts behind QA disclosure', async ({ page }) => {
    await page.goto('/aproviva-suite/index.html#/login');
    await expect(page.getByTestId('suite-login-screen')).toBeVisible();
    await expect(page.getByTestId('suite-login-security-note')).toContainText(/Acceso privado/i);
    await expect(page.getByTestId('suite-demo-access')).toContainText(/Modo demo \/ QA/i);
    await expect(page.getByRole('button', { name: 'Gerencia' })).not.toBeVisible();
    await page.getByTestId('suite-demo-access').locator('summary').click();
    await expect(page.getByRole('button', { name: 'Gerencia' })).toBeVisible();
  });

  test('legacy portal is visibly guarded from commercial path', async ({ page }) => {
    await page.goto('/aproviva-portal.html');
    await expect(page.getByTestId('legacy-portal-notice')).toContainText(/superficie heredada/i);
    await expect(page.getByTestId('legacy-portal-notice')).toContainText(/experiencia comercial vigente/i);
  });
});
