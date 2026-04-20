const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.E2E_PORT || '8787';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
        // cwd = e2e/ so local `serve` devDependency resolves; `..` = portal root
        command: `npx serve .. -l ${PORT}`,
        cwd: __dirname,
        url: `${baseURL}/index.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
