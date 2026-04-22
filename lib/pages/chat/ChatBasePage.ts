import { Page, expect } from '@playwright/test';
import { TestConfig } from '../../utils/test-config';
import { trackErrors, addError } from '../../utils/error-tracker';
import { dismissOverlay, nukeIframes, installOverlayAutoDismiss, injectOverlayNuke } from '../../utils/overlay-manager';

const { selectors, timeouts } = TestConfig;

/**
 * Base class for all ChatPage sub-pages.
 * Provides shared overlay handling, smart wait/click, and bubble helpers.
 */
export class ChatBasePage {
  protected testName: string = '';
  protected overlayScreenshots: Buffer[] = [];

  constructor(protected page: Page) {}

  // ─── Error Tracking ───

  attachErrorTracking(testName: string = 'Unknown Test') {
    this.testName = testName;
    trackErrors(this.page, testName);
  }

  async drainRuntimeErrors() {
    try {
      if (this.overlayScreenshots.length > 0) {
        console.warn(`[ChatPage] ${this.overlayScreenshots.length} overlay screenshot(s) captured during test`);
        for (let i = 0; i < this.overlayScreenshots.length; i++) {
          addError({
            timestamp: new Date().toISOString(),
            test: this.testName || 'Unknown',
            type: 'uncaught-exception',
            message: `Runtime error overlay #${i + 1} — screenshot captured before dismissal`,
            stack: undefined, url: '', source: 'Overlay Screenshot',
          });
        }
      }

      const errors = await this.page.evaluate(() => {
        const rt = (window as any).__runtimeErrors || [];
        const cap = (window as any).__capturedRuntimeErrors || [];
        (window as any).__runtimeErrors = [];
        (window as any).__capturedRuntimeErrors = [];
        return { runtime: rt, captured: cap };
      }).catch(() => ({ runtime: [], captured: [] }));

      for (const err of errors.runtime) {
        addError({
          timestamp: err.timestamp || new Date().toISOString(),
          test: this.testName || 'Unknown', type: 'uncaught-exception',
          message: (err.message || 'Runtime error overlay').substring(0, 3000),
          stack: undefined, url: err.url || '', source: 'Runtime Error Overlay (auto-dismissed)',
        });
      }
      for (const err of errors.captured) {
        const isDupe = errors.runtime.some((r: any) => r.message === err.message && r.timestamp === err.timestamp);
        if (!isDupe) {
          addError({
            timestamp: err.timestamp || new Date().toISOString(),
            test: this.testName || 'Unknown', type: 'uncaught-exception',
            message: (err.message || 'Runtime error overlay').substring(0, 3000),
            stack: err.html?.substring(0, 2000) || undefined,
            url: err.url || '', source: 'Runtime Error Overlay',
          });
        }
      }

      const total = errors.runtime.length + errors.captured.length;
      if (total > 0) console.warn(`[ChatPage] Drained ${total} runtime error(s) into report`);
    } catch {}
  }

  // ─── Overlay Handling (delegates to overlay-manager) ───

  async dismissErrorOverlay(): Promise<boolean> {
    const found = await dismissOverlay(this.page);
    if (found) {
      try {
        const ss = await this.page.screenshot({ fullPage: false, timeout: 3000 });
        this.overlayScreenshots.push(ss);
      } catch {}
    }
    return found;
  }

  getOverlayScreenshots(): Buffer[] { return this.overlayScreenshots; }

  async setupErrorOverlayAutoDismiss(testName?: string) {
    if (testName) this.attachErrorTracking(testName);
    else if (!this.testName) this.attachErrorTracking('Shared Context');
    await installOverlayAutoDismiss(this.page);
    await injectOverlayNuke(this.page);
  }

  // ─── Smart Helpers ───

  async smartWait(locator: ReturnType<Page['locator']>, options?: { timeout?: number; description?: string }) {
    const timeout = options?.timeout ?? timeouts.chatOpen;
    const desc = options?.description || 'element';
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const hadOverlay = await this.dismissErrorOverlay();
      if (hadOverlay) await this.page.waitForTimeout(300);
      const visible = await locator.isVisible().catch(() => false);
      if (visible) return true;
      await this.page.waitForTimeout(500);
    }

    await this.dismissErrorOverlay();
    await this.page.waitForTimeout(300);
    const finalVisible = await locator.isVisible().catch(() => false);
    if (!finalVisible) {
      console.warn(`[ChatPage] smartWait: "${desc}" not visible after ${timeout}ms`);
    }
    return finalVisible;
  }

  async safeClick(locator: ReturnType<Page['locator']>, options?: { timeout?: number }) {
    const timeout = options?.timeout ?? timeouts.chatOpen;
    await this.smartWait(locator, { timeout, description: 'click target' });
    await expect(locator).toBeVisible({ timeout: 5000 });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.dismissErrorOverlay();
      try {
        await locator.click({ timeout: 5000 });
        return;
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('intercepts pointer events') || msg.includes('overlay') || msg.includes('iframe')) {
          console.warn(`[ChatPage] safeClick attempt ${attempt}/3 — overlay blocked, dismissing...`);
          await this.dismissErrorOverlay();
          await this.page.waitForTimeout(300);
          if (attempt === 3) await locator.click({ force: true, timeout: 5000 });
        } else throw err;
      }
    }
  }

  async smartExpect(fn: () => Promise<void>, options?: { timeout?: number }) {
    try { await fn(); } catch (firstErr) {
      const hadOverlay = await this.dismissErrorOverlay();
      if (hadOverlay) {
        console.warn('[ChatPage] smartExpect: overlay dismissed, retrying assertion...');
        await this.page.waitForTimeout(500);
        await fn();
      } else throw firstErr;
    }
  }

  // ─── Bubble Helpers ───

  async getOutgoingBubbleCount(): Promise<number> {
    return this.page.locator(selectors.sentMessageBubble).count();
  }

  async getLastOutgoingBubble(timeout: number) {
    const bubble = this.page.locator(selectors.sentMessageBubble).last();
    await expect(bubble).toBeVisible({ timeout });
    return bubble;
  }

  async waitForChatReady() {
    await this.dismissErrorOverlay();
    await nukeIframes(this.page);

    const recordingBar = this.page.locator(selectors.recordingBar);
    if (await recordingBar.isVisible({ timeout: 500 }).catch(() => false)) {
      const deleteBtn = this.page.locator(selectors.recordingBarDelete);
      if (await deleteBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await deleteBtn.click({ force: true });
        await this.page.waitForTimeout(300);
      }
    }

    await this.smartWait(this.page.locator(selectors.composerInput), {
      timeout: timeouts.chatOpen, description: 'chat composer',
    });
    await expect(this.page.locator(selectors.composerInput)).toBeVisible({ timeout: 5000 });
    await this.page.locator(selectors.sendButton).or(
      this.page.locator(selectors.composerInput)
    ).first().waitFor({ state: 'attached', timeout: timeouts.chatOpen });
    await this.page.waitForTimeout(500);
  }

  // ─── Hover Menu Helpers ───

  async hoverLastBubbleAndGetWrapper() {
    await this.dismissErrorOverlay();
    await this.page.waitForTimeout(300);
    const bubble = this.page.locator(selectors.sentMessageBubble).last();
    await this.smartWait(bubble, { timeout: timeouts.messageAppear, description: 'outgoing bubble for hover' });
    await expect(bubble).toBeVisible({ timeout: 5000 });
    await expect(async () => { await bubble.scrollIntoViewIfNeeded(); }).toPass({ timeout: 5000 });
    await this.dismissErrorOverlay();
    await bubble.hover({ force: true });
    await this.page.waitForTimeout(500);
    return bubble.locator('..');
  }

  async openSubMenu() {
    let wrapper = await this.hoverLastBubbleAndGetWrapper();
    const subMenu = wrapper.locator(selectors.messageActionSubMenu);
    if (!await subMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      wrapper = await this.hoverLastBubbleAndGetWrapper();
    }
    await expect(subMenu).toBeVisible({ timeout: timeouts.attachMenu });
    await subMenu.dispatchEvent('click');
    await this.page.waitForTimeout(500);
    return wrapper;
  }

  async clickSubMenuItem(wrapper: ReturnType<typeof this.page.locator>, title: string) {
    const item = wrapper.locator(`div.cometchat-menu-list__sub-menu-list-item[title="${title}"]`);
    await expect(item).toBeVisible({ timeout: timeouts.attachMenu });
    await item.dispatchEvent('click');
    await this.page.waitForTimeout(300);
  }
}
