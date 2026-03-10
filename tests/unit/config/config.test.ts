import { loadConfig } from '../../../src/config/config';

describe('loadConfig', () => {
  const validEnv = {
    MIMECAST_BASE_URL: 'https://api.services.mimecast.com',
    MIMECAST_CLIENT_ID: 'test-client-id',
    MIMECAST_CLIENT_SECRET: 'test-secret',
    MIMECAST_EVENT_TYPES: 'receipt,ttp-url',
    VISIONONE_BASE_URL: 'https://api.xdr.trendmicro.com',
    VISIONONE_INGEST_TOKEN: 'test-token',
    VISIONONE_VENDOR: 'Mimecast',
    VISIONONE_PRODUCT: 'Email Security',
    POLL_INTERVAL_MS: '300000',
    LOG_LEVEL: 'info',
  };

  beforeEach(() => {
    Object.assign(process.env, validEnv);
  });

  afterEach(() => {
    for (const key of Object.keys(validEnv)) {
      delete process.env[key];
    }
  });

  it('should load valid config from env vars', () => {
    const config = loadConfig();
    expect(config.mimecast.baseUrl).toBe('https://api.services.mimecast.com');
    expect(config.mimecast.clientId).toBe('test-client-id');
    expect(config.mimecast.eventTypes).toEqual(['receipt', 'ttp-url']);
    expect(config.visionOne.ingestToken).toBe('test-token');
    expect(config.pollIntervalMs).toBe(300000);
  });

  it('should throw on missing required fields', () => {
    delete process.env.MIMECAST_CLIENT_ID;
    expect(() => loadConfig()).toThrow();
  });

  it('should throw on invalid URL', () => {
    process.env.MIMECAST_BASE_URL = 'not-a-url';
    expect(() => loadConfig()).toThrow();
  });

  it('should throw on poll interval too low', () => {
    process.env.POLL_INTERVAL_MS = '100';
    expect(() => loadConfig()).toThrow();
  });

  it('should use defaults for optional fields', () => {
    delete process.env.VISIONONE_VENDOR;
    delete process.env.VISIONONE_PRODUCT;
    delete process.env.POLL_INTERVAL_MS;
    delete process.env.LOG_LEVEL;
    const config = loadConfig();
    expect(config.visionOne.vendor).toBe('Mimecast');
    expect(config.visionOne.product).toBe('Email Security');
    expect(config.pollIntervalMs).toBe(300000);
    expect(config.logLevel).toBe('info');
  });
});
