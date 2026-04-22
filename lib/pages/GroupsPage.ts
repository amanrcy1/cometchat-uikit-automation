import { Page, expect } from '@playwright/test';
import { TestConfig } from '../utils/test-config';

const { selectors, timeouts } = TestConfig;

export type GroupType = 'Public' | 'Private' | 'Password';

/**
 * Page Object for the Groups tab.
 * Handles navigating to Groups, creating groups (Public/Private/Password), and opening them.
 */
export class GroupsPage {
  constructor(private page: Page) {}

  /** Generate a unique random group name using timestamp + random suffix */
  static generateGroupName(prefix = 'TestGroup'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}-${timestamp}-${random}`;
  }

  /** Click the "Groups" tab in the bottom navigation */
  async navigateToGroupsTab() {
    const groupsTab = this.page.locator(selectors.bottomNav.groups);
    await expect(groupsTab).toBeVisible({ timeout: timeouts.pageLoad });
    await groupsTab.click();
    await expect(
      this.page.locator(selectors.groupsList)
    ).toBeVisible({ timeout: timeouts.pageLoad });
  }

  /** Click the create group button (top-right icon) */
  async clickCreateGroupButton() {
    const btn = this.page.locator(selectors.groupsCreateButton);
    await expect(btn).toBeVisible({ timeout: timeouts.chatOpen });
    await btn.click();
    await expect(
      this.page.locator(selectors.createGroupModal)
    ).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /**
   * Select the group type in the creation form.
   * Clicks the type tab and verifies it becomes selected.
   */
  async selectGroupType(type: GroupType) {
    const typeTab = this.page.locator(selectors.createGroupType(type));
    await expect(typeTab).toBeVisible({ timeout: timeouts.chatOpen });
    await typeTab.click();
    // Verify the tab became active
    await expect(async () => {
      const cls = await typeTab.getAttribute('class');
      expect(cls).toContain('cometchat-create-group__type-selected');
    }).toPass({ timeout: timeouts.attachMenu });
  }

  /** Verify the currently selected group type */
  async verifySelectedGroupType(type: GroupType) {
    const selected = this.page.locator(selectors.createGroupTypeSelected);
    await expect(selected).toHaveText(type, { timeout: timeouts.chatOpen });
  }

  /** Fill the password field (only visible when Password type is selected) */
  async fillGroupPassword(password: string) {
    const pwInput = this.page.locator(selectors.createGroupPasswordInput);
    await expect(pwInput).toBeVisible({ timeout: timeouts.chatOpen });
    await pwInput.fill(password);
  }

  /** Verify the password input is visible */
  async verifyPasswordFieldVisible() {
    await expect(
      this.page.locator(selectors.createGroupPasswordInput)
    ).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Verify the password input is NOT visible */
  async verifyPasswordFieldHidden() {
    await expect(
      this.page.locator(selectors.createGroupPasswordInput)
    ).not.toBeVisible({ timeout: 3000 });
  }

  /** Fill in the group name and submit the form */
  async fillAndSubmitGroupForm(groupName: string) {
    const nameInput = this.page.locator(selectors.createGroupNameInput);
    await expect(nameInput).toBeVisible({ timeout: timeouts.chatOpen });
    await nameInput.fill(groupName);

    const submitBtn = this.page.locator(selectors.createGroupSubmitButton);
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await expect(
      this.page.locator(selectors.composerInput)
    ).toBeVisible({ timeout: timeouts.chatOpen });

    // Stabilization — CometChat needs time to establish the WebSocket
    await this.page.waitForTimeout(2000);
  }

  /**
   * Full flow: Groups tab → create → enter name → submit.
   * Defaults to Public type. Returns the generated group name.
   */
  async createNewGroupAndOpen(type: GroupType = 'Public', password?: string): Promise<string> {
    const prefix = type === 'Public' ? 'TestGroup' : type === 'Private' ? 'PrivateGroup' : 'PwdGroup';
    const groupName = GroupsPage.generateGroupName(prefix);

    await this.navigateToGroupsTab();
    await this.clickCreateGroupButton();

    if (type !== 'Public') {
      await this.selectGroupType(type);
    }

    if (type === 'Password' && password) {
      await this.fillGroupPassword(password);
    }

    await this.fillAndSubmitGroupForm(groupName);
    return groupName;
  }

  /** Search for a group in the Groups tab search bar */
  async searchGroup(keyword: string) {
    const searchInput = this.page.locator(selectors.groupsSearchInput);
    await expect(searchInput).toBeVisible({ timeout: timeouts.chatOpen });
    await searchInput.fill(keyword);
    await this.page.waitForTimeout(1000);
  }

  /** Clear the Groups tab search bar */
  async clearGroupSearch() {
    const searchInput = this.page.locator(selectors.groupsSearchInput);
    await searchInput.clear();
    await this.page.waitForTimeout(500);
  }

  /** Verify a group appears in the filtered list */
  async verifyGroupInList(name: string) {
    await expect(
      this.page.locator(selectors.groupsListItem(name))
    ).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Verify a group is NOT in the filtered list */
  async verifyGroupNotInList(name: string) {
    await expect(
      this.page.locator(selectors.groupsListItem(name))
    ).not.toBeVisible({ timeout: 3000 });
  }

  /** Verify the member count subtitle is visible on a group list item */
  async verifyGroupMemberCount() {
    const subtitle = this.page.locator('div.cometchat-groups__subtitle').first();
    await expect(subtitle).toBeVisible({ timeout: timeouts.chatOpen });
    const text = await subtitle.textContent();
    expect(text).toMatch(/\d+ Member/);
  }
}
