import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const SUITE = '/aproviva-suite/index.html';

async function openSuiteLoginWithRetry(page: Page, tries = 3) {
  let lastError: unknown = null;
  for (let i = 0; i < tries; i++) {
    try {
      await page.goto(`${SUITE}#/login`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.getByTestId('suite-login-screen').waitFor({ state: 'visible', timeout: 90_000 });
      return;
    } catch (err) {
      lastError = err;
      // Keep retries small; this is only to absorb occasional webServer cold-start races.
      await page.waitForTimeout(1_500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not open suite login screen.');
}

/** Clears suite session and opens the login screen. */
export async function clearSuiteSession(page: Page) {
  await openSuiteLoginWithRetry(page);
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
  await openSuiteLoginWithRetry(page);
  await page.locator('#pin-input').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#pin-input').fill(pin);
  await page.locator('#pin-submit').click();
  await expect(page).toHaveURL(/#\/inicio/, { timeout: 45_000 });
  await page.locator('#app-nav').waitFor({ state: 'visible', timeout: 45_000 });
}
