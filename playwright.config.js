// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2, // Reduce parallel workers to prevent video encoding conflicts
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 }
    },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    // Fix blank video/screenshots in headless mode on macOS
    headless: process.env.HEADED !== 'true',
    launchOptions: {
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1280,720',
        // Additional flags for better rendering on macOS
        '--use-gl=swiftshader',
        '--enable-features=NetworkService,NetworkServiceInProcess'
      ]
    }
  },
  projects: [
    {
      name: 'frontend',
      testDir: './tests/frontend',
      metadata: { category: 'Frontend' },
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'backend',
      testDir: './tests/backend',
      metadata: { category: 'Backend' },
      use: {
        baseURL: process.env.BASE_URL || 'http://localhost:8000',
        trace: 'retain-on-failure',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
});
