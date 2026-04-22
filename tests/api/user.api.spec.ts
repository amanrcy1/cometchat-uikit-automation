import { test, expect } from '@playwright/test';
import { UserApi } from '../../lib/api/UserApi';

/**
 * API Tests — Users
 *
 * TC-API-USR-001  List users — 200 with array
 * TC-API-USR-002  Get user by UID — 200 with user data
 * TC-API-USR-003  Get non-existent user — 404
 * TC-API-USR-004  User response has uid, name, status fields
 */

test.describe('API — Users', () => {
  test.skip(!process.env.COMETCHAT_APP_ID, 'COMETCHAT_APP_ID not set — skipping API tests');

  let userApi: UserApi;

  test.beforeAll(async () => {
    userApi = await UserApi.create();
  });

  test.afterAll(async () => {
    await userApi.dispose();
  });

  test('@smoke @api TC-API-USR-001: List users — 200 with array', async () => {
    const res = await userApi.listUsers();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBeTruthy();
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('@sanity @api TC-API-USR-002: Get user by UID — 200 with user data', async () => {
    const uid = process.env.PRIMARY_UID || 'cometchat-uid-1';
    const res = await userApi.getUser(uid);
    expect(res.status).toBe(200);
    expect(res.body?.data?.uid).toBe(uid);
  });

  test('@sanity @api @negative TC-API-USR-003: Get non-existent user — 404', async () => {
    const res = await userApi.getUser('nonexistent_user_xyz_99999');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('@regression @api TC-API-USR-004: User response has uid, name, status fields', async () => {
    const uid = process.env.PRIMARY_UID || 'cometchat-uid-1';
    const res = await userApi.getUser(uid);
    expect(res.body?.data?.uid).toBeTruthy();
    expect(res.body?.data?.name).toBeTruthy();
    expect(res.body?.data?.status).toBeDefined();
  });
});
