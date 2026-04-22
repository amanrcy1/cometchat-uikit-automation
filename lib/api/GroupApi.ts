import { ApiClient } from './ApiClient';

/**
 * CometChat Groups REST API wrapper.
 */
export class GroupApi {
  private constructor(private api: ApiClient) {}

  static async create(): Promise<GroupApi> {
    return new GroupApi(await ApiClient.create());
  }

  /** List all groups */
  async listGroups() {
    return this.api.get('/groups');
  }

  /** Get a single group by GUID */
  async getGroup(guid: string) {
    return this.api.get(`/groups/${guid}`);
  }

  /** Create a group */
  async createGroup(guid: string, name: string, type: 'public' | 'private' | 'password', password?: string) {
    const data: Record<string, unknown> = { guid, name, type };
    if (type === 'password' && password) data.password = password;
    return this.api.post('/groups', data);
  }

  /** Delete a group */
  async deleteGroup(guid: string) {
    return this.api.delete(`/groups/${guid}`);
  }

  /** Add members to a group */
  async addMembers(guid: string, members: { uid: string; scope: 'admin' | 'moderator' | 'participant' }[]) {
    const participants: Record<string, { scope: string }> = {};
    for (const m of members) participants[m.uid] = { scope: m.scope };
    return this.api.post(`/groups/${guid}/members`, { participants });
  }

  /** Remove a member from a group */
  async kickMember(guid: string, uid: string) {
    return this.api.delete(`/groups/${guid}/members/${uid}`);
  }

  /** Get group members */
  async getMembers(guid: string) {
    return this.api.get(`/groups/${guid}/members`);
  }

  async dispose() {
    await this.api.dispose();
  }
}
