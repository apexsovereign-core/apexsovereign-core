import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = Number(process.env.PLAYWRIGHT_WEB_PORT || 3000);
const API_PORT = Number(process.env.PLAYWRIGHT_API_PORT || 3100);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${WEB_PORT}`;
const apiURL =
  process.env.PLAYWRIGHT_API_URL || `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'node tests/e2e/support/apiServer.mjs',
      url: `${apiURL}/__e2e__/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        APEX_E2E: '1',
        NODE_ENV: 'test',
        E2E_API_PORT: String(API_PORT),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
