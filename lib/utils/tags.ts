/**
 * Test Tag Definitions — Enterprise Tagging Strategy
 *
 * Tags are embedded in test titles using @tag syntax.
 * Playwright's --grep flag filters by regex match on test title.
 *
 * ── Tag Categories ──
 *
 * Priority:
 *   @smoke       Critical path — must pass before any deploy (login, send msg, open chat)
 *   @sanity      Core features — quick validation after build (CRUD, media, calls)
 *   @regression  Full coverage — nightly run (all tests)
 *
 * Feature:
 *   @chat        1:1 chat messaging
 *   @group       Group chat features
 *   @calls       Voice/video calls
 *   @composer    Rich text composer & formatting
 *   @media       File uploads, emoji, stickers, voice recording
 *   @thread      Threaded messages
 *   @search      Search functionality
 *   @auth        Login, logout, session
 *   @admin       Group admin (add/kick members, delete group)
 *   @details     User/group details panel
 *
 * Type:
 *   @visual      CSS, layout, typography validation
 *   @a11y        Accessibility (ARIA, keyboard nav, screen reader)
 *   @api         REST API tests
 *   @integration End-to-end flow tests
 *   @negative    Negative/edge case tests
 *   @network     Network request validation
 *
 * ── Usage ──
 *
 *   npx playwright test --grep @smoke              # Run smoke suite
 *   npx playwright test --grep @sanity             # Run sanity suite
 *   npx playwright test --grep @chat               # Run chat feature tests
 *   npx playwright test --grep "@smoke|@sanity"    # Run smoke + sanity
 *   npx playwright test --grep @media              # Run media tests
 *   npx playwright test --grep-invert @visual      # Skip visual tests
 *   npx playwright test --grep "@chat.*@media"     # Chat + media intersection
 */

export const TAGS = {
  // Priority
  SMOKE: '@smoke',
  SANITY: '@sanity',
  REGRESSION: '@regression',

  // Feature
  CHAT: '@chat',
  GROUP: '@group',
  CALLS: '@calls',
  COMPOSER: '@composer',
  MEDIA: '@media',
  THREAD: '@thread',
  SEARCH: '@search',
  AUTH: '@auth',
  ADMIN: '@admin',
  DETAILS: '@details',

  // Type
  VISUAL: '@visual',
  A11Y: '@a11y',
  API: '@api',
  INTEGRATION: '@integration',
  NEGATIVE: '@negative',
  NETWORK: '@network',
} as const;

export type Tag = typeof TAGS[keyof typeof TAGS];
