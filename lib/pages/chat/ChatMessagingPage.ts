import { expect } from '@playwright/test';
import { TestConfig } from '../../utils/test-config';
import { MediaType, getTestFilePath } from '../../utils/file-helper';
import { ChatBasePage } from './ChatBasePage';
import { nukeIframes } from '../../utils/overlay-manager';

const { selectors, timeouts } = TestConfig;

/**
 * Handles core messaging: send text, upload media, edit, delete, copy, reply, verify.
 */
export class ChatMessagingPage extends ChatBasePage {

  // ─── Attachment Upload ───

  private async clickAttachButton() {
    const btn = this.page.locator(selectors.attachButton);
    await expect(btn).toBeVisible({ timeout: timeouts.attachMenu });
    await btn.click();
    await expect(this.page.locator(selectors.attachPopover)).toBeVisible({ timeout: timeouts.attachMenu });
  }

  private async selectAttachmentType(type: MediaType) {
    const optionMap: Record<MediaType, string> = {
      image: selectors.attachOption.image, video: selectors.attachOption.video,
      audio: selectors.attachOption.audio, pdf: selectors.attachOption.file,
    };
    const option = this.page.locator(optionMap[type]);
    await expect(option).toBeVisible({ timeout: timeouts.attachMenu });
    await option.click();
  }

  async uploadMedia(type: MediaType) {
    await this.dismissErrorOverlay();
    const filePath = getTestFilePath(type);
    const bubbleCountBefore = await this.getOutgoingBubbleCount();
    await this.clickAttachButton();
    const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: timeouts.fileUpload });
    await this.selectAttachmentType(type);
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    const uploadTimeout = type === 'video' ? timeouts.videoUpload : timeouts.fileUpload;
    await expect(async () => {
      const currentCount = await this.getOutgoingBubbleCount();
      expect(currentCount).toBeGreaterThan(bubbleCountBefore);
    }).toPass({ timeout: uploadTimeout });
  }

  // ─── Text Message ───

  async sendTextMessage(text: string) {
    await this.dismissErrorOverlay();
    await nukeIframes(this.page);

    const recordingBar = this.page.locator(selectors.recordingBar);
    if (await recordingBar.isVisible({ timeout: 500 }).catch(() => false)) {
      const deleteBtn = this.page.locator(selectors.recordingBarDelete);
      if (await deleteBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await deleteBtn.click({ force: true });
        await this.page.waitForTimeout(300);
      }
    }

    const bubbleCountBefore = await this.getOutgoingBubbleCount();
    const composer = this.page.locator(selectors.composerInput);
    await this.smartWait(composer, { timeout: timeouts.chatOpen, description: 'composer for send' });
    await nukeIframes(this.page);
    await composer.click({ force: true });
    await composer.fill(text);
    const sendBtn = this.page.locator(selectors.sendButton);
    await nukeIframes(this.page);
    await this.safeClick(sendBtn, { timeout: 5000 });

    await expect(async () => {
      await this.dismissErrorOverlay();
      const currentCount = await this.getOutgoingBubbleCount();
      expect(currentCount).toBeGreaterThan(bubbleCountBefore);
    }).toPass({ timeout: timeouts.videoMessageAppear });
  }

  // ─── Edit / Delete / Copy / Reply ───

  async editMessage(newText: string) {
    const wrapper = await this.openSubMenu();
    await this.clickSubMenuItem(wrapper, 'Edit');
    const composer = this.page.locator(selectors.composerInput);
    await expect(composer).toBeVisible({ timeout: timeouts.chatOpen });
    await composer.click();
    await composer.click({ clickCount: 3 });
    await this.page.waitForTimeout(300);
    await this.page.keyboard.type(newText);
    const sendBtn = this.page.locator(selectors.sendButton);
    await expect(sendBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await sendBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async verifyMessageEdited(expectedText: string) {
    const bubble = this.page.locator(selectors.sentMessageBubble).last();
    await expect(bubble.locator(`text=${expectedText}`)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async deleteMessage() {
    const wrapper = await this.openSubMenu();
    await this.clickSubMenuItem(wrapper, 'Delete');
    await this.page.waitForTimeout(1000);
  }

  async verifyMessageDeleted(originalBubbleCount: number) {
    await expect(
      this.page.locator('label.cometchat-delete-bubble__text').last()
    ).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async copyMessage(): Promise<string> {
    const wrapper = await this.openSubMenu();
    await this.clickSubMenuItem(wrapper, 'Copy');
    await this.page.waitForTimeout(500);
    return this.page.evaluate(async () => navigator.clipboard.readText());
  }

  async directReply(text: string) {
    const wrapper = await this.hoverLastBubbleAndGetWrapper();
    const replyIcon = wrapper.locator(selectors.messageActionReply);
    await expect(replyIcon).toBeVisible({ timeout: timeouts.attachMenu });
    await replyIcon.dispatchEvent('click');
    await this.page.waitForTimeout(800);
    const composer = this.page.locator(selectors.composerInput);
    await expect(composer).toBeVisible({ timeout: timeouts.chatOpen });
    await composer.click();
    await composer.fill(text);
    const sendBtn = this.page.locator(selectors.sendButton);
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async verifyDirectReply(expectedText: string) {
    const bubble = this.page.locator(selectors.sentMessageBubble).last();
    await expect(bubble.locator(`text=${expectedText}`)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  // ─── Verification ───

  async verifyImageSent() {
    const bubble = await this.getLastOutgoingBubble(timeouts.messageAppear);
    await expect(bubble.locator('img')).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async verifyVideoSent() {
    const bubble = await this.getLastOutgoingBubble(timeouts.videoMessageAppear);
    await expect(async () => {
      const hasVideo = await bubble.locator('video').isVisible().catch(() => false);
      const hasMp4 = await bubble.locator('text=mp4').isVisible().catch(() => false);
      const hasVideoThumbnail = await bubble.locator('img[src*="video"]').isVisible().catch(() => false);
      expect(hasVideo || hasMp4 || hasVideoThumbnail).toBeTruthy();
    }).toPass({ timeout: timeouts.videoMessageAppear });
  }

  async verifyPdfSent() {
    const bubble = await this.getLastOutgoingBubble(timeouts.messageAppear);
    await expect(bubble.locator('text=.pdf')).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async verifyAudioSent() {
    const bubble = await this.getLastOutgoingBubble(timeouts.messageAppear);
    await expect(bubble.locator(selectors.audioBubble)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async verifyTextSent(expectedText: string) {
    const bubble = await this.getLastOutgoingBubble(timeouts.messageAppear);
    await expect(bubble.locator(`text=${expectedText}`)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async verifyVoiceSent() {
    const bubble = await this.getLastOutgoingBubble(timeouts.messageAppear);
    await expect(bubble.locator(selectors.audioBubble)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async verifyMessageReceipt() {
    const bubble = await this.getLastOutgoingBubble(timeouts.messageAppear);
    const wrapper = bubble.locator('..');
    await expect(async () => {
      const receipt = wrapper.locator('[class*="cometchat-receipts"]');
      await expect(receipt.first()).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: timeouts.messageAppear });
  }

  // ─── Message Info ───

  async openMessageInfoAndVerify() {
    const wrapper = await this.openSubMenu();
    await this.clickSubMenuItem(wrapper, 'Info');
    await this.page.waitForTimeout(1000);
    await expect(this.page.locator(selectors.messageInfoPanel)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async closeMessageInfo() {
    const closeBtn = this.page.locator(selectors.messageInfoCloseButton);
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) await closeBtn.click();
    else await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  // ─── Delete Chat ───

  async deleteChat() {
    const deleteBtn = this.page.locator(selectors.deleteChatAction).first();
    await expect(deleteBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await deleteBtn.click();
    await this.page.waitForTimeout(800);
    const confirmBtn = this.page.locator(selectors.confirmDialogDeleteButton);
    await expect(confirmBtn).toBeVisible({ timeout: timeouts.attachMenu });
    await confirmBtn.click();
    await this.page.waitForTimeout(1500);
  }

  // ─── Incoming Message Actions ───

  private async hoverIncomingBubbleAndOpenMenu() {
    await this.dismissErrorOverlay();
    await this.page.waitForTimeout(300);
    const bubble = this.page.locator(selectors.incomingMessageBubble).last();
    await expect(bubble).toBeVisible({ timeout: timeouts.messageAppear });
    await bubble.scrollIntoViewIfNeeded();
    await bubble.hover({ force: true });
    await this.page.waitForTimeout(500);
    const wrapper = bubble.locator('..');
    const subMenu = wrapper.locator(selectors.messageActionSubMenu);
    if (!await subMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bubble.hover({ force: true });
      await this.page.waitForTimeout(500);
    }
    await expect(subMenu).toBeVisible({ timeout: timeouts.attachMenu });
    await subMenu.dispatchEvent('click');
    await this.page.waitForTimeout(500);
    return wrapper;
  }

  async markMessageUnread() {
    await this.hoverIncomingBubbleAndOpenMenu();
    const markUnread = this.page.locator(selectors.markUnreadMenuItem).last();
    await expect(markUnread).toBeVisible({ timeout: timeouts.attachMenu });
    await markUnread.dispatchEvent('click');
    await this.page.waitForTimeout(1000);
  }

  async reportMessage() {
    await this.hoverIncomingBubbleAndOpenMenu();
    const report = this.page.locator(selectors.reportMenuItem).last();
    await expect(report).toBeVisible({ timeout: timeouts.attachMenu });
    await report.dispatchEvent('click');
    await this.page.waitForTimeout(1000);
  }

  async verifyMarkUnreadVisible(): Promise<boolean> {
    await this.hoverIncomingBubbleAndOpenMenu();
    const visible = await this.page.locator(selectors.markUnreadMenuItem).last()
      .isVisible({ timeout: 2000 }).catch(() => false);
    await this.page.keyboard.press('Escape');
    return visible;
  }

  async verifyReportVisible(): Promise<boolean> {
    await this.hoverIncomingBubbleAndOpenMenu();
    const visible = await this.page.locator(selectors.reportMenuItem).last()
      .isVisible({ timeout: 2000 }).catch(() => false);
    await this.page.keyboard.press('Escape');
    return visible;
  }
}
