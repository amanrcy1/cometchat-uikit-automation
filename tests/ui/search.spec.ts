import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { UsersPage } from '../../lib/pages/UsersPage';
import { GroupsPage } from '../../lib/pages/GroupsPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { TestConfig } from '../../lib/utils/test-config';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * In-Chat Message Search — full coverage for 1:1 and Group chats.
 *
 * Search UI architecture (discovered via DOM inspection):
 *   - Header button `button[title="Search"]` opens a modal `div.cometchat-search-view`
 *   - Modal contains: title "Search Messages", close button, search input, clear button,
 *     initial view ("Start Your Search"), 5 filter tabs (Audio/Documents/Photos/Videos/Links),
 *     results list `div.cometchat-search__results`, and empty view ("No Results")
 *   - Each result is `div.cometchat-search-messages__list-item` with sender, subtitle (message text), date
 *   - Search is debounced (~1s)
 *
 * Coverage — 1:1 chat (TC-SEARCH-001 to TC-SEARCH-012):
 *   001  Header search button visible + clickable
 *   002  Opens search modal with title and initial view
 *   003  5 filter tabs visible (Audio/Documents/Photos/Videos/Links)
 *   004  Type keyword — results appear with matching text
 *   005  Case-insensitive matching
 *   006  Partial word matching
 *   007  Non-existent keyword shows empty state
 *   008  Clear button resets input and returns to initial view
 *   009  Media filter tabs filter results correctly
 *   010  Typing triggers results; clearing restores initial view
 *   011  Close button hides search modal
 *   012  Empty keyword shows initial view (not empty state)
 *
 * Coverage — Group chat (TC-SEARCH-013 to TC-SEARCH-018):
 *   013  Group search button opens search modal
 *   014  Keyword match in group returns results
 *   015  Non-existent keyword in group shows empty state
 *   016  Clear resets search in group
 *   017  Filter tabs work in group search
 *   018  Close button in group search
 */

async function createContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: TestConfig.baseURL,
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  return { context, page };
}

// Unique keyword per run so we can guarantee a known match
const runId = Date.now().toString().slice(-6);
const uniqueKeyword = `srchtst${runId}`;

// ══════════════════════════════════════════════════════════════════════════════
// 1:1 CHAT SEARCH
// ══════════════════════════════════════════════════════════════════════════════

test.describe('1:1 Chat → Message Search', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let usersPage: UsersPage;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss('1:1 Chat Search');
    usersPage = new UsersPage(page);

    const conversationList = new ConversationListPage(page);
    await conversationList.goto();
    await new LoginPage(page).ensureLoggedIn(TestConfig.login.sampleUserUid);

    // Open 1:1 chat with George Alan
    await usersPage.navigateToUsersTab();
    await usersPage.searchUser(TestConfig.chatTargets.user);
    await usersPage.openUserChat(TestConfig.chatTargets.user);
    await chatPage.waitForChatReady();

    // Seed the conversation with known-searchable messages
    await chatPage.sendTextMessage(`${uniqueKeyword} alpha`);
    await chatPage.verifyTextSent(`${uniqueKeyword} alpha`);
    await chatPage.sendTextMessage(`${uniqueKeyword} bravo`);
    await chatPage.verifyTextSent(`${uniqueKeyword} bravo`);
    await chatPage.sendTextMessage('Hello World case check');
    await chatPage.verifyTextSent('Hello World case check');
  });

  test.afterAll(async () => {
    await chatPage.drainRuntimeErrors();
    await context.close();
  });

  async function ensureUserChatOpen() {
    const composerVisible = await page.locator(TestConfig.selectors.composerInput)
      .isVisible({ timeout: 2000 }).catch(() => false);
    if (composerVisible) return;
    await usersPage.navigateToUsersTab();
    await usersPage.searchUser(TestConfig.chatTargets.user);
    await usersPage.openUserChat(TestConfig.chatTargets.user);
    await chatPage.waitForChatReady();
  }

  test.beforeEach(async () => {
    // Close leftover search modal
    const searchModal = page.locator(TestConfig.selectors.chatSearchView);
    if (await searchModal.isVisible({ timeout: 500 }).catch(() => false)) {
      const closeBtn = page.locator(TestConfig.selectors.chatSearchCloseButton).first();
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }
    await chatPage.dismissErrorOverlay();
    await ensureUserChatOpen();
  });

  test('@smoke @search @chat TC-SEARCH-001: Header search button is visible and clickable', async () => {
    await test.step('Search button visible in chat header', async () => {
      const btn = page.locator(TestConfig.selectors.chatSearchButton).first();
      await expect(btn).toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
      await expect(btn).toBeEnabled();
    });
  });

  test('@smoke @sanity @search @chat TC-SEARCH-002: Click opens search modal with title and initial view', async () => {
    await test.step('Open search', async () => {
      await chatPage.openChatSearch();
      await chatPage.verifySearchViewVisible();
    });
    await test.step('Title is "Search Messages"', async () => {
      await expect(page.locator(TestConfig.selectors.chatSearchViewTitle))
        .toHaveText('Search Messages', { timeout: TestConfig.timeouts.chatOpen });
    });
    await test.step('Initial view is shown before typing', async () => {
      await chatPage.verifySearchInitialState();
    });
    await test.step('Close search', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@sanity @search @chat TC-SEARCH-003: All 5 filter tabs are visible', async () => {
    await test.step('Open search', async () => {
      await chatPage.openChatSearch();
    });
    await test.step('Audio, Documents, Photos, Videos, Links all visible', async () => {
      await chatPage.verifySearchFiltersVisible();
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@smoke @sanity @search @chat TC-SEARCH-004: Typing a known keyword returns matching results', async () => {
    await test.step('Open search and type keyword', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword(uniqueKeyword);
    });
    await test.step('At least one result appears (retries on indexing latency)', async () => {
      await chatPage.verifySearchHasResults(1, uniqueKeyword);
    });
    await test.step('Result subtitle contains the keyword', async () => {
      await chatPage.verifyResultContainsText(uniqueKeyword);
    });
    await test.step('We sent 2 messages with this keyword — expect at least 1 result', async () => {
      const count = await chatPage.getSearchResultCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@regression @search @chat TC-SEARCH-005: Search is case-insensitive', async () => {
    await test.step('Open search and type in UPPERCASE', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword('HELLO WORLD');
    });
    await test.step('Result appears matching lowercase message', async () => {
      await chatPage.verifySearchHasResults(1, 'HELLO WORLD');
      await chatPage.verifyResultContainsText('Hello World');
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@regression @search @chat TC-SEARCH-006: Partial word matching', async () => {
    await test.step('Search with a substring of the full keyword', async () => {
      await chatPage.openChatSearch();
      // uniqueKeyword is "srchtstXXXXXX" — search just first 7 chars
      await chatPage.typeSearchKeyword(uniqueKeyword.substring(0, 7));
    });
    await test.step('Results still include full keyword match', async () => {
      await chatPage.verifySearchHasResults(1, uniqueKeyword.substring(0, 7));
      await chatPage.verifyResultContainsText(uniqueKeyword);
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@sanity @search @chat @negative TC-SEARCH-007: Non-existent keyword shows empty state', async () => {
    await test.step('Open search and type random keyword', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword('zzz_xx_nonexistent_99999');
    });
    await test.step('"No Results" empty view appears', async () => {
      await chatPage.verifySearchEmptyState();
      await expect(page.locator(TestConfig.selectors.chatSearchEmptyDescription))
        .toContainText(/couldn.?t find/i, { timeout: TestConfig.timeouts.chatOpen });
    });
    await test.step('No result items rendered', async () => {
      const count = await chatPage.getSearchResultCount();
      expect(count).toBe(0);
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@regression @search @chat TC-SEARCH-008: Clear button resets input and returns to initial view', async () => {
    await test.step('Type a keyword to trigger results', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword(uniqueKeyword);
      await chatPage.verifySearchHasResults(1, uniqueKeyword);
    });
    await test.step('Clear button visible and clickable', async () => {
      await expect(page.locator(TestConfig.selectors.chatSearchClearButton).first())
        .toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
      await chatPage.clearSearchViaButton();
    });
    await test.step('Input is empty', async () => {
      await chatPage.verifySearchInputValue('');
    });
    await test.step('Initial view is shown again', async () => {
      await chatPage.verifySearchInitialState();
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@regression @search @chat @media TC-SEARCH-009: Filter tabs filter results correctly', async () => {
    // UIKit behavior: once a filter is selected, other filter tabs are removed from the DOM.
    // To test each filter we reopen the search view each time.
    const filters = ['Audio', 'Documents', 'Photos', 'Videos', 'Links'] as const;
    for (const f of filters) {
      await test.step(`${f} filter shows empty state for text-only chat`, async () => {
        await ensureUserChatOpen();
        await chatPage.openChatSearch();
        await chatPage.typeSearchKeyword(uniqueKeyword);
        await chatPage.verifySearchHasResults(1, uniqueKeyword);
        await chatPage.selectSearchFilter(f);
        await chatPage.verifySearchEmptyState();
        await chatPage.closeChatSearch();
      });
    }
  });

  test('@regression @search @chat TC-SEARCH-010: Typing then clearing restores initial view', async () => {
    await test.step('Open and type', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword(uniqueKeyword);
      await chatPage.verifySearchHasResults(1, uniqueKeyword);
    });
    await test.step('Manually clear input via keyboard', async () => {
      const input = page.locator(TestConfig.selectors.chatSearchInput).first();
      await input.fill('');
      await page.waitForTimeout(1000);
    });
    await test.step('Initial view is back', async () => {
      await chatPage.verifySearchInitialState();
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@smoke @search @chat TC-SEARCH-011: Close button hides search modal', async () => {
    await test.step('Open search', async () => {
      await chatPage.openChatSearch();
    });
    await test.step('Click close button', async () => {
      const closeBtn = page.locator(TestConfig.selectors.chatSearchCloseButton).first();
      await expect(closeBtn).toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
      await closeBtn.click({ force: true });
    });
    await test.step('Search modal is no longer visible', async () => {
      await expect(page.locator(TestConfig.selectors.chatSearchView))
        .not.toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
    });
    await test.step('Composer is back and interactive', async () => {
      await expect(page.locator(TestConfig.selectors.composerInput))
        .toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
    });
  });

  test('@regression @search @chat @negative TC-SEARCH-012: Empty keyword shows initial view (not empty state)', async () => {
    await test.step('Open search — input starts empty', async () => {
      await chatPage.openChatSearch();
      await chatPage.verifySearchInputValue('');
    });
    await test.step('Initial view is shown, NOT empty state', async () => {
      await chatPage.verifySearchInitialState();
      const emptyVisible = await page.locator(TestConfig.selectors.chatSearchEmptyView)
        .isVisible({ timeout: 2000 }).catch(() => false);
      expect(emptyVisible).toBeFalsy();
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP CHAT SEARCH
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group Chat → Message Search', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let groupsPage: GroupsPage;
  let groupName: string;
  const groupKeyword = `grpsrch${runId}`;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss('Group Chat Search');
    groupsPage = new GroupsPage(page);

    const conversationList = new ConversationListPage(page);
    await conversationList.goto();
    await new LoginPage(page).ensureLoggedIn(TestConfig.login.sampleUserUid);

    // Create a fresh group so results are predictable
    groupName = await groupsPage.createNewGroupAndOpen();
    await chatPage.waitForChatReady();

    // Seed with known-searchable messages
    await chatPage.sendTextMessage(`${groupKeyword} one`);
    await chatPage.verifyTextSent(`${groupKeyword} one`);
    await chatPage.sendTextMessage(`${groupKeyword} two`);
    await chatPage.verifyTextSent(`${groupKeyword} two`);
    await chatPage.sendTextMessage('Group greeting message');
    await chatPage.verifyTextSent('Group greeting message');
  });

  test.afterAll(async () => {
    // Cleanup — delete the group
    try {
      await chatPage.openGroupDetails();
      await chatPage.deleteAndExitGroup();
    } catch { /* best-effort cleanup */ }
    await chatPage.drainRuntimeErrors();
    await context.close();
  });

  // Ensure the group chat is re-opened before every test (state can be lost between tests)
  test.beforeEach(async () => {
    // Close any leftover search modal
    const searchModal = page.locator(TestConfig.selectors.chatSearchView);
    if (await searchModal.isVisible({ timeout: 500 }).catch(() => false)) {
      const closeBtn = page.locator(TestConfig.selectors.chatSearchCloseButton).first();
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }

    // Dismiss any overlays that could block clicks
    await chatPage.dismissErrorOverlay();

    // Are we already in the group chat? Check for composer AND the group name in header
    const composerVisible = await page.locator(TestConfig.selectors.composerInput)
      .isVisible({ timeout: 2000 }).catch(() => false);
    if (composerVisible) return;

    // Otherwise navigate back to the group
    await groupsPage.navigateToGroupsTab();
    await groupsPage.searchGroup(groupName);
    await page.waitForTimeout(1500);
    const groupItem = page.locator(TestConfig.selectors.groupsListItem(groupName)).first();
    await expect(groupItem).toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
    await groupItem.click();
    await page.waitForTimeout(2500);
    await chatPage.waitForChatReady();
    // Clear the sidebar search to avoid filter state bleeding
    await groupsPage.clearGroupSearch().catch(() => {});
  });

  test('@smoke @search @group TC-SEARCH-013: Group chat search button opens modal', async () => {
    await test.step('Search button visible in group chat header', async () => {
      const btn = page.locator(TestConfig.selectors.chatSearchButton).first();
      await expect(btn).toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
    });
    await test.step('Clicking opens the search modal', async () => {
      await chatPage.openChatSearch();
      await chatPage.verifySearchInitialState();
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@sanity @search @group TC-SEARCH-014: Keyword match in group returns results', async () => {
    await test.step('Open and type group keyword', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword(groupKeyword);
    });
    await test.step('Results appear with matching text (retries on indexing latency)', async () => {
      await chatPage.verifySearchHasResults(1, groupKeyword);
      await chatPage.verifyResultContainsText(groupKeyword);
    });
    await test.step('At least 1 seeded message appears', async () => {
      const count = await chatPage.getSearchResultCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@sanity @search @group @negative TC-SEARCH-015: Non-existent keyword in group shows empty state', async () => {
    await test.step('Search random keyword', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword('zzz_group_nonexistent_99999');
    });
    await test.step('Empty view shown', async () => {
      await chatPage.verifySearchEmptyState();
    });
    await test.step('No results rendered', async () => {
      expect(await chatPage.getSearchResultCount()).toBe(0);
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@regression @search @group TC-SEARCH-016: Clear button resets group search', async () => {
    await test.step('Type keyword → results appear', async () => {
      await chatPage.openChatSearch();
      await chatPage.typeSearchKeyword(groupKeyword);
      await chatPage.verifySearchHasResults(1, groupKeyword);
    });
    await test.step('Click clear', async () => {
      await chatPage.clearSearchViaButton();
    });
    await test.step('Input empty and initial view restored', async () => {
      await chatPage.verifySearchInputValue('');
      await chatPage.verifySearchInitialState();
    });
    await test.step('Close', async () => {
      await chatPage.closeChatSearch();
    });
  });

  test('@regression @search @group @media TC-SEARCH-017: Filter tabs work in group search', async () => {
    // UIKit hides sibling filter tabs once a filter is selected — reopen search for each filter
    for (const f of ['Audio', 'Documents', 'Photos', 'Videos', 'Links'] as const) {
      await test.step(`${f} filter shows empty state for text-only group`, async () => {
        await chatPage.openChatSearch();
        await chatPage.typeSearchKeyword(groupKeyword);
        await chatPage.verifySearchHasResults(1, groupKeyword);
        await chatPage.selectSearchFilter(f);
        await chatPage.verifySearchEmptyState();
        await chatPage.closeChatSearch();
      });
    }
  });

  test('@smoke @search @group TC-SEARCH-018: Close button exits group search', async () => {
    await test.step('Open search', async () => {
      await chatPage.openChatSearch();
    });
    await test.step('Close via close button', async () => {
      await chatPage.closeChatSearch();
    });
    await test.step('Group chat composer is visible again', async () => {
      await expect(page.locator(TestConfig.selectors.composerInput))
        .toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
    });
  });
});
