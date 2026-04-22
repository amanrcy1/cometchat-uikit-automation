/**
 * Centralized selectors, timeouts, and static config.
 * Single source of truth — update here when CometChat UI changes.
 *
 * SELECTOR RESILIENCE STRATEGY:
 * Every selector uses a `data-testid` as the PRIMARY locator, with the
 * original CSS-class selector as an automatic FALLBACK. This means:
 *
 *   1. If CometChat UIKit adds `data-testid` attributes → selectors match immediately.
 *   2. If `data-testid` is not yet present → the CSS-class fallback kicks in.
 *   3. When UIKit refactors class names → only the fallback string here needs updating.
 *
 * To migrate fully: add `data-testid` attributes to the UIKit source, then
 * remove the fallback CSS selectors from this file.
 *
 * Helper:
 *   sel('send-btn', 'button.cometchat-button[title="Send"]')
 *     → '[data-testid="send-btn"], button.cometchat-button[title="Send"]'
 *
 * Playwright evaluates the comma-separated selector and matches the FIRST
 * element found by either branch, so this is safe for .click(), .isVisible(), etc.
 */

// ── Selector helper ──

/**
 * Returns true if the fallback uses a Playwright-specific engine selector
 * (text=, role=, >>) that cannot be combined with CSS via comma.
 */
function isEngineSelector(s: string): boolean {
  return /^text=|^role=|>>/.test(s);
}

/**
 * Build a resilient selector: prefer `data-testid`, fall back to CSS class.
 *
 * For pure CSS fallbacks the result is a comma-separated selector list:
 *   `[data-testid="id"], div.class`  — Playwright tries both, first match wins.
 *
 * For Playwright engine selectors (text=, >>) that can't be mixed with CSS
 * via comma, we return the fallback as-is. The data-testid will activate
 * automatically once the UIKit adds the attribute — at that point swap the
 * fallback string here to the pure CSS form.
 *
 * @param testId   - The data-testid value (without brackets/quotes).
 * @param fallback - The legacy CSS / text / engine selector used today.
 */
export function sel(testId: string, fallback: string): string {
  if (isEngineSelector(fallback)) {
    return fallback;
  }
  return `[data-testid="${testId}"], ${fallback}`;
}

/**
 * Build a resilient selector that also scopes by visible text.
 * Useful for tabs, list items, and buttons identified by label.
 *
 * @param testId   - The data-testid value.
 * @param fallback - The legacy CSS / text selector.
 * @param _text    - (documentation only) the text this selector targets.
 */
function selText(testId: string, fallback: string, _text?: string): string {
  return sel(testId, fallback);
}

// ── Timeouts (ms) ──
export const TIMEOUTS = {
  pageLoad: 20_000,
  login: 20_000,
  chatOpen: 15_000,
  attachMenu: 5_000,
  fileUpload: 10_000,
  videoUpload: 30_000,
  messageAppear: 20_000,
  videoMessageAppear: 30_000,
  errorOverlay: 2_000,
} as const;

// ── CometChat DOM Selectors ──
export const SEL = {
  // Login
  loginHeading: sel('login-heading', 'text=Sign in to cometchat'),
  loginButton: sel('login-button', 'button:has-text("Login")'),
  uidInput: sel('uid-input', 'input[placeholder="Enter your UID"]'),

  // Bottom nav tabs
  tab: {
    chats: selText('tab-chats', 'div.cometchat-tab-component__tab-text:has-text("Chats")', 'Chats'),
    calls: selText('tab-calls', 'div.cometchat-tab-component__tab-text:has-text("Calls")', 'Calls'),
    users: selText('tab-users', 'div.cometchat-tab-component__tab-text:has-text("Users")', 'Users'),
    groups: selText('tab-groups', 'div.cometchat-tab-component__tab-text:has-text("Groups")', 'Groups'),
    all: sel('tab-item', 'div.cometchat-tab-component__tab'),
    activeText: sel('tab-text-active', 'div.cometchat-tab-component__tab-text-active'),
    activeIcon: sel('tab-icon-active', 'div.cometchat-tab-component__tab-icon-active'),
  },

  // Chats heading
  chatsHeading: sel('chats-heading', 'text=Chats'),

  // Conversation list
  conv: {
    list: sel('conversations-list', 'div.cometchat-conversations'),
    item: (name: string) => `div.cometchat-conversations >> text="${name}"`,
    listItem: sel('conversation-list-item', 'div.cometchat-conversations div.cometchat-list-item'),
    search: sel('conversations-search', 'div.cometchat-conversations input.cometchat-search-bar__input[placeholder="Search"]'),
    subtitleText: sel('conversations-subtitle-text', 'div.cometchat-conversations__subtitle-text'),
    date: sel('conversations-date', 'div.cometchat-conversations .cometchat-date'),
    receipts: sel('conversations-receipts', 'div.cometchat-conversations [class*="cometchat-receipts"]'),
    subMenuIcon: sel('conversations-submenu-icon', 'div.cometchat-conversations div.cometchat-menu-list__sub-menu-icon'),
    subMenuList: sel('conversations-submenu-list', 'div.cometchat-conversations div.cometchat-menu-list__sub-menu-list'),
    subMenuItem: (title: string) => `[data-testid="conversations-submenu-item-${title}"], div.cometchat-conversations div.cometchat-menu-list__sub-menu-list-item[title="${title}"]`,
    loggedInUser: sel('logged-in-user', 'label.cometchat-menu-list__sub-menu-item-title-logged-in-user'),
    createConvItem: sel('create-conversation', 'div.cometchat-menu-list__sub-menu-list-item[title="Create conversation"]'),
    logOutItem: sel('logout', 'label.cometchat-menu-list__sub-menu-item-title-log-out'),
    deleteIcon: sel('conversation-delete-icon', 'div.cometchat-conversations div.cometchat-list-item__menu-view div.cometchat-menu-list__main-menu-item-icon-delete'),
  },

  // New Chat panel
  newChat: {
    panel: sel('new-chat-panel', 'div.cometchat-new-chat-view'),
    title: sel('new-chat-title', 'div.cometchat-new-chat-view__header-title'),
    back: sel('new-chat-back', 'div.cometchat-new-chat-view__header button.cometchat-button'),
    usersTab: selText('new-chat-users-tab', 'div.cometchat-new-chat-view__tabs-tab:has-text("Users")', 'Users'),
    groupsTab: selText('new-chat-groups-tab', 'div.cometchat-new-chat-view__tabs-tab:has-text("Groups")', 'Groups'),
    activeTab: sel('new-chat-active-tab', 'div.cometchat-new-chat-view__tabs-tab-active'),
    search: sel('new-chat-search', 'div.cometchat-new-chat-view input.cometchat-search-bar__input'),
    userItem: (name: string) => `[data-testid="new-chat-user-${name}"], div.cometchat-new-chat-view div.cometchat-list-item__body-title:has-text("${name}")`,
    groupItem: (name: string) => `[data-testid="new-chat-group-${name}"], div.cometchat-new-chat-view div.cometchat-list-item__body-title:text-is("${name}")`,
  },

  // Message header
  header: {
    wrapper: sel('message-header', 'div.cometchat-message-header'),
    listItem: sel('message-header-listitem', 'div.cometchat-message-header__listitem'),
    title: sel('message-header-title', 'div.cometchat-message-header .cometchat-list-item__body-title'),
    subtitle: sel('message-header-subtitle', 'div.cometchat-message-header__subtitle'),
    avatar: sel('message-header-avatar', 'div.cometchat-message-header .cometchat-avatar'),
    voiceCall: sel('voice-call-btn', 'button.cometchat-button[title="Voice call"]'),
    videoCall: sel('video-call-btn', 'button.cometchat-button[title="Video call"]'),
    search: sel('header-search-btn', 'button.cometchat-button[title="Search"]'),
  },

  // Composer
  composer: {
    wrapper: sel('message-composer', 'div.cometchat-compact-message-composer'),
    input: sel('composer-input', '.cometchat-compact-message-composer__input[contenteditable], [placeholder="Enter your message here"][contenteditable], [data-placeholder="Enter your message here"][contenteditable]'),
    send: sel('send-message-btn', 'button.cometchat-button[title="Send Message"]'),
    attach: sel('attach-btn', 'button.cometchat-button[title="Attach"]'),
    emoji: sel('emoji-btn', 'button.cometchat-button[title="Emoji"]'),
    sticker: sel('sticker-btn', 'button.cometchat-button[title="Sticker"]'),
    voiceRecord: sel('voice-record-btn', 'button.cometchat-button[title="Voice Recording"]'),
  },

  // Attach menu
  attach: {
    menu: sel('attach-menu', 'div.cometchat-action-sheet'),
    image: selText('attach-image', 'div.cometchat-action-sheet__item-body:text-is("Attach Image")', 'Attach Image'),
    video: selText('attach-video', 'div.cometchat-action-sheet__item-body:text-is("Attach Video")', 'Attach Video'),
    audio: selText('attach-audio', 'div.cometchat-action-sheet__item-body:text-is("Attach Audio")', 'Attach Audio'),
    file: selText('attach-file', 'div.cometchat-action-sheet__item-body:text-is("Attach File")', 'Attach File'),
  },

  // Message bubbles
  bubble: {
    outgoing: sel('bubble-outgoing', 'div.cometchat-message-bubble-outgoing'),
    incoming: sel('bubble-incoming', 'div.cometchat-message-bubble-incoming'),
    all: sel('bubble', 'div.cometchat-message-bubble'),
    text: sel('bubble-text', 'div.cometchat-text-bubble__body-text'),
    audio: sel('bubble-audio', 'div.cometchat-audio-bubble'),
    deleted: sel('bubble-deleted', '[class*="cometchat-text-bubble__body-text"]:has-text("This message was deleted")'),
    receipts: sel('bubble-receipts', '[class*="cometchat-receipts"]'),
    reactions: sel('bubble-reactions', 'div.cometchat-reactions'),
    dateHeader: sel('bubble-date-header', 'div.cometchat-message-list__bubble-date-header'),
  },

  // Message actions
  action: {
    subMenu: sel('action-submenu', 'div.cometchat-menu-list__sub-menu-icon'),
    react: sel('action-react', 'div.cometchat-menu-list__main-menu-item-icon-react'),
    reply: sel('action-reply', 'div.cometchat-menu-list__main-menu-item-icon-reply'),
    thread: sel('action-thread', 'div.cometchat-menu-list__main-menu-item-icon-replyInThread'),
    copy: sel('action-copy', 'div.cometchat-menu-list__sub-menu-list-item-icon-copy'),
    edit: sel('action-edit', 'div.cometchat-menu-list__sub-menu-list-item-icon-edit'),
    delete: sel('action-delete', 'div.cometchat-menu-list__sub-menu-list-item-icon-delete'),
    info: sel('action-info', 'div.cometchat-menu-list__sub-menu-list-item-icon-messageInformation'),
    translate: sel('action-translate', 'div.cometchat-menu-list__sub-menu-list-item-icon-translate'),
    markUnread: sel('action-mark-unread', 'div.cometchat-menu-list__sub-menu-list-item[title="Mark Unread"]'),
    report: sel('action-report', 'div.cometchat-menu-list__sub-menu-list-item[title="Report"]'),
  },

  // Message info panel
  msgInfo: {
    panel: sel('message-info-panel', 'div.cometchat-message-information'),
    close: sel('message-info-close', 'div.cometchat-message-information button.cometchat-button'),
  },

  // Thread panel
  thread: {
    panel: sel('thread-panel', 'div.cometchat-threaded-message'),
    close: sel('thread-close', 'div.cometchat-thread-header__top-bar-close'),
    input: sel('thread-input', 'div.cometchat-threaded-message .cometchat-compact-message-composer__input[contenteditable], div.cometchat-message-composer__input-thread'),
    send: sel('thread-send-btn', 'div.cometchat-threaded-message button.cometchat-button[title="Send Message"]'),
    outgoing: sel('thread-bubble-outgoing', 'div.cometchat-threaded-message div.cometchat-message-bubble-outgoing'),
    attach: sel('thread-attach-btn', 'div.cometchat-threaded-message button.cometchat-button[title="Attach"]'),
    emoji: sel('thread-emoji-btn', 'div.cometchat-threaded-message button.cometchat-button[title="Emoji"]'),
    voiceRecord: sel('thread-voice-record-btn', 'div.cometchat-threaded-message button.cometchat-button[title="Voice Recording"]'),
  },

  // Chat search
  chatSearch: {
    button: sel('chat-search-btn', 'button.cometchat-button[title="Search"]'),
    input: sel('chat-search-input', 'input.cometchat-search-bar__input'),
  },

  // Message list
  msgList: sel('message-list', 'div.cometchat-message-list'),

  // Emoji keyboard
  emojiKb: {
    keyboard: sel('emoji-keyboard', 'div.cometchat-emoji-keyboard'),
    search: sel('emoji-search', 'input.cometchat-search-bar__input[placeholder="Search emoji"]'),
    item: (title: string) => `[data-testid="emoji-item-${title}"], div.cometchat-emoji-keyboard__list-item[title="${title}"]`,
    first: sel('emoji-first-item', 'div.cometchat-emoji-keyboard__list-item'),
  },

  // Sticker keyboard
  stickerKb: {
    keyboard: sel('sticker-keyboard', 'div.cometchat-sticker-keyboard'),
    tabs: sel('sticker-tabs', 'div.cometchat-sticker-keyboard__tabs'),
    tab: sel('sticker-tab', 'div.cometchat-sticker-keyboard__tab'),
    tabActive: sel('sticker-tab-active', 'div.cometchat-sticker-keyboard__tab-active'),
    item: sel('sticker-item', 'img.cometchat-sticker-keyboard__list-item'),
    shimmer: sel('sticker-shimmer', 'div.cometchat-sticker-keyboard__shimmer-list'),
  },

  // Voice recording
  recording: {
    bar: sel('recording-bar', 'div.cometchat-compact-message-composer__recording-bar'),
    delete: sel('recording-delete', 'button.cometchat-compact-message-composer__recording-bar-delete'),
    pause: sel('recording-pause', 'button.cometchat-compact-message-composer__recording-bar-pause'),
    timer: sel('recording-timer', 'div.cometchat-compact-message-composer__recording-bar-timer'),
    waveform: sel('recording-waveform', 'div.cometchat-compact-message-composer__recording-bar-waveform'),
  },

  // Formatting toolbar
  fmt: {
    toolbar: sel('formatting-toolbar', 'div.cometchat-formatting-toolbar'),
    button: (title: string) => `[data-testid="fmt-btn-${title.toLowerCase().replace(/\s+/g, '-')}"], div.cometchat-formatting-toolbar button.cometchat-button[title="${title}"]`,
    bold: sel('fmt-btn-bold', 'button.cometchat-button[title="Bold"]'),
    italic: sel('fmt-btn-italic', 'button.cometchat-button[title="Italic"]'),
    underline: sel('fmt-btn-underline', 'button.cometchat-button[title="Underline"]'),
    strikethrough: sel('fmt-btn-strikethrough', 'button.cometchat-button[title="Strikethrough"]'),
    link: sel('fmt-btn-link', 'button.cometchat-button[title="Link"]'),
    numberedList: sel('fmt-btn-numbered-list', 'button.cometchat-button[title="Numbered List"]'),
    bulletedList: sel('fmt-btn-bulleted-list', 'button.cometchat-button[title="Bulleted List"]'),
    blockquote: sel('fmt-btn-blockquote', 'button.cometchat-button[title="Blockquote"]'),
    code: sel('fmt-btn-code', 'button.cometchat-button[title="Code"]'),
    codeBlock: sel('fmt-btn-code-block', 'button.cometchat-button[title="Code Block"]'),
  },

  // Users tab
  users: {
    list: sel('users-list', 'div.cometchat-users'),
    search: sel('users-search', 'input.cometchat-search-bar__input[placeholder="Search"]'),
    item: (name: string) => `div.cometchat-users >> div.cometchat-list-item__body-title:has-text("${name}")`,
    sectionHeader: sel('users-section-header', 'div.cometchat-list__section-header'),
    details: sel('user-details-header', 'div.cometchat-user-details__header'),
    detailsClose: sel('user-details-close', 'div.cometchat-user-details__header-icon'),
    detailsStatus: sel('user-details-status', 'div.cometchat-user-details__content-description'),
    blockBtn: sel('user-block-btn', 'text=Block'),
    unblockBtn: sel('user-unblock-btn', 'text=Unblock'),
    deleteChat: sel('user-delete-chat', 'div[class*="cometchat-user-details__content-action-item"]:has-text("Delete")'),
  },

  // Groups tab
  groups: {
    list: sel('groups-list', 'div.cometchat-groups'),
    search: sel('groups-search', 'div.cometchat-groups input.cometchat-search-bar__input[placeholder="Search"]'),
    item: (name: string) => `div.cometchat-groups >> div.cometchat-list-item__body-title:has-text("${name}")`,
    createBtn: sel('groups-create-btn', 'div.cometchat-groups button.cometchat-button'),
    form: sel('create-group-form', 'form.cometchat-create-group'),
    nameInput: sel('create-group-name', 'input.cometchat-create-group__input[placeholder="Enter the group name"]'),
    pwdInput: sel('create-group-password', 'input.cometchat-create-group__input[placeholder="Enter a password"]'),
    submitBtn: sel('create-group-submit', 'button.cometchat-create-group__submit-button'),
    typeBtn: (type: string) => `[data-testid="create-group-type-${type.toLowerCase()}"], div.cometchat-create-group__type-content div.cometchat-create-group__type:has-text("${type}")`,
    typeSelected: sel('create-group-type-selected', 'div.cometchat-create-group__type-selected'),
    subtitle: sel('groups-subtitle', 'div.cometchat-groups__subtitle'),
    infoHeader: sel('group-info-header', 'div.side-component-header__text:text-is("Group Info")'),
    addMembers: sel('group-add-members', 'text=Add Members'),
    deleteAndExit: sel('group-delete-exit', 'text=Delete and Exit'),
    deleteChat: sel('group-delete-chat', 'text=Delete Chat'),
    ownerBadge: sel('group-owner-badge', 'div.cometchat-group-members__trailing-view-options-owner'),
    kickAction: sel('group-kick-action', 'div.cometchat-menu-list__sub-menu-list-item:has-text("Kick")'),
    memberMenu: sel('group-member-menu', 'div.cometchat-list-item__menu-view div.cometchat-menu-list__sub-menu-icon'),
    bannedTab: sel('group-banned-tab', 'text=Banned Members'),
    viewTab: sel('group-view-tab', 'text=View Members'),
    addSubmit: sel('group-add-submit', 'button:has-text("Add Member")'),
  },

  // Calls tab
  calls: {
    list: sel('call-logs-list', 'div.cometchat-call-logs'),
    header: sel('call-logs-header', 'div.cometchat-call-logs div.cometchat-list__header-title'),
    item: sel('call-log-item', 'div.cometchat-call-logs__list-item'),
    itemName: sel('call-log-item-name', 'div.cometchat-call-logs__list-item .cometchat-list-item__body-title'),
    itemDate: sel('call-log-item-date', 'div.cometchat-call-logs__list-item .cometchat-date'),
    directionIcon: sel('call-log-direction-icon', 'div.cometchat-call-logs__list-item-subtitle-icon'),
    trailingIcon: sel('call-log-trailing-icon', 'div.cometchat-call-logs__list-item-trailing-view'),
    details: sel('call-details', 'div.cometchat-call-log-details'),
    detailsHeader: sel('call-details-header', 'div.cometchat-call-log-details__header'),
    detailsName: sel('call-details-name', 'div.cometchat-call-log-details div.cometchat-call-log-details__call-log-item .cometchat-list-item__body-title'),
    detailsSubtitle: sel('call-details-subtitle', 'div.cometchat-call-log-details div.cometchat-call-log-details__subtitle'),
    infoRow: sel('call-info-row', 'div.cometchat-call-log-details div.cometchat-call-log-info'),
    infoTitle: sel('call-info-title', 'div.cometchat-call-log-details div.cometchat-call-log-info .cometchat-list-item__body-title'),
    infoDuration: sel('call-info-duration', 'div.cometchat-call-log-details div.cometchat-call-log-info .cometchat-call-log-info__trailing-view-disabled'),
    voiceBtn: sel('call-details-voice-btn', 'div.cometchat-call-log-details button.cometchat-button[title="Voice call"]'),
    videoBtn: sel('call-details-video-btn', 'div.cometchat-call-log-details button.cometchat-button[title="Video call"]'),
    tabItem: (name: string) => `[data-testid="call-details-tab-${name.toLowerCase().replace(/\s+/g, '-')}"], div.cometchat-call-log-details__tabs [class*="cometchat-call-log-details__tabs-tab-item"]:has-text("${name}")`,
    tabActive: sel('call-details-tab-active', 'div.cometchat-call-log-details__tabs-tab-item-active'),
    participants: sel('call-participants', 'div.cometchat-call-log-participants'),
    participantName: sel('call-participant-name', 'div.cometchat-call-log-participants .cometchat-list-item__body-title'),
    recordings: sel('call-recordings', 'div.cometchat-call-log-recordings'),
    recordingsEmpty: sel('call-recordings-empty', 'div.cometchat-call-log-recordings__empty-state-text'),
    history: sel('call-history', 'div.cometchat-call-log-history'),
    historyItem: sel('call-history-item', 'div.cometchat-call-log-history .cometchat-list-item'),
    historyTitle: sel('call-history-title', 'div.cometchat-call-log-history .cometchat-list-item__body-title'),
  },

  // Outgoing / Ongoing call overlays
  outgoingCall: {
    overlay: sel('outgoing-call-overlay', 'div.cometchat-outgoing-call'),
    title: sel('outgoing-call-title', 'div.cometchat-outgoing-call__title'),
    subtitle: sel('outgoing-call-subtitle', 'div.cometchat-outgoing-call__subtitle'),
    cancel: sel('outgoing-call-cancel', 'div.cometchat-outgoing-call__button'),
  },
  ongoingCall: {
    overlay: sel('ongoing-call-overlay', 'div.cometchat-ongoing-call'),
    end: sel('ongoing-call-end', 'span[title="End call"]'),
  },

  // Confirm dialog
  confirm: {
    dialog: sel('confirm-dialog', 'div.cometchat-confirm-dialog'),
    deleteBtn: sel('confirm-delete-btn', 'div.cometchat-confirm-dialog button:has-text("Delete")'),
    exitBtn: sel('confirm-exit-btn', 'div.cometchat-confirm-dialog__button-group-submit'),
  },

  // Error overlay
  errorOverlayDismiss: sel('error-overlay-dismiss', 'button:has-text("×")'),
} as const;
