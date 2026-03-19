/**
 * Tests for routes/auth/config.js
 * Cookie configuration constants
 */

import { describe, it, expect } from 'vitest';

import {
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    CLEAR_ACCESS_TOKEN,
    CLEAR_REFRESH_TOKEN
} from '../../routes/auth/config.js';

describe('Auth Cookie Config', () => {
    it('ACCESS_TOKEN_COOKIE should be httpOnly with 1h maxAge', () => {
        expect(ACCESS_TOKEN_COOKIE.httpOnly).toBe(true);
        expect(ACCESS_TOKEN_COOKIE.sameSite).toBe('lax');
        expect(ACCESS_TOKEN_COOKIE.path).toBe('/');
        expect(ACCESS_TOKEN_COOKIE.maxAge).toBe(60 * 60 * 1000);
    });

    it('REFRESH_TOKEN_COOKIE should be httpOnly with 7d maxAge and restricted path', () => {
        expect(REFRESH_TOKEN_COOKIE.httpOnly).toBe(true);
        expect(REFRESH_TOKEN_COOKIE.sameSite).toBe('lax');
        expect(REFRESH_TOKEN_COOKIE.path).toBe('/api/auth');
        expect(REFRESH_TOKEN_COOKIE.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('CLEAR_ACCESS_TOKEN should match ACCESS_TOKEN_COOKIE options (minus maxAge)', () => {
        expect(CLEAR_ACCESS_TOKEN.httpOnly).toBe(true);
        expect(CLEAR_ACCESS_TOKEN.sameSite).toBe('lax');
        expect(CLEAR_ACCESS_TOKEN.path).toBe('/');
        expect(CLEAR_ACCESS_TOKEN.maxAge).toBeUndefined();
    });

    it('CLEAR_REFRESH_TOKEN should match REFRESH_TOKEN_COOKIE options (minus maxAge)', () => {
        expect(CLEAR_REFRESH_TOKEN.httpOnly).toBe(true);
        expect(CLEAR_REFRESH_TOKEN.sameSite).toBe('lax');
        expect(CLEAR_REFRESH_TOKEN.path).toBe('/api/auth');
        expect(CLEAR_REFRESH_TOKEN.maxAge).toBeUndefined();
    });

    it('secure flag should be consistent across set/clear pairs', () => {
        expect(ACCESS_TOKEN_COOKIE.secure).toBe(CLEAR_ACCESS_TOKEN.secure);
        expect(REFRESH_TOKEN_COOKIE.secure).toBe(CLEAR_REFRESH_TOKEN.secure);
    });
});
