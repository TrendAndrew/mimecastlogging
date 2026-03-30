import { MimecastClient } from '../../../src/mimecast/mimecast-client';
import { MimecastClientDeps, PageResponse } from '../../../src/mimecast/mimecast.types';

describe('MimecastClient', () => {
  let mockHttpGet: jest.Mock;
  let client: MimecastClient;

  beforeEach(() => {
    mockHttpGet = jest.fn();
    const deps: MimecastClientDeps = {
      baseUrl: 'https://api.services.mimecast.com',
      eventTypes: ['receipt'],
      getToken: jest.fn().mockResolvedValue('test-token'),
      httpGet: mockHttpGet,
    };
    client = new MimecastClient(deps);
  });

  it('should fetch a single page of events', async () => {
    const page: PageResponse = {
      value: [{ id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' }],
      isCaughtUp: true,
    };
    mockHttpGet.mockResolvedValue(page);

    const result = await client.fetchPage();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('1');
    expect(result.isCaughtUp).toBe(true);
  });

  it('should return isCaughtUp false when more pages available', async () => {
    const page: PageResponse = {
      value: [{ id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' }],
      '@nextPage': 'token2',
      isCaughtUp: false,
    };
    mockHttpGet.mockResolvedValue(page);

    const result = await client.fetchPage();
    expect(result.events).toHaveLength(1);
    expect(result.isCaughtUp).toBe(false);
    expect(result.nextToken).toBe('token2');
  });

  it('should pass fromToken as token param', async () => {
    const page: PageResponse = {
      value: [],
      isCaughtUp: true,
    };
    mockHttpGet.mockResolvedValue(page);

    await client.fetchPage('start-token');
    expect(mockHttpGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ token: 'start-token' }),
    );
  });

  it('should retry on RateLimitError then succeed', async () => {
    const { RateLimitError } = require('../../../src/shared/errors');
    const page: PageResponse = {
      value: [{ id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' }],
      isCaughtUp: true,
    };
    mockHttpGet
      .mockRejectedValueOnce(new RateLimitError('Rate limited', 10))
      .mockResolvedValueOnce(page);

    const result = await client.fetchPage();
    expect(result.events).toHaveLength(1);
    expect(mockHttpGet).toHaveBeenCalledTimes(2);
  });

  it('should rethrow non-rate-limit errors', async () => {
    mockHttpGet.mockRejectedValue(new Error('Connection refused'));
    await expect(client.fetchPage()).rejects.toThrow('Connection refused');
  });
});
