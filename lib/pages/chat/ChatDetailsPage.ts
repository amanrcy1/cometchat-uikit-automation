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

  // ─── Search (full-screen search-view modal) ───

  async openChatSearch() {
    await this.dismissErrorOverlay();
    const searchBtn = this.page.locator(selectors.chatSearchButton).first();
    await expect(searchBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await searchBtn.click({ force: true });
    // Search view modal opens
    await expect(this.page.locator(selectors.chatSearchView)).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.chatSearchViewTitle)).toHaveText('Search Messages', { timeout: timeouts.chatOpen });
  }

  async verifySearchViewVisible() {
    await expect(this.page.locator(selectors.chatSearchView)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async verifySearchInitialState() {
    await expect(this.page.locator(selectors.chatSearchInitialView)).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.chatSearchInitialTitle)).toHaveText('Start Your Search', { timeout: timeouts.chatOpen });
  }

  async verifySearchFiltersVisible() {
    const filters: Array<'Audio' | 'Documents' | 'Photos' | 'Videos' | 'Links'> =
      ['Audio', 'Documents', 'Photos', 'Videos', 'Links'];
    for (const f of filters) {
      await expect(this.page.locator(selectors.chatSearchFilter(f)).first()).toBeVisible({ timeout: timeouts.chatOpen });
    }
  }

  async typeSearchKeyword(keyword: string) {
    const input = this.page.locator(selectors.chatSearchInput).first();
    await expect(input).toBeVisible({ timeout: timeouts.chatOpen });
    await input.fill(keyword);
    // Debounced search — wait for either results or empty view to appear
    await this.page.waitForTimeout(1500);
  }

  async searchInChat(keyword: string) {
    await this.openChatSearch();
    await this.typeSearchKeyword(keyword);
  }

  /** Wait until at least one result is rendered OR empty view appears. */
  async waitForSearchResolved(timeout: number = timeouts.chatOpen) {
    await expect(async () => {
      const hasResults = await this.page.locator(selectors.chatSearchResultItem).first().isVisible().catch(() => false);
      const isEmpty = await this.page.locator(selectors.chatSearchEmptyView).isVisible().catch(() => false);
      expect(hasResults || isEmpty).toBeTruthy();
    }).toPass({ timeout });
  }

  /**
   * CometChat search indexing is async — newly sent messages can take several seconds
   * to appear in search results. This method re-types the keyword (which re-fires the
   * search request) on each poll iteration until results appear.
   */
  async waitForSearchResultsWithRetry(keyword: string, timeout: number = 30_000) {
    const input = this.page.locator(selectors.chatSearchInput).first();
    await expect(async () => {
      // Re-type to trigger a fresh search
      await input.fill('').catch(() => {});
      await this.page.waitForTimeout(300);
      await input.fill(keyword).catch(() => {});
      await this.page.waitForTimeout(2000);
      const count = await this.page.locator(selectors.chatSearchResultItem).count();
      expect(count).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout, intervals: [2000, 3000, 4000, 5000] });
  }

  async verifySearchHasResults(minCount: number = 1, keyword?: string) {
    if (keyword) {
      await this.waitForSearchResultsWithRetry(keyword);
    } else {
      await this.waitForSearchResolved();
    }
    const count = await this.page.locator(selectors.chatSearchResultItem).count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async getSearchResultCount(): Promise<number> {
    return this.page.locator(selectors.chatSearchResultItem).count();
  }

  async verifyResultContainsText(text: string) {
    await this.waitForSearchResolved();
    const subtitle = this.page.locator(selectors.chatSearchResultSubtitle, { hasText: text }).first();
    await expect(subtitle).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async verifySearchEmptyState() {
    await this.waitForSearchResolved();
    await expect(this.page.locator(selectors.chatSearchEmptyView)).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.chatSearchEmptyTitle)).toHaveText('No Results', { timeout: timeouts.chatOpen });
  }

  async selectSearchFilter(filter: 'Audio' | 'Documents' | 'Photos' | 'Videos' | 'Links') {
    const tab = this.page.locator(selectors.chatSearchFilter(filter)).first();
    await expect(tab).toBeVisible({ timeout: timeouts.chatOpen });
    await tab.click({ force: true });
    await this.page.waitForTimeout(1500);
  }

  async clearSearchViaButton() {
    const clearBtn = this.page.locator(selectors.chatSearchClearButton).first();
    await expect(clearBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await clearBtn.click({ force: true });
    await this.page.waitForTimeout(500);
    // Input should be empty
    const input = this.page.locator(selectors.chatSearchInput).first();
    await expect(input).toHaveValue('', { timeout: timeouts.attachMenu });
  }

  async verifySearchInputValue(expected: string) {
    const input = this.page.locator(selectors.chatSearchInput).first();
    await expect(input).toHaveValue(expected, { timeout: timeouts.chatOpen });
  }

  async closeChatSearch() {
    const searchView = this.page.locator(selectors.chatSearchView);
    if (!(await searchView.isVisible({ timeout: 1000 }).catch(() => false))) return;
    const closeBtn = this.page.locator(selectors.chatSearchCloseButton).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click({ force: true });
    } else {
      await this.page.keyboard.press('Escape');
    }
    await expect(searchView).not.toBeVisible({ timeout: timeouts.chatOpen });
  }
}
