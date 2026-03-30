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

    if (this.deps.rateLimiter.remaining() < 10) {
      logger.warn('Rate limit headroom low, skipping fetch');
      return { events: [], isCaughtUp: true };
    }

    await this.deps.rateLimiter.waitForSlot();
    this.deps.rateLimiter.record();

    const token = await this.deps.getToken();
    const params: Record<string, string> = {};
    if (fromToken) {
      params.token = fromToken;
    }
    if (this.deps.eventTypes.length > 0) {
      params.type = this.deps.eventTypes.join(',');
    }

    let response: PageResponse;
    try {
      response = await this.deps.httpGet(
        `${this.deps.baseUrl}/siem/v1/events/cg`,
        {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        params,
      );
    } catch (err) {
      if (err instanceof RateLimitError) {
        logger.warn({ retryAfterMs: err.retryAfterMs }, 'Rate limited by Mimecast, backing off');
        await this.backoff(err.retryAfterMs);
        // Retry once after backoff
        response = await this.deps.httpGet(
          `${this.deps.baseUrl}/siem/v1/events/cg`,
          {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          params,
        );
      } else {
        throw err;
      }
    }

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

  private async backoff(baseMs: number): Promise<void> {
    const jitter = Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
  }
}
