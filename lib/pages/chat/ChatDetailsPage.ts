import { expect } from '@playwright/test';
import { TestConfig } from '../../utils/test-config';
import { ChatBasePage } from './ChatBasePage';

const { selectors, timeouts } = TestConfig;

/**
 * Handles user details panel, search, and user status.
 */
export class ChatDetailsPage extends ChatBasePage {

  // ─── User Details ───

  async openUserDetails() {
    const header = this.page.locator(selectors.messageHeaderListItem);
    await expect(header).toBeVisible({ timeout: timeouts.chatOpen });
    await header.click();
    await this.page.waitForTimeout(800);
    await expect(this.page.locator(selectors.userDetailsPanel)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async closeUserDetails() {
    const closeBtn = this.page.locator(selectors.userDetailsCloseButton);
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) await closeBtn.click();
    else await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  async verifyHeaderStatusVisible() {
    const subtitle = this.page.locator(selectors.messageHeaderSubtitle);
    await expect(subtitle).toBeVisible({ timeout: timeouts.chatOpen });
    const text = await subtitle.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  }

  async verifyUserDetailsStatus() {
    const status = this.page.locator(selectors.userDetailsStatus);
    await expect(status).toBeVisible({ timeout: timeouts.chatOpen });
    const text = await status.textContent();
    expect(text === 'Online' || text === 'Offline').toBeTruthy();
  }

  async blockUser() {
    const blockBtn = this.page.locator(
      'div[class*="cometchat-user-details__content-action-item"]:has-text("Block"):not(:has-text("Unblock"))'
    ).first();
    await expect(blockBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await blockBtn.click();
    await this.page.waitForTimeout(800);
    const confirmBtn = this.page.locator('div.cometchat-confirm-dialog button:has-text("Block")');
    await expect(confirmBtn).toBeVisible({ timeout: timeouts.attachMenu });
    await confirmBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async unblockUser() {
    const unblockBtn = this.page.locator(
      'div[class*="cometchat-user-details__content-action-item"]:has-text("Unblock")'
    ).first();
    await expect(unblockBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await unblockBtn.click();
    await this.page.waitForTimeout(1000);
  }

  // ─── Search ───

  async openChatSearch() {
    const searchBtn = this.page.locator(selectors.chatSearchButton);
    await expect(searchBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await searchBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async searchInChat(keyword: string) {
    await this.openChatSearch();
    const searchInput = this.page.locator(selectors.chatSearchInput).last();
    await expect(searchInput).toBeVisible({ timeout: timeouts.chatOpen });
    await searchInput.fill(keyword);
    await this.page.waitForTimeout(1500);
  }

  async closeChatSearch() {
    const searchInput = this.page.locator(selectors.chatSearchInput).last();
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await searchInput.clear();
      await this.page.waitForTimeout(300);
    }
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    for (const sel of [selectors.usersSearchInput, selectors.groupsSearchInput, selectors.conversationSearchInput]) {
      const sidebarSearch = this.page.locator(sel);
      if (await sidebarSearch.isVisible({ timeout: 1000 }).catch(() => false)) {
        const value = await sidebarSearch.inputValue().catch(() => '');
        if (value) {
          await sidebarSearch.clear();
          await this.page.waitForTimeout(300);
        }
      }
    }
  }
}
