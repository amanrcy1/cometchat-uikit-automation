import { expect } from '@playwright/test';
import { TestConfig } from '../../utils/test-config';
import { ChatBasePage } from './ChatBasePage';

const { selectors, timeouts } = TestConfig;

/**
 * Handles emoji, stickers, and voice recording.
 */
export class ChatMediaPage extends ChatBasePage {

  // ─── Emoji ───

  async openEmojiKeyboard() {
    const emojiBtn = this.page.locator(selectors.emojiButton);
    await expect(emojiBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await emojiBtn.click();
    await expect(this.page.locator(selectors.emojiKeyboard)).toBeVisible({ timeout: timeouts.attachMenu });
  }

  async selectEmoji(title: string) {
    const emoji = this.page.locator(selectors.emojiItem(title));
    await expect(emoji).toBeVisible({ timeout: timeouts.attachMenu });
    await emoji.click();
  }

  async searchAndSelectEmoji(keyword: string) {
    const searchInput = this.page.locator(selectors.emojiSearchInput);
    await expect(searchInput).toBeVisible({ timeout: timeouts.attachMenu });
    await searchInput.fill(keyword);
    await this.page.waitForTimeout(500);
    const firstResult = this.page.locator(selectors.emojiFirstItem).first();
    await expect(firstResult).toBeVisible({ timeout: timeouts.attachMenu });
    await firstResult.click();
  }

  async sendEmoji(emojiTitle: string, emojiChar: string) {
    const bubbleCountBefore = await this.getOutgoingBubbleCount();
    await this.openEmojiKeyboard();
    await this.selectEmoji(emojiTitle);
    const sendBtn = this.page.locator(selectors.sendButton);
    await expect(sendBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await sendBtn.click();
    await expect(async () => {
      const currentCount = await this.getOutgoingBubbleCount();
      expect(currentCount).toBeGreaterThan(bubbleCountBefore);
    }).toPass({ timeout: timeouts.messageAppear });
  }

  async searchAndSendEmoji(keyword: string) {
    const bubbleCountBefore = await this.getOutgoingBubbleCount();
    await this.openEmojiKeyboard();
    await this.searchAndSelectEmoji(keyword);
    const sendBtn = this.page.locator(selectors.sendButton);
    await expect(sendBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await sendBtn.click();
    await expect(async () => {
      const currentCount = await this.getOutgoingBubbleCount();
      expect(currentCount).toBeGreaterThan(bubbleCountBefore);
    }).toPass({ timeout: timeouts.messageAppear });
  }

  async verifyEmojiSent(emojiChar: string) {
    const bubble = await this.getLastOutgoingBubble(timeouts.messageAppear);
    await expect(bubble.locator(`text=${emojiChar}`)).toBeVisible({ timeout: timeouts.messageAppear });
  }

  // ─── Voice Recording ───

  async startVoiceRecording() {
    await this.dismissErrorOverlay();
    const voiceBtn = this.page.locator(selectors.voiceRecordButton);
    await expect(voiceBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await voiceBtn.click({ force: true });
    await this.dismissErrorOverlay();
    await expect(
      this.page.locator(selectors.recordingBar).or(this.page.locator('div.cometchat-media-recorder'))
    ).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async pauseVoiceRecording() {
    await this.dismissErrorOverlay();
    const pauseBtn = this.page.locator(selectors.recordingBarPause).or(this.page.locator(selectors.mediaRecorderPause));
    await expect(pauseBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await pauseBtn.click({ force: true });
  }

  async resumeVoiceRecording() {
    await this.dismissErrorOverlay();
    const resumeBtn = this.page.locator(selectors.recordingBarPause).or(this.page.locator(selectors.mediaRecorderResume));
    await expect(resumeBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await resumeBtn.click({ force: true });
  }

  async stopVoiceRecording() {
    await this.dismissErrorOverlay();
    const oldStop = this.page.locator('div.cometchat-media-recorder__recording-control-stop');
    if (await oldStop.isVisible({ timeout: 1000 }).catch(() => false)) {
      await oldStop.click({ force: true });
      await expect(this.page.locator(selectors.mediaRecorderSend)).toBeVisible({ timeout: timeouts.fileUpload });
    }
  }

  async sendVoiceRecording() {
    await this.dismissErrorOverlay();
    const oldSend = this.page.locator('div.cometchat-media-recorder__recorded-control-send');
    const newSend = this.page.locator('button.cometchat-button[title="Send Message"]').first();
    if (await oldSend.isVisible({ timeout: 1000 }).catch(() => false)) {
      await oldSend.click({ force: true });
    } else {
      await expect(newSend).toBeVisible({ timeout: timeouts.chatOpen });
      await newSend.click({ force: true });
    }
  }

  async recordAndSendVoice(recordDurationMs: number = 3000) {
    const bubbleCountBefore = await this.getOutgoingBubbleCount();
    await this.startVoiceRecording();
    const chunks = Math.ceil(recordDurationMs / 500);
    for (let i = 0; i < chunks; i++) {
      await this.page.waitForTimeout(Math.min(500, recordDurationMs - i * 500));
      await this.dismissErrorOverlay();
    }
    await this.stopVoiceRecording();
    await this.sendVoiceRecording();
    await expect(async () => {
      await this.dismissErrorOverlay();
      const currentCount = await this.getOutgoingBubbleCount();
      expect(currentCount).toBeGreaterThan(bubbleCountBefore);
    }).toPass({ timeout: timeouts.messageAppear });
  }

  async recordWithPauseAndSend(
    recordBeforePauseMs: number = 2000,
    pauseDurationMs: number = 1000,
    recordAfterResumeMs: number = 2000,
  ) {
    const bubbleCountBefore = await this.getOutgoingBubbleCount();
    await this.startVoiceRecording();
    for (let i = 0; i < Math.ceil(recordBeforePauseMs / 500); i++) {
      await this.page.waitForTimeout(500); await this.dismissErrorOverlay();
    }
    await this.pauseVoiceRecording();
    await this.page.waitForTimeout(pauseDurationMs);
    await this.dismissErrorOverlay();
    await this.resumeVoiceRecording();
    for (let i = 0; i < Math.ceil(recordAfterResumeMs / 500); i++) {
      await this.page.waitForTimeout(500); await this.dismissErrorOverlay();
    }
    await this.stopVoiceRecording();
    await this.sendVoiceRecording();
    await expect(async () => {
      await this.dismissErrorOverlay();
      const currentCount = await this.getOutgoingBubbleCount();
      expect(currentCount).toBeGreaterThan(bubbleCountBefore);
    }).toPass({ timeout: timeouts.messageAppear });
  }

  // ─── Sticker Keyboard ───

  async openStickerKeyboard() {
    await this.dismissErrorOverlay();
    const btn = this.page.locator(selectors.stickerButton);
    await this.safeClick(btn);
    await expect(this.page.locator(selectors.stickerKeyboard)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async closeStickerKeyboard() {
    const btn = this.page.locator(selectors.stickerButton);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ force: true });
      await this.page.waitForTimeout(500);
    }
  }

  async waitForStickersLoaded() {
    await expect(async () => {
      const shimmerVisible = await this.page.locator(selectors.stickerShimmer).isVisible().catch(() => false);
      const realStickers = await this.page.locator(selectors.stickerListItem).count();
      expect(shimmerVisible === false || realStickers > 0).toBeTruthy();
    }).toPass({ timeout: timeouts.chatOpen });
  }

  async sendSticker() {
    const bubbleCountBefore = await this.getOutgoingBubbleCount();
    await this.openStickerKeyboard();
    await this.waitForStickersLoaded();
    const firstSticker = this.page.locator(selectors.stickerListItem).first();
    await expect(firstSticker).toBeVisible({ timeout: timeouts.chatOpen });
    await firstSticker.click();
    await this.page.waitForTimeout(2000);
    await expect(async () => {
      const currentCount = await this.getOutgoingBubbleCount();
      expect(currentCount).toBeGreaterThan(bubbleCountBefore);
    }).toPass({ timeout: timeouts.messageAppear });
  }

  async verifyStickerSent() {
    const bubble = this.page.locator(selectors.sentMessageBubble).last();
    await expect(bubble).toBeVisible({ timeout: timeouts.messageAppear });
    await expect(async () => {
      const hasImg = await bubble.locator('img').isVisible().catch(() => false);
      const hasSticker = await bubble.locator('[class*="sticker"]').isVisible().catch(() => false);
      expect(hasImg || hasSticker).toBeTruthy();
    }).toPass({ timeout: timeouts.messageAppear });
  }

  async switchStickerTab(index: number) {
    const tabs = this.page.locator(selectors.stickerTab);
    const tab = tabs.nth(index);
    await expect(tab).toBeVisible({ timeout: timeouts.chatOpen });
    await tab.click();
    await this.page.waitForTimeout(1000);
  }

  // ─── Reactions ───

  async reactToMessage() {
    const wrapper = await this.hoverLastBubbleAndGetWrapper();
    const reactMenuItem = wrapper.locator('div.cometchat-menu-list__main-menu-item[title="React"]');
    await expect(reactMenuItem).toBeVisible({ timeout: timeouts.attachMenu });
    await reactMenuItem.dispatchEvent('click');
    await this.page.waitForTimeout(1000);
    const emojiItem = this.page.locator('div.cometchat-emoji-keyboard__list-item').first();
    await expect(emojiItem).toBeVisible({ timeout: timeouts.attachMenu });
    await emojiItem.click();
    await this.page.waitForTimeout(1000);
  }

  async verifyReactionAdded() {
    const reaction = this.page.locator(selectors.reactionItem).last();
    await expect(reaction).toBeVisible({ timeout: timeouts.messageAppear });
  }

  async addAnotherReaction(emojiIndex: number = 1) {
    const wrapper = await this.hoverLastBubbleAndGetWrapper();
    const reactMenuItem = wrapper.locator('div.cometchat-menu-list__main-menu-item[title="React"]');
    await expect(reactMenuItem).toBeVisible({ timeout: timeouts.attachMenu });
    await reactMenuItem.dispatchEvent('click');
    await this.page.waitForTimeout(1000);
    const emojiItem = this.page.locator('div.cometchat-emoji-keyboard__list-item').nth(emojiIndex);
    await expect(emojiItem).toBeVisible({ timeout: timeouts.attachMenu });
    await emojiItem.click();
    await this.page.waitForTimeout(1000);
  }

  async verifyMultipleReactions(minCount: number) {
    const bubble = this.page.locator(selectors.sentMessageBubble).last();
    const wrapper = bubble.locator('..');
    const reactions = wrapper.locator('div.cometchat-reactions');
    await expect(reactions).toBeVisible({ timeout: timeouts.messageAppear });
    await expect(async () => {
      const count = await reactions.locator('> div').count();
      expect(count).toBeGreaterThanOrEqual(minCount);
    }).toPass({ timeout: timeouts.messageAppear });
  }
}
