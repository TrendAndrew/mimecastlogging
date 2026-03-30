import { MimecastClientDeps, MimecastEvent, PageResponse } from './mimecast.types';
import { RateLimitError } from '../shared/errors';
import { getLogger } from '../shared/logger';

export interface PageResult {
  events: MimecastEvent[];
  nextToken?: string;
  isCaughtUp: boolean;
}

export class MimecastClient {
  constructor(private readonly deps: MimecastClientDeps) {}

  async fetchPage(fromToken?: string): Promise<PageResult> {
    const logger = getLogger();

    const token = await this.deps.getToken();
    const params: Record<string, string> = {};
    if (fromToken) {
      params.token = fromToken;
    }
    if (this.deps.eventTypes.length > 0) {
      params.type = this.deps.eventTypes.join(',');
    }

    const response = await this.fetchWithRetry(token, params);

    const events = response.value || [];
    const nextToken = response['@nextPage'] || response['@nextLink'];

    logger.info(
      {
        pageEvents: events.length,
        isCaughtUp: response.isCaughtUp ?? false,
      },
      'Page fetched',
    );

    return {
      events,
      nextToken,
      isCaughtUp: response.isCaughtUp ?? (events.length === 0 && !nextToken),
    };
  }

  private async fetchWithRetry(token: string, params: Record<string, string>, attempt = 1): Promise<PageResponse> {
    const logger = getLogger();
    const maxRetries = 3;

    try {
      return await this.deps.httpGet(
        `${this.deps.baseUrl}/siem/v1/events/cg`,
        {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        params,
      );
    } catch (err) {
      if (err instanceof RateLimitError && attempt <= maxRetries) {
        logger.warn(
          { retryAfterMs: err.retryAfterMs, attempt },
          'Rate limited by Mimecast, backing off',
        );
        await this.backoff(err.retryAfterMs);
        return this.fetchWithRetry(token, params, attempt + 1);
      }
      throw err;
    }
  }

  private async backoff(baseMs: number): Promise<void> {
    const jitter = Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
  }
}
