import pino from 'pino';

let loggerInstance: pino.Logger | undefined;

export function createLogger(level: string = 'info'): pino.Logger {
  loggerInstance = pino({
    level,
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return loggerInstance;
}

export function getLogger(): pino.Logger {
  if (!loggerInstance) {
    return createLogger();
  }
  return loggerInstance;
}
