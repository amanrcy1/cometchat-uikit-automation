import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { UsersPage } from '../../lib/pages/UsersPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { TestConfig } from '../../lib/utils/test-config';
import { USERS } from '../../lib/utils/helpers';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * Integration — Full Chat Flow (end-to-end happy path)
 *
 * TC-INT-CHAT-001  Login → open user chat → send text → verify bubble
 * TC-INT-CHAT-002  Send media (image) → verify image bubble
 * TC-INT-CHAT-003  React → edit → delete message flow
 * TC-INT-CHAT-004  Open thread → send reply → close thread
 * TC-INT-CHAT-005  Search in chat → find message → close search
 * TC-INT-CHAT-006  Voice call → cancel → video call → cancel
 * TC-INT-CHAT-007  Open user details → block → unblock → close
 * TC-INT-CHAT-008  Delete chat → verify removed
 * TC-INT-CHAT-009  Logout → re-login → verify session restored
 */

async function createContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: TestConfig.baseURL,
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  return { context, page: await context.newPage() };
}

test.describe('Integration — Full 1:1 Chat Flow', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let loginPage: LoginPage;
  let usersPage: UsersPage;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();
    loginPage = new LoginPage(page);
    usersPage = new UsersPage(page);
    const convList = new ConversationListPage(page);
    await convList.goto();
    await loginPage.ensureLoggedIn(USERS.primary);
    await usersPage.navigateToUsersTab();
    await usersPage.searchUser(USERS.chatTarget);
    await usersPage.openUserChat(USERS.chatTarget);
    await chatPage.waitForChatReady();
  });

  test.afterAll(async () => {
    await chatPage.drainRuntimeErrors();
    await context.close();
  });

  test('@smoke @integration @chat TC-INT-CHAT-001: Login → open chat → send text → verify', async () => {
    await chatPage.sendTextMessage('integration-test-msg');
    await chatPage.verifyTextSent('integration-test-msg');
  });

  test('@sanity @integration @chat @media TC-INT-CHAT-002: Send image → verify image bubble', async () => {
    await chatPage.uploadMedia('image');
    await chatPage.verifyImageSent();
  });

  test('@sanity @integration @chat TC-INT-CHAT-003: React → edit → delete message flow', async () => {
    await chatPage.sendTextMessage('react-edit-delete');
    await chatPage.verifyTextSent('react-edit-delete');
    await chatPage.reactToMessage();
    await chatPage.verifyReactionAdded();
    await chatPage.sendTextMessage('to-be-edited');
    await chatPage.verifyTextSent('to-be-edited');
    await chatPage.editMessage('edited-text');
    await chatPage.verifyMessageEdited('edited-text');
    await chatPage.sendTextMessage('to-be-deleted');
    await chatPage.verifyTextSent('to-be-deleted');
    await chatPage.deleteMessage();
    await chatPage.verifyMessageDeleted(0);
  });

  test('@sanity @integration @chat @thread TC-INT-CHAT-004: Open thread → send reply → close', async () => {
    await chatPage.sendTextMessage('thread-parent');
    await chatPage.verifyTextSent('thread-parent');
    await chatPage.openThreadPanel();
    await chatPage.sendTextInThread('thread-reply');
    await chatPage.verifyTextInThread('thread-reply');
    await chatPage.closeThread();
  });

  test('@sanity @integration @chat @search TC-INT-CHAT-005: Search in chat → find → close', async () => {
    await chatPage.searchInChat('integration-test-msg');
    await chatPage.closeChatSearch();
  });

  test('@sanity @integration @calls TC-INT-CHAT-006: Voice call → cancel → video call → cancel', async () => {
    await chatPage.initiateVoiceCall();
    await chatPage.verifyOutgoingCallUI(USERS.chatTarget);
    await chatPage.cancelOutgoingCall();
    await chatPage.initiateVideoCall();
    await chatPage.verifyOutgoingCallUI(USERS.chatTarget);
    await chatPage.cancelOutgoingCall();
  });

  test('@sanity @integration @details TC-INT-CHAT-007: User details → block → unblock → close', async () => {
    await chatPage.openUserDetails();
    await chatPage.verifyUserDetailsStatus();
    await chatPage.blockUser();
    await chatPage.unblockUser();
    await chatPage.closeUserDetails();
  });

  test('@regression @integration @chat TC-INT-CHAT-008: Delete chat → verify removed', async () => {
    await chatPage.openUserDetails();
    await chatPage.deleteChat();
  });

  test('@smoke @integration @auth TC-INT-CHAT-009: Logout → re-login → verify session', async () => {
    await loginPage.logout();
    await loginPage.loginAs(USERS.primary);
  });
});
