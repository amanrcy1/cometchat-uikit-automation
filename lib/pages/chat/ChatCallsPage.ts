import { expect } from '@playwright/test';
import { TestConfig } from '../../utils/test-config';
import { ChatBasePage } from './ChatBasePage';

const { selectors, timeouts } = TestConfig;

/**
 * Handles voice/video call initiation, cancellation, group calls, and call bubble verification.
 */
export class ChatCallsPage extends ChatBasePage {

  async initiateVoiceCall() {
    await this.dismissErrorOverlay();
    const btn = this.page.locator(selectors.voiceCallButton);
    await expect(btn).toBeVisible({ timeout: timeouts.chatOpen });
    await btn.click({ force: true });
    await this.dismissErrorOverlay();
    await expect(this.page.locator(selectors.outgoingCallOverlay)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async initiateVideoCall() {
    await this.dismissErrorOverlay();
    const btn = this.page.locator(selectors.videoCallButton);
    await expect(btn).toBeVisible({ timeout: timeouts.chatOpen });
    await btn.click({ force: true });
    await this.dismissErrorOverlay();
    await expect(this.page.locator(selectors.outgoingCallOverlay)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async verifyOutgoingCallUI(expectedName: string) {
    const title = this.page.locator(selectors.outgoingCallTitle);
    await expect(title).toHaveText(expectedName, { timeout: timeouts.chatOpen });
    const subtitle = this.page.locator(selectors.outgoingCallSubtitle);
    await expect(subtitle).toHaveText('Calling...', { timeout: timeouts.chatOpen });
  }

  async cancelOutgoingCall() {
    const cancelBtn = this.page.locator(selectors.outgoingCallCancelButton);
    await expect(cancelBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await this.dismissErrorOverlay();
    await cancelBtn.click({ timeout: 5000 });
    await expect(this.page.locator(selectors.outgoingCallOverlay)).not.toBeVisible({ timeout: timeouts.chatOpen });
    await this.page.waitForTimeout(500);
  }

  async initiateGroupVoiceCall() {
    const btn = this.page.locator(selectors.voiceCallButton);
    await expect(btn).toBeVisible({ timeout: timeouts.chatOpen });
    await btn.click();
    await expect(this.page.locator(selectors.ongoingCallOverlay)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async initiateGroupVideoCall() {
    const btn = this.page.locator(selectors.videoCallButton);
    await expect(btn).toBeVisible({ timeout: timeouts.chatOpen });
    await btn.click();
    await expect(this.page.locator(selectors.ongoingCallOverlay)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async verifyOngoingCallUI() {
    await expect(this.page.locator(selectors.ongoingCallOverlay)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async endGroupCall() {
    const endBtn = this.page.locator(selectors.ongoingCallEndButton);
    await expect(endBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await endBtn.click();
    await expect(this.page.locator(selectors.ongoingCallOverlay)).not.toBeVisible({ timeout: timeouts.chatOpen });
    await this.page.waitForTimeout(1000);
  }

  async verifyCallBubble(callType: 'Voice call' | 'Video call') {
    const bubble = this.page.locator(`div.cometchat-call-bubble__body-content-title:has-text("${callType}")`);
    await expect(bubble.last()).toBeVisible({ timeout: timeouts.messageAppear });
  }
}
