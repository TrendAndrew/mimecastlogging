export interface MimecastEvent {
  id: string;
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface PageResponse {
  value: MimecastEvent[];
  '@nextLink'?: string;
  '@nextPage'?: string;
  pageSize?: number;
  isCaughtUp?: boolean;
}

export interface MimecastClientDeps {
  baseUrl: string;
  eventTypes: string[];
  getToken: () => Promise<string>;
  httpGet: (url: string, headers: Record<string, string>, params?: Record<string, string>) => Promise<PageResponse>;
}
