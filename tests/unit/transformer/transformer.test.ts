import { toNdjson, chunkNdjson } from '../../../src/transformer/transformer';

describe('toNdjson', () => {
  it('should convert events to NDJSON', () => {
    const events = [
      { id: '1', type: 'receipt', timestamp: '2024-01-01T00:00:00Z' },
      { id: '2', type: 'ttp-url', timestamp: '2024-01-01T00:01:00Z' },
    ];
    const result = toNdjson(events);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(events[0]);
    expect(JSON.parse(lines[1])).toEqual(events[1]);
  });

  it('should return empty string for empty array', () => {
    expect(toNdjson([])).toBe('');
  });

  it('should handle events with nested data', () => {
    const events = [{ id: '1', type: 'receipt', timestamp: '2024-01-01', details: { from: 'a@b.com' } }];
    const result = toNdjson(events);
    const parsed = JSON.parse(result);
    expect(parsed.details.from).toBe('a@b.com');
  });
});

describe('chunkNdjson', () => {
  it('should return single chunk for small payload', () => {
    const payload = '{"id":"1"}\n{"id":"2"}';
    expect(chunkNdjson(payload)).toHaveLength(1);
  });

  it('should split large payload into chunks', () => {
    const line = JSON.stringify({ id: '1', data: 'x'.repeat(1000) });
    const lines = Array(5000).fill(line);
    const payload = lines.join('\n');
    const chunks = chunkNdjson(payload, 1024 * 1024); // 1MB chunks
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf-8')).toBeLessThanOrEqual(1024 * 1024 + 2000); // slight tolerance
    }
  });
});
