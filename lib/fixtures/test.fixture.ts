import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ChatPage } from '../pages/ChatPage';
import { UsersPage } from '../pages/UsersPage';
import { GroupsPage } from '../pages/GroupsPage';
import { CallsPage } from '../pages/CallsPage';
import { ConversationListPage } from '../pages/ConversationListPage';
import { TestConfig } from '../utils/test-config';
import { trackErrors, addError } from '../utils/error-tracker';
import { RuntimeErrorHandler } from '../utils/runtime-error-handler';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * Unified Playwright Fixture — combines error tracking + page object DI.
 *
 * Provides:
 *   1. Error tracking (console errors, page errors, network failures)
 *   2. Runtime error overlay auto-dismiss
 *   3. First-failure screenshot capture for bug reports
 *   4. Pre-configured page objects via dependency injection
 *
 * Usage in tests:
 *   import { test, expect } from '../../lib/fixtures/test.fixture';
 *
 *   test('my test', async ({ chatPage, usersPage }) => { ... });
 *
 * For tests that only need error tracking on the base page:
 *   test('simple test', async ({ page }) => { ... });
 */

type Fixtures = {
  loginPage: LoginPage;
  chatPage: ChatPage;
  usersPage: UsersPage;
  groupsPage: GroupsPage;
  callsPage: CallsPage;
  convListPage: ConversationListPage;
  authedPage: Page;
  authedContext: BrowserContext;
};

export const test = base.extend<Fixtures>({
  // Override base page with error tracking
  page: async ({ page }, use, testInfo) => {
    const testName = testInfo.titlePath.join(' → ');

    // 1. Track JS errors
    trackErrors(page, testName);

    // 2. Install runtime error overlay auto-dismiss
    const runtimeHandler = new RuntimeErrorHandler(page, testInfo);
    await runtimeHandler.install();

    await use(page);

    // 3. On FIRST failure (retry === 0), capture screenshot
    if (testInfo.status !== testInfo.expectedStatus && testInfo.retry === 0) {
      try {
        const screenshot = await page.screenshot({ fullPage: false });
        await testInfo.attach('first-failure-screenshot', {
          body: screenshot,
          contentType: 'image/png',
        });
      } catch {
        // Page may have crashed
      }
    }

    // 4. Drain runtime errors BEFORE page might close
    try {
      if (!page.isClosed()) {
        const newErrors = await page.evaluate(() => {
          const errors = (window as any).__runtimeErrors || [];
          (window as any).__runtimeErrors = [];
          return errors;
        }).catch(() => []);

        for (const err of newErrors) {
          addError({
            timestamp: err.timestamp || new Date().toISOString(),
            test: testName,
            type: 'uncaught-exception',
            message: err.message?.substring(0, 3000) || 'Unknown runtime error',
            stack: undefined,
            url: err.url || '',
            source: 'Runtime Error Overlay (auto-dismissed)',
          });
        }

        const legacyErrors = await page.evaluate(() => {
          const errors = (window as any).__capturedRuntimeErrors || [];
          (window as any).__capturedRuntimeErrors = [];
          return errors;
        }).catch(() => []);

        for (const err of legacyErrors) {
          addError({
            timestamp: err.timestamp || new Date().toISOString(),
            test: testName,
            type: 'uncaught-exception',
            message: err.message?.substring(0, 3000) || 'Unknown runtime error',
            stack: err.html?.substring(0, 2000) || undefined,
            url: err.url || '',
            source: 'Runtime Error Overlay',
          });
        }

        runtimeHandler.logSummary();
      }
    } catch {
      // Page may have closed
    }
  },

  authedContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: AUTH_FILE,
      baseURL: TestConfig.baseURL,
      permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
    });
    await use(context);
    await context.close();
  },

  authedPage: async ({ authedContext }, use, testInfo) => {
    const page = await authedContext.newPage();
    const testName = testInfo.titlePath.join(' → ');

    trackErrors(page, testName);

    const runtimeHandler = new RuntimeErrorHandler(page, testInfo);
    await runtimeHandler.install();

    await use(page);

    // Drain runtime errors on teardown
    if (!page.isClosed()) {
      try {
        const errors = await page.evaluate(() => {
          const rt = (window as any).__runtimeErrors || [];
          (window as any).__runtimeErrors = [];
          return rt;
        }).catch(() => []);
        if (errors.length > 0) {
          console.warn(`[Fixture] Drained ${errors.length} runtime error(s)`);
        }
      } catch {}
    }
  },

  loginPage: async ({ authedPage }, use) => {
    await use(new LoginPage(authedPage));
  },

  chatPage: async ({ authedPage }, use) => {
    const cp = new ChatPage(authedPage);
    await cp.setupErrorOverlayAutoDismiss();
    await use(cp);
    await cp.drainRuntimeErrors();
  },

  usersPage: async ({ authedPage }, use) => {
    await use(new UsersPage(authedPage));
  },

  groupsPage: async ({ authedPage }, use) => {
    await use(new GroupsPage(authedPage));
  },

  callsPage: async ({ authedPage }, use) => {
    await use(new CallsPage(authedPage));
  },

  convListPage: async ({ authedPage }, use) => {
    await use(new ConversationListPage(authedPage));
  },
});

export { expect };
