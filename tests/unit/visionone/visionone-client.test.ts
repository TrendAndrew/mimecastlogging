import { VisionOneClient } from '../../../src/visionone/visionone-client';
import { VisionOneClientDeps } from '../../../src/visionone/visionone.types';
import { ApiError } from '../../../src/shared/errors';

describe('VisionOneClient', () => {
  let mockHttpPost: jest.Mock;
  let client: VisionOneClient;

  beforeEach(() => {
    mockHttpPost = jest.fn().mockResolvedValue({ status: 200 });
    const deps: VisionOneClientDeps = {
      baseUrl: 'https://api.xdr.trendmicro.com',
      ingestToken: 'test-token',
      vendor: 'Mimecast',
      product: 'Email Security',
      httpPost: mockHttpPost,
    };
    client = new VisionOneClient(deps);
  });

  it('should ingest NDJSON payload', async () => {
    const payload = '{"id":"1"}\n{"id":"2"}';
    const result = await client.ingest(payload);
    expect(result.accepted).toBe(true);
    expect(result.chunksSubmitted).toBe(1);
    expect(mockHttpPost).toHaveBeenCalledWith(
      expect.stringContaining('/v3.0/xdr/oat/dataPipeline/packageLogs'),
      payload,
      expect.objectContaining({
        Authorization: 'Bearer test-token',
        'TMV1-Log-Vendor': 'Mimecast',
        'TMV1-Log-Product': 'Email Security',
      }),
    );
  });

  it('should skip empty payload', async () => {
    const result = await client.ingest('');
    expect(result.accepted).toBe(true);
    expect(result.chunksSubmitted).toBe(0);
    expect(mockHttpPost).not.toHaveBeenCalled();
  });

  it('should retry on 5xx errors', async () => {
    mockHttpPost
      .mockRejectedValueOnce(new ApiError('Server error', 500, true))
      .mockResolvedValue({ status: 200 });

    const result = await client.ingest('{"id":"1"}');
    expect(result.accepted).toBe(true);
    expect(mockHttpPost).toHaveBeenCalledTimes(2);
  });

  it('should throw on non-retryable errors', async () => {
    mockHttpPost.mockRejectedValue(new ApiError('Bad request', 400, false));
    await expect(client.ingest('{"id":"1"}')).rejects.toThrow('Bad request');
  });
});
