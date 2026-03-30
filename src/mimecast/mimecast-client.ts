import { MimecastClientDeps, MimecastEvent, PageResponse } from './mimecast.types';
import { RateLimitError } from '../shared/errors';
import { getLogger } from '../shared/logger';

export class MimecastClient {
  constructor(private readonly deps: MimecastClientDeps) {}

  async fetchEvents(fromToken?: string): Promise<{ events: MimecastEvent[]; nextToken?: string }> {
    const logger = getLogger();
    const allEvents: MimecastEvent[] = [];
    let pageToken = fromToken;
    let hasMore = true;

    logger.info({ fromToken: fromToken ? '(resuming)' : '(fresh)' }, 'Fetching events from Mimecast');

    while (hasMore) {
      if (this.deps.rateLimiter.remaining() < 10) {
        logger.warn('Rate limit headroom low, stopping pagination');
        break;
      }

      await this.deps.rateLimiter.waitForSlot();
      this.deps.rateLimiter.record();

      const token = await this.deps.getToken();
      const params: Record<string, string> = {};
      if (pageToken) {
        params.token = pageToken;
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
          continue;
        }
        throw err;
      }

      const events = response.value || [];
      allEvents.push(...events);

      logger.info(
        {
          page: allEvents.length > 0 ? Math.ceil(allEvents.length / 100) : 1,
          pageEvents: events.length,
          totalEvents: allEvents.length,
          isCaughtUp: response.isCaughtUp,
        },
        'Page fetched',
      );

      const nextPage = response['@nextPage'] || response['@nextLink'];
      if (response.isCaughtUp) {
        pageToken = nextPage;
        hasMore = false;
      } else if (nextPage && nextPage !== pageToken) {
        pageToken = nextPage;
      } else {
        hasMore = false;
      }
    }

    logger.info({ eventCount: allEvents.length }, 'Finished fetching events from Mimecast');
    return { events: allEvents, nextToken: pageToken };
  }

  private async backoff(baseMs: number): Promise<void> {
    const jitter = Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
  }
}
