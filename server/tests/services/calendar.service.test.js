/**
 * Tests for Calendar Service
 * Tests connection status, disconnect, table init, and destroy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../config/oauth.config.js', () => ({
    googleAuthConfig: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3001/callback'
    },
    encryptToken: vi.fn((t) => `enc_${t}`),
    decryptToken: vi.fn((t) => t.replace('enc_', '')),
    calculateTokenExpiry: vi.fn(() => new Date(Date.now() + 3600000))
}));

vi.mock('googleapis', () => ({
    google: {
        auth: { OAuth2: vi.fn(() => ({
            generateAuthUrl: vi.fn(() => 'https://accounts.google.com/auth'),
            getToken: vi.fn(() => ({ tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600000 } })),
            setCredentials: vi.fn(),
            on: vi.fn()
        })) },
        calendar: vi.fn(() => ({
            events: {
                insert: vi.fn(() => ({ data: { id: 'evt1', htmlLink: 'http://cal/evt1' } })),
                patch: vi.fn(() => ({ data: { id: 'evt1', htmlLink: 'http://cal/evt1' } })),
                delete: vi.fn(),
                list: vi.fn(() => ({ data: { items: [] } }))
            }
        }))
    }
}));

import { query } from '../../config/database.js';
import {
    isCalendarConnected,
    disconnectCalendar,
    initCalendarTokensTable,
    destroyCalendarService
} from '../../services/calendar.service.js';

describe('Calendar Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isCalendarConnected', () => {
        it('should return true if user has tokens', async () => {
            query.mockResolvedValueOnce({ rows: [{
                access_token_encrypted: 'enc_at',
                refresh_token_encrypted: 'enc_rt',
                token_expiry: new Date()
            }] });

            expect(await isCalendarConnected('u1')).toBe(true);
        });

        it('should return false if no tokens', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await isCalendarConnected('u1')).toBe(false);
        });

        it('should return false on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await isCalendarConnected('u1')).toBe(false);
        });
    });

    describe('disconnectCalendar', () => {
        it('should delete tokens and return true', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            expect(await disconnectCalendar('u1')).toBe(true);
            expect(query.mock.calls[0][0]).toContain('DELETE FROM user_calendar_tokens');
        });

        it('should return false on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await disconnectCalendar('u1')).toBe(false);
        });
    });

    describe('initCalendarTokensTable', () => {
        it('should create table and index', async () => {
            query.mockResolvedValue({ rows: [] });

            expect(await initCalendarTokensTable()).toBe(true);
            expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS user_calendar_tokens');
            expect(query.mock.calls[1][0]).toContain('CREATE INDEX');
        });

        it('should return false on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await initCalendarTokensTable()).toBe(false);
        });
    });

    describe('destroyCalendarService', () => {
        it('should not throw', () => {
            expect(() => destroyCalendarService()).not.toThrow();
        });
    });
});
