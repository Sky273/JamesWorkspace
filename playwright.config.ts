import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'npm run start:proxy',
    url: 'http://localhost:3001/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      PDF_SERVER_INTERNAL_TOKEN: process.env.PDF_SERVER_INTERNAL_TOKEN || 'playwright-pdf-server-internal-token-32chars',
      HTTPS_ENABLED: process.env.HTTPS_ENABLED || 'false',
    },
  },
});
