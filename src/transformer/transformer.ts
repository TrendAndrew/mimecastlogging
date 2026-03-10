import { MimecastEvent } from '../mimecast/mimecast.types';

export function toNdjson(events: MimecastEvent[]): string {
  if (events.length === 0) {
    return '';
  }
  return events.map((event) => JSON.stringify(event)).join('\n');
}

export function chunkNdjson(ndjson: string, maxBytes: number = 4 * 1024 * 1024): string[] {
  if (Buffer.byteLength(ndjson, 'utf-8') <= maxBytes) {
    return [ndjson];
  }

  const lines = ndjson.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const line of lines) {
    const lineSize = Buffer.byteLength(line, 'utf-8') + 1; // +1 for newline
    if (currentSize + lineSize > maxBytes && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(line);
    currentSize += lineSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}
