import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const configSchema = z.object({
  mimecast: z.object({
    baseUrl: z.string().url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    eventTypes: z.array(z.string()).min(1),
  }),
  visionOne: z.object({
    ingestUrl: z.string().url(),
    ingestToken: z.string().min(1),
    vendor: z.string().default('Mimecast'),
    product: z.string().default('Email Security'),
  }),
  pollIntervalMs: z.number().int().min(10000).max(3600000),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const raw = {
    mimecast: {
      baseUrl: process.env.MIMECAST_BASE_URL || '',
      clientId: process.env.MIMECAST_CLIENT_ID || '',
      clientSecret: process.env.MIMECAST_CLIENT_SECRET || '',
      eventTypes: (process.env.MIMECAST_EVENT_TYPES || '').split(',').filter(Boolean),
    },
    visionOne: {
      ingestUrl: process.env.VISIONONE_INGEST_URL || '',
      ingestToken: process.env.VISIONONE_INGEST_TOKEN || '',
      vendor: process.env.VISIONONE_VENDOR || 'Mimecast',
      product: process.env.VISIONONE_PRODUCT || 'Email Security',
    },
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '300000', 10),
    logLevel: (process.env.LOG_LEVEL || 'info') as Config['logLevel'],
  };

  return configSchema.parse(raw);
}
