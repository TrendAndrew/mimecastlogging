import axios from 'axios';
import { loadConfig } from './config/config';
import { createLogger } from './shared/logger';
import { RateLimiter } from './shared/rate-limiter';
import { OAuthClient } from './auth/oauth-client';
import { MimecastClient } from './mimecast/mimecast-client';
import { toNdjson } from './transformer/transformer';
import { VisionOneClient } from './visionone/visionone-client';
import { Poller } from './poller/poller';
import { StateStore } from './poller/state-store';
import { ApiError, RateLimitError } from './shared/errors';
import { PageResponse } from './mimecast/mimecast.types';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info('Mimecast → Vision One forwarder starting');

  const rateLimiter = new RateLimiter({ maxRequests: 300, windowMs: 3600000 });

  const oauthClient = new OAuthClient({
    baseUrl: config.mimecast.baseUrl,
    clientId: config.mimecast.clientId,
    clientSecret: config.mimecast.clientSecret,
    httpPost: async (url, data, headers) => {
      const resp = await axios.post(url, data, { headers });
      return resp.data;
    },
  });

  const mimecastClient = new MimecastClient({
    baseUrl: config.mimecast.baseUrl,
    eventTypes: config.mimecast.eventTypes,
    getToken: () => oauthClient.getToken(),
    rateLimiter,
    httpGet: async (url, headers, params) => {
      const resp = await axios.get<PageResponse>(url, { headers, params });
      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers['retry-after'] || '60', 10) * 1000;
        throw new RateLimitError('Mimecast rate limit hit', retryAfter);
      }
      if (resp.status >= 400) {
        throw new ApiError(`Mimecast API error: ${resp.status}`, resp.status, resp.status >= 500);
      }
      return resp.data;
    },
  });

  const visionOneClient = new VisionOneClient({
    baseUrl: config.visionOne.baseUrl,
    ingestToken: config.visionOne.ingestToken,
    vendor: config.visionOne.vendor,
    product: config.visionOne.product,
    httpPost: async (url, body, headers) => {
      const resp = await axios.post(url, body, { headers });
      if (resp.status >= 500) {
        throw new ApiError(`Vision One server error: ${resp.status}`, resp.status, true);
      }
      if (resp.status >= 400) {
        throw new ApiError(`Vision One client error: ${resp.status}`, resp.status, false);
      }
      return { status: resp.status };
    },
  });

  const stateStore = new StateStore();

  const poller = new Poller({
    fetchEvents: (fromToken) => mimecastClient.fetchEvents(fromToken),
    transform: (events) => toNdjson(events as any),
    ingest: (payload) => visionOneClient.ingest(payload),
    stateStore,
    intervalMs: config.pollIntervalMs,
  });

  const shutdown = () => {
    logger.info('Shutting down...');
    poller.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await poller.start();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
