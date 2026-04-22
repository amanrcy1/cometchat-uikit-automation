import { ApiClient } from './ApiClient';

/**
 * CometChat Users REST API wrapper.
 */
export class UserApi {
  private constructor(private api: ApiClient) {}

  static async create(): Promise<UserApi> {
    return new UserApi(await ApiClient.create());
  }

  /** List all users */
  async listUsers() {
    return this.api.get('/users');
  }

  /** Get a single user by UID */
  async getUser(uid: string) {
    return this.api.get(`/users/${uid}`);
  }

  /** Create a user */
  async createUser(uid: string, name: string) {
    return this.api.post('/users', { uid, name });
  }

  /** Update a user */
  async updateUser(uid: string, data: Record<string, unknown>) {
    return this.api.put(`/users/${uid}`, data);
  }

  /** Delete a user */
  async deleteUser(uid: string) {
    return this.api.delete(`/users/${uid}`);
  }

  /** Block users (from perspective of onBehalfOf user) */
  async blockUsers(fromUid: string, blockedUids: string[]) {
    const api = await ApiClient.create({ onBehalfOf: fromUid });
    return api.post('/users/blockedusers', { blockedUids });
  }

  /** Unblock users */
  async unblockUsers(fromUid: string, blockedUids: string[]) {
    const api = await ApiClient.create({ onBehalfOf: fromUid });
    return api.delete('/users/blockedusers');
  }

  async dispose() {
    await this.api.dispose();
  }
}
