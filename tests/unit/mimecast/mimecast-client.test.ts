import { MimecastClient } from '../../../src/mimecast/mimecast-client';
import { MimecastClientDeps, PageResponse } from '../../../src/mimecast/mimecast.types';

describe('MimecastClient', () => {
  let mockHttpGet: jest.Mock;
  let mockRateLimiter: any;
  let client: MimecastClient;

  beforeEach(() => {
    mockHttpGet = jest.fn();
    mockRateLimiter = {
      canProceed: jest.fn().mockReturnValue(true),
      remaining: jest.fn().mockReturnValue(200),
      record: jest.fn(),
      waitForSlot: jest.fn().mockResolvedValue(undefined),
    };
    const deps: MimecastClientDeps = {
      baseUrl: 'https://api.services.mimecast.com',
      eventTypes: ['receipt'],
      getToken: jest.fn().mockResolvedValue('test-token'),
      rateLimiter: mockRateLimiter,
      httpGet: mockHttpGet,
    };
    client = new MimecastClient(deps);
  });

  it('should fetch events from single page', async () => {
    const page: PageResponse = {
      data: [{ id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' }],
      meta: { pagination: {} },
    };
    mockHttpGet.mockResolvedValue(page);

    const result = await client.fetchEvents();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('1');
  });

  it('should paginate through multiple pages', async () => {
    const page1: PageResponse = {
      data: [{ id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' }],
      meta: { pagination: { next: 'token2' } },
    };
    const page2: PageResponse = {
      data: [{ id: '2', type: 'receipt', timestamp: '2024-01-01T00:01:00Z' }],
      meta: { pagination: {} },
    };
    mockHttpGet.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const result = await client.fetchEvents();
    expect(result.events).toHaveLength(2);
    expect(mockHttpGet).toHaveBeenCalledTimes(2);
  });

  it('should stop when rate limit headroom is low', async () => {
    mockRateLimiter.remaining.mockReturnValueOnce(200).mockReturnValue(5);
    const page: PageResponse = {
      data: [{ id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' }],
      meta: { pagination: { next: 'token2' } },
    };
    mockHttpGet.mockResolvedValue(page);

    const result = await client.fetchEvents();
    expect(result.events).toHaveLength(1);
  });

  it('should pass fromToken as pageToken param', async () => {
    const page: PageResponse = {
      data: [],
      meta: { pagination: {} },
    };
    mockHttpGet.mockResolvedValue(page);

    await client.fetchEvents('start-token');
    expect(mockHttpGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ pageToken: 'start-token' }),
    );
  });

  it('should retry on RateLimitError then succeed', async () => {
    const { RateLimitError } = require('../../../src/shared/errors');
    const page: PageResponse = {
      data: [{ id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' }],
      meta: { pagination: {} },
    };
    mockHttpGet
      .mockRejectedValueOnce(new RateLimitError('Rate limited', 10))
      .mockResolvedValueOnce(page);

    const result = await client.fetchEvents();
    expect(result.events).toHaveLength(1);
    expect(mockHttpGet).toHaveBeenCalledTimes(2);
  });

  it('should rethrow non-rate-limit errors', async () => {
    mockHttpGet.mockRejectedValue(new Error('Connection refused'));
    await expect(client.fetchEvents()).rejects.toThrow('Connection refused');
  });
});
