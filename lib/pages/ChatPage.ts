import { Page } from '@playwright/test';
import { MediaType } from '../utils/file-helper';
import { ChatMessagingPage } from './chat/ChatMessagingPage';
import { ChatMediaPage } from './chat/ChatMediaPage';
import { ChatThreadPage } from './chat/ChatThreadPage';
import { ChatCallsPage } from './chat/ChatCallsPage';
import { ChatGroupActionsPage } from './chat/ChatGroupActionsPage';
import { ChatDetailsPage } from './chat/ChatDetailsPage';

/**
 * Composed ChatPage — backward-compatible facade that delegates to focused sub-pages.
 *
 * Sub-pages can also be used directly for more targeted imports:
 *   import { ChatMessagingPage } from './chat/ChatMessagingPage';
 *
 * All original method signatures are preserved for zero-breakage migration.
 */
export class ChatPage {
  readonly messaging: ChatMessagingPage;
  readonly media: ChatMediaPage;
  readonly thread: ChatThreadPage;
  readonly calls: ChatCallsPage;
  readonly groupActions: ChatGroupActionsPage;
  readonly details: ChatDetailsPage;

  constructor(private page: Page) {
    this.messaging = new ChatMessagingPage(page);
    this.media = new ChatMediaPage(page);
    this.thread = new ChatThreadPage(page);
    this.calls = new ChatCallsPage(page);
    this.groupActions = new ChatGroupActionsPage(page);
    this.details = new ChatDetailsPage(page);
  }

  // ─── Error Tracking (delegates to messaging as primary) ───
  attachErrorTracking(testName?: string) { this.messaging.attachErrorTracking(testName); }
  async drainRuntimeErrors() { await this.messaging.drainRuntimeErrors(); }
  async dismissErrorOverlay() { return this.messaging.dismissErrorOverlay(); }
  getOverlayScreenshots() { return this.messaging.getOverlayScreenshots(); }
  async setupErrorOverlayAutoDismiss(testName?: string) { await this.messaging.setupErrorOverlayAutoDismiss(testName); }
  async waitForChatReady() { await this.messaging.waitForChatReady(); }

  // ─── Messaging ───
  async uploadMedia(type: MediaType) { await this.messaging.uploadMedia(type); }
  async sendTextMessage(text: string) { await this.messaging.sendTextMessage(text); }
  async editMessage(newText: string) { await this.messaging.editMessage(newText); }
  async verifyMessageEdited(expectedText: string) { await this.messaging.verifyMessageEdited(expectedText); }
  async deleteMessage() { await this.messaging.deleteMessage(); }
  async verifyMessageDeleted(originalBubbleCount: number) { await this.messaging.verifyMessageDeleted(originalBubbleCount); }
  async copyMessage() { return this.messaging.copyMessage(); }
  async directReply(text: string) { await this.messaging.directReply(text); }
  async verifyDirectReply(expectedText: string) { await this.messaging.verifyDirectReply(expectedText); }
  async deleteChat() { await this.messaging.deleteChat(); }

  // ─── Verification ───
  async verifyImageSent() { await this.messaging.verifyImageSent(); }
  async verifyVideoSent() { await this.messaging.verifyVideoSent(); }
  async verifyPdfSent() { await this.messaging.verifyPdfSent(); }
  async verifyAudioSent() { await this.messaging.verifyAudioSent(); }
  async verifyTextSent(expectedText: string) { await this.messaging.verifyTextSent(expectedText); }
  async verifyVoiceSent() { await this.messaging.verifyVoiceSent(); }
  async verifyMessageReceipt() { await this.messaging.verifyMessageReceipt(); }
  async openMessageInfoAndVerify() { await this.messaging.openMessageInfoAndVerify(); }
  async closeMessageInfo() { await this.messaging.closeMessageInfo(); }

  // ─── Incoming Message Actions ───
  async markMessageUnread() { await this.messaging.markMessageUnread(); }
  async reportMessage() { await this.messaging.reportMessage(); }
  async verifyMarkUnreadVisible() { return this.messaging.verifyMarkUnreadVisible(); }
  async verifyReportVisible() { return this.messaging.verifyReportVisible(); }

  // ─── Emoji / Sticker / Voice ───
  async openEmojiKeyboard() { await this.media.openEmojiKeyboard(); }
  async selectEmoji(title: string) { await this.media.selectEmoji(title); }
  async searchAndSelectEmoji(keyword: string) { await this.media.searchAndSelectEmoji(keyword); }
  async sendEmoji(emojiTitle: string, emojiChar: string) { await this.media.sendEmoji(emojiTitle, emojiChar); }
  async searchAndSendEmoji(keyword: string) { await this.media.searchAndSendEmoji(keyword); }
  async verifyEmojiSent(emojiChar: string) { await this.media.verifyEmojiSent(emojiChar); }
  async startVoiceRecording() { await this.media.startVoiceRecording(); }
  async pauseVoiceRecording() { await this.media.pauseVoiceRecording(); }
  async resumeVoiceRecording() { await this.media.resumeVoiceRecording(); }
  async stopVoiceRecording() { await this.media.stopVoiceRecording(); }
  async sendVoiceRecording() { await this.media.sendVoiceRecording(); }
  async recordAndSendVoice(durationMs?: number) { await this.media.recordAndSendVoice(durationMs); }
  async recordWithPauseAndSend(before?: number, pause?: number, after?: number) { await this.media.recordWithPauseAndSend(before, pause, after); }
  async openStickerKeyboard() { await this.media.openStickerKeyboard(); }
  async closeStickerKeyboard() { await this.media.closeStickerKeyboard(); }
  async waitForStickersLoaded() { await this.media.waitForStickersLoaded(); }
  async sendSticker() { await this.media.sendSticker(); }
  async verifyStickerSent() { await this.media.verifyStickerSent(); }
  async switchStickerTab(index: number) { await this.media.switchStickerTab(index); }
  async reactToMessage() { await this.media.reactToMessage(); }
  async verifyReactionAdded() { await this.media.verifyReactionAdded(); }
  async addAnotherReaction(emojiIndex?: number) { await this.media.addAnotherReaction(emojiIndex); }
  async verifyMultipleReactions(minCount: number) { await this.media.verifyMultipleReactions(minCount); }

  // ─── Thread ───
  async openThreadPanel() { await this.thread.openThreadPanel(); }
  async closeThread() { await this.thread.closeThread(); }
  async sendTextInThread(text: string) { await this.thread.sendTextInThread(text); }
  async verifyTextInThread(expectedText: string) { await this.thread.verifyTextInThread(expectedText); }
  async reactInThread() { await this.thread.reactInThread(); }
  async verifyReactionInThread() { await this.thread.verifyReactionInThread(); }
  async editInThread(newText: string) { await this.thread.editInThread(newText); }
  async verifyEditedInThread(expectedText: string) { await this.thread.verifyEditedInThread(expectedText); }
  async deleteInThread() { await this.thread.deleteInThread(); }
  async verifyDeletedInThread() { await this.thread.verifyDeletedInThread(); }
  async uploadMediaInThreadPanel(type: MediaType) { await this.thread.uploadMediaInThreadPanel(type); }
  async verifyImageInThread() { await this.thread.verifyImageInThread(); }
  async sendEmojiInThread(emojiTitle: string, emojiChar: string) { await this.thread.sendEmojiInThread(emojiTitle, emojiChar); }
  async verifyEmojiInThread(emojiChar: string) { await this.thread.verifyEmojiInThread(emojiChar); }
  async recordVoiceInThread(durationMs?: number) { await this.thread.recordVoiceInThread(durationMs); }
  async verifyVoiceInThread() { await this.thread.verifyVoiceInThread(); }

  // ─── Calls ───
  async initiateVoiceCall() { await this.calls.initiateVoiceCall(); }
  async initiateVideoCall() { await this.calls.initiateVideoCall(); }
  async verifyOutgoingCallUI(expectedName: string) { await this.calls.verifyOutgoingCallUI(expectedName); }
  async cancelOutgoingCall() { await this.calls.cancelOutgoingCall(); }
  async initiateGroupVoiceCall() { await this.calls.initiateGroupVoiceCall(); }
  async initiateGroupVideoCall() { await this.calls.initiateGroupVideoCall(); }
  async verifyOngoingCallUI() { await this.calls.verifyOngoingCallUI(); }
  async endGroupCall() { await this.calls.endGroupCall(); }
  async verifyCallBubble(callType: 'Voice call' | 'Video call') { await this.calls.verifyCallBubble(callType); }

  // ─── Group Actions ───
  async openGroupDetails() { await this.groupActions.openGroupDetails(); }
  async verifyMemberVisible(name: string) { await this.groupActions.verifyMemberVisible(name); }
  async verifyMemberNotVisible(name: string) { await this.groupActions.verifyMemberNotVisible(name); }
  async addMemberToGroup(name: string) { await this.groupActions.addMemberToGroup(name); }
  async kickMember(name: string) { await this.groupActions.kickMember(name); }
  async deleteAndExitGroup() { await this.groupActions.deleteAndExitGroup(); }
  async deleteChatFromGroupDetails() { await this.groupActions.deleteChatFromGroupDetails(); }
  async switchToBannedMembersTab() { await this.groupActions.switchToBannedMembersTab(); }
  async verifyBannedMembersEmpty() { await this.groupActions.verifyBannedMembersEmpty(); }
  async switchToViewMembersTab() { await this.groupActions.switchToViewMembersTab(); }

  // ─── User Details & Search ───
  async openUserDetails() { await this.details.openUserDetails(); }
  async closeUserDetails() { await this.details.closeUserDetails(); }
  async verifyHeaderStatusVisible() { await this.details.verifyHeaderStatusVisible(); }
  async verifyUserDetailsStatus() { await this.details.verifyUserDetailsStatus(); }
  async blockUser() { await this.details.blockUser(); }
  async unblockUser() { await this.details.unblockUser(); }
  async openChatSearch() { await this.details.openChatSearch(); }
  async searchInChat(keyword: string) { await this.details.searchInChat(keyword); }
  async closeChatSearch() { await this.details.closeChatSearch(); }
  async verifySearchViewVisible() { await this.details.verifySearchViewVisible(); }
  async verifySearchInitialState() { await this.details.verifySearchInitialState(); }
  async verifySearchFiltersVisible() { await this.details.verifySearchFiltersVisible(); }
  async typeSearchKeyword(keyword: string) { await this.details.typeSearchKeyword(keyword); }
  async waitForSearchResolved(timeout?: number) { await this.details.waitForSearchResolved(timeout); }
  async verifySearchHasResults(minCount?: number, keyword?: string) { await this.details.verifySearchHasResults(minCount, keyword); }
  async getSearchResultCount() { return this.details.getSearchResultCount(); }
  async verifyResultContainsText(text: string) { await this.details.verifyResultContainsText(text); }
  async verifySearchEmptyState() { await this.details.verifySearchEmptyState(); }
  async selectSearchFilter(filter: 'Audio' | 'Documents' | 'Photos' | 'Videos' | 'Links') { await this.details.selectSearchFilter(filter); }
  async clearSearchViaButton() { await this.details.clearSearchViaButton(); }
  async verifySearchInputValue(expected: string) { await this.details.verifySearchInputValue(expected); }
}
