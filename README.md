# CometChat UIKit Automation

Enterprise-grade Playwright test framework for CometChat UIKit — UI, API, integration, and performance testing.

## Project Structure

```
cometchat-uikit-automation/
├── tests/                          # All Playwright test specs
│   ├── ui/                         # 10 specs — UI functional tests
│   │   ├── chat.spec.ts            #   1:1 messaging, media, reactions
│   │   ├── groups.spec.ts          #   Group CRUD, member management
│   │   ├── users.spec.ts           #   User list, details, block/unblock
│   │   ├── calls.spec.ts           #   Voice/video call flows
│   │   ├── composer.spec.ts        #   Rich text formatting toolbar
│   │   ├── features.spec.ts        #   Threads, stickers, search
│   │   ├── extended.spec.ts        #   Edge cases, advanced flows
│   │   ├── deep-validation.spec.ts #   DOM structure, receipts, status
│   │   ├── network.spec.ts         #   API request/response validation
│   │   └── visual.spec.ts          #   CSS, layout, typography
│   ├── api/                        # 4 specs — REST API tests
│   │   ├── auth.api.spec.ts
│   │   ├── user.api.spec.ts
│   │   ├── message.api.spec.ts
│   │   └── group.api.spec.ts
│   └── integration/                # 2 specs — end-to-end flows
│       ├── chat-flow.integration.spec.ts
│       └── group-flow.integration.spec.ts
│
├── lib/                            # Framework internals
│   ├── index.ts                    # Barrel export for all public APIs
│   ├── pages/                      # Page Object Model
│   │   ├── ChatPage.ts             #   Composed facade (delegates to chat/)
│   │   ├── LoginPage.ts
│   │   ├── UsersPage.ts
│   │   ├── GroupsPage.ts
│   │   ├── CallsPage.ts
│   │   ├── ConversationListPage.ts
│   │   └── chat/                   #   ChatPage split by concern
│   │       ├── ChatBasePage.ts     #     Overlay handling, smart wait/click
│   │       ├── ChatMessagingPage.ts#     Send, edit, delete, copy, reply
│   │       ├── ChatMediaPage.ts    #     Emoji, stickers, voice, reactions
│   │       ├── ChatThreadPage.ts   #     Thread panel interactions
│   │       ├── ChatCallsPage.ts    #     Voice/video call actions
│   │       ├── ChatGroupActionsPage.ts # Add/kick members, delete group
│   │       └── ChatDetailsPage.ts  #     User details, search, block
│   ├── api/                        # REST API clients
│   │   ├── ApiClient.ts            #   Base HTTP wrapper with auth headers
│   │   ├── UserApi.ts
│   │   ├── MessageApi.ts
│   │   └── GroupApi.ts
│   ├── fixtures/                   # Playwright fixtures
│   │   ├── auth.setup.ts           #   Global login — runs once, saves session
│   │   ├── test.fixture.ts         #   Unified: error tracking + page object DI
│   │   └── error-fixture.ts        #   Re-export shim (backward compat)
│   ├── reporters/                  # Custom test reporters
│   │   ├── unified-reporter.ts     #   HTML report: overview, tests, bugs, errors
│   │   ├── ai-bug-writer.ts        #   Groq AI-powered bug report generation
│   │   └── linear-reporter.ts      #   Linear issue creation from failures
│   ├── utils/                      # Shared utilities
│   │   ├── constants.ts            #   DOM selectors (SEL) + timeouts (TIMEOUTS)
│   │   ├── test-config.ts          #   App config (imports from constants.ts)
│   │   ├── overlay-manager.ts      #   Centralized error overlay dismissal
│   │   ├── error-tracker.ts        #   Console/page/network error capture
│   │   ├── runtime-error-handler.ts#   React error overlay auto-dismiss
│   │   ├── helpers.ts              #   uniqueName, testDataPath, USERS, MediaType
│   │   ├── data-factory.ts         #   Unique test data generation
│   │   ├── logger.ts               #   Structured logging with colors
│   │   ├── retry.ts                #   retry() and waitFor() utilities
│   │   └── tags.ts                 #   Tag constants (@smoke, @sanity, etc.)
│   └── types/
│       └── index.ts                # Shared TypeScript interfaces
│
├── config/                         # Test case definitions
│   ├── test-cases.csv              #   Test case matrix (linked to reporter)
│   └── member-scopes.csv           #   Group permission test cases
│
├── perf/                           # k6 performance tests (not Playwright)
│   └── chat-load-test.js           #   Load scenarios: smoke/average/stress/spike/soak
│
├── scripts/                        # Standalone dev scripts
│   └── debug-richtext.ts           #   Rich text rendering debugger
│
├── test-data/                      # Media fixtures
│   ├── sample-image.jpg
│   ├── sample-video.mp4
│   ├── sample-audio.mp3
│   └── sample-file.pdf
│
├── .github/workflows/              # CI/CD
│   ├── e2e-tests.yml
│   ├── nightly-regression.yml
│   └── pr-check.yml
│
├── playwright.config.ts            # Test execution config
├── global-teardown.ts              # Error report + test data cleanup
├── tsconfig.json
├── package.json
├── .env.example
└── .gitignore
```

## Quick Start

```bash
npm install
cp .env.example .env   # edit with your values
npx playwright test     # run all tests
```

## Run by Tag

```bash
# Priority
npm run test:smoke              # critical path (deploy gate)
npm run test:sanity             # core features (post-build)
npm run test:regression         # full suite (nightly)

# Feature
npm run test:chat               # 1:1 chat messaging
npm run test:group              # group chat features
npm run test:calls              # voice/video calls
npm run test:composer           # rich text formatting
npm run test:media              # file uploads, emoji, stickers, voice
npm run test:thread             # threaded messages
npm run test:search             # search functionality
npm run test:auth               # login, logout, session
npm run test:admin              # group admin (add/kick, delete)
npm run test:details            # user/group details panel

# Type
npm run test:visual             # CSS, layout, typography
npm run test:a11y               # accessibility (ARIA, keyboard)
npm run test:api                # REST API tests
npm run test:negative           # negative/edge cases
npm run test:network            # network request validation

# Combine tags
npx playwright test --grep "@smoke|@sanity"
npx playwright test --grep "@chat.*@media"
npx playwright test --grep-invert @visual
```

## Run by Layer

```bash
npm run test:ui          # UI tests only
npm run test:api         # API tests (needs COMETCHAT_APP_ID)
npm run test:integration # integration flows
npm run test:headed      # all tests with browser visible
```

## Performance Tests (k6)

```bash
npm run perf:smoke       # quick validation
npm run perf:average     # normal load
npm run perf:stress      # high load
npm run perf:spike       # sudden burst
npm run perf:soak        # sustained load
```

## Reports

- `npx playwright show-report` — Playwright HTML report
- `automation-report.html` — generated after each run (overview, test cases, AI bug reports)
- `error-report.html` — runtime error summary
- `npm run linear` — push failures to Linear as issues

## Architecture

### Page Object Model

Tests interact with the app through page objects, never touching selectors directly:

```typescript
import { test } from '../../lib/fixtures/test.fixture';

test('send a message', async ({ chatPage, usersPage }) => {
  await usersPage.navigateToUsersTab();
  await chatPage.sendTextMessage('hello');
  await chatPage.verifyTextSent('hello');
});
```

### ChatPage Composition

`ChatPage` is a facade that delegates to focused sub-pages:

```typescript
chatPage.messaging   // send, edit, delete, copy, reply
chatPage.media       // emoji, stickers, voice, reactions
chatPage.thread      // thread panel interactions
chatPage.calls       // voice/video call actions
chatPage.groupActions // add/kick members, delete group
chatPage.details     // user details, search, block
```

All original methods still work directly on `chatPage` for backward compatibility.

### Centralized Config

Selectors and timeouts live in `lib/utils/constants.ts` — single source of truth. `test-config.ts` imports from it and adds app-level config (baseURL, login, test data paths).

### Error Handling

Runtime error overlays are auto-dismissed via `overlay-manager.ts`. Console errors, page errors, and network failures are captured by `error-tracker.ts` and included in the HTML report.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BASE_URL` | Yes | App URL (default: `http://localhost:3000`) |
| `PRIMARY_UID` | Yes | Login user UID |
| `SECONDARY_UID` | No | Second user for cross-user tests |
| `CHAT_TARGET_USER` | Yes | Display name of chat target |
| `COMETCHAT_APP_ID` | For API | CometChat app ID |
| `COMETCHAT_API_KEY` | For API | CometChat REST API key |
| `GROQ_API_KEY` | No | Groq AI for smart bug reports |
| `LINEAR_API_KEY` | No | Linear issue creation |
| `DEBUG` | No | Enable debug logging (`true`) |
| `PW_WORKERS` | No | Override Playwright worker count |
| `CI` | No | CI flag (sets retries to 2) |
