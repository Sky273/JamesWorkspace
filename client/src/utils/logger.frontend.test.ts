import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  group: console.group,
  groupEnd: console.groupEnd,
  table: console.table,
};

describe('logger.frontend', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.useFakeTimers();
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    console.debug = vi.fn();
    console.group = vi.fn();
    console.groupEnd = vi.fn();
    console.table = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    console.group = originalConsole.group;
    console.groupEnd = originalConsole.groupEnd;
    console.table = originalConsole.table;
  });

  it('redacts sensitive fields in error logs', async () => {
    const { logger } = await import('./logger.frontend');

    logger.error('Auth failure', { password: 'secret', token: 'abc', nested: { csrf: 'x', keep: 'ok' } });

    expect(console.error).toHaveBeenCalledTimes(2);
    const calls = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const payload = calls[1]?.[0];
    expect(payload).toMatchObject({
      password: '[REDACTED]',
      token: '[REDACTED]',
      nested: { csrf: '[REDACTED]', keep: 'ok' },
    });
  });

  it('logs small payloads on the same line', async () => {
    const { logger } = await import('./logger.frontend');

    logger.info('Small payload', { ok: true });

    expect(console.log).toHaveBeenCalledTimes(1);
    expect((console.log as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual({ ok: true });
  });

  it('redacts arrays recursively', async () => {
    const { logger } = await import('./logger.frontend');

    logger.error('Array payload', [{ secret: 'x' }, { keep: 'ok' }]);

    const payload = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload).toEqual([{ secret: '[REDACTED]' }, { keep: 'ok' }]);
  });

  it('rate-limits repeated warn logs', async () => {
    const { logger } = await import('./logger.frontend');

    logger.warn('Repeated warning');
    logger.warn('Repeated warning');
    expect(console.warn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(101);
    logger.warn('Repeated warning');
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('creates module-scoped loggers', async () => {
    const { createLogger } = await import('./logger.frontend');
    const authLogger = createLogger('AuthService');

    authLogger.info('User logged in', { userId: '123' });

    expect(console.log).toHaveBeenCalled();
    const firstArg = (console.log as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(firstArg).toContain('[AuthService]');
  });

  it('enables debug-only helpers when log level is debug', async () => {
    vi.stubEnv('VITE_LOG_LEVEL', 'debug');
    const { logger } = await import('./logger.frontend');

    logger.debug('Verbose');
    logger.group('Group');
    logger.table([{ a: 1 }]);
    logger.groupEnd();

    expect(console.debug).toHaveBeenCalled();
    expect(console.group).toHaveBeenCalledWith('Group');
    expect(console.table).toHaveBeenCalledWith([{ a: 1 }]);
    expect(console.groupEnd).toHaveBeenCalled();
  });
});
