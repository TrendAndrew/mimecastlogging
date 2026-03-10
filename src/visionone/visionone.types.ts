export interface IngestResult {
  status: number;
  accepted: boolean;
  chunksSubmitted: number;
}

export interface VisionOneClientDeps {
  baseUrl: string;
  ingestToken: string;
  vendor: string;
  product: string;
  httpPost: (url: string, body: string, headers: Record<string, string>) => Promise<{ status: number }>;
}
