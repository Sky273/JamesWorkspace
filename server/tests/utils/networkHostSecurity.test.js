import { describe, expect, it } from 'vitest';

import { assertSafeOutboundHost, assertTrustedInternalServiceUrl, isPrivateOrReservedIp } from '../../utils/networkHostSecurity.js';

describe('networkHostSecurity', () => {
    it('detects private and loopback IP ranges', () => {
        expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
        expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
        expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
        expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    });

    it('rejects localhost names', async () => {
        await expect(assertSafeOutboundHost('localhost')).rejects.toThrow('Private or loopback hosts are not allowed');
    });

    it('rejects domains resolving to private addresses', async () => {
        await expect(assertSafeOutboundHost('internal.example', {
            resolver: async () => [{ address: '10.0.0.7' }]
        })).rejects.toThrow('Remote host resolves to a private or loopback address');
    });

    it('allows public domains', async () => {
        await expect(assertSafeOutboundHost('public.example', {
            resolver: async () => [{ address: '8.8.8.8' }]
        })).resolves.toBe(true);
    });

    it('allows internal service urls that resolve to loopback or private addresses', async () => {
        await expect(assertTrustedInternalServiceUrl('http://pdf-server:3002', {
            resolver: async () => [{ address: '10.0.0.42' }]
        })).resolves.toBe(true);
    });

    it('rejects public internal service urls', async () => {
        await expect(assertTrustedInternalServiceUrl('https://example.com', {
            resolver: async () => [{ address: '8.8.8.8' }]
        })).rejects.toThrow('private or loopback address');
    });
});
