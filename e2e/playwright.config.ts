import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  /* Global setup */
  globalSetup: require.resolve(path.join(__dirname, 'global-setup')),
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry failed tests to handle flakiness */
  retries: process.env.CI ? 2 : 1,
  // Reduce worker count to avoid resource contention causing flakiness
  workers: process.env.CI ? Math.min(3, os.cpus().length) : Math.min(4, os.cpus().length),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [
        [
          'html',
          {
            outputFolder: path.join(
              __dirname,
              '..',
              '.tmp',
              'e2e-test-results',
              'playwright-report',
            ),
            open: 'never',
          },
        ],
        [
          'junit',
          {
            outputFile: path.join(
              __dirname,
              '..',
              '.tmp',
              'e2e-test-results',
              'results.xml',
            ),
          },
        ],
      ]
    : process.env.PLAYWRIGHT_HTML_REPORT
      ? [
          [
            'html',
            {
              outputFolder: path.join(
                __dirname,
                '..',
                '.tmp',
                'e2e-test-results',
                'playwright-report',
              ),
              open: 'always',
            },
          ],
        ]
      : 'line',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4242',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Browser options */
    userAgent: 'PLAYWRIGHT',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: {
          permissions: ['geolocation', 'notifications'],
          geolocation: { longitude: 0, latitude: 0 },
        },
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-browser-side-navigation',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions',
          ],
        },
      },
    },

    // Optionally test against other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run startFrontend:e2e',
    url: 'http://localhost:4242',
    reuseExistingServer: !process.env.CI, // Don't reuse in CI to ensure clean state
    // unfortunately for CI we need to wait long for this to go up :(
    timeout: 3 * 60 * 1000, // Allow up to 3 minutes for slower CI starts
    stdout: 'pipe', // Always show output for debugging
    stderr: 'pipe',
  },

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: path.join(__dirname, '..', '.tmp', 'e2e-test-results', 'test-results'),

  /* Global timeout for each test - slightly increased for stability */
  timeout: 60 * 1000,

  /* Global timeout for each assertion */
  expect: {
    timeout: 15 * 1000,
  },

  /* Maximum test failures before stopping */
  maxFailures: process.env.CI ? undefined : 5,
});
