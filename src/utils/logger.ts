type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const log = (level: LogLevel, msg: string, meta?: Record<string, unknown>): void => {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
  if (level === 'ERROR') {
    console.error(entry);
  } else {
    console.log(entry);
  }
};

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => log('INFO', msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('WARN', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('ERROR', msg, meta),
};
