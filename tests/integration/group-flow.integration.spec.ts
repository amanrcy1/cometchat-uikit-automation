import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { GroupsPage } from '../../lib/pages/GroupsPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { TestConfig } from '../../lib/utils/test-config';
import { USERS } from '../../lib/utils/helpers';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * Integration — Full Group Flow (end-to-end happy path)
 *
 * TC-INT-GRP-001  Create public group → send message → verify
 * TC-INT-GRP-002  Send media (image + emoji + voice) in group
 * TC-INT-GRP-003  React → edit → delete in group
 * TC-INT-GRP-004  Thread in group → send reply → close
 * TC-INT-GRP-005  Group voice call → end → video call → end
 * TC-INT-GRP-006  Group details → add member → kick member
 * TC-INT-GRP-007  Create private group → send message
 * TC-INT-GRP-008  Create password group → send message
 * TC-INT-GRP-009  Delete and exit all test groups (cleanup)
 */

async function createContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: TestConfig.baseURL,
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  return { context, page: await context.newPage() };
}

test.describe('Integration — Full Group Flow', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let groupsPage: GroupsPage;
  let publicGroup: string;
  let privateGroup: string;
  let pwdGroup: string;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();
    groupsPage = new GroupsPage(page);
    const convList = new ConversationListPage(page);
    await convList.goto();
    await new LoginPage(page).ensureLoggedIn(USERS.primary);
  });

  test.afterAll(async () => {
    await chatPage.drainRuntimeErrors();
    await context.close();
  });

  test('@smoke @integration @group TC-INT-GRP-001: Create public group → send message', async () => {
    publicGroup = await groupsPage.createNewGroupAndOpen();
    await chatPage.waitForChatReady();
    await chatPage.sendTextMessage('group-integration-msg');
    await chatPage.verifyTextSent('group-integration-msg');
  });

  test('@sanity @integration @group @media TC-INT-GRP-002: Send image + emoji + voice in group', async () => {
    await chatPage.uploadMedia('image');
    await chatPage.verifyImageSent();
    await chatPage.sendEmoji('grinning', '😀');
    await chatPage.verifyEmojiSent('😀');
    await chatPage.recordAndSendVoice(2000);
    await chatPage.verifyVoiceSent();
  });

  test('@sanity @integration @group TC-INT-GRP-003: React → edit → delete in group', async () => {
    await chatPage.sendTextMessage('grp-react');
    await chatPage.verifyTextSent('grp-react');
    await chatPage.reactToMessage();
    await chatPage.verifyReactionAdded();
    await chatPage.sendTextMessage('grp-edit-me');
    await chatPage.verifyTextSent('grp-edit-me');
    await chatPage.editMessage('grp-edited');
    await chatPage.verifyMessageEdited('grp-edited');
    await chatPage.sendTextMessage('grp-delete-me');
    await chatPage.verifyTextSent('grp-delete-me');
    await chatPage.deleteMessage();
    await chatPage.verifyMessageDeleted(0);
  });

  test('@sanity @integration @group @thread TC-INT-GRP-004: Thread in group → reply → close', async () => {
    await chatPage.sendTextMessage('grp-thread-parent');
    await chatPage.verifyTextSent('grp-thread-parent');
    await chatPage.openThreadPanel();
    await chatPage.sendTextInThread('grp-thread-reply');
    await chatPage.verifyTextInThread('grp-thread-reply');
    await chatPage.closeThread();
  });

  test('@sanity @integration @group @calls TC-INT-GRP-005: Group voice call → end → video call → end', async () => {
    await chatPage.initiateGroupVoiceCall();
    await chatPage.verifyOngoingCallUI();
    await chatPage.endGroupCall();
    await chatPage.initiateGroupVideoCall();
    await chatPage.verifyOngoingCallUI();
    await chatPage.endGroupCall();
  });

  test('@sanity @integration @group @admin TC-INT-GRP-006: Group details → add member → kick', async () => {
    await chatPage.openGroupDetails();
    await chatPage.addMemberToGroup('George Alan');
    await chatPage.verifyMemberVisible('George Alan');
    await chatPage.kickMember('George Alan');
    await chatPage.verifyMemberNotVisible('George Alan');
  });

  test('@sanity @integration @group @admin TC-INT-GRP-007: Create private group → send message', async () => {
    privateGroup = await groupsPage.createNewGroupAndOpen('Private');
    await chatPage.waitForChatReady();
    await chatPage.sendTextMessage('private-grp-msg');
    await chatPage.verifyTextSent('private-grp-msg');
  });

  test('@sanity @integration @group @admin TC-INT-GRP-008: Create password group → send message', async () => {
    pwdGroup = await groupsPage.createNewGroupAndOpen('Password', 'test123');
    await chatPage.waitForChatReady();
    await chatPage.sendTextMessage('pwd-grp-msg');
    await chatPage.verifyTextSent('pwd-grp-msg');
  });

  test('@regression @integration @group @admin TC-INT-GRP-009: Delete and exit all test groups (cleanup)', async () => {
    // Delete pwd group (currently open)
    await chatPage.openGroupDetails();
    await chatPage.deleteAndExitGroup();
    await page.waitForTimeout(1000);

    // Delete private group
    await groupsPage.navigateToGroupsTab();
    const privItem = page.locator(TestConfig.selectors.groupsListItem(privateGroup));
    if (await privItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await privItem.click();
      await chatPage.waitForChatReady();
      await chatPage.openGroupDetails();
      await chatPage.deleteAndExitGroup();
      await page.waitForTimeout(1000);
    }

    // Delete public group
    await groupsPage.navigateToGroupsTab();
    const pubItem = page.locator(TestConfig.selectors.groupsListItem(publicGroup));
    if (await pubItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pubItem.click();
      await chatPage.waitForChatReady();
      await chatPage.openGroupDetails();
      await chatPage.deleteAndExitGroup();
    }
  });
});
