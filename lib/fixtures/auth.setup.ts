import { test as setup, expect } from '@playwright/test';
import { TestConfig } from '../utils/test-config';
import { installOverlayAutoDismiss, dismissOverlay } from '../utils/overlay-manager';

const { selectors, timeouts } = TestConfig;
const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * Global auth setup — runs ONCE before all tests.
 * Handles:
 *   1. Runtime error overlay dismissal (via centralized overlay-manager)
 *   2. Sample user button click OR UID text input
 *   3. Login button click
 *   4. Session state save for all subsequent tests
 */
setup('authenticate', async ({ page }) => {
  // Install centralized overlay auto-dismiss before navigating
  await installOverlayAutoDismiss(page);

  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: timeouts.pageLoad });
  await page.waitForTimeout(2000);

  // Dismiss any overlay that appeared during load
  await dismissOverlay(page);

  // Wait for login page
  await expect(
    page.locator(selectors.loginHeading)
  ).toBeVisible({ timeout: timeouts.pageLoad });

  // Wait for sample users to load
  await page.waitForTimeout(2000);
  await dismissOverlay(page);

  // Try clicking the sample user button first (e.g. "cometchat-uid-1")
  const uidButton = page.locator(`text=${TestConfig.login.sampleUserUid}`);

  let loggedIn = false;

  // Method 1: Click sample user button
  if (await uidButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dismissOverlay(page);
    try {
      await uidButton.click({ force: true });
      loggedIn = true;
    } catch {
      await dismissOverlay(page);
      await uidButton.click({ force: true });
      loggedIn = true;
    }
  }

  // Method 2: Fill UID input field
  if (!loggedIn) {
    const allInputs = page.locator('input[type="text"], input:not([type])');
    const count = await allInputs.count();
    for (let i = 0; i < count; i++) {
      const input = allInputs.nth(i);
      const placeholder = await input.getAttribute('placeholder').catch(() => '') || '';
      if (placeholder.toLowerCase().includes('uid') || placeholder.toLowerCase().includes('enter')) {
        await dismissOverlay(page);
        await input.fill(TestConfig.login.sampleUserUid);
        loggedIn = true;
        break;
      }
    }
  }

  if (!loggedIn) {
    throw new Error('Login page: could not find sample user button or UID input');
  }

  // Click Login button
  await dismissOverlay(page);
  const loginBtn = page.locator(selectors.loginButton);
  await expect(loginBtn).toBeVisible({ timeout: 5000 });
  await loginBtn.click({ force: true });

  // Wait for app to load
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await dismissOverlay(page);

  // Verify we're logged in
  await expect(
    page.locator(selectors.chatsHeading).first()
  ).toBeVisible({ timeout: timeouts.login });

  // Final overlay cleanup
  await dismissOverlay(page);

  // Save session
  await page.context().storageState({ path: AUTH_FILE });
});
