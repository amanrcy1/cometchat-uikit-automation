import { test, expect } from '@playwright/test';
import { ApiClient } from '../../lib/api/ApiClient';

/**
 * API Tests — Authentication & App Health
 *
 * TC-API-AUTH-001  Valid API key returns 200 on /users
 * TC-API-AUTH-002  Invalid API key returns 401
 * TC-API-AUTH-003  Missing appid header returns 400/401
 * TC-API-AUTH-004  App health — /users endpoint responds within 5s
 */

test.describe('API — Auth & Health', () => {
  test.skip(!process.env.COMETCHAT_APP_ID, 'COMETCHAT_APP_ID not set — skipping API tests');

  test('@smoke @api TC-API-AUTH-001: Valid API key returns 200 on /users', async () => {
    const api = await ApiClient.create();
    const res = await api.get('/users?perPage=1');
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    await api.dispose();
  });

  test('@sanity @api @negative TC-API-AUTH-002: Invalid API key returns 401', async ({ request }) => {
    const appId = process.env.COMETCHAT_APP_ID!;
    const region = process.env.COMETCHAT_REGION || 'us';
    const res = await request.get(`https://${appId}.apiclient-${region}.cometchat.io/v3/users?perPage=1`, {
      headers: { appid: appId, apikey: 'invalid_key_12345', accept: 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('@sanity @api @negative TC-API-AUTH-003: Missing appid returns error', async ({ request }) => {
    const region = process.env.COMETCHAT_REGION || 'us';
    const res = await request.get(`https://fake.apiclient-${region}.cometchat.io/v3/users`, {
      headers: { apikey: 'fake', accept: 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('@sanity @api @network TC-API-AUTH-004: /users responds within 5s', async () => {
    const api = await ApiClient.create();
    const start = Date.now();
    const res = await api.get('/users?perPage=1');
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(5000);
    await api.dispose();
  });
});
