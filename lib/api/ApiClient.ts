import { request, APIRequestContext } from '@playwright/test';

/**
 * Base HTTP client for CometChat REST API.
 * Wraps Playwright's APIRequestContext with auth headers.
 *
 * Usage:
 *   const api = await ApiClient.create();
 *   const res = await api.get('/users');
 */
export class ApiClient {
  private constructor(private ctx: APIRequestContext) {}

  static async create(options?: { onBehalfOf?: string }): Promise<ApiClient> {
    const appId = process.env.COMETCHAT_APP_ID;
    const apiKey = process.env.COMETCHAT_API_KEY;
    const region = process.env.COMETCHAT_REGION || 'us';

    if (!appId || !apiKey) {
      throw new Error(
        'COMETCHAT_APP_ID and COMETCHAT_API_KEY must be set in .env for API tests'
      );
    }

    const headers: Record<string, string> = {
      appid: appId,
      apikey: apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    };

    if (options?.onBehalfOf) {
      headers['onbehalfof'] = options.onBehalfOf;
    }

    const ctx = await request.newContext({
      baseURL: `https://${appId}.apiclient-${region}.cometchat.io/v3`,
      extraHTTPHeaders: headers,
    });

    return new ApiClient(ctx);
  }

  async get(endpoint: string) {
    const res = await this.ctx.get(endpoint);
    return { status: res.status(), body: await res.json().catch(() => null) };
  }

  async post(endpoint: string, data?: Record<string, unknown>) {
    const res = await this.ctx.post(endpoint, { data });
    return { status: res.status(), body: await res.json().catch(() => null) };
  }

  async put(endpoint: string, data?: Record<string, unknown>) {
    const res = await this.ctx.put(endpoint, { data });
    return { status: res.status(), body: await res.json().catch(() => null) };
  }

  async delete(endpoint: string) {
    const res = await this.ctx.delete(endpoint);
    return { status: res.status(), body: await res.json().catch(() => null) };
  }

  async dispose() {
    await this.ctx.dispose();
  }
}
