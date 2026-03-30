import { OAuthClient } from '../../src/auth/oauth-client';
import { MimecastClient } from '../../src/mimecast/mimecast-client';
import { toCef } from '../../src/transformer/transformer';
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
        value: mockEvents,
        isCaughtUp: true,
      } as PageResponse),
    });

    const ingestCalls: string[] = [];
    const visionOneClient = new VisionOneClient({
      ingestUrl: 'https://mock.xdr.trendmicro.com/ingest/api/v1/third_party_log/raw',
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

    const cef = toCef(events);
    expect(cef.split('\n')).toHaveLength(2);

    const result = await visionOneClient.ingest(cef);
    expect(result.accepted).toBe(true);
    expect(ingestCalls).toHaveLength(1);

    // Verify CEF content
    const lines = ingestCalls[0].split('\n');
    expect(lines[0]).toMatch(/^CEF:0\|Mimecast\|/);
    expect(lines[0]).toContain('msg=Test email');
    expect(lines[1]).toContain('request=https://example.com');
  });
});
