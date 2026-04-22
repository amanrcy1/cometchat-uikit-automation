import { Page, expect } from '@playwright/test';
import { TestConfig } from '../utils/test-config';

const { selectors, timeouts } = TestConfig;

/**
 * Page Object for the Users tab.
 * Handles navigating to Users, searching, and opening a user chat.
 */
export class UsersPage {
  constructor(private page: Page) {}

  /** Click the "Users" tab in the bottom navigation */
  async navigateToUsersTab() {
    const usersTab = this.page.locator(selectors.bottomNav.users);
    await expect(usersTab).toBeVisible({ timeout: timeouts.pageLoad });
    await usersTab.click();

    // Confirm the Users list loaded
    await expect(
      this.page.locator(selectors.usersSearchInput)
    ).toBeVisible({ timeout: timeouts.pageLoad });
  }

  /** Search for a user by name using the search bar */
  async searchUser(name: string) {
    const searchInput = this.page.locator(selectors.usersSearchInput);
    await expect(searchInput).toBeVisible({ timeout: timeouts.chatOpen });
    await searchInput.fill(name);

    // Wait for search results to filter
    await expect(
      this.page.locator(selectors.usersListItem(name))
    ).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Click on a user from the search results to open their chat */
  async openUserChat(name: string) {
    const userItem = this.page.locator(selectors.usersListItem(name));
    await expect(userItem).toBeVisible({ timeout: timeouts.chatOpen });
    await userItem.click();

    // Confirm the chat composer appeared
    const composer = this.page.locator(selectors.composerInput);
    try {
      await expect(composer).toBeVisible({ timeout: timeouts.chatOpen });
    } catch {
      // Retry with force click if first attempt didn't register
      await userItem.click({ force: true });
      await expect(composer).toBeVisible({ timeout: timeouts.chatOpen });
    }
  }

  /** Full flow: navigate to Users tab → search → open chat */
  async searchAndOpenChat(name: string) {
    await this.navigateToUsersTab();
    await this.searchUser(name);
    await this.openUserChat(name);
  }

  /**
   * Verify alphabetical section headers are visible in the users list.
   * CometChat groups users by first letter (e.g. G, J, N, S).
   */
  async verifySectionHeaders() {
    const sections = this.page.locator('div.cometchat-list__section-header');
    await expect(sections.first()).toBeVisible({ timeout: timeouts.chatOpen });

    const headers = await sections.allTextContents();
    const letters = headers.map(h => h.trim()).filter(h => h.length === 1);
    // Should have at least 2 distinct letter groups
    expect(letters.length).toBeGreaterThanOrEqual(2);
    // Each header should be a single uppercase letter
    for (const letter of letters) {
      expect(letter).toMatch(/^[A-Z]$/);
    }
    return letters;
  }

}
