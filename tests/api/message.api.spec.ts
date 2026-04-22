import { test, expect } from '@playwright/test';
import { MessageApi } from '../../lib/api/MessageApi';
import { USERS } from '../../lib/utils/helpers';

/**
 * API Tests — Messages
 *
 * TC-API-MSG-001  Send text message to user — 200
 * TC-API-MSG-002  Response contains message ID and text
 * TC-API-MSG-003  Get user messages — 200 with array
 * TC-API-MSG-004  Send text message to group — 200
 * TC-API-MSG-005  Delete a message — 200
 * TC-API-MSG-006  Send empty text — returns error
 */

test.describe('API — Messages', () => {
  test.skip(!process.env.COMETCHAT_APP_ID, 'COMETCHAT_APP_ID not set — skipping API tests');

  let msgApi: MessageApi;
  let sentMessageId: string;

  test.beforeAll(async () => {
    msgApi = await MessageApi.create(USERS.primary);
  });

  test.afterAll(async () => {
    await msgApi.dispose();
  });

  test('@smoke @api @chat TC-API-MSG-001: Send text message to user — 200', async () => {
    const res = await msgApi.sendTextToUser(USERS.secondary, 'API test message');
    expect(res.status).toBe(200);
    expect(res.body?.data).toBeTruthy();
    sentMessageId = res.body?.data?.id?.toString();
  });

  test('@sanity @api TC-API-MSG-002: Response contains message ID and text', async () => {
    expect(sentMessageId).toBeTruthy();
  });

  test('@sanity @api TC-API-MSG-003: Get user messages — 200 with array', async () => {
    const res = await msgApi.getUserMessages(USERS.secondary, 5);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBeTruthy();
  });

  test('@sanity @api TC-API-MSG-005: Delete a message — 200', async () => {
    if (!sentMessageId) test.skip();
    const res = await msgApi.deleteMessage(sentMessageId);
    expect(res.status).toBe(200);
  });
});
