import { IngestResult, VisionOneClientDeps } from './visionone.types';
import { ApiError } from '../shared/errors';
import { getLogger } from '../shared/logger';
import { chunkNdjson } from '../transformer/transformer';

const MAX_RETRIES = 3;

export class VisionOneClient {
  constructor(private readonly deps: VisionOneClientDeps) {}

  async ingest(ndjsonPayload: string): Promise<IngestResult> {
    const logger = getLogger();

    if (!ndjsonPayload || ndjsonPayload.trim().length === 0) {
      logger.debug('Empty payload, skipping ingest');
      return { status: 200, accepted: true, chunksSubmitted: 0 };
    }

    const chunks = chunkNdjson(ndjsonPayload);
    logger.info({ chunks: chunks.length }, 'Ingesting NDJSON payload to Vision One');

    for (let i = 0; i < chunks.length; i++) {
      await this.postChunk(chunks[i], i + 1, chunks.length);
    }

    return { status: 200, accepted: true, chunksSubmitted: chunks.length };
  }

  private async postChunk(chunk: string, chunkNum: number, totalChunks: number): Promise<void> {
    const logger = getLogger();
    const url = `${this.deps.baseUrl}/v3.0/xdr/oat/dataPipeline/packageLogs`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.deps.httpPost(url, chunk, {
          Authorization: `Bearer ${this.deps.ingestToken}`,
          'Content-Type': 'text/plain;charset=UTF-8',
          'TMV1-Log-Vendor': this.deps.vendor,
          'TMV1-Log-Product': this.deps.product,
        });

        logger.debug(
          { chunkNum, totalChunks, status: response.status },
          'Chunk ingested successfully',
        );
        return;
      } catch (err) {
        if (err instanceof ApiError && err.statusCode && err.statusCode >= 500 && attempt < MAX_RETRIES) {
          const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          logger.warn(
            { chunkNum, attempt, delayMs, error: err.message },
            'Server error, retrying',
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw err;
      }
    }
  }
}
