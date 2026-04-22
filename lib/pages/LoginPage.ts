import { Page, expect } from '@playwright/test';
import { TestConfig } from '../utils/test-config';

const { selectors, timeouts } = TestConfig;

/**
 * Page Object for the CometChat login/sign-in screen.
 * Detects if already authenticated (via saved storageState) and skips login.
 */
export class LoginPage {
  constructor(private page: Page) {}

  /** Check if we're already on the main chat screen (session restored) */
  async isAlreadyLoggedIn(): Promise<boolean> {
    try {
      const chats = this.page.locator(selectors.chatsHeading).first();
      return await chats.isVisible({ timeout: 3_000 });
    } catch {
      return false;
    }
  }

  /** Dismiss any React runtime error overlay if present */
  async dismissErrorOverlay() {
    // Remove webpack iframe overlay
    await this.page.evaluate(() => {
      document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
      document.querySelectorAll('iframe').forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 100) el.remove();
      });
      // Scan body children AND inside #root for React error overlays
      document.querySelectorAll('body > *, #root > *, #root > div > *').forEach(el => {
        if ((el as HTMLElement).id === 'root') return;
        const t = (el as HTMLElement).innerText || '';
        if (t.includes('Uncaught runtime error') || t.includes('Uncaught runtime errors')) {
          (el as HTMLElement).remove();
        }
      });
      document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]').forEach(el => {
        const t = (el as HTMLElement).innerText || '';
        if (t.includes('ERROR') && (t.includes('bundle.js') || t.includes('Failed to fetch'))) {
          (el as HTMLElement).remove();
        }
      });
    });
  }

  /**
   * Ensures the user is logged in.
   * If session is already restored (storageState), skips login entirely.
   * Otherwise performs the full login flow.
   */
  async ensureLoggedIn(uid: string) {
    if (await this.isAlreadyLoggedIn()) {
      return;
    }

    await expect(
      this.page.locator(selectors.loginHeading)
    ).toBeVisible({ timeout: timeouts.pageLoad });

    // Handle both login formats: clickable UID buttons or text input
    const uidButton = this.page.locator(`text=${uid}`);
    const uidInput = this.page.locator('input[placeholder="Enter your UID"]');

    if (await uidButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uidButton.click();
    } else if (await uidInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uidInput.fill(uid);
    }

    await this.page.locator(selectors.loginButton).click();

    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
    await this.dismissErrorOverlay();

    await expect(
      this.page.locator(selectors.chatsHeading).first()
    ).toBeVisible({ timeout: timeouts.login });
  }

  /**
   * Logout via sidebar menu → "Log Out" item.
   * The Log Out label may be hidden in the sidebar — use evaluate click.
   */
  async logout() {
    // First ensure we're on the Chats tab where the sidebar menu is
    const chatsTab = this.page.locator(selectors.bottomNav.chats);
    if (await chatsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatsTab.click();
      await this.page.waitForTimeout(500);
    }

    // The Log Out item is in the sidebar but may be hidden — use dispatchEvent
    const logoutItem = this.page.locator('label.cometchat-menu-list__sub-menu-item-title-log-out');
    await logoutItem.waitFor({ state: 'attached', timeout: timeouts.chatOpen });
    await logoutItem.dispatchEvent('click');

    // Wait for login screen to appear
    await expect(
      this.page.locator(selectors.loginHeading)
    ).toBeVisible({ timeout: timeouts.pageLoad });
  }

  /**
   * Full re-login flow: click user UID → click Login → wait for Chats.
   */
  async loginAs(uid: string) {
    await expect(
      this.page.locator(selectors.loginHeading)
    ).toBeVisible({ timeout: timeouts.pageLoad });

    const uidButton = this.page.locator(`text=${uid}`);
    const uidInput = this.page.locator('input[placeholder="Enter your UID"]');

    if (await uidButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uidButton.click();
    } else if (await uidInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uidInput.fill(uid);
    }

    await this.page.locator(selectors.loginButton).click();

    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
    await this.dismissErrorOverlay();

    await expect(
      this.page.locator(selectors.chatsHeading).first()
    ).toBeVisible({ timeout: timeouts.login });
  }
}
