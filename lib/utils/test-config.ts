import { TIMEOUTS, SEL } from './constants';
import { testDataPath, USERS } from './helpers';

/**
 * Central configuration for test execution.
 * Timeouts and selectors are imported from constants.ts (single source of truth).
 * This file adds app-level config: baseURL, login, chat targets, test data paths.
 */
export const TestConfig = {
  /** Base URL of the chat application */
  baseURL: process.env.BASE_URL || 'http://localhost:3000',

  /** Login — which sample user UID to sign in as */
  login: {
    sampleUserUid: USERS.primary,
  },

  /** Chat targets — add more as needed */
  chatTargets: {
    user: USERS.chatTarget,
  },

  /** Paths to test media files (resolved from test-data/) */
  testData: {
    image: testDataPath('sample-image.jpg'),
    video: testDataPath('sample-video.mp4'),
    audio: testDataPath('sample-audio.mp3'),
    pdf: testDataPath('sample-file.pdf'),
  },

  /** Centralized timeouts — delegates to constants.ts */
  timeouts: TIMEOUTS,

  /** CometChat DOM selectors — delegates to constants.ts flat selectors for backward compat */
  selectors: {
    // Login
    loginHeading: SEL.loginHeading,
    loginButton: SEL.loginButton,

    // Conversation list
    conversationItem: (name: string) => SEL.conv.item(name),
    conversationSearchInput: SEL.conv.search,
    chatsHeading: SEL.chatsHeading,

    // Composer
    attachButton: SEL.composer.attach,
    attachPopover: SEL.attach.menu,
    attachOption: {
      image: SEL.attach.image,
      video: SEL.attach.video,
      audio: SEL.attach.audio,
      file: SEL.attach.file,
    },
    composerInput: SEL.composer.input,
    sendButton: SEL.composer.send,

    // Bubbles
    sentMessageBubble: SEL.bubble.outgoing,
    incomingMessageBubble: SEL.bubble.incoming,
    audioBubble: SEL.bubble.audio,

    // Error overlay
    errorOverlayDismiss: SEL.errorOverlayDismiss,

    // Bottom nav
    bottomNav: {
      chats: SEL.tab.chats,
      users: SEL.tab.users,
      groups: SEL.tab.groups,
    },

    // Users
    usersSearchInput: SEL.users.search,
    usersListItem: (name: string) => SEL.users.item(name),

    // Groups
    groupsList: SEL.groups.list,
    groupsCreateButton: SEL.groups.createBtn,
    createGroupModal: SEL.groups.form,
    createGroupNameInput: SEL.groups.nameInput,
    createGroupPasswordInput: SEL.groups.pwdInput,
    createGroupSubmitButton: SEL.groups.submitBtn,
    createGroupType: (type: string) => SEL.groups.typeBtn(type),
    createGroupTypeSelected: SEL.groups.typeSelected,
    groupsSearchInput: SEL.groups.search,
    groupsListItem: (name: string) => SEL.groups.item(name),
    groupInfoHeader: SEL.groups.infoHeader,
    groupAddMembersAction: SEL.groups.addMembers,
    groupDeleteAndExitAction: SEL.groups.deleteAndExit,
    addMembersHeader: 'div.cometchat-list__header-title:has-text("Users")',
    addMembersListItem: (name: string) => `text="${name}"`,
    addMembersSubmitButton: SEL.groups.addSubmit,
    memberMenuView: 'div.cometchat-list-item__menu-view',
    memberSubMenuIcon: 'div.cometchat-list-item__menu-view div.cometchat-menu-list__sub-menu-icon',
    memberActionKick: SEL.groups.kickAction,
    memberOwnerBadge: SEL.groups.ownerBadge,
    confirmDialogDeleteExitButton: SEL.confirm.exitBtn,
    groupMemberItem: (name: string) => `text="${name}"`,

    // Voice recording
    voiceRecordButton: SEL.composer.voiceRecord,
    recordingBar: SEL.recording.bar,
    recordingBarDelete: SEL.recording.delete,
    recordingBarPause: SEL.recording.pause,
    recordingBarTimer: SEL.recording.timer,
    recordingBarWaveform: SEL.recording.waveform,
    recordingRow: 'div.cometchat-compact-message-composer__row--recording',
    mediaRecorder: 'div.cometchat-media-recorder, div.cometchat-compact-message-composer__recording-bar',
    mediaRecorderPause: 'div.cometchat-media-recorder__recording-control-pause, button.cometchat-compact-message-composer__recording-bar-pause',
    mediaRecorderStop: 'div.cometchat-media-recorder__recording-control-stop',
    mediaRecorderSend: 'div.cometchat-media-recorder__recorded-control-send',
    mediaRecorderResume: 'div.cometchat-media-recorder__recording-control-record',
    mediaRecorderPreviewPlay: 'div.cometchat-media-recorder__recorded div.cometchat-audio-bubble__leading-view-play',

    // Emoji
    emojiButton: SEL.composer.emoji,
    emojiKeyboard: SEL.emojiKb.keyboard,
    emojiSearchInput: SEL.emojiKb.search,
    emojiItem: (title: string) => SEL.emojiKb.item(title),
    emojiFirstItem: SEL.emojiKb.first,

    // Sticker
    stickerButton: SEL.composer.sticker,
    stickerKeyboard: SEL.stickerKb.keyboard,
    stickerTabs: SEL.stickerKb.tabs,
    stickerTabActive: SEL.stickerKb.tabActive,
    stickerTab: SEL.stickerKb.tab,
    stickerListItem: SEL.stickerKb.item,
    stickerShimmer: SEL.stickerKb.shimmer,

    // Message actions
    messageActionReply: SEL.action.reply,
    messageActionSubMenu: SEL.action.subMenu,
    reactionItem: SEL.bubble.reactions,
    markUnreadMenuItem: SEL.action.markUnread,
    reportMenuItem: SEL.action.report,

    // Thread
    threadPanel: SEL.thread.panel,
    threadComposerInput: SEL.thread.input,
    threadSendButton: SEL.thread.send,
    threadCloseButton: SEL.thread.close,
    threadSentBubble: SEL.thread.outgoing,
    threadAttachButton: SEL.thread.attach,
    threadEmojiButton: SEL.thread.emoji,
    threadVoiceRecordButton: SEL.thread.voiceRecord,

    // Message header
    messageHeaderListItem: SEL.header.listItem,
    messageHeaderSubtitle: SEL.header.subtitle,
    messageHeaderName: SEL.header.title,

    // User details
    userDetailsPanel: SEL.users.details,
    userDetailsCloseButton: SEL.users.detailsClose,
    userDetailsStatus: SEL.users.detailsStatus,
    deleteChatAction: SEL.users.deleteChat,
    confirmDialogDeleteButton: SEL.confirm.deleteBtn,

    // Chat search
    chatSearchButton: SEL.chatSearch.button,
    chatSearchInput: SEL.chatSearch.input,

    // Message info
    messageInfoPanel: SEL.msgInfo.panel,
    messageInfoCloseButton: SEL.msgInfo.close,

    // Calls
    voiceCallButton: SEL.header.voiceCall,
    videoCallButton: SEL.header.videoCall,
    outgoingCallOverlay: SEL.outgoingCall.overlay,
    outgoingCallTitle: SEL.outgoingCall.title,
    outgoingCallSubtitle: SEL.outgoingCall.subtitle,
    outgoingCallCancelButton: SEL.outgoingCall.cancel,
    ongoingCallOverlay: SEL.ongoingCall.overlay,
    ongoingCallEndButton: SEL.ongoingCall.end,

    // Calls tab
    callsTab: SEL.tab.calls,
    callLogsList: SEL.calls.list,
    callLogsHeaderTitle: SEL.calls.header,
    callLogItem: SEL.calls.item,
    callLogItemName: SEL.calls.itemName,
    callLogItemSubtitle: SEL.calls.itemDate,
    callLogDirectionIcon: SEL.calls.directionIcon,
    callLogTrailingIcon: SEL.calls.trailingIcon,
    callDetailsPanel: SEL.calls.details,
    callDetailsHeader: SEL.calls.detailsHeader,
    callDetailsName: SEL.calls.detailsName,
    callDetailsSubtitle: SEL.calls.detailsSubtitle,
    callLogInfo: SEL.calls.infoRow,
    callLogInfoTitle: SEL.calls.infoTitle,
    callLogInfoDuration: SEL.calls.infoDuration,
    callDetailsVoiceCallButton: SEL.calls.voiceBtn,
    callDetailsVideoCallButton: SEL.calls.videoBtn,
    callDetailsTabs: 'div.cometchat-call-log-details__tabs',
    callDetailsTabItem: (name: string) => SEL.calls.tabItem(name),
    callDetailsActiveTab: SEL.calls.tabActive,
    callLogParticipants: SEL.calls.participants,
    callLogParticipantName: SEL.calls.participantName,
    callLogRecordings: SEL.calls.recordings,
    callLogRecordingsEmptyText: SEL.calls.recordingsEmpty,
    callLogHistory: SEL.calls.history,
    callLogHistoryItem: SEL.calls.historyItem,
    callLogHistoryTitle: SEL.calls.historyTitle,

    // Formatting toolbar
    compactComposer: SEL.composer.wrapper,
    compactComposerInput: 'div.cometchat-compact-message-composer__input[contenteditable]',
    formattingToolbar: SEL.fmt.toolbar,
    formattingButton: (title: string) => SEL.fmt.button(title),
    boldButton: SEL.fmt.bold,
    italicButton: SEL.fmt.italic,
    underlineButton: SEL.fmt.underline,
    strikethroughButton: SEL.fmt.strikethrough,
    linkButton: SEL.fmt.link,
    numberedListButton: SEL.fmt.numberedList,
    bulletedListButton: SEL.fmt.bulletedList,
    blockquoteButton: SEL.fmt.blockquote,
    codeButton: SEL.fmt.code,
    codeBlockButton: SEL.fmt.codeBlock,

    // Conversation sub-menu
    conversationsSubMenuIcon: SEL.conv.subMenuIcon,
    conversationsSubMenuList: SEL.conv.subMenuList,
    conversationsSubMenuItem: (title: string) => SEL.conv.subMenuItem(title),
    createConversationItem: SEL.conv.createConvItem,

    // New chat panel
    newChatPanel: SEL.newChat.panel,
    newChatHeaderTitle: SEL.newChat.title,
    newChatBackButton: SEL.newChat.back,
    newChatUsersTab: SEL.newChat.usersTab,
    newChatGroupsTab: SEL.newChat.groupsTab,
    newChatActiveTab: SEL.newChat.activeTab,
    newChatSearchInput: SEL.newChat.search,
    newChatUserItem: (name: string) => SEL.newChat.userItem(name),
    newChatGroupItem: (name: string) => SEL.newChat.groupItem(name),

    // Misc selectors kept for backward compat
    groupsListItemPassword: 'div.cometchat-groups__list-item-password',
    usersListItemOffline: 'div.cometchat-users__list-item-offline',
    usersListItemOnline: 'div.cometchat-users__list-item-online',
    conversationsListItemOffline: 'div.cometchat-conversations__list-item-offline',
    callLogInfoSubtitle: 'div.cometchat-call-log-details div.cometchat-call-log-info__subtitle',
    callLogRecordingsEmptyState: 'div.cometchat-call-log-recordings__empty-state',
    callLogParticipantDuration: 'div.cometchat-call-log-participants [class*="trailing-view"]',
    callLogHistorySubtitle: 'div.cometchat-call-log-history__subtitle',
    callLogHistoryDuration: 'div.cometchat-call-log-history [class*="trailing-view"]',
    stickerList: 'div.cometchat-sticker-keyboard__list',
  },
} as const;
