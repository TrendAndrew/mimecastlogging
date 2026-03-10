export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export interface OAuthClientDeps {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  httpPost: (url: string, data: string, headers: Record<string, string>) => Promise<TokenResponse>;
}
