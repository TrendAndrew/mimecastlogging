export interface MimecastEvent {
  id: string;
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface PageResponse {
  data: MimecastEvent[];
  meta: {
    pagination?: {
      pageToken?: string;
      next?: string;
    };
  };
}

export interface MimecastClientDeps {
  baseUrl: string;
  eventTypes: string[];
  getToken: () => Promise<string>;
  rateLimiter: {
    canProceed: () => boolean;
    remaining: () => number;
    record: () => void;
    waitForSlot: () => Promise<void>;
  };
  httpGet: (url: string, headers: Record<string, string>, params?: Record<string, string>) => Promise<PageResponse>;
}
