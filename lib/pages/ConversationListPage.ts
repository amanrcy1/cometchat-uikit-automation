import { Page, expect } from '@playwright/test';
import { TestConfig } from '../utils/test-config';

const { selectors, timeouts } = TestConfig;

/**
 * Page Object for the conversation/chat list sidebar.
 * Handles the sidebar menu, "Create conversation" flow, and the New Chat panel.
 */
export class ConversationListPage {
  constructor(private page: Page) {}

  /** Navigate to the app and wait for initial page load */
  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded', timeout: timeouts.pageLoad });
  }

  /** Ensure we're on the Chats tab */
  async navigateToChatsTab() {
    const chatsTab = this.page.locator(selectors.bottomNav.chats);
    await expect(chatsTab).toBeVisible({ timeout: timeouts.pageLoad });
    // Remove all error overlays before clicking — they can intercept pointer events
    await this.page.evaluate(() => {
      document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
      document.querySelectorAll('iframe').forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 1000) el.remove();
      });
      document.querySelectorAll('body > div, body > section').forEach(el => {
        if (el.id === 'root') return;
        const s = window.getComputedStyle(el as HTMLElement);
        const t = (el as HTMLElement).innerText || '';
        if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 100 &&
            (t.includes('runtime error') || t.includes('Uncaught') || t.includes('ERROR'))) {
          (el as HTMLElement).remove();
        }
      });
    });
    await chatsTab.click();
    await expect(
      this.page.locator('div.cometchat-conversations')
    ).toBeVisible({ timeout: timeouts.pageLoad });
  }

  // ─── Sidebar Sub-Menu ───

  /**
   * Open the conversations header sub-menu (three-dot icon).
   * Retries — the menu uses a CSS opacity transition that can lag.
   */
  async openSubMenu() {
    await expect(async () => {
      // Dismiss any overlay before clicking
      await this.page.evaluate(() => {
        const t = document.body?.innerText || '';
        if (t.includes('Uncaught runtime error')) {
          document.querySelectorAll('button, span, a').forEach(el => {
            if (((el as HTMLElement).textContent?.trim() || '') === '×') (el as HTMLElement).click();
          });
        }
        document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
      }).catch(() => {});
      await this.page.locator(selectors.conversationsSubMenuIcon).click();
      await expect(
        this.page.locator(selectors.conversationsSubMenuItem('Create conversation'))
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  /** Close the sub-menu by clicking the icon again */
  async closeSubMenu() {
    await this.page.locator(selectors.conversationsSubMenuIcon).click();
    await expect(
      this.page.locator(selectors.conversationsSubMenuItem('Create conversation'))
    ).not.toBeVisible({ timeout: timeouts.attachMenu });
  }

  /** Verify all expected sub-menu items are present and visible */
  async verifySubMenuItems(expectedItems: string[]) {
    for (const title of expectedItems) {
      await expect(
        this.page.locator(selectors.conversationsSubMenuItem(title))
      ).toBeVisible({ timeout: timeouts.chatOpen });
    }
  }

  // ─── Create Conversation / New Chat Panel ───

  /**
   * Open the New Chat panel via sub-menu → "Create conversation".
   * Retries the full flow if the panel doesn't appear.
   */
  async openCreateConversation() {
    await expect(async () => {
      await this.page.locator(selectors.conversationsSubMenuIcon).click();
      const item = this.page.locator(selectors.createConversationItem);
      await expect(item).toBeVisible({ timeout: 2000 });
      await item.dispatchEvent('click');
      await expect(
        this.page.locator(selectors.newChatPanel)
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  /** Verify the New Chat panel header shows "New Chat" */
  async verifyNewChatPanelHeader() {
    await expect(
      this.page.locator(selectors.newChatHeaderTitle)
    ).toHaveText('New Chat', { timeout: timeouts.chatOpen });
  }

  /** Verify both Users and Groups tabs are visible */
  async verifyNewChatTabs() {
    await expect(this.page.locator(selectors.newChatUsersTab)).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.newChatGroupsTab)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Verify the given tab is currently active */
  async verifyActiveTab(tabName: 'Users' | 'Groups') {
    await expect(
      this.page.locator(selectors.newChatActiveTab)
    ).toContainText(tabName, { timeout: timeouts.chatOpen });
  }

  /** Verify the search input is visible in the New Chat panel */
  async verifySearchInputVisible() {
    await expect(
      this.page.locator(selectors.newChatSearchInput)
    ).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Verify specific users are listed in the New Chat panel */
  async verifyUsersListed(expectedUsers: string[]) {
    for (const name of expectedUsers) {
      await expect(
        this.page.locator(selectors.newChatUserItem(name))
      ).toBeVisible({ timeout: timeouts.chatOpen });
    }
  }

  /** Verify at least one group is listed in the New Chat panel */
  async verifyGroupsListed() {
    await expect(
      this.page.locator('div.cometchat-new-chat-view div.cometchat-list-item__body-title').first()
    ).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Switch to the Groups tab in the New Chat panel */
  async switchToGroupsTab() {
    await this.page.locator(selectors.newChatGroupsTab).click();
    await this.verifyActiveTab('Groups');
  }

  /** Switch to the Users tab in the New Chat panel */
  async switchToUsersTab() {
    await this.page.locator(selectors.newChatUsersTab).click();
    await this.verifyActiveTab('Users');
  }

  /** Search for a keyword in the New Chat panel */
  async searchInNewChat(keyword: string) {
    await this.page.locator(selectors.newChatSearchInput).fill(keyword);
    await this.page.waitForTimeout(800);
  }

  /** Clear the search input in the New Chat panel */
  async clearNewChatSearch() {
    await this.page.locator(selectors.newChatSearchInput).clear();
    await this.page.waitForTimeout(500);
  }

  /**
   * Click a user in the New Chat panel to start a conversation.
   * Retries — React can swallow the first click.
   */
  async selectUserFromNewChat(name: string) {
    await expect(async () => {
      await this.page.locator(selectors.newChatUserItem(name)).click();
      await expect(
        this.page.locator(selectors.composerInput)
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  /**
   * Click a group in the New Chat panel to open its chat.
   * Retries — React can swallow the first click.
   */
  async selectGroupFromNewChat(name: string) {
    await expect(async () => {
      await this.page.locator(selectors.newChatGroupItem(name)).click();
      await expect(
        this.page.locator(selectors.composerInput)
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  /** Verify the message header shows the expected name */
  async verifyMessageHeaderName(expectedName: string) {
    await expect(
      this.page.locator(selectors.messageHeaderName)
    ).toHaveText(expectedName, { timeout: timeouts.chatOpen });
  }

  /** Verify a conversation appears in the sidebar list */
  async verifyConversationInList(name: string) {
    await expect(async () => {
      await expect(
        this.page.locator(selectors.conversationItem(name)).first()
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  /** Close the New Chat panel using the back button */
  async closeNewChatPanel() {
    await this.page.locator(selectors.newChatBackButton).click();
    await expect(
      this.page.locator(selectors.newChatPanel)
    ).not.toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Full flow: Chats tab → Create Conversation → select user → verify chat */
  async createConversationWithUser(name: string) {
    await this.navigateToChatsTab();
    await this.openCreateConversation();
    await this.selectUserFromNewChat(name);
    await this.verifyMessageHeaderName(name);
  }

  /** Full flow: Chats tab → Create Conversation → Groups tab → select group → verify chat */
  async createConversationWithGroup(name: string) {
    await this.navigateToChatsTab();
    await this.openCreateConversation();
    await this.switchToGroupsTab();
    await this.selectGroupFromNewChat(name);
    await this.verifyMessageHeaderName(name);
  }

  // ─── Conversation Hover Actions ───

  /** Verify the delete icon appears when hovering a conversation item */
  async verifyConversationHoverDeleteIcon() {
    const firstConv = this.page.locator('div.cometchat-conversations div.cometchat-list-item').first();
    await expect(firstConv).toBeVisible({ timeout: timeouts.chatOpen });
    await firstConv.hover();
    await this.page.waitForTimeout(500);
    const deleteIcon = this.page.locator(
      'div.cometchat-conversations div.cometchat-list-item__menu-view div.cometchat-menu-list__main-menu-item-icon-delete'
    );
    await expect(deleteIcon.first()).toBeVisible({ timeout: timeouts.attachMenu });
  }

  /**
   * Delete a conversation by hovering it and clicking the delete icon.
   * Confirms the delete dialog if one appears.
   */
  async deleteConversationViaHover(name: string) {
    const convItem = this.page.locator(selectors.conversationItem(name)).first();
    await expect(convItem).toBeVisible({ timeout: timeouts.chatOpen });

    // Navigate up to the list-item wrapper and hover
    const listItem = convItem.locator('ancestor::div[contains(@class,"cometchat-list-item")]').first()
      ?? convItem.locator('..').locator('..');
    await convItem.hover();
    await this.page.waitForTimeout(500);

    // Click the delete icon that appears on hover
    const deleteIcon = this.page.locator(
      'div.cometchat-conversations div.cometchat-list-item__menu-view div.cometchat-menu-list__main-menu-item-icon-delete'
    ).first();
    await expect(deleteIcon).toBeVisible({ timeout: timeouts.attachMenu });
    await deleteIcon.dispatchEvent('click');
    await this.page.waitForTimeout(500);

    // Confirm dialog if it appears
    const confirmBtn = this.page.locator('div.cometchat-confirm-dialog button:has-text("Delete")');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await this.page.waitForTimeout(1000);
    }

    // Verify conversation removed from list
    await expect(async () => {
      await expect(
        this.page.locator(selectors.conversationItem(name)).first()
      ).not.toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  /** Search for a conversation in the sidebar search */
  async searchConversation(keyword: string) {
    const searchInput = this.page.locator(selectors.conversationSearchInput);
    await expect(searchInput).toBeVisible({ timeout: timeouts.chatOpen });
    await searchInput.fill(keyword);
    await this.page.waitForTimeout(1000);
  }

  /** Clear the conversation sidebar search */
  async clearConversationSearch() {
    const searchInput = this.page.locator(selectors.conversationSearchInput);
    await searchInput.clear();
    await this.page.waitForTimeout(500);
  }

  // ─── Conversation List Subtitle & Receipts ───

  /**
   * Verify conversation subtitle icons are present (thread, video, audio, etc.).
   * Each conversation shows an icon indicating the last message type.
   * Icons with class `subtitle-icon-none` are hidden placeholders — skip them.
   */
  async verifySubtitleIcons() {
    // Wait for at least one conversation subtitle to render
    const allIcons = this.page.locator('[class*="cometchat-conversations__subtitle-icon"]');
    await expect(allIcons.first()).toBeAttached({ timeout: timeouts.chatOpen });

    // Collect distinct icon types, filtering out "none" (hidden placeholder)
    const classes = await allIcons.evaluateAll(els =>
      els.map(el => {
        const cls = el.className;
        const match = cls.match(/subtitle-icon-(\w+)/);
        return match ? match[1] : 'unknown';
      })
    );
    const types = [...new Set(classes)].filter(t => t !== 'unknown' && t !== 'none');
    expect(types.length).toBeGreaterThan(0);
    return types;
  }

  /**
   * Verify receipt indicators exist in the conversation list.
   * Receipts show sent/delivered/read status next to each conversation.
   */
  async verifyReceiptIndicators() {
    const receipts = this.page.locator(
      'div.cometchat-conversations [class*="cometchat-receipts"]'
    );
    await expect(receipts.first()).toBeAttached({ timeout: timeouts.chatOpen });
    const count = await receipts.count();
    expect(count).toBeGreaterThan(0);

    // Collect receipt types
    const classes = await receipts.evaluateAll(els =>
      els.map(el => {
        const cls = el.className;
        if (cls.includes('receipts-read')) return 'read';
        if (cls.includes('receipts-delivered')) return 'delivered';
        if (cls.includes('receipts-sent')) return 'sent';
        return 'unknown';
      })
    );
    const types = [...new Set(classes)].filter(t => t !== 'unknown');
    return types;
  }

  /**
   * Verify conversation subtitle text shows sender label ("You:") and message preview.
   */
  async verifySubtitleContent() {
    const senderLabels = this.page.locator('span.cometchat-conversations__subtitle-text-sender');
    await expect(senderLabels.first()).toBeAttached({ timeout: timeouts.chatOpen });
    const count = await senderLabels.count();
    expect(count).toBeGreaterThan(0);

    // Verify message preview text exists
    const previewText = this.page.locator('div.cometchat-conversations__subtitle-text');
    await expect(previewText.first()).toBeAttached({ timeout: timeouts.chatOpen });
  }

  /**
   * Verify conversation trailing view shows date labels.
   */
  async verifyDateLabels() {
    const dates = this.page.locator('div.cometchat-conversations div.cometchat-date');
    await expect(dates.first()).toBeVisible({ timeout: timeouts.chatOpen });
    const count = await dates.count();
    expect(count).toBeGreaterThan(0);
    // First date should have non-empty text
    const text = await dates.first().textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  }
}
