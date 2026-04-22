import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { UsersPage } from '../../lib/pages/UsersPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { CallsPage } from '../../lib/pages/CallsPage';
import { TestConfig } from '../../lib/utils/test-config';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';
const { selectors, timeouts } = TestConfig;

/**
 * Calls Tab — Call Logs
 *   @smoke @sanity @calls TC-CALL-001: Navigate to Calls tab and verify list structure
 *   @sanity @calls @details TC-CALL-002: Open call details and verify all panel contents
 *   @regression @calls @details TC-CALL-003: Participants tab — verify content
 *   @regression @calls @details TC-CALL-004: Recording tab — verify empty state
 *   @regression @calls @details TC-CALL-005: History tab — verify entries
 *   @sanity @calls TC-CALL-006: Initiate voice call from details and cancel
 *   @sanity @calls TC-CALL-007: Initiate video call from details and cancel
 *   @regression @calls TC-CALL-008: Switch to a different call log entry
 */

async function createContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: TestConfig.baseURL,
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  return { context, page: await context.newPage() };
}

/**
 * Ensure at least one call log entry exists.
 * Strategy:
 *   1. Navigate to Calls tab — if entries already exist, done.
 *   2. If empty, generate a call log by initiating + cancelling a voice call.
 *   3. Retry navigating to Calls tab up to 3 times with increasing wait.
 *   4. Only throw if still empty after all retries.
 */
async function ensureCallLogExists(page: Page, chatPage: ChatPage): Promise<void> {
  const callsTabSel = selectors.callsTab;
  const callItemSel = selectors.callLogItem;

  // Navigate to Calls tab
  await page.locator(callsTabSel).click();
  await page.waitForTimeout(2000);

  // Check if entries already exist
  const existingCount = await page.locator(callItemSel).count();
  if (existingCount > 0) return;

  // No entries — generate a call log
  console.log('[callsTab] No call logs found — generating one via voice call...');
  await page.locator(selectors.bottomNav.chats).click();
  await page.waitForTimeout(1000);

  // Open chat with target user (try conversation list first, then Users tab)
  let chatReady = false;
  const convItem = page.locator(selectors.conversationItem(TestConfig.chatTargets.user)).first();
  if (await convItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await convItem.click();
    await page.waitForTimeout(1500);
    chatReady = true;
  } else {
    const usersPage = new UsersPage(page);
    try {
      await usersPage.searchAndOpenChat(TestConfig.chatTargets.user);
      chatReady = true;
    } catch {
      console.log('[callsTab] Could not open chat via Users tab either');
    }
  }

  if (chatReady) {
    await chatPage.waitForChatReady();
    await chatPage.initiateVoiceCall();
    await chatPage.cancelOutgoingCall();
  }

  // Retry navigating to Calls tab up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wait = attempt * 3000;
    console.log(`[callsTab] Waiting ${wait}ms for call log to register (attempt ${attempt}/3)...`);
    await page.waitForTimeout(wait);
    await page.locator(callsTabSel).click();
    await page.waitForTimeout(2000);
    const count = await page.locator(callItemSel).count();
    if (count > 0) {
      console.log(`[callsTab] Call log appeared after attempt ${attempt}`);
      return;
    }
    // Go back to chats between retries
    if (attempt < 3) {
      await page.locator(selectors.bottomNav.chats).click();
      await page.waitForTimeout(500);
    }
  }

  // Final check — if still empty, throw a clear error
  const finalCount = await page.locator(callItemSel).count();
  if (finalCount === 0) {
    throw new Error('[callsTab] No call log entries found after generating a call and 3 retries. Check app connectivity.');
  }
}

test.describe('Calls Tab → Call Logs', () => {
  let context: BrowserContext;
  let page: Page;
  let callsPage: CallsPage;
  let chatPage: ChatPage;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    callsPage = new CallsPage(page);
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();

    const conversationList = new ConversationListPage(page);
    await conversationList.goto();
    await new LoginPage(page).ensureLoggedIn(TestConfig.login.sampleUserUid);

    // Smart setup: ensure call log exists, auto-generate if missing
    await ensureCallLogExists(page, chatPage);
  });

  test.afterAll(async () => { await chatPage.drainRuntimeErrors(); await context.close(); });

  test('@smoke @sanity @calls TC-CALL-001: Navigate to Calls tab and verify list structure', async () => {
    await test.step('Navigate to Calls tab — header visible', async () => {
      await callsPage.navigateToCallsTab();
      await callsPage.verifyCallsHeaderVisible();
    });
    await test.step('At least one call log entry exists', async () => {
      await callsPage.verifyCallLogEntriesExist();
      const count = await page.locator(selectors.callLogItem).count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
    await test.step('Entry has avatar, name, date, direction icon, trailing icon', async () => {
      await callsPage.verifyCallLogEntryStructure(TestConfig.chatTargets.user);
    });
    await test.step('Entry name matches expected user', async () => {
      await expect(page.locator(selectors.callLogItemName).first())
        .toHaveText(TestConfig.chatTargets.user, { timeout: timeouts.chatOpen });
    });
    await test.step('Entry date is non-empty', async () => {
      const dateText = await page.locator(selectors.callLogItemSubtitle).first().textContent();
      expect(dateText?.trim().length).toBeGreaterThan(0);
    });
  });

  test('@sanity @calls @details TC-CALL-002: Open call details and verify all panel contents', async () => {
    await test.step('Click first entry — details panel opens', async () => {
      await callsPage.openCallDetails();
    });
    await test.step('Panel shows user name, subtitle, call info, buttons, tabs', async () => {
      await callsPage.verifyCallDetailsPanelContent(TestConfig.chatTargets.user);
    });
    await test.step('Call info title is non-empty', async () => {
      const title = await page.locator(selectors.callLogInfoTitle).textContent();
      expect(title?.trim().length).toBeGreaterThan(0);
    });
    await test.step('Duration field is visible', async () => {
      await expect(page.locator(selectors.callLogInfoDuration)).toBeVisible({ timeout: timeouts.chatOpen });
    });
    await test.step('Voice and video call buttons are enabled', async () => {
      await expect(page.locator(selectors.callDetailsVoiceCallButton)).toBeEnabled();
      await expect(page.locator(selectors.callDetailsVideoCallButton)).toBeEnabled();
    });
    await test.step('All 3 tabs (Participants, Recording, History) are visible', async () => {
      for (const tab of ['Participants', 'Recording', 'History']) {
        await expect(page.locator(selectors.callDetailsTabItem(tab))).toBeVisible({ timeout: timeouts.chatOpen });
      }
    });
  });

  test('@regression @calls @details TC-CALL-003: Participants tab — verify content', async () => {
    await test.step('Switch to Participants tab — active state updates', async () => {
      await callsPage.switchToTab('Participants');
      await expect(page.locator(selectors.callDetailsActiveTab)).toContainText('Participants');
    });
    await test.step('Participant name visible', async () => {
      await callsPage.verifyParticipantsTab('Andrew Joseph');
    });
    await test.step('Participant duration column visible', async () => {
      await expect(page.locator(selectors.callLogParticipantDuration).first()).toBeVisible({ timeout: timeouts.chatOpen });
    });
  });

  test('@regression @calls @details TC-CALL-004: Recording tab — verify empty state', async () => {
    await test.step('Switch to Recording tab — active state updates', async () => {
      await callsPage.switchToTab('Recording');
      await expect(page.locator(selectors.callDetailsActiveTab)).toContainText('Recording');
    });
    await test.step('Empty state message is "No recording available"', async () => {
      await callsPage.verifyRecordingTabEmptyState();
    });
  });

  test('@regression @calls @details TC-CALL-005: History tab — verify entries', async () => {
    await test.step('Switch to History tab — active state updates', async () => {
      await callsPage.switchToTab('History');
      await expect(page.locator(selectors.callDetailsActiveTab)).toContainText('History');
    });
    await test.step('History entries have title, subtitle, duration', async () => {
      await callsPage.verifyHistoryTab();
    });
    await test.step('History title is non-empty', async () => {
      const text = await page.locator(selectors.callLogHistoryTitle).first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });
  });

  test('@sanity @calls TC-CALL-006: Initiate voice call from details and cancel', async () => {
    await test.step('Click voice call button — outgoing overlay appears', async () => {
      await callsPage.initiateVoiceCallFromDetails();
    });
    await test.step('Overlay shows correct name and "Calling..." subtitle', async () => {
      await callsPage.verifyOutgoingCallUI(TestConfig.chatTargets.user);
    });
    await test.step('Cancel — overlay disappears', async () => {
      await callsPage.cancelOutgoingCall();
      await expect(page.locator(selectors.outgoingCallOverlay)).not.toBeVisible({ timeout: timeouts.chatOpen });
    });
  });

  test('@sanity @calls TC-CALL-007: Initiate video call from details and cancel', async () => {
    await test.step('Click video call button — outgoing overlay appears', async () => {
      await callsPage.initiateVideoCallFromDetails();
    });
    await test.step('Overlay shows correct name and "Calling..." subtitle', async () => {
      await callsPage.verifyOutgoingCallUI(TestConfig.chatTargets.user);
    });
    await test.step('Cancel — overlay disappears', async () => {
      await callsPage.cancelOutgoingCall();
      await expect(page.locator(selectors.outgoingCallOverlay)).not.toBeVisible({ timeout: timeouts.chatOpen });
    });
  });

  test('@regression @calls TC-CALL-008: Switch to a different call log entry', async () => {
    await test.step('At least one entry exists in the list', async () => {
      await callsPage.verifyCallLogEntriesExist();
      const count = await page.locator(selectors.callLogItem).count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
    await test.step('Click second entry (or first if only one) — details panel updates', async () => {
      const count = await page.locator(selectors.callLogItem).count();
      const idx = count > 1 ? 1 : 0;
      await callsPage.openCallDetails(idx);
    });
    await test.step('Details panel is visible with user name', async () => {
      await expect(page.locator(selectors.callDetailsPanel)).toBeVisible({ timeout: timeouts.chatOpen });
      await expect(page.locator(selectors.callDetailsName)).toBeVisible({ timeout: timeouts.chatOpen });
    });
  });
});
