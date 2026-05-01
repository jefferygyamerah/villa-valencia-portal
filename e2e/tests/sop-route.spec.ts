import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers';

const roles = [
  { pin: '2026', label: 'Conserjería' },
  { pin: 'SUP26', label: 'Supervisión' },
  { pin: 'GER26', label: 'Gerencia' },
  { pin: 'JD26', label: 'Junta' },
] as const;

test.describe('Rendered SOP is available to every authenticated role', () => {
  for (const role of roles) {
    test(`${role.label} can open SOP from Inicio and nav`, async ({ page }) => {
      await loginWithPin(page, role.pin);
      await expect(page.getByTestId('home-sop-link')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('home-sop-link').click();
      await expect(page).toHaveURL(/#\/sop/);
      await expect(page.getByTestId('sop-page')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('sop-premium-hero')).toContainText(/SOP APROVIVA Villa Valencia/i);
      await expect(page.getByTestId('sop-page')).toContainText(/Tabla rápida de roles/i);
      await expect(page.getByTestId('sop-page')).toContainText(/Conserjería/i);
      await expect(page.getByTestId('sop-page')).toContainText(/Junta Directiva/i);
      await expect(page.locator('img[alt="Paquete Ejecutivo"]')).toBeVisible();
      await expect(page.locator('#app-nav').getByRole('link', { name: /SOP/i })).toHaveAttribute('aria-current', 'page');
    });
  }
});
