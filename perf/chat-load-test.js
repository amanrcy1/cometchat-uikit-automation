/**
 * ═══════════════════════════════════════════════════════════════════════
 * CometChat k6 Performance / Load Test
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Tests the CometChat REST API under load — NOT the UI.
 * Simulates multiple concurrent users sending messages, fetching
 * conversations, listing users/groups, and making API calls.
 *
 * ── Scenarios ──
 *
 *   smoke        1 VU  for 30s   — baseline, verify API works
 *   average      10 VU for 1m    — normal weekday traffic
 *   stress       50 VU for 2m    — peak hour simulation
 *   spike        100 VU for 30s  — sudden traffic burst
 *   soak         10 VU for 5m    — sustained load, detect memory leaks
 *
 * ── Thresholds ──
 *
 *   http_req_duration p(95) < 3s     — 95th percentile under 3 seconds
 *   http_req_duration p(99) < 5s     — 99th percentile under 5 seconds
 *   http_req_failed < 5%             — less than 5% error rate
 *   send_message_duration p(95) < 2s — message send under 2 seconds
 *
 * ── Setup ──
 *
 *   1. Set env vars (or edit the defaults below):
 *        export COMETCHAT_APP_ID=your_app_id
 *        export COMETCHAT_API_KEY=your_api_key
 *        export COMETCHAT_REGION=us
 *
 *   2. Run:
 *        k6 run tests/performance/chat-load-test.js                    # smoke
 *        k6 run --env SCENARIO=average tests/performance/chat-load-test.js
 *        k6 run --env SCENARIO=stress tests/performance/chat-load-test.js
 *        k6 run --env SCENARIO=spike tests/performance/chat-load-test.js
 *        k6 run --env SCENARIO=soak tests/performance/chat-load-test.js
 *
 *   3. HTML report (optional):
 *        k6 run --out json=results.json tests/performance/chat-load-test.js
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ── Custom Metrics ──
const sendMessageDuration = new Trend('send_message_duration', true);
const listUsersDuration = new Trend('list_users_duration', true);
const listGroupsDuration = new Trend('list_groups_duration', true);
const fetchMessagesDuration = new Trend('fetch_messages_duration', true);
const messagesSent = new Counter('messages_sent');
const messagesFailedRate = new Rate('messages_failed');

// ── Config ──
const APP_ID = __ENV.COMETCHAT_APP_ID || 'your_app_id';
const API_KEY = __ENV.COMETCHAT_API_KEY || 'your_api_key';
const REGION = __ENV.COMETCHAT_REGION || 'us';
const BASE = `https://${APP_ID}.apiclient-${REGION}.cometchat.io/v3`;
const SENDER_UID = __ENV.PRIMARY_UID || 'cometchat-uid-1';
const RECEIVER_UID = __ENV.SECONDARY_UID || 'cometchat-uid-2';

const HEADERS = {
  appid: APP_ID,
  apikey: API_KEY,
  'content-type': 'application/json',
  accept: 'application/json',
  onbehalfof: SENDER_UID,
};

// ── Scenario Selection ──
const SCENARIO = __ENV.SCENARIO || 'smoke';

const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    tags: { scenario: 'smoke' },
  },
  average: {
    executor: 'constant-vus',
    vus: 10,
    duration: '1m',
    tags: { scenario: 'average' },
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 25 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 0 },
    ],
    tags: { scenario: 'stress' },
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 100 },
      { duration: '20s', target: 100 },
      { duration: '10s', target: 0 },
    ],
    tags: { scenario: 'spike' },
  },
  soak: {
    executor: 'constant-vus',
    vus: 10,
    duration: '5m',
    tags: { scenario: 'soak' },
  },
};

export const options = {
  scenarios: {
    [SCENARIO]: SCENARIOS[SCENARIO] || SCENARIOS.smoke,
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    send_message_duration: ['p(95)<2000'],
    list_users_duration: ['p(95)<2000'],
    list_groups_duration: ['p(95)<2000'],
    fetch_messages_duration: ['p(95)<2000'],
  },
};

// ── Helper: API call with timing ──
function apiGet(endpoint, metric) {
  const res = http.get(`${BASE}${endpoint}`, { headers: HEADERS });
  if (metric) metric.add(res.timings.duration);
  return res;
}

function apiPost(endpoint, body, metric) {
  const res = http.post(`${BASE}${endpoint}`, JSON.stringify(body), { headers: HEADERS });
  if (metric) metric.add(res.timings.duration);
  return res;
}

// ── Main Test Function ──
export default function () {
  const iteration = __ITER;
  const vu = __VU;

  // 1. List Users
  group('List Users', () => {
    const res = apiGet('/users?perPage=10', listUsersDuration);
    check(res, {
      'list users: status 200': (r) => r.status === 200,
      'list users: has data array': (r) => {
        try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
      },
    });
  });

  sleep(0.5);

  // 2. List Groups
  group('List Groups', () => {
    const res = apiGet('/groups?perPage=10', listGroupsDuration);
    check(res, {
      'list groups: status 200': (r) => r.status === 200,
      'list groups: has data array': (r) => {
        try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
      },
    });
  });

  sleep(0.5);

  // 3. Send Text Message
  group('Send Message', () => {
    const msgText = `k6-load-test-vu${vu}-iter${iteration}-${Date.now()}`;
    const res = apiPost('/messages', {
      receiver: RECEIVER_UID,
      receiverType: 'user',
      category: 'message',
      type: 'text',
      data: { text: msgText },
    }, sendMessageDuration);

    const sent = check(res, {
      'send message: status 200': (r) => r.status === 200,
      'send message: has message id': (r) => {
        try { return !!JSON.parse(r.body).data.id; } catch { return false; }
      },
    });

    messagesSent.add(1);
    messagesFailedRate.add(!sent);
  });

  sleep(0.5);

  // 4. Fetch Messages (conversation history)
  group('Fetch Messages', () => {
    const res = apiGet(`/users/${RECEIVER_UID}/messages?perPage=20`, fetchMessagesDuration);
    check(res, {
      'fetch messages: status 200': (r) => r.status === 200,
      'fetch messages: has data': (r) => {
        try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
      },
    });
  });

  sleep(0.5);

  // 5. Get Single User (presence check)
  group('Get User', () => {
    const res = apiGet(`/users/${RECEIVER_UID}`);
    check(res, {
      'get user: status 200': (r) => r.status === 200,
      'get user: has uid': (r) => {
        try { return JSON.parse(r.body).data.uid === RECEIVER_UID; } catch { return false; }
      },
    });
  });

  sleep(1);
}

// ── Summary ──
export function handleSummary(data) {
  const now = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const scenario = SCENARIO;

  // Console summary
  const p95 = data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(0) || 'N/A';
  const p99 = data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(0) || 'N/A';
  const failRate = (data.metrics.http_req_failed?.values?.rate * 100)?.toFixed(2) || '0';
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;
  const msgSent = data.metrics.messages_sent?.values?.count || 0;
  const msgP95 = data.metrics.send_message_duration?.values?.['p(95)']?.toFixed(0) || 'N/A';

  console.log('\n' + '═'.repeat(60));
  console.log(`  k6 Performance Report — ${scenario.toUpperCase()}`);
  console.log('═'.repeat(60));
  console.log(`  Total Requests:     ${totalReqs}`);
  console.log(`  Messages Sent:      ${msgSent}`);
  console.log(`  Error Rate:         ${failRate}%`);
  console.log(`  HTTP p(95):         ${p95}ms`);
  console.log(`  HTTP p(99):         ${p99}ms`);
  console.log(`  Send Message p(95): ${msgP95}ms`);
  console.log('═'.repeat(60) + '\n');

  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    [`tests/performance/results/${scenario}-${now}.json`]: JSON.stringify(data, null, 2),
  };
}

// k6 built-in text summary
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
