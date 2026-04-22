import { expect, Browser, Page, BrowserContext } from '@playwright/test';
import { test } from '../../lib/fixtures/error-fixture';
import { LoginPage } from '../../lib/pages/LoginPage';
import { ConversationListPage } from '../../lib/pages/ConversationListPage';
import { GroupsPage } from '../../lib/pages/GroupsPage';
import { ChatPage } from '../../lib/pages/ChatPage';
import { TestConfig } from '../../lib/utils/test-config';

const AUTH_FILE = 'lib/fixtures/.auth/session.json';

/**
 * Groups Tab → Group Chat
 *
 * Full happy-path coverage from Groups tab entry point.
 * Creates a fresh group, runs all actions + thread mirror.
 *
 * Sequential flow:
 *   ── Setup ──
 *   0.  Groups search + member count subtitle verification
 *   ── Main Chat ──
 *   1.  React, edit, delete message
 *   2.  Send all media (image, video, audio, PDF)
 *   3.  Send emoji (pick + search)
 *   4.  Voice recording (simple + pause/resume)
 *   5.  Copy a text message
 *   6.  Direct reply
 *   7.  Message info panel + receipt
 *   8.  Search in chat
 *   ── Thread Mirror ──
 *   9.  Open thread → send text, react, edit, delete, image, emoji, voice
 *   ── Calls ──
 *  10.  Voice call — initiate & cancel
 *  11.  Video call — initiate & cancel
 *   ── Group Admin ──
 *  12.  Group details — verify panel, banned members tab, add/kick member, delete chat
 *   ── Destructive ──
 *  13.  Delete and exit group
 *  14.  Logout & re-login
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

test.describe('Groups Tab → Group Chat', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let loginPage: LoginPage;
  let groupsPage: GroupsPage;
  let groupName: string;

  test.beforeAll(async ({ browser }) => {
    const setup = await createContext(browser);
    context = setup.context;
    page = setup.page;
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();
    loginPage = new LoginPage(page);
    groupsPage = new GroupsPage(page);

    const conversationList = new ConversationListPage(page);
    await conversationList.goto();
    await loginPage.ensureLoggedIn(TestConfig.login.sampleUserUid);
  });

  test.afterAll(async () => { await chatPage.drainRuntimeErrors(); await context.close(); });

  // ─── Groups List: Search + Member Count ───

  test('@smoke @sanity @group TC-GRP-001: Groups search and member count subtitle', async () => {
    await test.step('Navigate to Groups tab', async () => {
      await groupsPage.navigateToGroupsTab();
    });
    await test.step('Verify member count subtitle on first group', async () => {
      await groupsPage.verifyGroupMemberCount();
    });
    await test.step('Search filters groups', async () => {
      // Use a unique prefix that won't match — verify empty, then clear
      await groupsPage.searchGroup('zzz_nonexistent_group');
      await page.waitForTimeout(500);
      const count = await page.locator('div.cometchat-groups div.cometchat-list-item').count();
      expect(count).toBe(0);
      await groupsPage.clearGroupSearch();
    });
    await test.step('Create group for remaining tests', async () => {
      groupName = await groupsPage.createNewGroupAndOpen();
      console.log(`Created group: ${groupName}`);
      await chatPage.waitForChatReady();
      await warmUp(chatPage, page);
    });
  });

  // ─── Main Chat: Message Actions ───

  test('@sanity @group @chat TC-GRP-002: React, edit, delete in group chat', async () => {
    await test.step('React to a message', async () => {
      await chatPage.sendTextMessage('group react test');
      await chatPage.verifyTextSent('group react test');
      await chatPage.reactToMessage();
      await chatPage.verifyReactionAdded();
    });
    await test.step('Edit a message', async () => {
      await chatPage.sendTextMessage('group original');
      await chatPage.verifyTextSent('group original');
      await chatPage.editMessage('group edited');
      await chatPage.verifyMessageEdited('group edited');
    });
    await test.step('Delete a message', async () => {
      await chatPage.sendTextMessage('group delete me');
      await chatPage.verifyTextSent('group delete me');
      await chatPage.deleteMessage();
      await chatPage.verifyMessageDeleted(0);
    });
  });

  // ─── Main Chat: Media ───

  test('@sanity @group @media TC-GRP-003: Send all media types in group', async () => {
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

  test('@sanity @group @media TC-GRP-004: Send emoji in group — pick and search', async () => {
    await test.step('Pick emoji', async () => {
      await chatPage.sendEmoji('grinning', '😀');
      await chatPage.verifyEmojiSent('😀');
    });
    await test.step('Search emoji', async () => {
      await chatPage.searchAndSendEmoji('thumbsup');
    });
  });

  test('@sanity @group @media TC-GRP-005: Voice recording in group — simple and pause/resume', async () => {
    await test.step('Record and send', async () => {
      await chatPage.recordAndSendVoice(2000);
      await chatPage.verifyVoiceSent();
    });
    await test.step('Record with pause/resume', async () => {
      await chatPage.recordWithPauseAndSend(1500, 800, 1500);
      await chatPage.verifyVoiceSent();
    });
  });

  test('@regression @group @chat TC-GRP-006: Copy a text message in group', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('group copy this');
      await chatPage.verifyTextSent('group copy this');
    });
    await test.step('Copy and verify clipboard', async () => {
      const copied = await chatPage.copyMessage();
      expect(copied).toContain('group copy this');
    });
  });

  test('@regression @group @chat @thread TC-GRP-007: Direct reply to a message in group', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('group reply target');
      await chatPage.verifyTextSent('group reply target');
    });
    await test.step('Reply and verify', async () => {
      await chatPage.directReply('group direct reply');
      await chatPage.verifyDirectReply('group direct reply');
    });
  });

  test('@regression @group @details TC-GRP-008: Message info panel and receipt in group', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendTextMessage('group info check');
      await chatPage.verifyTextSent('group info check');
    });
    await test.step('Verify delivery receipt', async () => {
      await chatPage.verifyMessageReceipt();
    });
    await test.step('Open message info', async () => {
      await chatPage.openMessageInfoAndVerify();
    });
    await test.step('Close message info', async () => {
      await chatPage.closeMessageInfo();
    });
  });

  test('@regression @group @search TC-GRP-009: Search for a message in group chat', async () => {
    await test.step('Search for "group edited"', async () => {
      await chatPage.searchInChat('group edited');
    });
    await test.step('Close search', async () => {
      await chatPage.closeChatSearch();
    });
  });

  // ─── Thread Mirror ───

  test('@sanity @group @thread TC-GRP-010: Thread — send text, react, edit, delete, image, emoji, voice', async () => {
    await test.step('Send parent message and open thread', async () => {
      await chatPage.sendTextMessage('group thread parent');
      await chatPage.verifyTextSent('group thread parent');
      await chatPage.openThreadPanel();
    });
    await test.step('Send text in thread', async () => {
      await chatPage.sendTextInThread('group thread text');
      await chatPage.verifyTextInThread('group thread text');
    });
    await test.step('React to message in thread', async () => {
      await chatPage.reactInThread();
      await chatPage.verifyReactionInThread();
    });
    await test.step('Edit message in thread', async () => {
      await chatPage.sendTextInThread('group thread original');
      await chatPage.verifyTextInThread('group thread original');
      await chatPage.editInThread('group thread edited');
      await chatPage.verifyEditedInThread('group thread edited');
    });
    await test.step('Delete message in thread', async () => {
      await chatPage.sendTextInThread('group thread delete me');
      await chatPage.verifyTextInThread('group thread delete me');
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

  test('@sanity @group @calls TC-GRP-011: Initiate voice call and cancel in group', async () => {
    await test.step('Click voice call button', async () => {
      await chatPage.initiateGroupVoiceCall();
    });
    await test.step('Verify ongoing call UI', async () => {
      await chatPage.verifyOngoingCallUI();
    });
    await test.step('End the call', async () => {
      await chatPage.endGroupCall();
    });
    await test.step('Verify call bubble in chat', async () => {
      await chatPage.verifyCallBubble('Voice call');
    });
  });

  test('@sanity @group @calls TC-GRP-012: Initiate video call and cancel in group', async () => {
    await test.step('Click video call button', async () => {
      await chatPage.initiateGroupVideoCall();
    });
    await test.step('Verify ongoing call UI', async () => {
      await chatPage.verifyOngoingCallUI();
    });
    await test.step('End the call', async () => {
      await chatPage.endGroupCall();
    });
    await test.step('Verify call bubble in chat', async () => {
      await chatPage.verifyCallBubble('Video call');
    });
  });

  // ─── Group Admin: Details, Banned Members, Add/Kick, Delete Chat ───

  test('@sanity @group @admin @details TC-GRP-013: Group details — panel, banned members, add/kick member, delete chat', async () => {
    await test.step('Open group details', async () => {
      await chatPage.openGroupDetails();
    });

    await test.step('Verify owner listed with badge', async () => {
      await chatPage.verifyMemberVisible('Andrew Joseph');
      await expect(
        page.locator(TestConfig.selectors.memberOwnerBadge)
      ).toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
    });

    await test.step('Verify admin actions visible', async () => {
      for (const label of ['Add Members', 'Delete Chat', 'Delete and Exit']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible({
          timeout: TestConfig.timeouts.chatOpen,
        });
      }
    });

    await test.step('Verify View Members and Banned Members tabs', async () => {
      for (const tab of ['View Members', 'Banned Members']) {
        await expect(page.getByText(tab, { exact: true })).toBeVisible({
          timeout: TestConfig.timeouts.chatOpen,
        });
      }
    });

    await test.step('Switch to Banned Members — verify empty state', async () => {
      await chatPage.switchToBannedMembersTab();
      await chatPage.verifyBannedMembersEmpty();
    });

    await test.step('Switch back to View Members', async () => {
      await chatPage.switchToViewMembersTab();
    });

    await test.step('Add George Alan to the group', async () => {
      await chatPage.addMemberToGroup('George Alan');
    });

    await test.step('Verify George Alan is in the member list', async () => {
      await chatPage.verifyMemberVisible('George Alan');
    });

    await test.step('Kick George Alan', async () => {
      await chatPage.kickMember('George Alan');
    });

    await test.step('Verify George Alan was removed', async () => {
      await chatPage.verifyMemberNotVisible('George Alan');
    });
  });

  // ─── Destructive ───

  test('@sanity @group @admin TC-GRP-014: Delete and exit the group', async () => {
    await test.step('Open group details (may already be open)', async () => {
      // Details panel may still be open from previous test — check first
      const groupInfo = page.locator(TestConfig.selectors.groupInfoHeader);
      if (!await groupInfo.isVisible({ timeout: 2000 }).catch(() => false)) {
        await chatPage.openGroupDetails();
      }
    });
    await test.step('Click Delete and Exit and confirm', async () => {
      await chatPage.deleteAndExitGroup();
    });
    await test.step('Verify returned to groups list or chats', async () => {
      await expect(async () => {
        const groupsVisible = await page.locator(TestConfig.selectors.groupsList).isVisible().catch(() => false);
        const chatsVisible = await page.locator(TestConfig.selectors.chatsHeading).first().isVisible().catch(() => false);
        expect(groupsVisible || chatsVisible).toBeTruthy();
      }).toPass({ timeout: TestConfig.timeouts.pageLoad });
    });
  });

  // TC-GRP-015 removed — duplicate of TC-USR-017 (Logout and re-login)
});


/**
 * Groups Tab → Private & Password-Protected Groups
 *
 * Sequential flow:
 *   1. Verify type selector defaults to Public, password field hidden
 *   2. Create a Private group → verify chat opens, send message
 *   3. Create a Password group → verify password field, create, send message
 *   4. Delete and exit both groups (cleanup)
 */
test.describe('Groups Tab → Private & Password Groups', () => {
  let context: BrowserContext;
  let page: Page;
  let chatPage: ChatPage;
  let groupsPage: GroupsPage;
  let privateGroupName: string;
  let passwordGroupName: string;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await createContext(browser));
    chatPage = new ChatPage(page);
    await chatPage.setupErrorOverlayAutoDismiss();
    groupsPage = new GroupsPage(page);

    const conversationList = new ConversationListPage(page);
    await conversationList.goto();
    await new LoginPage(page).ensureLoggedIn(TestConfig.login.sampleUserUid);
  });

  test.afterAll(async () => { await chatPage.drainRuntimeErrors(); await context.close(); });

  test('@regression @group @admin TC-GRP-016: Type selector defaults to Public, password field hidden', async () => {
    await test.step('Open create group form', async () => {
      await groupsPage.navigateToGroupsTab();
      await groupsPage.clickCreateGroupButton();
    });
    await test.step('Verify Public is selected by default', async () => {
      await groupsPage.verifySelectedGroupType('Public');
    });
    await test.step('Verify password field is hidden', async () => {
      await groupsPage.verifyPasswordFieldHidden();
    });
    await test.step('Switch to Private — password field still hidden', async () => {
      await groupsPage.selectGroupType('Private');
      await groupsPage.verifyPasswordFieldHidden();
    });
    await test.step('Switch to Password — password field appears', async () => {
      await groupsPage.selectGroupType('Password');
      await groupsPage.verifyPasswordFieldVisible();
    });
    await test.step('Switch back to Public — password field hidden again', async () => {
      await groupsPage.selectGroupType('Public');
      await groupsPage.verifyPasswordFieldHidden();
    });
    await test.step('Close form', async () => {
      await page.locator('div.cometchat-create-group__close-button').click();
      await page.waitForTimeout(500);
    });
  });

  test('@sanity @group @admin TC-GRP-017: Create a Private group and send a message', async () => {
    await test.step('Create Private group', async () => {
      privateGroupName = await groupsPage.createNewGroupAndOpen('Private');
    });
    await test.step('Verify chat opened', async () => {
      await chatPage.waitForChatReady();
    });
    await test.step('Send message', async () => {
      await expect(async () => {
        await chatPage.sendTextMessage('Private group message');
        await chatPage.verifyTextSent('Private group message');
      }).toPass({ timeout: TestConfig.timeouts.messageAppear });
    });
  });

  test('@sanity @group @admin TC-GRP-018: Create a Password-protected group and send a message', async () => {
    await test.step('Create Password group', async () => {
      passwordGroupName = await groupsPage.createNewGroupAndOpen('Password', 'test123');
    });
    await test.step('Verify chat opened', async () => {
      await chatPage.waitForChatReady();
    });
    await test.step('Send message', async () => {
      await expect(async () => {
        await chatPage.sendTextMessage('Password group message');
        await chatPage.verifyTextSent('Password group message');
      }).toPass({ timeout: TestConfig.timeouts.messageAppear });
    });
  });

  test('@regression @group @admin TC-GRP-019: Delete and exit Private group', async () => {
    await test.step('Navigate to Groups and open Private group', async () => {
      await groupsPage.navigateToGroupsTab();
      // Find group by prefix if variable is undefined (retry scenario)
      if (!privateGroupName) {
        const allTitles = await page.locator('div.cometchat-groups div.cometchat-list-item__body-title').allTextContents();
        privateGroupName = allTitles.find(t => t.startsWith('PrivateGroup-')) || '';
      }
      if (!privateGroupName) return; // skip if no private group exists
      const groupItem = page.locator(TestConfig.selectors.groupsListItem(privateGroupName));
      await expect(groupItem).toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
      await groupItem.click();
      await chatPage.waitForChatReady();
    });
    await test.step('Open details and delete', async () => {
      if (!privateGroupName) return;
      await chatPage.openGroupDetails();
      await chatPage.deleteAndExitGroup();
    });
  });

  test('@regression @group @admin TC-GRP-020: Delete and exit Password group', async () => {
    await test.step('Navigate to Groups and open Password group', async () => {
      await groupsPage.navigateToGroupsTab();
      // Find group by prefix if variable is undefined (retry scenario)
      if (!passwordGroupName) {
        const allTitles = await page.locator('div.cometchat-groups div.cometchat-list-item__body-title').allTextContents();
        passwordGroupName = allTitles.find(t => t.startsWith('PwdGroup-')) || '';
      }
      if (!passwordGroupName) return; // skip if no password group exists
      const groupItem = page.locator(TestConfig.selectors.groupsListItem(passwordGroupName));
      await expect(groupItem).toBeVisible({ timeout: TestConfig.timeouts.chatOpen });
      await groupItem.click();
      await chatPage.waitForChatReady();
    });
    await test.step('Open details and delete', async () => {
      if (!passwordGroupName) return;
      await chatPage.openGroupDetails();
      await chatPage.deleteAndExitGroup();
    });
  });
});
