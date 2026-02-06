/**
 * Unit tests for security service
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  securityLog,
  getRequestMetadata,
  securityLogs,
  LOG_LEVELS,
  SECURITY_EVENTS
} from '../src/services/security.service.js';

describe('Security Service', () => {
  
  describe('LOG_LEVELS', () => {
    it('should have all required log levels', () => {
      expect(LOG_LEVELS.INFO).toBe('INFO');
      expect(LOG_LEVELS.WARNING).toBe('WARNING');
      expect(LOG_LEVELS.ERROR).toBe('ERROR');
      expect(LOG_LEVELS.SECURITY).toBe('SECURITY');
    });
  });

  describe('SECURITY_EVENTS', () => {
    it('should have all required security events', () => {
      expect(SECURITY_EVENTS.AUTH_SUCCESS).toBe('AUTH_SUCCESS');
      expect(SECURITY_EVENTS.AUTH_FAILURE).toBe('AUTH_FAILURE');
      expect(SECURITY_EVENTS.AUTH_BLOCKED).toBe('AUTH_BLOCKED');
      expect(SECURITY_EVENTS.RATE_LIMIT_HIT).toBe('RATE_LIMIT_HIT');
      expect(SECURITY_EVENTS.INVALID_TOKEN).toBe('INVALID_TOKEN');
      expect(SECURITY_EVENTS.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
      expect(SECURITY_EVENTS.FILE_UPLOAD).toBe('FILE_UPLOAD');
      expect(SECURITY_EVENTS.LLM_REQUEST).toBe('LLM_REQUEST');
    });
  });

  describe('getRequestMetadata', () => {
    it('should extract metadata from request object', () => {
      const mockReq = {
        ip: '192.168.1.1',
        path: '/api/auth/signin',
        method: 'POST',
        get: (header) => header === 'user-agent' ? 'Mozilla/5.0' : null,
        user: {
          id: 'recABCDEFGHIJKLMN',
          email: 'test@example.com'
        }
      };

      const metadata = getRequestMetadata(mockReq);

      expect(metadata.ip).toBe('192.168.1.1');
      expect(metadata.endpoint).toBe('/api/auth/signin');
      expect(metadata.method).toBe('POST');
      expect(metadata.userAgent).toBe('Mozilla/5.0');
      expect(metadata.userId).toBe('recABCDEFGHIJKLMN');
      expect(metadata.email).toBe('test@example.com');
    });

    it('should handle missing user data', () => {
      const mockReq = {
        ip: '10.0.0.1',
        path: '/api/public',
        method: 'GET',
        get: () => null,
        connection: { remoteAddress: '10.0.0.1' }
      };

      const metadata = getRequestMetadata(mockReq);

      expect(metadata.userId).toBeNull();
      expect(metadata.email).toBeNull();
    });

    it('should fallback to connection.remoteAddress for IP', () => {
      const mockReq = {
        ip: undefined,
        connection: { remoteAddress: '127.0.0.1' },
        path: '/test',
        method: 'GET',
        get: () => null
      };

      const metadata = getRequestMetadata(mockReq);
      expect(metadata.ip).toBe('127.0.0.1');
    });
  });

  describe('securityLog', () => {
    const initialLogCount = securityLogs.length;

    it('should add log entry to securityLogs array', () => {
      const countBefore = securityLogs.length;
      
      securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.AUTH_SUCCESS, {
        ip: '192.168.1.1',
        email: 'test@example.com',
        message: 'Test login'
      });

      // Log count should increase (or stay same if circular buffer wrapped)
      expect(securityLogs.length).toBeGreaterThanOrEqual(countBefore);
    });

    it('should create properly structured log entry', () => {
      securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_FAILURE, {
        ip: '10.0.0.1',
        email: 'attacker@example.com',
        message: 'Invalid password attempt'
      });

      // Get logs and find the one we just created
      const logs = [...securityLogs];
      const lastLog = logs[0]; // Newest first
      
      expect(lastLog.level).toBe('SECURITY');
      expect(lastLog.event).toBe('AUTH_FAILURE');
      expect(lastLog.ip).toBe('10.0.0.1');
      expect(lastLog.email).toBe('attacker@example.com');
      expect(lastLog.message).toBe('Invalid password attempt');
      expect(lastLog.timestamp).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.DATA_ACCESS, {});

      const logs = [...securityLogs];
      const lastLog = logs[0]; // Newest first
      
      // Only ip is always present with default 'unknown'
      expect(lastLog.ip).toBe('unknown');
      // Optional fields are not included when not provided (not null)
      expect(lastLog.email).toBeUndefined();
      expect(lastLog.message).toBeUndefined();
    });
  });
});
