import { expect } from '@playwright/test';
import { TestConfig } from '../../utils/test-config';
import { ChatBasePage } from './ChatBasePage';

const { selectors, timeouts } = TestConfig;

/**
 * Handles group management: open details, add/kick members, delete group, banned members.
 */
export class ChatGroupActionsPage extends ChatBasePage {

  async openGroupDetails() {
    const header = this.page.locator(selectors.messageHeaderListItem);
    await expect(header).toBeVisible({ timeout: timeouts.chatOpen });
    await header.click();
    await this.page.waitForTimeout(1000);
    await expect(this.page.locator(selectors.groupInfoHeader)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async verifyMemberVisible(name: string) {
    await expect(async () => {
      const member = this.page.locator(selectors.groupMemberItem(name));
      await expect(member.last()).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  async verifyMemberNotVisible(name: string) {
    await expect(async () => {
      const memberInGroupPanel = this.page.locator('div.cometchat-group-members__trailing-view-options-participant');
      const count = await memberInGroupPanel.count();
      expect(count).toBe(0);
    }).toPass({ timeout: timeouts.chatOpen });
  }

  async addMemberToGroup(name: string) {
    const addMembersAction = this.page.locator(selectors.groupAddMembersAction);
    await expect(addMembersAction).toBeVisible({ timeout: timeouts.chatOpen });
    await addMembersAction.click();
    await this.page.waitForTimeout(1000);
    await expect(this.page.locator(selectors.addMembersHeader)).toBeVisible({ timeout: timeouts.chatOpen });
    const userRow = this.page.locator(selectors.addMembersListItem(name)).last();
    await expect(userRow).toBeVisible({ timeout: timeouts.chatOpen });
    await userRow.click();
    await this.page.waitForTimeout(500);
    const submitBtn = this.page.locator(selectors.addMembersSubmitButton);
    await expect(submitBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await submitBtn.click();
    await this.page.waitForTimeout(1500);
    await expect(this.page.locator(selectors.groupInfoHeader)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async kickMember(name: string) {
    const memberName = this.page.locator(selectors.groupMemberItem(name)).last();
    await expect(memberName).toBeVisible({ timeout: timeouts.chatOpen });
    const memberRow = memberName.locator('..').locator('..');
    await memberRow.hover();
    await this.page.waitForTimeout(800);
    const subMenuIcon = this.page.locator(selectors.memberSubMenuIcon).last();
    await expect(subMenuIcon).toBeVisible({ timeout: timeouts.attachMenu });
    await subMenuIcon.dispatchEvent('click');
    await this.page.waitForTimeout(500);
    const kickOption = this.page.locator(selectors.memberActionKick).last();
    await expect(kickOption).toBeVisible({ timeout: timeouts.attachMenu });
    await kickOption.dispatchEvent('click');
    await this.page.waitForTimeout(1500);
  }

  async deleteAndExitGroup() {
    const deleteExitBtn = this.page.locator(selectors.groupDeleteAndExitAction);
    await expect(deleteExitBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await deleteExitBtn.click();
    await this.page.waitForTimeout(800);
    const confirmBtn = this.page.locator(selectors.confirmDialogDeleteExitButton);
    await expect(confirmBtn).toBeVisible({ timeout: timeouts.attachMenu });
    await confirmBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async deleteChatFromGroupDetails() {
    const deleteChatBtn = this.page.locator('text=Delete Chat').first();
    await expect(deleteChatBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await deleteChatBtn.click();
    await this.page.waitForTimeout(800);
    const confirmBtn = this.page.locator(selectors.confirmDialogDeleteButton);
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async switchToBannedMembersTab() {
    const tab = this.page.locator('text=Banned Members').first();
    await expect(tab).toBeVisible({ timeout: timeouts.chatOpen });
    await tab.click();
    await this.page.waitForTimeout(500);
  }

  async verifyBannedMembersEmpty() {
    await expect(this.page.locator('text=No banned members')).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async switchToViewMembersTab() {
    const tab = this.page.locator('text=View Members').first();
    await expect(tab).toBeVisible({ timeout: timeouts.chatOpen });
    await tab.click();
    await this.page.waitForTimeout(500);
  }
}
