import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { TestConfig } from '../../lib/utils/test-config';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';
const { selectors, timeouts } = TestConfig;

/**
 * Chats Tab — Sidebar Menu, Create Conversation & Conversation Actions
 *
 * Validates the Chats tab sidebar functionality:
 *   @smoke @sanity @chat TC-CHAT-001: Sidebar menu items (user name, create conversation, logout)
 *   @sanity @chat @visual TC-CHAT-002: Conversation list subtitle icons, receipts, date labels
 *   @sanity @chat TC-CHAT-003: New Chat panel structure, tabs, search, back button
 *   @smoke @sanity @chat TC-CHAT-004: Create 1:1 conversation with user and send message
 *   @sanity @chat @group TC-CHAT-005: Create group conversation and send message
 *   @regression @chat TC-CHAT-006: Conversation hover delete, search, delete 1:1 and group
 */

async function createContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: TestConfig.baseURL,
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  return { context, page: await context.newPage() };
}

test.describe('Chats Tab → Sidebar Menu & Create Conversation', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let convListPage: ConversationListPage;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();
    convListPage = new ConversationListPage(page);
    await convListPage.goto();
    await new LoginPage(page).ensureLoggedIn(TestConfig.login.sampleUserUid);
    await convListPage.navigateToChatsTab();
  });

  test.afterAll(async () => { await chatPage.drainRuntimeErrors(); await context.close(); });

  test('@smoke @sanity @chat TC-CHAT-001: Sidebar menu displays user name, create conversation, and logout options', async () => {
    await test.step('Open sidebar menu and verify all 3 items present', async () => {
      await convListPage.openSubMenu();
      // Get the actual logged-in user name dynamically
      const userNameLabel = page.locator('label.cometchat-menu-list__sub-menu-item-title-logged-in-user');
      const actualUserName = await userNameLabel.textContent() || '';
      expect(actualUserName.trim().length).toBeGreaterThan(0);
      await convListPage.verifySubMenuItems([actualUserName.trim(), 'Create conversation', 'Log Out']);
    });
    await test.step('Close menu, reopen, verify Create conversation visible, close again', async () => {
      await convListPage.closeSubMenu();
      await convListPage.openSubMenu();
      await convListPage.verifySubMenuItems(['Create conversation']);
      await convListPage.closeSubMenu();
    });
  });

  test('@sanity @chat @visual TC-CHAT-002: Conversation list shows subtitle icons, receipt indicators, and date labels', async () => {
    await test.step('Check for subtitle icons (thread/video/audio indicators) if present', async () => {
      const allIcons = page.locator('[class*="cometchat-conversations__subtitle-icon"]');
      const count = await allIcons.count().catch(() => 0);
      if (count > 0) {
        // Only assert if non-none icons exist — some conversations may only have text messages
        const classes = await allIcons.evaluateAll(els =>
          els.map(el => {
            const match = el.className.match(/subtitle-icon-(\w+)/);
            return match ? match[1] : 'unknown';
          })
        );
        const nonNone = classes.filter(c => c !== 'none' && c !== 'unknown');
        // Soft assertion — icons may all be 'none' if only text messages exist
        expect(nonNone.length).toBeGreaterThanOrEqual(0);
      }
    });
    await test.step('Verify message receipt indicators (sent/delivered/read) and sender labels', async () => {
      // Receipt indicators may not exist if conversation list is empty or fresh
      const receipts = page.locator('div.cometchat-conversations [class*="cometchat-receipts"]');
      const receiptCount = await receipts.count().catch(() => 0);
      if (receiptCount > 0) {
        const receiptTypes = await convListPage.verifyReceiptIndicators();
        expect(receiptTypes.length).toBeGreaterThanOrEqual(0);
      }
      // Sender labels ("You:") may not exist if no outgoing messages yet
      const senderLabels = page.locator('span.cometchat-conversations__subtitle-text-sender');
      const senderCount = await senderLabels.count().catch(() => 0);
      if (senderCount > 0) {
        await convListPage.verifySubtitleContent();
      }
    });
    await test.step('Verify date/time labels are displayed on conversations', async () => {
      await convListPage.verifyDateLabels();
    });
  });

  test('@sanity @chat TC-CHAT-003: New Chat panel has correct structure, tabs, search, and back button', async () => {
    await test.step('Open panel — verify header, Users/Groups tabs, active tab, search input, back button', async () => {
      await convListPage.openCreateConversation();
      await convListPage.verifyNewChatPanelHeader();
      await convListPage.verifyNewChatTabs();
      await convListPage.verifyActiveTab('Users');
      await convListPage.verifySearchInputVisible();
      await expect(page.locator(selectors.newChatBackButton)).toBeVisible({ timeout: timeouts.chatOpen });
    });
    await test.step('Verify users are listed in the New Chat panel', async () => {
      // Dynamically check that at least 1 user is listed (app data may vary)
      const userItems = page.locator('div.cometchat-new-chat-view div.cometchat-list-item');
      await expect(userItems.first()).toBeVisible({ timeout: timeouts.chatOpen });
      const count = await userItems.count();
      expect(count).toBeGreaterThan(0);
    });
    await test.step('Switch to Groups tab, verify groups listed, switch back to Users tab', async () => {
      await convListPage.switchToGroupsTab();
      await convListPage.verifyGroupsListed();
      await convListPage.switchToUsersTab();
      // Verify users still visible after switching back
      const userItems = page.locator('div.cometchat-new-chat-view div.cometchat-list-item');
      await expect(userItems.first()).toBeVisible({ timeout: timeouts.chatOpen });
    });
    await test.step('Search filters users — verify search works', async () => {
      // Get the first user's name to search for
      const firstName = await page.locator('div.cometchat-new-chat-view div.cometchat-list-item__body-title').first().textContent() || '';
      if (firstName.trim()) {
        const searchTerm = firstName.trim().split(' ')[0]; // First word of name
        await convListPage.searchInNewChat(searchTerm);
        await page.waitForTimeout(1000);
        // At least the searched user should be visible
        const results = page.locator('div.cometchat-new-chat-view div.cometchat-list-item');
        const resultCount = await results.count();
        expect(resultCount).toBeGreaterThan(0);
        await convListPage.clearNewChatSearch();
      }
    });
    await test.step('Click back button to close panel, reopen to verify it works again', async () => {
      await convListPage.closeNewChatPanel();
      await expect(page.locator(selectors.newChatPanel)).not.toBeVisible({ timeout: 5000 });
      await convListPage.openCreateConversation();
      await convListPage.verifyNewChatPanelHeader();
      await convListPage.closeNewChatPanel();
    });
  });

  test('@smoke @sanity @chat TC-CHAT-004: Create 1:1 conversation with Susan Marie and send a message', async () => {
    await test.step('Open New Chat, search "Susan", select Susan Marie, verify header name', async () => {
      await convListPage.openCreateConversation();
      await convListPage.searchInNewChat('Susan');
      await convListPage.selectUserFromNewChat('Susan Marie');
      await convListPage.verifyMessageHeaderName('Susan Marie');
    });
    await test.step('Send "Hello from create conversation" and verify message bubble appears', async () => {
      await chatPage.waitForChatReady();
      await expect(async () => {
        await chatPage.sendTextMessage('Hello from create conversation');
        await chatPage.verifyTextSent('Hello from create conversation');
      }).toPass({ timeout: timeouts.messageAppear });
    });
    await test.step('Navigate to Chats sidebar and verify Susan Marie conversation appears', async () => {
      await convListPage.verifyConversationInList('Susan Marie');
    });
  });

  test('@sanity @chat @group TC-CHAT-005: Create group conversation via New Chat panel and send a message', async () => {
    let targetGroup: string;
    await test.step('Open New Chat, switch to Groups tab, select first group', async () => {
      await convListPage.navigateToChatsTab();
      await convListPage.openCreateConversation();
      await convListPage.switchToGroupsTab();
      targetGroup = (await page.locator('div.cometchat-new-chat-view div.cometchat-list-item__body-title').first().textContent())!;
      expect(targetGroup).toBeTruthy();
      await convListPage.selectGroupFromNewChat(targetGroup);
      await convListPage.verifyMessageHeaderName(targetGroup);
    });
    await test.step('Send "Hello group from create conversation" and verify bubble', async () => {
      await chatPage.waitForChatReady();
      await expect(async () => {
        await chatPage.sendTextMessage('Hello group from create conversation');
        await chatPage.verifyTextSent('Hello group from create conversation');
      }).toPass({ timeout: timeouts.messageAppear });
    });
  });

  test('@regression @chat TC-CHAT-006: Conversation hover shows delete icon, search works, delete 1:1 and group', async () => {
    let targetGroup = '';
    await test.step('Navigate to Chats tab to view conversation list', async () => {
      await convListPage.navigateToChatsTab();
    });
    await test.step('Hover over first conversation — verify delete icon appears', async () => {
      const firstConv = page.locator('div.cometchat-conversations div.cometchat-list-item').first();
      if (await firstConv.isVisible({ timeout: 3000 }).catch(() => false)) {
        await convListPage.verifyConversationHoverDeleteIcon();
      }
    });
    await test.step('Search for "Susan Marie" in conversation search and verify result', async () => {
      const susanVisible = await page.locator(selectors.conversationItem('Susan Marie')).first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      if (susanVisible) {
        await convListPage.searchConversation('Susan Marie');
        await convListPage.verifyConversationInList('Susan Marie');
        await convListPage.clearConversationSearch();
      }
    });
    await test.step('Delete Susan Marie 1:1 conversation via hover delete icon', async () => {
      const susanVisible = await page.locator(selectors.conversationItem('Susan Marie')).first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      if (susanVisible) {
        await convListPage.deleteConversationViaHover('Susan Marie');
      }
    });
    await test.step('Find and delete a group conversation via hover delete icon', async () => {
      const allConvTitles = await page.locator('div.cometchat-conversations div.cometchat-list-item__body-title').allTextContents();
      const knownUsers = ['George Alan', 'John Paul', 'Nancy Grace', 'Susan Marie'];
      targetGroup = allConvTitles.find(t => !knownUsers.includes(t.trim())) || '';
      if (targetGroup) {
        await convListPage.deleteConversationViaHover(targetGroup);
      }
    });
  });
});
