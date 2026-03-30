import { MimecastEvent } from '../mimecast/mimecast.types';

const CEF_VERSION = 0;
const DEVICE_VENDOR = 'Mimecast';
const DEVICE_PRODUCT = 'Email Security';
const DEVICE_VERSION = '2.0';

const SEVERITY_MAP: Record<string, number> = {
  receipt: 3,
  process: 3,
  delivery: 3,
  journal: 2,
  spam: 5,
  av: 8,
  'ttp-url': 7,
  'ttp_url': 7,
  'url_protect': 7,
  'ttp-attachment': 8,
  'ttp_attachment': 8,
  'attachment_protect': 8,
  'ttp-impersonation': 7,
  'ttp_impersonation': 7,
  'impersonation_protect': 7,
  'internal_email_protect': 5,
};

const EVENT_NAME_MAP: Record<string, string> = {
  receipt: 'Email Receipt',
  process: 'Email Processing',
  delivery: 'Email Delivery',
  journal: 'Journal Entry',
  spam: 'Spam Detection',
  av: 'Virus Detection',
  'ttp-url': 'URL Click Protection',
  'ttp_url': 'URL Click Protection',
  'url_protect': 'URL Click Protection',
  'ttp-attachment': 'Attachment Sandbox',
  'ttp_attachment': 'Attachment Sandbox',
  'attachment_protect': 'Attachment Sandbox',
  'ttp-impersonation': 'Impersonation Detection',
  'ttp_impersonation': 'Impersonation Detection',
  'impersonation_protect': 'Impersonation Detection',
  'internal_email_protect': 'Internal Email Protection',
};

function escapeCefHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function escapeCefExtValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/\|/g, '\\|').replace(/\n/g, '\\n');
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toEpochMs(value: unknown): string {
  if (!value) return '';
  const n = Number(value);
  if (!isNaN(n) && n > 1000000000000) return new Date(n).toISOString();
  if (!isNaN(n) && n > 1000000000) return new Date(n * 1000).toISOString();
  return str(value);
}

export function eventToCef(event: MimecastEvent): string {
  const eventType = str(event.eventType || event.type || 'unknown');
  const signatureId = eventType;
  const name = EVENT_NAME_MAP[eventType] || `Mimecast ${eventType}`;
  const severity = SEVERITY_MAP[eventType] ?? 3;

  const header = [
    `CEF:${CEF_VERSION}`,
    escapeCefHeader(DEVICE_VENDOR),
    escapeCefHeader(DEVICE_PRODUCT),
    escapeCefHeader(DEVICE_VERSION),
    escapeCefHeader(signatureId),
    escapeCefHeader(name),
    String(severity),
  ].join('|');

  const ext: string[] = [];

  const addExt = (key: string, value: unknown) => {
    const s = str(value);
    if (s) ext.push(`${key}=${escapeCefExtValue(s)}`);
  };

  // Timestamps
  const ts = toEpochMs(event.timestamp);
  if (ts) addExt('rt', ts);

  // Network / sender
  addExt('src', event.senderIp);
  addExt('suser', event.senderEnvelope || event.senderHeader);
  addExt('shost', event.senderDomain);

  // Recipient
  addExt('duser', event.recipients);

  // Email details
  addExt('msg', event.subject);
  addExt('externalId', event.messageId);

  // Action / result
  addExt('act', event.action || event.subType);
  addExt('outcome', event.route || event.direction);

  // Mimecast-specific (custom string fields)
  addExt('cs1', event.accountId);
  addExt('cs1Label', event.accountId ? 'accountId' : undefined);
  addExt('cs2', event.aggregateId);
  addExt('cs2Label', event.aggregateId ? 'aggregateId' : undefined);
  addExt('cs3', event.processingId);
  addExt('cs3Label', event.processingId ? 'processingId' : undefined);

  // Spam-specific
  if (event.spamScore !== undefined) {
    addExt('cn1', event.spamScore);
    addExt('cn1Label', 'spamScore');
  }
  if (event.spamDetectionLevel) {
    addExt('cs4', event.spamDetectionLevel);
    addExt('cs4Label', 'spamDetectionLevel');
  }

  // AV-specific
  if (event.virusFound) {
    addExt('cs4', event.virusFound);
    addExt('cs4Label', 'virusFound');
  }

  // TTP-specific
  if (event.url) {
    addExt('request', event.url);
  }

  // Rejection
  if (event.rejectionType) {
    addExt('reason', event.rejectionType);
    addExt('cs5', event.rejectionCode);
    addExt('cs5Label', event.rejectionCode ? 'rejectionCode' : undefined);
  }

  // TLS
  addExt('cs6', event.tlsVersion);
  addExt('cs6Label', event.tlsVersion ? 'tlsVersion' : undefined);

  // Number of attachments
  if (event.numberAttachments !== undefined) {
    addExt('cn2', event.numberAttachments);
    addExt('cn2Label', 'numberAttachments');
  }

  return `${header}|${ext.join(' ')}`;
}

export function toCef(events: MimecastEvent[]): string {
  if (events.length === 0) return '';
  return events.map((event) => eventToCef(event)).join('\n');
}

export function toNdjson(events: MimecastEvent[]): string {
  if (events.length === 0) return '';
  return events.map((event) => JSON.stringify(event)).join('\n');
}

export function chunkNdjson(payload: string, maxBytes: number = 4 * 1024 * 1024): string[] {
  if (Buffer.byteLength(payload, 'utf-8') <= maxBytes) {
    return [payload];
  }

  const lines = payload.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const line of lines) {
    const lineSize = Buffer.byteLength(line, 'utf-8') + 1;
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
