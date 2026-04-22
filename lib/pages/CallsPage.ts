import { Page, Locator, expect } from '@playwright/test';
import { TestConfig } from '../utils/test-config';

const { selectors, timeouts } = TestConfig;

/**
 * Page Object for the Calls tab.
 * Handles call logs list, call details panel, and detail sub-tabs
 * (Participants / Recording / History).
 */
export class CallsPage {
  constructor(private page: Page) {}

  // ─── Helpers ───

  /**
   * Remove the webpack-dev-server error overlay iframe, then click.
   * The iframe intercepts pointer events — removing it right before
   * the click keeps the window small enough that it can't reappear.
   */
  private async safeClick(locator: Locator, opts?: { timeout?: number }) {
    await this.page.evaluate(() => {
      document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(el => el.remove());
      document.querySelectorAll('iframe').forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 1000) el.remove();
      });
      document.querySelectorAll('body > div, body > section').forEach(el => {
        if (el.id === 'root') return;
        const s = window.getComputedStyle(el as HTMLElement);
        const t = (el as HTMLElement).innerText || '';
        if (s.position === 'fixed' && parseInt(s.zIndex || '0') > 100 &&
            (t.includes('runtime error') || t.includes('Uncaught') || t.includes('ERROR'))) {
          (el as HTMLElement).remove();
        }
      });
    });
    await locator.click({ timeout: opts?.timeout ?? 5_000 });
  }

  // ─── Navigation ───

  async navigateToCallsTab() {
    const tab = this.page.locator(selectors.callsTab);
    await expect(tab).toBeVisible({ timeout: timeouts.pageLoad });
    await this.safeClick(tab);
    await expect(this.page.locator(selectors.callLogsList)).toBeVisible({ timeout: timeouts.pageLoad });
  }

  // ─── Call Logs List ───

  async verifyCallsHeaderVisible() {
    await expect(this.page.locator(selectors.callLogsHeaderTitle)).toHaveText('Calls', { timeout: timeouts.pageLoad });
  }

  async verifyCallLogEntriesExist() {
    await expect(this.page.locator(selectors.callLogItem).first()).toBeVisible({ timeout: timeouts.chatOpen });
  }

  /** Verify the first (or nth) call log entry has all expected structural elements */
  async verifyCallLogEntryStructure(expectedName: string, index = 0) {
    const item = this.page.locator(selectors.callLogItem).nth(index);
    await expect(item).toBeVisible({ timeout: timeouts.chatOpen });

    // Avatar
    await expect(item.locator('div.cometchat-avatar')).toBeVisible({ timeout: timeouts.chatOpen });
    // Name
    await expect(this.page.locator(selectors.callLogItemName).nth(index)).toHaveText(expectedName, { timeout: timeouts.chatOpen });
    // Date — non-empty
    await expect(this.page.locator(selectors.callLogItemSubtitle).nth(index)).not.toBeEmpty({ timeout: timeouts.chatOpen });
    // Direction icon
    await expect(this.page.locator(selectors.callLogDirectionIcon).nth(index)).toBeVisible({ timeout: timeouts.chatOpen });
    // Trailing icon (voice/video)
    await expect(this.page.locator(selectors.callLogTrailingIcon).nth(index)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  // ─── Call Details Panel ───

  /** Open the details panel for a call log entry. Retries the click if the panel is slow. */
  async openCallDetails(index = 0) {
    // Make sure the list is visible first
    const list = this.page.locator(selectors.callLogsList);
    if (!await list.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.navigateToCallsTab();
    }

    const item = this.page.locator(selectors.callLogItem).nth(index);
    await expect(item).toBeVisible({ timeout: timeouts.chatOpen });

    await expect(async () => {
      await this.safeClick(item);
      await expect(this.page.locator(selectors.callDetailsPanel)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: timeouts.chatOpen });
  }

  /** Verify all static content inside the call details panel */
  async verifyCallDetailsPanelContent(expectedName: string) {
    const panel = this.page.locator(selectors.callDetailsPanel);
    await expect(panel).toBeVisible({ timeout: timeouts.chatOpen });

    // Header
    await expect(this.page.locator(selectors.callDetailsHeader)).toContainText('Call Details');
    // User name
    await expect(this.page.locator(selectors.callDetailsName)).toHaveText(expectedName);
    // Status (Online / Offline / Last seen …)
    await expect(this.page.locator(selectors.callDetailsSubtitle)).toBeVisible();
    // Call info row — direction label, date, duration
    await expect(this.page.locator(selectors.callLogInfo)).toBeVisible();
    await expect(this.page.locator(selectors.callLogInfoTitle)).not.toBeEmpty();
    await expect(this.page.locator(selectors.callLogInfoSubtitle)).toBeVisible();
    await expect(this.page.locator(selectors.callLogInfoDuration)).toBeVisible();
    // Action buttons
    await expect(this.page.locator(selectors.callDetailsVoiceCallButton)).toBeVisible();
    await expect(this.page.locator(selectors.callDetailsVideoCallButton)).toBeVisible();
    // Tabs
    for (const name of ['Participants', 'Recording', 'History']) {
      await expect(this.page.locator(selectors.callDetailsTabItem(name))).toBeVisible();
    }
  }

  // ─── Call Details Tabs ───

  async switchToTab(tabName: 'Participants' | 'Recording' | 'History') {
    const tab = this.page.locator(selectors.callDetailsTabItem(tabName));
    await expect(tab).toBeVisible({ timeout: timeouts.chatOpen });
    await tab.click();
    // Wait for the tab content to swap — active class changes
    await expect(this.page.locator(selectors.callDetailsActiveTab)).toContainText(tabName, { timeout: timeouts.chatOpen });
  }

  // ─── Participants Tab ───

  async verifyParticipantsTab(expectedParticipant: string) {
    await expect(this.page.locator(selectors.callLogParticipants)).toBeVisible({ timeout: timeouts.chatOpen });
    // At least one participant with the expected name
    const name = this.page.locator(selectors.callLogParticipantName).filter({ hasText: expectedParticipant });
    await expect(name.first()).toBeVisible({ timeout: timeouts.chatOpen });
    // Duration column present
    await expect(this.page.locator(selectors.callLogParticipantDuration).first()).toBeVisible({ timeout: timeouts.chatOpen });
  }

  // ─── Recording Tab ───

  async verifyRecordingTabEmptyState() {
    await expect(this.page.locator(selectors.callLogRecordings)).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.callLogRecordingsEmptyState)).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.callLogRecordingsEmptyText)).toHaveText('No recording available');
  }

  // ─── History Tab ───

  async verifyHistoryTab() {
    await expect(this.page.locator(selectors.callLogHistory)).toBeVisible({ timeout: timeouts.chatOpen });
    // At least one history entry with direction, date, duration
    await expect(this.page.locator(selectors.callLogHistoryTitle).first()).toBeVisible({ timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.callLogHistoryTitle).first()).not.toBeEmpty();
    await expect(this.page.locator(selectors.callLogHistorySubtitle).first()).toBeVisible();
    await expect(this.page.locator(selectors.callLogHistoryDuration).first()).toBeVisible();
  }

  // ─── Initiate / Cancel Calls from Details ───

  async initiateVoiceCallFromDetails() {
    const btn = this.page.locator(selectors.callDetailsVoiceCallButton);
    await expect(btn).toBeVisible({ timeout: timeouts.chatOpen });
    await this.safeClick(btn);
    await expect(this.page.locator(selectors.outgoingCallOverlay)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async initiateVideoCallFromDetails() {
    const btn = this.page.locator(selectors.callDetailsVideoCallButton);
    await expect(btn).toBeVisible({ timeout: timeouts.chatOpen });
    await this.safeClick(btn);
    await expect(this.page.locator(selectors.outgoingCallOverlay)).toBeVisible({ timeout: timeouts.chatOpen });
  }

  async verifyOutgoingCallUI(expectedName: string) {
    await expect(this.page.locator(selectors.outgoingCallTitle)).toHaveText(expectedName, { timeout: timeouts.chatOpen });
    await expect(this.page.locator(selectors.outgoingCallSubtitle)).toHaveText('Calling...');
  }

  async cancelOutgoingCall() {
    const cancelBtn = this.page.locator(selectors.outgoingCallCancelButton);
    await expect(cancelBtn).toBeVisible({ timeout: timeouts.chatOpen });
    await this.safeClick(cancelBtn);
    await expect(this.page.locator(selectors.outgoingCallOverlay)).not.toBeVisible({ timeout: timeouts.chatOpen });
  }
}
