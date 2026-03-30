import { toCef, eventToCef, toNdjson, chunkNdjson } from '../../../src/transformer/transformer';

describe('eventToCef', () => {
  it('should convert a receipt event to CEF format', () => {
    const event = {
      id: '1',
      type: 'receipt',
      eventType: 'receipt',
      timestamp: '1774759361161',
      senderIp: '52.103.74.30',
      senderEnvelope: 'alice@example.com',
      senderDomain: 'example.com',
      recipients: 'bob@corp.com',
      subject: 'Test email',
      accountId: 'CAU3A18',
      aggregateId: 'abc123',
      action: 'Acc',
      numberAttachments: 3,
      tlsVersion: 'TLSv1.3',
    };
    const cef = eventToCef(event);
    expect(cef).toMatch(/^CEF:0\|Mimecast\|Email Security\|2\.0\|receipt\|Email Receipt\|3\|/);
    expect(cef).toContain('src=52.103.74.30');
    expect(cef).toContain('suser=alice@example.com');
    expect(cef).toContain('shost=example.com');
    expect(cef).toContain('duser=bob@corp.com');
    expect(cef).toContain('msg=Test email');
    expect(cef).toContain('act=Acc');
    expect(cef).toContain('cs1=CAU3A18');
    expect(cef).toContain('cn2=3');
    expect(cef).toContain('cn2Label=numberAttachments');
    expect(cef).toContain('cs6=TLSv1.3');
    expect(cef).toContain('cs6Label=tlsVersion');
  });

  it('should convert a spam event with correct severity', () => {
    const event = {
      id: '2',
      type: 'spam',
      eventType: 'spam',
      timestamp: '1774759632271',
      senderEnvelope: 'spammer@bad.com',
      recipients: 'user@corp.com',
      subject: 'Buy now',
      spamScore: 9,
      spamDetectionLevel: 'high',
      accountId: 'CAU3A18',
    };
    const cef = eventToCef(event);
    expect(cef).toMatch(/\|spam\|Spam Detection\|5\|/);
    expect(cef).toContain('cn1=9');
    expect(cef).toContain('cn1Label=spamScore');
    expect(cef).toContain('cs4=high');
    expect(cef).toContain('cs4Label=spamDetectionLevel');
  });

  it('should convert a ttp-url event with URL field', () => {
    const event = {
      id: '3',
      type: 'ttp-url',
      eventType: 'ttp-url',
      timestamp: '1774759400000',
      url: 'https://malicious.example.com/phish',
      recipients: 'victim@corp.com',
    };
    const cef = eventToCef(event);
    expect(cef).toMatch(/\|URL Click Protection\|7\|/);
    expect(cef).toContain('request=https://malicious.example.com/phish');
  });

  it('should convert an av event with virus info', () => {
    const event = {
      id: '4',
      type: 'av',
      eventType: 'av',
      timestamp: '1774759500000',
      virusFound: 'Trojan.GenericKD',
      recipients: 'user@corp.com',
    };
    const cef = eventToCef(event);
    expect(cef).toMatch(/\|Virus Detection\|8\|/);
    expect(cef).toContain('cs4=Trojan.GenericKD');
    expect(cef).toContain('cs4Label=virusFound');
  });

  it('should escape pipes in header values', () => {
    const event = {
      id: '5',
      type: 'receipt',
      eventType: 'receipt',
      timestamp: '1774759361161',
      subject: 'Test | with pipes',
    };
    const cef = eventToCef(event);
    expect(cef).not.toContain('msg=Test | with pipes');
  });

  it('should escape equals in extension values', () => {
    const event = {
      id: '6',
      type: 'receipt',
      eventType: 'receipt',
      timestamp: '1774759361161',
      subject: 'a=b test',
    };
    const cef = eventToCef(event);
    expect(cef).toContain('msg=a\\=b test');
  });

  it('should handle missing optional fields gracefully', () => {
    const event = { id: '7', type: 'receipt', timestamp: '1774759361161' };
    const cef = eventToCef(event);
    expect(cef).toMatch(/^CEF:0\|/);
    expect(cef).not.toContain('src=');
    expect(cef).not.toContain('suser=');
  });

  it('should handle rejection events', () => {
    const event = {
      id: '8',
      type: 'receipt',
      eventType: 'receipt',
      timestamp: '1774759361161',
      rejectionType: 'Connection Attempt',
      rejectionCode: '451',
    };
    const cef = eventToCef(event);
    expect(cef).toContain('reason=Connection Attempt');
    expect(cef).toContain('cs5=451');
    expect(cef).toContain('cs5Label=rejectionCode');
  });
});

describe('toCef', () => {
  it('should convert multiple events to newline-separated CEF', () => {
    const events = [
      { id: '1', type: 'receipt', timestamp: '1774759361161' },
      { id: '2', type: 'spam', timestamp: '1774759632271' },
    ];
    const result = toCef(events);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^CEF:0\|/);
    expect(lines[1]).toMatch(/^CEF:0\|/);
  });

  it('should return empty string for empty array', () => {
    expect(toCef([])).toBe('');
  });
});

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
  });

  it('should return empty string for empty array', () => {
    expect(toNdjson([])).toBe('');
  });
});

describe('chunkNdjson', () => {
  it('should return single chunk for small payload', () => {
    const payload = 'CEF:0|Mimecast|test\nCEF:0|Mimecast|test2';
    expect(chunkNdjson(payload)).toHaveLength(1);
  });

  it('should split large payload into chunks', () => {
    const line = `CEF:0|Mimecast|Email Security|2.0|receipt|Email Receipt|3|msg=${'x'.repeat(1000)}`;
    const lines = Array(5000).fill(line);
    const payload = lines.join('\n');
    const chunks = chunkNdjson(payload, 1024 * 1024);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf-8')).toBeLessThanOrEqual(1024 * 1024 + 2000);
    }
  });
});
