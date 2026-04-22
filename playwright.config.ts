import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * Parallel execution strategy:
 *
 *   fullyParallel: true  → tests WITHIN a file run in parallel (only if independent)
 *   workers: 'auto'      → Playwright picks optimal worker count (CPU cores / 2)
 *   workers: 4           → fixed 4 parallel workers
 *
 *   Override per-describe with: test.describe.configure({ mode: 'serial' })
 *   Override via CLI:           npx playwright test --workers=1
 *
 * Current setup:
 *   - fullyParallel: false → tests within a file run sequentially (they share state)
 *   - workers: auto        → different SPEC FILES run in parallel across workers
 *   - Each spec file gets its own browser context → no state collision
 *
 * This means:
 *   users.spec.ts, groups.spec.ts, calls.spec.ts, composer.spec.ts etc.
 *   all run simultaneously on different workers. Tests INSIDE each file
 *   still run top-to-bottom (because they share beforeAll context).
 */

const WORKERS = process.env.CI
  ? 3
  : parseInt(process.env.PW_WORKERS || '0') || undefined;  // undefined = Playwright auto-detects

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },

  /* Parallel at FILE level, sequential WITHIN each file */
  fullyParallel: false,
  workers: WORKERS,

  retries: process.env.CI ? 2 : 1,
  globalTeardown: './global-teardown.ts',
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['./lib/reporters/unified-reporter.ts'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    /* Auth setup — runs ONCE before everything, saves session */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      testDir: './lib/fixtures',
    },

    /* API tests — no browser UI, fast, can run fully parallel */
    {
      name: 'api',
      testDir: './tests/api',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      fullyParallel: true,   // API tests are independent — full parallel
    },

    /* UI tests — parallel across files, sequential within each file */
    {
      name: 'chromium',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
        permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
      dependencies: ['setup'],
    },

    /* Integration tests — sequential (shared state across tests) */
    {
      name: 'integration',
      testDir: './tests/integration',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
        permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
      dependencies: ['setup'],
      fullyParallel: false,
    },
  ],
});
