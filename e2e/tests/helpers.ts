import type { Page } from '@playwright/test';

const SUITE = '/aproviva-suite/index.html';

/** Clears suite session and opens the login screen. */
export async function clearSuiteSession(page: Page) {
  await page.goto(`${SUITE}#/login`);
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem('aproviva_session_v1');
    } catch {
      /* ignore */
    }
  });
}

/** Logs in with the given PIN and waits until the shell nav is visible on Inicio. */
export async function loginWithPin(page: Page, pin: string) {
  await clearSuiteSession(page);
  await page.goto(`${SUITE}#/login`);
  await page.locator('#pin-input').fill(pin);
  await page.locator('#pin-submit').click();
  await page.waitForURL(/#\/inicio/, { timeout: 15_000 });
  await page.locator('#app-nav').waitFor({ state: 'visible', timeout: 15_000 });
}
