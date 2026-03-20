/**
 * Tests for PDF Server Logger
 * Tests log levels, formatting, and output routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { log, LOG_LEVELS } = require('../../lib/logger.cjs');

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('LOG_LEVELS', () => {
    it('should define correct numeric levels', () => {
      expect(LOG_LEVELS.error).toBe(0);
      expect(LOG_LEVELS.warn).toBe(1);
      expect(LOG_LEVELS.info).toBe(2);
      expect(LOG_LEVELS.debug).toBe(3);
    });
  });

  describe('log()', () => {
    it('should route error messages to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      log('error', 'test error');
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain('test error');
      expect(spy.mock.calls[0][0]).toContain('[ERROR]');
    });

    it('should suppress warn messages when LOG_LEVEL is error', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      log('warn', 'test warning');
      expect(spy).not.toHaveBeenCalled();
    });

    it('should include timestamp in YYYY-MM-DD HH:MM:SS format', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      log('error', 'timestamp check');
      expect(spy.mock.calls[0][0]).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('should include [pdf-server] prefix', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      log('error', 'prefix check');
      expect(spy.mock.calls[0][0]).toContain('[pdf-server]');
    });

    it('should serialize object data as JSON', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      log('error', 'with data', { key: 'value' });
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('with data'),
        expect.stringContaining('"key":"value"')
      );
    });

    it('should pass string data directly', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      log('error', 'with string', 'extra info');
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('with string'),
        'extra info'
      );
    });

    it('should suppress debug messages when LOG_LEVEL is error', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      log('debug', 'should be suppressed');
      expect(spy).not.toHaveBeenCalled();
    });

    it('should suppress info messages when LOG_LEVEL is error', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      log('info', 'should be suppressed');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
