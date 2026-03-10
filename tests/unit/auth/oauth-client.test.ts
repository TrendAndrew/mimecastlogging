import { OAuthClient } from '../../../src/auth/oauth-client';
import { OAuthClientDeps, TokenResponse } from '../../../src/auth/auth.types';

describe('OAuthClient', () => {
  let mockHttpPost: jest.Mock;
  let client: OAuthClient;

  const tokenResponse: TokenResponse = {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
  };

  beforeEach(() => {
    mockHttpPost = jest.fn().mockResolvedValue(tokenResponse);
    const deps: OAuthClientDeps = {
      baseUrl: 'https://api.services.mimecast.com',
      clientId: 'test-id',
      clientSecret: 'test-secret',
      httpPost: mockHttpPost,
    };
    client = new OAuthClient(deps);
  });

  it('should fetch a new token on first call', async () => {
    const token = await client.getToken();
    expect(token).toBe('test-access-token');
    expect(mockHttpPost).toHaveBeenCalledTimes(1);
  });

  it('should return cached token on subsequent calls', async () => {
    await client.getToken();
    await client.getToken();
    expect(mockHttpPost).toHaveBeenCalledTimes(1);
  });

  it('should refresh when cache is cleared', async () => {
    await client.getToken();
    client.clearCache();
    await client.getToken();
    expect(mockHttpPost).toHaveBeenCalledTimes(2);
  });

  it('should throw AuthError on failure', async () => {
    mockHttpPost.mockRejectedValue(new Error('Network fail'));
    await expect(client.getToken()).rejects.toThrow('Failed to obtain OAuth token');
  });

  it('should deduplicate concurrent refresh calls', async () => {
    const [t1, t2, t3] = await Promise.all([
      client.getToken(),
      client.getToken(),
      client.getToken(),
    ]);
    expect(t1).toBe('test-access-token');
    expect(t2).toBe('test-access-token');
    expect(t3).toBe('test-access-token');
    expect(mockHttpPost).toHaveBeenCalledTimes(1);
  });
});
