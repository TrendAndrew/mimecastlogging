import { getLogger } from '../shared/logger';
import { StateStore } from './state-store';

export interface PollerDeps {
  fetchPage: (fromToken?: string) => Promise<{ events: unknown[]; nextToken?: string; isCaughtUp: boolean }>;
  transform: (events: unknown[]) => string;
  ingest: (payload: string) => Promise<{ accepted: boolean; chunksSubmitted: number }>;
  stateStore: StateStore;
  intervalMs: number;
}

export class Poller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly deps: PollerDeps) {}

  async start(): Promise<void> {
    const logger = getLogger();
    logger.info({ intervalMs: this.deps.intervalMs }, 'Starting poller');

    // First tick — log errors but don't crash
    try {
      await this.tick();
    } catch (err) {
      logger.error({ err }, 'First tick failed, will retry on next interval');
    }

    this.timer = setInterval(() => {
      if (!this.running) {
        this.tick().catch((err) => {
          logger.error({ err }, 'Tick failed');
        });
      }
    }, this.deps.intervalMs);
  }

  stop(): void {
    const logger = getLogger();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Poller stopped');
    }
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const logger = getLogger();

    try {
      const state = await this.deps.stateStore.load();
      let pageToken = state.lastPageToken;
      let totalEvents = 0;
      let totalChunks = 0;
      let pageNum = 0;
      let pendingIngest: Promise<void> | null = null;

      logger.info({ lastToken: pageToken }, 'Poll tick starting');

      while (true) {
        pageNum++;
        const { events, nextToken, isCaughtUp } = await this.deps.fetchPage(pageToken);

        if (events.length > 0) {
          const payload = this.deps.transform(events);
          const currentPageToken = nextToken;
          const currentEventCount = events.length;

          // Wait for any previous page's ingest to complete before starting next
          if (pendingIngest) {
            await pendingIngest;
          }

          logger.info({ page: pageNum, eventCount: events.length }, 'Sending page to Vision One');

          // Start ingest + checkpoint — runs while we fetch the next page
          pendingIngest = (async () => {
            const result = await this.deps.ingest(payload);
            // Only checkpoint after successful ingest
            await this.deps.stateStore.save({
              lastPageToken: currentPageToken,
              lastPollTime: new Date().toISOString(),
              lastEventCount: currentEventCount,
            });
            totalEvents += currentEventCount;
            totalChunks += result.chunksSubmitted;
          })();
        }

        pageToken = nextToken;

        if (isCaughtUp) {
          break;
        }

        if (events.length === 0 && !nextToken) {
          break;
        }
      }

      // Wait for final page ingest to complete
      if (pendingIngest) {
        await pendingIngest;
      }

      if (totalEvents === 0) {
        logger.info('No new events');
      } else {
        logger.info(
          { totalEvents, totalChunks, pages: pageNum },
          'Poll tick complete',
        );
      }
    } catch (err) {
      logger.error({ err }, 'Poll tick error, will retry next interval');
    } finally {
      this.running = false;
    }
  }
}
