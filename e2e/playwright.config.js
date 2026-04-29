const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.E2E_PORT || '8787';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  /** One worker avoids static `serve` + session races during local pre-push runs. */
  workers: process.env.CI ? 2 : 1,
  fullyParallel: !!process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // cwd = e2e/; `..` = portal root. Avoid `serve`, which enumerates network interfaces.
        command: `node static-server.js .. 127.0.0.1 ${PORT}`,
        cwd: __dirname,
        // Wait for suite entry (most e2e traffic); resident `index.html` alone can race with cold start.
        url: `${baseURL}/aproviva-suite/index.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
