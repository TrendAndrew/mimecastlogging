import { OAuthClient } from '../../src/auth/oauth-client';
import { MimecastClient } from '../../src/mimecast/mimecast-client';
import { toNdjson } from '../../src/transformer/transformer';
import { VisionOneClient } from '../../src/visionone/visionone-client';
import { RateLimiter } from '../../src/shared/rate-limiter';
import { PageResponse } from '../../src/mimecast/mimecast.types';

describe('Integration: Mimecast → Vision One pipeline', () => {
  it('should fetch events, transform, and ingest', async () => {
    const mockEvents = [
      { id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z', subject: 'Test email' },
      { id: '2', type: 'ttp-url', timestamp: '2024-01-01T00:01:00Z', url: 'https://example.com' },
    ];

    const oauthClient = new OAuthClient({
      baseUrl: 'https://mock.mimecast.com',
      clientId: 'test',
      clientSecret: 'test',
      httpPost: jest.fn().mockResolvedValue({
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
      }),
    });

    const rateLimiter = new RateLimiter({ maxRequests: 300, windowMs: 3600000 });

    const mimecastClient = new MimecastClient({
      baseUrl: 'https://mock.mimecast.com',
      eventTypes: ['receipt', 'ttp-url'],
      getToken: () => oauthClient.getToken(),
      rateLimiter,
      httpGet: jest.fn().mockResolvedValue({
        data: mockEvents,
        meta: { pagination: {} },
      } as PageResponse),
    });

    const ingestCalls: string[] = [];
    const visionOneClient = new VisionOneClient({
      baseUrl: 'https://mock.xdr.trendmicro.com',
      ingestToken: 'mock-v1-token',
      vendor: 'Mimecast',
      product: 'Email Security',
      httpPost: jest.fn().mockImplementation(async (_url, body) => {
        ingestCalls.push(body);
        return { status: 200 };
      }),
    });

    // Execute pipeline
    const { events } = await mimecastClient.fetchEvents();
    expect(events).toHaveLength(2);

    const ndjson = toNdjson(events);
    expect(ndjson.split('\n')).toHaveLength(2);

    const result = await visionOneClient.ingest(ndjson);
    expect(result.accepted).toBe(true);
    expect(ingestCalls).toHaveLength(1);

    // Verify NDJSON content
    const lines = ingestCalls[0].split('\n');
    expect(JSON.parse(lines[0]).subject).toBe('Test email');
    expect(JSON.parse(lines[1]).url).toBe('https://example.com');
  });
});
