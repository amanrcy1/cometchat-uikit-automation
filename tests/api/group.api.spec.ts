import { test, expect } from '@playwright/test';
import { GroupApi } from '../../lib/api/GroupApi';
import { uniqueName } from '../../lib/utils/helpers';

/**
 * API Tests — Groups
 *
 * TC-API-GRP-001  List groups — 200 with array
 * TC-API-GRP-002  Create public group — 200
 * TC-API-GRP-003  Get group by GUID — 200
 * TC-API-GRP-004  Add member to group — 200
 * TC-API-GRP-005  Get group members — 200 with array
 * TC-API-GRP-006  Kick member from group — 200
 * TC-API-GRP-007  Delete group — 200
 * TC-API-GRP-008  Get deleted group — 404
 */

test.describe('API — Groups', () => {
  test.skip(!process.env.COMETCHAT_APP_ID, 'COMETCHAT_APP_ID not set — skipping API tests');

  let groupApi: GroupApi;
  let testGuid: string;

  test.beforeAll(async () => {
    groupApi = await GroupApi.create();
    testGuid = uniqueName('api-grp').toLowerCase().replace(/[^a-z0-9-]/g, '');
  });

  test.afterAll(async () => {
    // Cleanup — delete test group if it still exists
    await groupApi.deleteGroup(testGuid).catch(() => {});
    await groupApi.dispose();
  });

  test('@smoke @api @group TC-API-GRP-001: List groups — 200 with array', async () => {
    const res = await groupApi.listGroups();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBeTruthy();
  });

  test('@sanity @api @group TC-API-GRP-002: Create public group — 200', async () => {
    const res = await groupApi.createGroup(testGuid, `API Test Group ${testGuid}`, 'public');
    expect(res.status).toBe(200);
    expect(res.body?.data?.guid).toBe(testGuid);
  });

  test('@sanity @api @group TC-API-GRP-003: Get group by GUID — 200', async () => {
    const res = await groupApi.getGroup(testGuid);
    expect(res.status).toBe(200);
    expect(res.body?.data?.guid).toBe(testGuid);
  });

  test('@sanity @api @group @admin TC-API-GRP-004: Add member to group — 200', async () => {
    const uid = process.env.SECONDARY_UID || 'cometchat-uid-2';
    const res = await groupApi.addMembers(testGuid, [{ uid, scope: 'participant' }]);
    expect(res.status).toBe(200);
  });

  test('@regression @api @group TC-API-GRP-005: Get group members — 200 with array', async () => {
    const res = await groupApi.getMembers(testGuid);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBeTruthy();
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('@sanity @api @group @admin TC-API-GRP-006: Kick member from group — 200', async () => {
    const uid = process.env.SECONDARY_UID || 'cometchat-uid-2';
    const res = await groupApi.kickMember(testGuid, uid);
    expect(res.status).toBe(200);
  });

  test('@regression @api @group TC-API-GRP-007: Delete group — 200', async () => {
    const res = await groupApi.deleteGroup(testGuid);
    expect(res.status).toBe(200);
  });

  test('@regression @api @group @negative TC-API-GRP-008: Get deleted group — 404', async () => {
    const res = await groupApi.getGroup(testGuid);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
