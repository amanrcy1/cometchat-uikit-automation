import { expect } from '@playwright/test';
import { TestConfig } from '../../utils/test-config';
import { MediaType, getTestFilePath } from '../../utils/file-helper';
import { ChatBasePage } from './ChatBasePage';

const { selectors, timeouts } = TestConfig;

/**
 * Handles all thread panel interactions: send, edit, delete, react, media, emoji, voice.
 */
export class ChatThreadPage extends ChatBasePage {

  private get threadPanel() {
    return this.page.locator(selectors.threadPanel);
  }

  private async ensureThreadReady() {
    await expect(this.threadPanel).toBeVisible({ timeout: timeouts.chatOpen });
    const composer = this.page.locator(selectors.threadComposerInput);
    await expect(composer).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(async () => {
      await composer.click();
      await expect(composer).toBeFocused({ timeout: 2000 });
    }).toPass({ timeout: timeouts.chatOpen });
    await this.page.waitForTimeout(300);
  }

  private async getThreadBubbleCount(): Promise<number> {
    return this.page.locator(selectors.threadSentBubble).count();
  }

  private async getLastThreadBubble(timeout: number) {
    const bubble = this.page.locator(selectors.threadSentBubble).last();
    await expect(bubble).toBeVisible({ timeout });
    return bubble;
  }

  async openThreadPanel() {
    await this.dismissErrorOverlay();
    const wrapper = await this.openSubMenu();
    const threadItem = wrapper.locator('div.cometchat-menu-list__sub-menu-list-item[title="Reply in thread"]');
    await expect(threadItem).toBeVisible({ timeout: timeouts.attachMenu });
    await threadItem.evaluate(el => (el as HTMLElement).click());

    await this.dismissErrorOverlay();
    await expect(async () => {
      await this.dismissErrorOverlay();
      await expect(this.page.locator(selectors.threadPanel)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: timeouts.chatOpen });

    await this.dismissErrorOverlay();
    await expect(this.page.locator(selectors.threadComposerInput)).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.threadSendButton)).toBeAttached({ timeout: timeouts.chatOpen });

    await expect(async () => {
      const parentBubble = this.page.locator('div.cometchat-threaded-message div.cometchat-message-bubble');
      await expect(parentBubble.first()).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: timeouts.chatOpen });
    await this.page.waitForTimeout(500);
  }

  async closeThread() {
    const closeBtn = this.page.locator(selectors.threadCloseButton);
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) await closeBtn.click();
    else await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
  }

  async sendTextInThread(text: string) {
    await this.ensureThreadReady();
    const countBefore = await this.getThreadBubbleCount();
    const composer = this.page.locator(selectors.threadComposerInput);
    const sendBtn = this.page.locator(selectors.threadSendButton);

    await expect(async () => {
      const currentCount = await this.getThreadBubbleCount();
      if (currentCount > countBefore) return;
      await composer.click();
      await expect(composer).toBeFocused({ timeout: 2000 });
      await composer.fill(text);
      await this.page.waitForTimeout(300);
      await expect(sendBtn).toBeVisible({ timeout: 5000 });
      await sendBtn.click();
      await this.page.waitForTimeout(1000);
      const afterCount = await this.getThreadBubbleCount();
      expect(afterCount).toBeGreaterThan(countBefore);
    }).toPass({ timeout: timeouts.videoMessageAppear });
  }

  async verifyTextInThread(expectedText: string) {
    const bubble = await this.getLastThreadBubble(timeouts.messageAppear);
    await expect(bubble.locator(`text=${expectedText}`)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  private async hoverLastThreadBubbleAndGetWrapper() {
    await this.page.waitForTimeout(300);
    const bubble = this.page.locator(selectors.threadSentBubble).last();
    await expect(bubble).toBeVisible({ timeout: timeouts.messageAppear });
    await expect(async () => { await bubble.scrollIntoViewIfNeeded(); }).toPass({ timeout: 5000 });
    await bubble.hover();
    await this.page.waitForTimeout(500);
    return bubble.locator('..');
  }

  private async openThreadSubMenu() {
    let wrapper = await this.hoverLastThreadBubbleAndGetWrapper();
    const subMenu = wrapper.locator(selectors.messageActionSubMenu);
    if (!await subMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      wrapper = await this.hoverLastThreadBubbleAndGetWrapper();
    }
    await expect(subMenu).toBeVisible({ timeout: timeouts.attachMenu });
    await subMenu.dispatchEvent('click');
    await this.page.waitForTimeout(500);
    return wrapper;
  }

  private async clickThreadSubMenuItem(wrapper: ReturnType<typeof this.page.locator>, title: string) {
    const item = wrapper.locator(`div.cometchat-menu-list__sub-menu-list-item[title="${title}"]`);
    await expect(item).toBeVisible({ timeout: timeouts.attachMenu });
    await item.dispatchEvent('click');
    await this.page.waitForTimeout(300);
  }

  async reactInThread() {
    await this.ensureThreadReady();
    const wrapper = await this.hoverLastThreadBubbleAndGetWrapper();
    const reactMenuItem = wrapper.locator('div.cometchat-menu-list__main-menu-item[title="React"]');
    await expect(reactMenuItem).toBeVisible({ timeout: timeouts.attachMenu });
    await reactMenuItem.dispatchEvent('click');
    await this.page.waitForTimeout(1000);
    const emojiItem = this.page.locator('div.cometchat-emoji-keyboard__list-item').first();
    await expect(emojiItem).toBeVisible({ timeout: timeouts.attachMenu });
    await emojiItem.click();
    await this.page.waitForTimeout(1000);
  }

  async verifyReactionInThread() {
    const reaction = this.threadPanel.locator(selectors.reactionItem).last();
    await expect(reaction).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async editInThread(newText: string) {
    await this.ensureThreadReady();
    const wrapper = await this.openThreadSubMenu();
    await this.clickThreadSubMenuItem(wrapper, 'Edit');
    const composer = this.page.locator(selectors.threadComposerInput);
    await expect(composer).toBeVisible({ timeout: timeouts.chatOpen });
    await composer.click();
    await composer.click({ clickCount: 3 });
    await this.page.waitForTimeout(300);
    await this.page.keyboard.type(newText);
    const sendBtn = this.page.locator(selectors.threadSendButton);
    await expect(sendBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await sendBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async verifyEditedInThread(expectedText: string) {
    const bubble = this.page.locator(selectors.threadSentBubble).last();
    await expect(bubble.locator(`text=${expectedText}`)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async deleteInThread() {
    await this.ensureThreadReady();
    const wrapper = await this.openThreadSubMenu();
    await this.clickThreadSubMenuItem(wrapper, 'Delete');
    await this.page.waitForTimeout(1000);
  }

  async verifyDeletedInThread() {
    await expect(
      this.threadPanel.locator('label.cometchat-delete-bubble__text').last()
    ).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async uploadMediaInThreadPanel(type: MediaType) {
    await this.ensureThreadReady();
    const countBefore = await this.getThreadBubbleCount();
    const threadAttach = this.page.locator(selectors.threadAttachButton);
    await expect(threadAttach).toBeVisible({ timeout: timeouts.attachMenu });
    await threadAttach.click();
    await expect(this.page.locator('div.cometchat-action-sheet')).toBeVisible({ timeout: timeouts.attachMenu });

    const optionMap: Record<MediaType, string> = {
      image: selectors.attachOption.image, video: selectors.attachOption.video,
      audio: selectors.attachOption.audio, pdf: selectors.attachOption.file,
    };

    const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: timeouts.fileUpload });
    const threadOption = this.threadPanel.locator(optionMap[type]);
    if (await threadOption.isVisible({ timeout: 2000 }).catch(() => false)) await threadOption.click();
    else await this.page.locator(optionMap[type]).click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(getTestFilePath(type));
    const uploadTimeout = type === 'video' ? timeouts.videoUpload : timeouts.fileUpload;
    await expect(async () => {
      const current = await this.getThreadBubbleCount();
      expect(current).toBeGreaterThan(countBefore);
    }).toPass({ timeout: uploadTimeout });
  }

  async verifyImageInThread() {
    const bubble = await this.getLastThreadBubble(timeouts.messageAppear);
    await expect(bubble.locator('img')).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async sendEmojiInThread(emojiTitle: string, emojiChar: string) {
    await this.ensureThreadReady();
    const countBefore = await this.getThreadBubbleCount();
    const emojiBtn = this.page.locator(selectors.threadEmojiButton);
    await expect(emojiBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await emojiBtn.click();
    await expect(this.page.locator(selectors.emojiKeyboard)).toBeVisible({ timeout: timeouts.attachMenu });
    const emoji = this.page.locator(selectors.emojiItem(emojiTitle));
    await expect(emoji).toBeVisible({ timeout: timeouts.attachMenu });
    await emoji.click();
    const sendBtn = this.page.locator(selectors.threadSendButton);
    await expect(sendBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await sendBtn.click();
    await expect(async () => {
      const current = await this.getThreadBubbleCount();
      expect(current).toBeGreaterThan(countBefore);
    }).toPass({ timeout: timeouts.messageAppear });
  }

  async verifyEmojiInThread(emojiChar: string) {
    const bubble = await this.getLastThreadBubble(timeouts.messageAppear);
    await expect(bubble.locator(`text=${emojiChar}`)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async recordVoiceInThread(durationMs: number = 2000) {
    await this.ensureThreadReady();
    const countBefore = await this.getThreadBubbleCount();
    const voiceBtn = this.page.locator(selectors.threadVoiceRecordButton);
    await expect(voiceBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await voiceBtn.click({ force: true });
    await expect(
      this.page.locator('div.cometchat-threaded-message ' + selectors.recordingBar)
        .or(this.page.locator(selectors.mediaRecorder))
    ).toBeVisible({ timeout: timeouts.chatOpen });
    for (let i = 0; i < Math.ceil(durationMs / 500); i++) {
      await this.page.waitForTimeout(500);
      await this.dismissErrorOverlay();
    }
    const threadSend = this.page.locator(selectors.threadSendButton);
    await this.dismissErrorOverlay();
    await expect(threadSend).toBeVisible({ timeout: timeouts.chatOpen });
    await threadSend.click({ force: true });
    await expect(async () => {
      const current = await this.getThreadBubbleCount();
      expect(current).toBeGreaterThan(countBefore);
    }).toPass({ timeout: timeouts.messageAppear });
  }

  async verifyVoiceInThread() {
    const bubble = await this.getLastThreadBubble(timeouts.messageAppear);
    await expect(bubble.locator(selectors.audioBubble)).toBeVisible({ timeout: timeouts.messageAppear });
  }
}
