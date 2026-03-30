import { getLogger } from '../shared/logger';
import { StateStore } from './state-store';

export interface PollerDeps {
  fetchEvents: (fromToken?: string) => Promise<{ events: unknown[]; nextToken?: string }>;
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

    await this.tick();

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
      logger.info({ lastToken: state.lastPageToken }, 'Poll tick starting');

      const { events, nextToken } = await this.deps.fetchEvents(state.lastPageToken);

      if (events.length === 0) {
        logger.info('No new events');
        this.running = false;
        return;
      }

      const payload = this.deps.transform(events);
      logger.info({ eventCount: events.length }, 'Transforming events to CEF');
      const result = await this.deps.ingest(payload);

      await this.deps.stateStore.save({
        lastPageToken: nextToken,
        lastPollTime: new Date().toISOString(),
        lastEventCount: events.length,
      });

      logger.info(
        { eventCount: events.length, chunksSubmitted: result.chunksSubmitted },
        'Poll tick complete',
      );
    } catch (err) {
      logger.error({ err }, 'Poll tick error');
      throw err;
    } finally {
      this.running = false;
    }
  }
}
