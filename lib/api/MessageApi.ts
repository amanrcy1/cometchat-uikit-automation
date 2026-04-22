import { ApiClient } from './ApiClient';

/**
 * CometChat Messages REST API wrapper.
 */
export class MessageApi {
  private constructor(private api: ApiClient) {}

  static async create(onBehalfOf?: string): Promise<MessageApi> {
    return new MessageApi(await ApiClient.create({ onBehalfOf }));
  }

  /** Send a text message to a user */
  async sendTextToUser(receiverUid: string, text: string) {
    return this.api.post('/messages', {
      receiver: receiverUid,
      receiverType: 'user',
      category: 'message',
      type: 'text',
      data: { text },
    });
  }

  /** Send a text message to a group */
  async sendTextToGroup(guid: string, text: string) {
    return this.api.post('/messages', {
      receiver: guid,
      receiverType: 'group',
      category: 'message',
      type: 'text',
      data: { text },
    });
  }

  /** Get messages for a user conversation */
  async getUserMessages(uid: string, limit = 20) {
    return this.api.get(`/users/${uid}/messages?limit=${limit}`);
  }

  /** Get messages for a group conversation */
  async getGroupMessages(guid: string, limit = 20) {
    return this.api.get(`/groups/${guid}/messages?limit=${limit}`);
  }

  /** Delete a message by ID */
  async deleteMessage(messageId: string) {
    return this.api.delete(`/messages/${messageId}`);
  }

  async dispose() {
    await this.api.dispose();
  }
}
