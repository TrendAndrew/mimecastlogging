import { CachedToken, OAuthClientDeps } from './auth.types';
import { AuthError } from '../shared/errors';
import { getLogger } from '../shared/logger';

export class OAuthClient {
  private cachedToken: CachedToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(private readonly deps: OAuthClientDeps) {}

  async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.accessToken;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refresh(): Promise<string> {
    const logger = getLogger();
    const url = `${this.deps.baseUrl}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.deps.clientId,
      client_secret: this.deps.clientSecret,
    }).toString();

    try {
      const response = await this.deps.httpPost(url, body, {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      this.cachedToken = {
        accessToken: response.access_token,
        expiresAt: Date.now() + response.expires_in * 1000,
      };

      logger.info('OAuth token refreshed successfully');
      return this.cachedToken.accessToken;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown auth error';
      throw new AuthError(`Failed to obtain OAuth token: ${message}`);
    }
  }

  clearCache(): void {
    this.cachedToken = null;
  }
}
