import { generateErrorReport } from './lib/utils/error-tracker';

/**
 * Global teardown — runs after all tests complete.
 * 1. Generates the runtime error HTML report
 * 2. Cleans up test data created during the run (groups with "Test-" prefix)
 */
export default async function globalTeardown() {
  // Generate error report
  generateErrorReport();

  // Clean up test-created groups via API (if credentials are available)
  const appId = process.env.COMETCHAT_APP_ID;
  const apiKey = process.env.COMETCHAT_API_KEY;

  if (!appId || !apiKey) {
    console.log('[Teardown] Skipping API cleanup — COMETCHAT_APP_ID or COMETCHAT_API_KEY not set');
    return;
  }

  try {
    const baseUrl = `https://${appId}.api-us.cometchat.io/v3`;
    const headers = {
      'Content-Type': 'application/json',
      'appid': appId,
      'apikey': apiKey,
    };

    // List groups and delete any with "Test-" prefix (created by DataFactory)
    const res = await fetch(`${baseUrl}/groups?perPage=100`, { headers });
    if (res.ok) {
      const data = await res.json();
      const testGroups = (data.data || []).filter((g: any) =>
        g.name?.startsWith('Test-') || g.guid?.startsWith('test-')
      );

      if (testGroups.length > 0) {
        console.log(`[Teardown] Cleaning up ${testGroups.length} test group(s)...`);
        for (const group of testGroups) {
          await fetch(`${baseUrl}/groups/${group.guid}`, {
            method: 'DELETE',
            headers,
          }).catch(() => {});
        }
        console.log('[Teardown] Test group cleanup complete');
      }
    }
  } catch (err) {
    console.warn('[Teardown] API cleanup failed (non-fatal):', err);
  }
}
