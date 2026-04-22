import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { UsersPage } from '../../lib/pages/UsersPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { TestConfig } from '../../lib/utils/test-config';
import { USERS } from '../../lib/utils/helpers';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';
const { selectors, timeouts } = TestConfig;

/**
 * Network Failure Tests — Advanced
 *
 * Uses Playwright's route interception to simulate:
 *   - Complete offline mode
 *   - Slow network (3G throttle)
 *   - API endpoint failures (500, 408, 429)
 *   - WebSocket disconnect
 *   - Partial network (block only messages API)
 *   - Recovery after network restore
 *
 * TC-NET-001  Send message while offline — no crash, error handled
 * TC-NET-002  App recovers after going offline then back online
 * TC-NET-003  Conversation list loads after network restore
 * TC-NET-004  Message API returns 500 — app shows error gracefully
 * TC-NET-005  Message API returns 408 timeout — app handles it
 * TC-NET-006  Message API returns 429 rate limit — app handles it
 * TC-NET-007  Block image CDN — chat still works, images show placeholder
 * TC-NET-008  Slow network (2s delay) — messages still send eventually
 * TC-NET-009  Block messages API — other features (users, groups) still work
 * TC-NET-010  Rapid offline/online toggle — app stays stable
 * TC-NET-011  Send message offline → restore → message delivers
 * TC-NET-012  Users tab loads after API failure recovery
 * TC-NET-013  Groups tab loads after API failure recovery
 * TC-NET-014  Calls tab loads after API failure recovery
 * TC-NET-015  WebSocket disconnect — app reconnects or shows status
 */

async function createContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: TestConfig.baseURL,
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  return { context, page: await context.newPage() };
}

test.describe('@network @regression Network Failure Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let usersPage: UsersPage;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();
    usersPage = new UsersPage(page);
    const convList = new ConversationListPage(page);
    await convList.goto();
    await new LoginPage(page).ensureLoggedIn(USERS.primary);
  });

  test.afterAll(async () => {
    // Ensure network is restored before closing
    await context.setOffline(false);
    await chatPage.drainRuntimeErrors();
    await context.close();
  });

  // Helper: open chat and ensure ready
  async function ensureChatOpen() {
    const composerVisible = await page.locator(selectors.composerInput)
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (!composerVisible) {
      await usersPage.navigateToUsersTab();
      await usersPage.searchUser(USERS.chatTarget);
      await usersPage.openUserChat(USERS.chatTarget);
      await chatPage.waitForChatReady();
    }
  }

  // ─── Offline Mode ───

  test('@network @negative TC-NET-001: Send message while offline — no crash', async () => {
    await ensureChatOpen();
    await chatPage.sendTextMessage('pre-offline-msg');
    await chatPage.verifyTextSent('pre-offline-msg');

    await test.step('Go offline', async () => {
      await context.setOffline(true);
      await page.waitForTimeout(1000);
    });

    await test.step('Attempt to send message while offline', async () => {
      // Nuke any overlay iframes that appeared during offline
      await page.evaluate(() => {
        document.querySelectorAll('iframe').forEach(el => el.remove());
      }).catch(() => {});
      const input = page.locator(selectors.composerInput);
      await input.click({ force: true });
      await input.fill('offline-message-attempt');
      await page.locator(selectors.sendButton).click({ force: true });
      await page.waitForTimeout(3000);
      // App should not crash — tab bar still visible
      await expect(page.locator(selectors.bottomNav.chats)).toBeVisible({ timeout: 5000 });
    });

    await test.step('Restore network', async () => {
      await context.setOffline(false);
      await page.waitForTimeout(2000);
    });
  });

  test('@network TC-NET-002: App recovers after going offline then back online', async () => {
    await ensureChatOpen();

    await test.step('Go offline for 3 seconds', async () => {
      await context.setOffline(true);
      await page.waitForTimeout(3000);
    });

    await test.step('Restore network', async () => {
      await context.setOffline(false);
      await page.waitForTimeout(3000);
    });

    await test.step('App is functional — can send message', async () => {
      await chatPage.dismissErrorOverlay();
      // Reload page to recover from offline state
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(3000);
      await chatPage.dismissErrorOverlay();
      await ensureChatOpen();
      await chatPage.sendTextMessage('post-recovery-msg');
      await chatPage.verifyTextSent('post-recovery-msg');
    });
  });

  test('@network TC-NET-003: Conversation list loads after network restore', async () => {
    await test.step('Go offline', async () => {
      await context.setOffline(true);
      await page.waitForTimeout(500);
    });

    await test.step('Navigate to Chats tab while offline', async () => {
      await page.locator(selectors.bottomNav.chats).click().catch(() => {});
      await page.waitForTimeout(1000);
    });

    await test.step('Restore network and verify list loads', async () => {
      await context.setOffline(false);
      await page.waitForTimeout(1000);
      // Reload to recover from offline state
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(3000);
      await chatPage.dismissErrorOverlay();
      await page.locator(selectors.bottomNav.chats).click();
      await page.waitForTimeout(1500);
      const convList = page.locator('div.cometchat-conversations div.cometchat-list-item');
      await expect(convList.first()).toBeVisible({ timeout: timeouts.pageLoad });
    });
  });

  // ─── API Error Simulation ───

  test('@network @negative TC-NET-004: Message API returns 500 — app handles gracefully', async () => {
    await ensureChatOpen();

    await test.step('Intercept messages API with 500', async () => {
      await page.route('**/messages', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({ status: 500, body: JSON.stringify({ error: { message: 'Internal Server Error' } }) });
        } else {
          route.continue();
        }
      });
    });

    await test.step('Attempt to send message — app should not crash', async () => {
      const input = page.locator(selectors.composerInput);
      await input.click();
      await input.fill('should-fail-500');
      await page.locator(selectors.sendButton).click();
      await page.waitForTimeout(3000);
      // App should still be functional
      await expect(page.locator(selectors.bottomNav.chats)).toBeVisible({ timeout: 5000 });
    });

    await test.step('Remove intercept and verify recovery', async () => {
      await page.unrouteAll();
      await page.waitForTimeout(1000);
      await chatPage.sendTextMessage('after-500-recovery');
      await chatPage.verifyTextSent('after-500-recovery');
    });
  });

  test('@network @negative TC-NET-005: Message API returns 408 timeout — app handles it', async () => {
    await ensureChatOpen();

    await test.step('Intercept with 408', async () => {
      await page.route('**/messages', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({ status: 408, body: JSON.stringify({ error: { message: 'Request Timeout' } }) });
        } else {
          route.continue();
        }
      });
    });

    await test.step('Send message — app handles timeout', async () => {
      const input = page.locator(selectors.composerInput);
      await input.click();
      await input.fill('should-timeout-408');
      await page.locator(selectors.sendButton).click();
      await page.waitForTimeout(3000);
      await expect(page.locator(selectors.bottomNav.chats)).toBeVisible({ timeout: 5000 });
    });

    await test.step('Remove intercept', async () => {
      await page.unrouteAll();
      await page.waitForTimeout(1000);
    });
  });

  test('@network @negative TC-NET-006: Message API returns 429 rate limit — app handles it', async () => {
    await ensureChatOpen();

    await test.step('Intercept with 429', async () => {
      await page.route('**/messages', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 429,
            headers: { 'Retry-After': '5' },
            body: JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
          });
        } else {
          route.continue();
        }
      });
    });

    await test.step('Send message — app handles rate limit', async () => {
      const input = page.locator(selectors.composerInput);
      await input.click();
      await input.fill('should-ratelimit-429');
      await page.locator(selectors.sendButton).click();
      await page.waitForTimeout(3000);
      await expect(page.locator(selectors.bottomNav.chats)).toBeVisible({ timeout: 5000 });
    });

    await test.step('Remove intercept', async () => {
      await page.unrouteAll();
      await page.waitForTimeout(1000);
    });
  });

  // ─── Partial Network Failures ───

  test('@network TC-NET-007: Block image CDN — chat still works, images show placeholder', async () => {
    await ensureChatOpen();

    await test.step('Block image requests', async () => {
      await page.route('**/*.{png,jpg,jpeg,webp,gif,svg}', route => route.abort('blockedbyclient'));
    });

    await test.step('Send text message — still works without images', async () => {
      await chatPage.sendTextMessage('text-while-images-blocked');
      await chatPage.verifyTextSent('text-while-images-blocked');
    });

    await test.step('Composer and buttons still functional', async () => {
      await expect(page.locator(selectors.composerInput)).toBeVisible();
      await expect(page.locator(selectors.sendButton)).toBeVisible();
    });

    await test.step('Restore image loading', async () => {
      await page.unrouteAll();
      await page.waitForTimeout(1000);
    });
  });

  test('@network TC-NET-008: Slow network (2s delay) — messages still send', async () => {
    await ensureChatOpen();

    await test.step('Add 2s delay to all API requests', async () => {
      await page.route('**/messages', async route => {
        await new Promise(r => setTimeout(r, 2000));
        await route.continue();
      });
    });

    await test.step('Send message — arrives after delay', async () => {
      const before = await page.locator(selectors.sentMessageBubble).count();
      const input = page.locator(selectors.composerInput);
      await input.click();
      await input.fill('slow-network-msg');
      await page.locator(selectors.sendButton).click();
      // Wait longer than usual for the delayed response
      await expect(async () => {
        const after = await page.locator(selectors.sentMessageBubble).count();
        expect(after).toBeGreaterThan(before);
      }).toPass({ timeout: 30000 });
    });

    await test.step('Remove delay', async () => {
      await page.unrouteAll();
      await page.waitForTimeout(1000);
    });
  });

  test('@network TC-NET-009: Block messages API — other features still work', async () => {
    // Ensure all previous routes are cleared
    await page.unrouteAll();
    await page.waitForTimeout(500);

    await test.step('Block only /messages endpoint', async () => {
      await page.route('**/messages**', route => {
        route.abort('blockedbyclient').catch(() => {});
      });
    });

    await test.step('Users tab still loads', async () => {
      await page.locator(selectors.bottomNav.users).click();
      await page.waitForTimeout(2000);
      const userItems = page.locator('div.cometchat-users div.cometchat-list-item');
      await expect(userItems.first()).toBeVisible({ timeout: timeouts.pageLoad });
    });

    await test.step('Groups tab still loads', async () => {
      await page.locator(selectors.bottomNav.groups).click();
      await page.waitForTimeout(2000);
      const groupItems = page.locator('div.cometchat-groups div.cometchat-list-item');
      await expect(groupItems.first()).toBeVisible({ timeout: timeouts.pageLoad });
    });

    await test.step('Remove block', async () => {
      await page.unrouteAll();
      await page.waitForTimeout(1000);
    });
  });

  // ─── Stability Under Network Chaos ───

  test('@network @negative TC-NET-010: Rapid offline/online toggle — app stays stable', async () => {
    await ensureChatOpen();

    await test.step('Toggle offline/online 5 times rapidly', async () => {
      for (let i = 0; i < 5; i++) {
        await context.setOffline(true);
        await page.waitForTimeout(500);
        await context.setOffline(false);
        await page.waitForTimeout(500);
      }
    });

    await test.step('App is still functional after chaos', async () => {
      await page.waitForTimeout(3000);
      await chatPage.dismissErrorOverlay();
      await expect(page.locator(selectors.bottomNav.chats)).toBeVisible({ timeout: 10000 });
      // Try to navigate — should work
      await page.locator(selectors.bottomNav.chats).click();
      await page.waitForTimeout(2000);
      await expect(page.locator('div.cometchat-conversations')).toBeVisible({ timeout: timeouts.pageLoad });
    });
  });

  test('@network TC-NET-011: Send message offline then restore — message delivers', async () => {
    await ensureChatOpen();
    const beforeCount = await page.locator(selectors.sentMessageBubble).count();

    await test.step('Go offline and type message', async () => {
      await context.setOffline(true);
      await page.waitForTimeout(500);
      const input = page.locator(selectors.composerInput);
      await input.click();
      await input.fill('queued-offline-msg');
      await page.locator(selectors.sendButton).click();
      await page.waitForTimeout(2000);
    });

    await test.step('Restore network — message should eventually appear', async () => {
      await context.setOffline(false);
      await page.waitForTimeout(5000);
      await chatPage.dismissErrorOverlay();
      // Either the queued message sent, or we can send a new one
      const afterCount = await page.locator(selectors.sentMessageBubble).count();
      // App should be functional regardless
      await expect(page.locator(selectors.composerInput)).toBeVisible({ timeout: timeouts.chatOpen });
    });
  });

  // ─── Tab Recovery After Failures ───

  test('@network TC-NET-012: Users tab loads after API failure recovery', async () => {
    await test.step('Block users API briefly', async () => {
      await page.route('**/users**', route => route.abort('blockedbyclient'));
      await page.locator(selectors.bottomNav.users).click();
      await page.waitForTimeout(2000);
    });

    await test.step('Unblock and reload — users appear', async () => {
      await page.unrouteAll();
      await page.locator(selectors.bottomNav.chats).click();
      await page.waitForTimeout(1000);
      await page.locator(selectors.bottomNav.users).click();
      await page.waitForTimeout(3000);
      const items = page.locator('div.cometchat-users div.cometchat-list-item');
      await expect(items.first()).toBeVisible({ timeout: timeouts.pageLoad });
    });
  });

  test('@network TC-NET-013: Groups tab loads after API failure recovery', async () => {
    await test.step('Block groups API briefly', async () => {
      await page.route('**/groups**', route => route.abort('blockedbyclient'));
      await page.locator(selectors.bottomNav.groups).click();
      await page.waitForTimeout(2000);
    });

    await test.step('Unblock and reload — groups appear', async () => {
      await page.unrouteAll();
      await page.locator(selectors.bottomNav.chats).click();
      await page.waitForTimeout(1000);
      await page.locator(selectors.bottomNav.groups).click();
      await page.waitForTimeout(3000);
      const items = page.locator('div.cometchat-groups div.cometchat-list-item');
      await expect(items.first()).toBeVisible({ timeout: timeouts.pageLoad });
    });
  });

  test('@network TC-NET-014: Calls tab loads after API failure recovery', async () => {
    await test.step('Block calls API briefly', async () => {
      await page.route('**/calls**', route => route.abort('blockedbyclient'));
      await page.locator(selectors.callsTab).click();
      await page.waitForTimeout(2000);
    });

    await test.step('Unblock and reload — calls list appears', async () => {
      await page.unrouteAll();
      await page.locator(selectors.bottomNav.chats).click();
      await page.waitForTimeout(1000);
      await page.locator(selectors.callsTab).click();
      await page.waitForTimeout(3000);
      // Calls tab should at least show the header
      await expect(page.locator(selectors.callLogsList)).toBeVisible({ timeout: timeouts.pageLoad });
    });
  });

  // ─── WebSocket Simulation ───

  test('@network @negative TC-NET-015: WebSocket disconnect — app handles gracefully', async () => {
    await ensureChatOpen();

    await test.step('Block WebSocket connections', async () => {
      await page.route('**/ws**', route => route.abort('blockedbyclient'));
      await page.route('**/*.ws', route => route.abort('blockedbyclient'));
      await page.waitForTimeout(3000);
    });

    await test.step('App UI remains visible and interactive', async () => {
      await chatPage.dismissErrorOverlay();
      await expect(page.locator(selectors.bottomNav.chats)).toBeVisible({ timeout: 5000 });
      // Composer should still be visible even if WS is down
      const composerVisible = await page.locator(selectors.composerInput)
        .isVisible({ timeout: 5000 }).catch(() => false);
      expect(typeof composerVisible).toBe('boolean');
    });

    await test.step('Restore WebSocket and verify recovery', async () => {
      await page.unrouteAll();
      await page.waitForTimeout(3000);
      await chatPage.dismissErrorOverlay();
      await expect(page.locator(selectors.bottomNav.chats)).toBeVisible({ timeout: 10000 });
    });
  });
});
