import 'server-only';
/**
 * Structured logging with redaction. Health data is sensitive: never log OTPs, result values,
 * tokens, or full phone numbers. Redaction is by key name, applied recursively.
 */
const REDACT = /^(otp|code|codehash|token|tokenhash|secret|password|authorization|cookie|value|valuenum|valuetext|phone|name|address|addressline|signature)$/i;

function scrub(v: unknown, depth = 0): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (depth > 4) return '[deep]';
  if (v instanceof Error) return { name: v.name, message: v.message };
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => scrub(x, depth + 1));
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, REDACT.test(k) ? '[redacted]' : scrub(x, depth + 1)]));
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const min = (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === 'test' ? 'error' : 'info');
  if (order[level] < order[min]) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(scrub(fields) as object) });
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => emit('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit('error', msg, f),
};

export { scrub as _scrubForTest };
