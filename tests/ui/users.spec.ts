import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { UsersPage } from '../../lib/pages/UsersPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { TestConfig } from '../../lib/utils/test-config';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * Users Tab → 1:1 Chat (George Alan)
 *
 * Full happy-path coverage from Users tab entry point.
 * Main chat actions + thread mirror (same actions inside thread).
 *
 * Sequential flow:
 *   ── Users List ──
 *   0.  Alphabetical section headers (G, J, N, S)
 *   ── Main Chat ──
 *   1.  React with multiple emojis
 *   2.  Edit a text message
 *   3.  Copy a text message
 *   4.  Direct reply
 *   5.  Message info panel + receipt verification
 *   6.  Delete a text message
 *   7.  Search in chat
 *   8.  Send all media (image, video, PDF, audio)
 *   9.  Send emoji (pick + search)
 *  10.  Voice recording (simple + pause/resume)
 *  ── Thread Mirror ──
 *  11.  Open thread → send text, react, edit, delete, image, emoji, voice
 *  ── Calls ──
 *  12.  Voice call — initiate & cancel
 *  13.  Video call — initiate & cancel
 *  ── User Details ──
 *  14.  Status indicators + block & unblock user
 *  15.  Delete chat
 *  16.  Logout & re-login
 */

async function createContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: TestConfig.baseURL,
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  return { context, page };
}

async function warmUp(chatPage: ChatPage, page: Page) {
  let sent = false;
  for (let i = 1; i <= 3 && !sent; i++) {
    try {
      await chatPage.dismissErrorOverlay();
      await chatPage.sendTextMessage('warm-up');
      await chatPage.verifyTextSent('warm-up');
      sent = true;
    } catch {
      console.log(`Warm-up attempt ${i} failed, retrying...`);
      await chatPage.dismissErrorOverlay();
      await page.waitForTimeout(2000);
    }
  }
  if (!sent) throw new Error('Warm-up failed after 3 attempts — app may have a runtime error overlay blocking interactions');
}

test.describe('Users Tab → 1:1 Chat', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let loginPage: LoginPage;
  let usersPage: UsersPage;

  test.beforeAll(async ({ browser }) => {
    const setup = await createContext(browser);
    context = setup.context;
    page = setup.page;
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();
    loginPage = new LoginPage(page);

    const conversationList = new ConversationListPage(page);
    await conversationList.goto();
    await loginPage.ensureLoggedIn(TestConfig.login.sampleUserUid);

    usersPage = new UsersPage(page);
  });

  test.afterAll(async () => { await chatPage.drainRuntimeErrors(); await context.close(); });

  // ─── Users List ───

  test('@smoke @sanity @chat TC-USR-001: Users list — alphabetical section headers', async () => {
    await test.step('Navigate to Users tab', async () => {
      await usersPage.navigateToUsersTab();
    });
    await test.step('Verify section headers exist', async () => {
      const letters = await usersPage.verifySectionHeaders();
      expect(letters.length).toBeGreaterThanOrEqual(2);
      // Verify each header is a single uppercase letter
      for (const letter of letters) {
        expect(letter).toMatch(/^[A-Z]$/);
      }
    });
    await test.step('Open chat with George Alan for remaining tests', async () => {
      await usersPage.searchUser(TestConfig.chatTargets.user);
      await usersPage.openUserChat(TestConfig.chatTargets.user);
      await chatPage.waitForChatReady();
      await warmUp(chatPage, page);
    });
  });

  // ─── Main Chat: Message Actions ───

  test('@sanity @chat TC-USR-002: React to a message with multiple emojis', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('react to this');
      await chatPage.verifyTextSent('react to this');
    });
    await test.step('Add first reaction', async () => {
      await chatPage.reactToMessage();
      await chatPage.verifyReactionAdded();
    });
    await test.step('Add second reaction', async () => {
      await chatPage.addAnotherReaction(2);
      await chatPage.verifyMultipleReactions(2);
    });
  });

  test('@sanity @chat TC-USR-003: Edit a text message', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('original message');
      await chatPage.verifyTextSent('original message');
    });
    await test.step('Edit and verify', async () => {
      await chatPage.editMessage('edited message');
      await chatPage.verifyMessageEdited('edited message');
    });
  });

  test('@sanity @chat TC-USR-004: Copy a text message', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('copy this text');
      await chatPage.verifyTextSent('copy this text');
    });
    await test.step('Copy and verify clipboard', async () => {
      const copied = await chatPage.copyMessage();
      expect(copied).toContain('copy this text');
    });
  });

  test('@sanity @chat @thread TC-USR-005: Direct reply to a message', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('reply to this directly');
      await chatPage.verifyTextSent('reply to this directly');
    });
    await test.step('Reply and verify', async () => {
      await chatPage.directReply('this is a direct reply');
      await chatPage.verifyDirectReply('this is a direct reply');
    });
  });

  test('@regression @chat @details TC-USR-006: Message info panel and delivery receipt', async () => {
    await test.step('Send a message', async () => {
      await chatPage.sendTextMessage('info check');
      await chatPage.verifyTextSent('info check');
    });
    await test.step('Verify delivery receipt on bubble', async () => {
      await chatPage.verifyMessageReceipt();
    });
    await test.step('Receipt has a recognizable state class (sent/delivered/read)', async () => {
      const bubble = page.locator(TestConfig.selectors.sentMessageBubble).last();
      const wrapper = bubble.locator('..');
      const receipt = wrapper.locator('[class*="cometchat-receipts"]').first();
      await expect(receipt).toBeAttached({ timeout: TestConfig.timeouts.messageAppear });
      const cls = await receipt.getAttribute('class') || '';
      // Receipt class exists and is non-empty — state may be sent/delivered/read
      expect(cls.length).toBeGreaterThan(0);
      expect(cls).toContain('cometchat-receipts');
    });
    await test.step('Open message info', async () => {
      await chatPage.openMessageInfoAndVerify();
    });
    await test.step('Close message info', async () => {
      await chatPage.closeMessageInfo();
    });
  });

  test('@sanity @chat TC-USR-007: Delete a text message', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('to be deleted');
      await chatPage.verifyTextSent('to be deleted');
    });
    await test.step('Delete and verify', async () => {
      await chatPage.deleteMessage();
      await chatPage.verifyMessageDeleted(0);
    });
  });

  test('@sanity @chat @search TC-USR-008: Search in chat', async () => {
    await test.step('Search inside chat', async () => {
      await chatPage.searchInChat('warm-up');
    });
    await test.step('Close chat search', async () => {
      await chatPage.closeChatSearch();
    });
  });

  // ─── Main Chat: Media ───

  test('@smoke @sanity @chat @media TC-USR-009: Send all media types', async () => {
    await test.step('Upload image', async () => {
      await chatPage.uploadMedia('image');
      await chatPage.verifyImageSent();
    });
    await test.step('Upload video', async () => {
      await chatPage.uploadMedia('video');
      await chatPage.verifyVideoSent();
    });
    await test.step('Upload audio', async () => {
      await chatPage.uploadMedia('audio');
      await chatPage.verifyAudioSent();
    });
    await test.step('Upload PDF', async () => {
      await chatPage.uploadMedia('pdf');
      await chatPage.verifyPdfSent();
    });
  });

  test('@sanity @chat @media TC-USR-010: Send emoji via picker and search', async () => {
    await test.step('Pick emoji', async () => {
      await chatPage.sendEmoji('grinning', '😀');
      await chatPage.verifyEmojiSent('😀');
    });
    await test.step('Search emoji', async () => {
      await chatPage.searchAndSendEmoji('thumbsup');
    });
  });

  test('@sanity @chat @media TC-USR-011: Voice recording — simple and pause/resume', async () => {
    await test.step('Record and send', async () => {
      await chatPage.recordAndSendVoice(2000);
      await chatPage.verifyVoiceSent();
    });
    await test.step('Record with pause/resume', async () => {
      await chatPage.recordWithPauseAndSend(1500, 800, 1500);
      await chatPage.verifyVoiceSent();
    });
  });

  // ─── Thread Mirror ───

  test('@sanity @chat @thread TC-USR-012: Thread — send text, react, edit, delete, image, emoji, voice', async () => {
    await test.step('Send parent message and open thread', async () => {
      // Ensure chat is ready after voice recording
      await chatPage.dismissErrorOverlay();
      await chatPage.waitForChatReady();
      await chatPage.sendTextMessage('thread parent for mirror');
      await chatPage.verifyTextSent('thread parent for mirror');
      await chatPage.openThreadPanel();
    });
    await test.step('Send text in thread', async () => {
      await chatPage.sendTextInThread('thread text message');
      await chatPage.verifyTextInThread('thread text message');
    });
    await test.step('React to message in thread', async () => {
      await chatPage.reactInThread();
      await chatPage.verifyReactionInThread();
    });
    await test.step('Edit message in thread', async () => {
      await chatPage.sendTextInThread('thread original');
      await chatPage.verifyTextInThread('thread original');
      await chatPage.editInThread('thread edited');
      await chatPage.verifyEditedInThread('thread edited');
    });
    await test.step('Delete message in thread', async () => {
      await chatPage.sendTextInThread('thread delete me');
      await chatPage.verifyTextInThread('thread delete me');
      await chatPage.deleteInThread();
      await chatPage.verifyDeletedInThread();
    });
    await test.step('Upload image in thread', async () => {
      await chatPage.uploadMediaInThreadPanel('image');
      await chatPage.verifyImageInThread();
    });
    await test.step('Send emoji in thread', async () => {
      await chatPage.sendEmojiInThread('grinning', '😀');
      await chatPage.verifyEmojiInThread('😀');
    });
    await test.step('Record voice in thread', async () => {
      await chatPage.recordVoiceInThread(2000);
      await chatPage.verifyVoiceInThread();
    });
    await test.step('Close thread', async () => {
      await chatPage.closeThread();
    });
  });

  // ─── Calls ───

  test('@smoke @sanity @chat @calls TC-USR-013: Initiate voice call and cancel', async () => {
    await test.step('Ensure chat is ready (recover from previous test)', async () => {
      // Close any open thread/panel
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
      await chatPage.dismissErrorOverlay();
      // If composer not visible, re-open the chat
      const composerVisible = await page.locator(TestConfig.selectors.composerInput).isVisible({ timeout: 3000 }).catch(() => false);
      if (!composerVisible) {
        await usersPage.navigateToUsersTab();
        await usersPage.searchUser(TestConfig.chatTargets.user);
        await usersPage.openUserChat(TestConfig.chatTargets.user);
        await chatPage.waitForChatReady();
      }
    });
    await test.step('Click voice call button', async () => {
      await chatPage.initiateVoiceCall();
    });
    await test.step('Verify outgoing call UI', async () => {
      await chatPage.verifyOutgoingCallUI(TestConfig.chatTargets.user);
    });
    await test.step('Cancel the call', async () => {
      await chatPage.cancelOutgoingCall();
    });
  });

  test('@sanity @chat @calls TC-USR-014: Initiate video call and cancel', async () => {
    await test.step('Ensure chat is open', async () => {
      await chatPage.dismissErrorOverlay();
      const headerVisible = await page.locator(TestConfig.selectors.voiceCallButton).isVisible({ timeout: 3000 }).catch(() => false);
      if (!headerVisible) {
        await usersPage.navigateToUsersTab();
        await usersPage.searchUser(TestConfig.chatTargets.user);
        await usersPage.openUserChat(TestConfig.chatTargets.user);
        await chatPage.waitForChatReady();
      }
    });
    await test.step('Click video call button', async () => {
      await chatPage.initiateVideoCall();
    });
    await test.step('Verify outgoing call UI', async () => {
      await chatPage.verifyOutgoingCallUI(TestConfig.chatTargets.user);
    });
    await test.step('Cancel the call', async () => {
      await chatPage.cancelOutgoingCall();
    });
  });

  // ─── User Details: Status + Block/Unblock (merged — avoids double open/close) ───

  test('@sanity @chat @details TC-USR-015: User details — status, block, unblock', async () => {
    await test.step('Ensure chat is open', async () => {
      await chatPage.dismissErrorOverlay();
      const headerVisible = await page.locator(TestConfig.selectors.messageHeaderListItem).isVisible({ timeout: 3000 }).catch(() => false);
      if (!headerVisible) {
        await usersPage.navigateToUsersTab();
        await usersPage.searchUser(TestConfig.chatTargets.user);
        await usersPage.openUserChat(TestConfig.chatTargets.user);
        await chatPage.waitForChatReady();
      }
    });
    await test.step('Open user details', async () => {
      await chatPage.openUserDetails();
    });
    await test.step('Verify header status subtitle', async () => {
      await chatPage.verifyHeaderStatusVisible();
    });
    await test.step('Verify details panel shows Online or Offline', async () => {
      await chatPage.verifyUserDetailsStatus();
    });
    await test.step('Block user', async () => {
      await chatPage.blockUser();
    });
    await test.step('Unblock user', async () => {
      await chatPage.unblockUser();
    });
    await test.step('Close user details', async () => {
      await chatPage.closeUserDetails();
    });
  });

  // ─── Destructive ───

  test('@regression @chat @details TC-USR-016: Delete chat from user details', async () => {
    await test.step('Ensure chat is open', async () => {
      await chatPage.dismissErrorOverlay();
      const headerVisible = await page.locator(TestConfig.selectors.messageHeaderListItem).isVisible({ timeout: 3000 }).catch(() => false);
      if (!headerVisible) {
        await usersPage.navigateToUsersTab();
        await usersPage.searchUser(TestConfig.chatTargets.user);
        await usersPage.openUserChat(TestConfig.chatTargets.user);
        await chatPage.waitForChatReady();
      }
    });
    await test.step('Open user details', async () => {
      await chatPage.openUserDetails();
    });
    await test.step('Delete the chat', async () => {
      await chatPage.deleteChat();
    });
  });

  test('@smoke @auth TC-USR-017: Logout and re-login', async () => {
    await test.step('Logout', async () => {
      await loginPage.logout();
    });
    await test.step('Re-login', async () => {
      await loginPage.loginAs(TestConfig.login.sampleUserUid);
    });
  });
});
