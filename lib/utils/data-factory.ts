import { uniqueName } from './helpers';

/**
 * Test Data Factory — generates unique, deterministic test data.
 * Prevents test pollution by ensuring each run uses fresh data.
 *
 * Usage:
 *   const msg = DataFactory.message();        // "msg-lx4k2-abc"
 *   const grp = DataFactory.groupName();      // "TestGroup-lx4k2-def"
 *   const user = DataFactory.userData();       // { uid: "test-user-...", name: "Test User ..." }
 */
export class DataFactory {
  /** Generate a unique message text */
  static message(prefix = 'msg'): string {
    return uniqueName(prefix);
  }

  /** Generate a unique group name */
  static groupName(type: 'Public' | 'Private' | 'Password' = 'Public'): string {
    const prefixMap = { Public: 'TestGroup', Private: 'PrivateGroup', Password: 'PwdGroup' };
    return uniqueName(prefixMap[type]);
  }

  /** Generate a unique user data object (for API user creation) */
  static userData(): { uid: string; name: string } {
    const id = uniqueName('test-user');
    return { uid: id, name: `Test User ${id.split('-').pop()}` };
  }

  /** Generate a unique group data object (for API group creation) */
  static groupData(type: 'public' | 'private' | 'password' = 'public'): {
    guid: string; name: string; type: string; password?: string;
  } {
    const id = uniqueName('test-grp').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const data: any = { guid: id, name: `Test Group ${id.split('-').pop()}`, type };
    if (type === 'password') data.password = 'test123';
    return data;
  }

  /** Generate a batch of unique messages */
  static messages(count: number, prefix = 'batch'): string[] {
    return Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}-${uniqueName('')}`);
  }

  /** Timestamp string for unique naming */
  static timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  }
}
