import { test, expect } from '@playwright/test';

test.describe('Portal residentes (index.html)', () => {
  test('loads hero, accesos, PQRS panel and finanzas section', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/APROVIVA/);
    await expect(page.getByRole('heading', { name: /Bienvenido a Villa Valencia/i })).toBeVisible();
    await expect(page.locator('#accesos')).toBeVisible();
    await expect(page.locator('#pqrs')).toBeVisible();
    await expect(page.locator('#finanzas')).toBeVisible();
    await expect(page.getByTestId('portal-role-path-strip')).toContainText(/Residentes/i);
    await expect(page.getByTestId('portal-pqrs-journey')).toContainText(/Seguimiento/i);
    await expect(page.getByTestId('portal-pqrs-privacy-note')).toContainText(/Privacidad/i);
  });



  test('accessos shows only administracion and junta entries', async ({ page }) => {
    await page.goto('/index.html#accesos');
    await expect(page.getByRole('heading', { name: /Ingreso administraci.n/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ingreso junta/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ingreso residentes/i })).toHaveCount(0);
    await expect(page.locator('.access-grid .access-card')).toHaveCount(2);
  });

  test('opens PQRS modal from Radicar button', async ({ page }) => {
    await page.goto('/index.html');
    // Prefer the panel button; the acceso rápido card is an <a href="#"> and is flaky under parallel runs.
    await page.getByRole('button', { name: /Radicar PQRS/i }).click();
    await expect(page.getByTestId('portal-pqrs-modal')).toBeVisible();
    await expect(page.getByTestId('portal-pqrs-modal-privacy-note')).toContainText(/evidencia operativa/i);
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

  test('PQRS status lookup uses ph-management fallback while VV Supabase flag is off', async ({ page }) => {
    await page.route('https://ph-management.vercel.app/api/pqrs/lookup?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          caseReference: 'VV-PQRS-20260430-123456',
          status: 'en_progreso',
          lastUpdatedAt: '2026-04-30T14:00:00Z'
        })
      });
    });

    await page.goto('/index.html');
    await page.evaluate(() => {
      (window as any).APROVIVA_CONFIG.PQRS_USE_VV_SUPABASE = false;
    });
    await page.locator('#pqrs-status-id').fill('VV-PQRS-20260430-123456');
    await page.getByRole('button', { name: /Consultar estado/i }).click();

    await expect(page.locator('#pqrs-status-feedback')).toContainText('En progreso');
  });

  test('PQRS status lookup uses VV Supabase RPC argument required by migration', async ({ page }) => {
    let rpcBody = '';
    await page.route('https://tgoitmwdpdkhlpqpwrvs.supabase.co/rest/v1/rpc/lookup_pqrs_case', async (route) => {
      rpcBody = route.request().postData() || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          case_reference: 'VV-PQRS-20260430-654321',
          status: 'recibido',
          updated_at: '2026-04-30T14:30:00Z'
        }])
      });
    });

    await page.goto('/index.html');
    await page.evaluate(() => {
      (window as any).APROVIVA_CONFIG.PQRS_USE_VV_SUPABASE = true;
    });
    await page.locator('#pqrs-status-id').fill('VV-PQRS-20260430-654321');
    await page.getByRole('button', { name: /Consultar estado/i }).click();

    await expect(page.locator('#pqrs-status-feedback')).toContainText('Recibido');
    expect(JSON.parse(rpcBody)).toEqual({ p_case_ref: 'VV-PQRS-20260430-654321' });
  });
});
