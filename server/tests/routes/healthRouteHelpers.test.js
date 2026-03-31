import { describe, it, expect } from 'vitest';

import {
    buildCacheCheck,
    buildDatabaseCheck,
    buildHealthResponsePayload,
    buildMemoryCheck,
    buildMemoryDiagnosticsPayload,
    buildOcrCheck,
    buildPublicHealthResponse,
    buildServerCheck,
    getCacheBackendSummary,
    getCacheDiagnosticSummary,
    getConfiguredCheck,
    getFailedConnectivityCheck,
    getHealthStatusCode,
    getInitialHealthChecks,
    getNotConfiguredCheck,
    updateOverallStatus
} from '../../routes/healthRouteHelpers.js';

describe('healthRouteHelpers', () => {
    it('summarizes cache backends and diagnostics', () => {
        const registry = {
            settings: { effectiveBackend: 'redis', connected: true, disabledReason: null },
            templates: { effectiveBackend: 'redis', connected: true, disabledReason: null }
        };

        expect(getCacheBackendSummary(registry)).toBe('redis');
        expect(getCacheDiagnosticSummary(registry)).toEqual({
            backend: 'redis',
            connected: true,
            fallbackReason: null
        });
    });

    it('creates initial checks and status codes', () => {
        const checks = getInitialHealthChecks();
        expect(checks.database.status).toBe('unknown');
        expect(getHealthStatusCode('healthy')).toBe(200);
        expect(getHealthStatusCode('degraded')).toBe(200);
        expect(getHealthStatusCode('unhealthy')).toBe(503);
    });

    it('builds server, memory, and database checks', () => {
        expect(buildServerCheck(125)).toEqual({
            status: 'ok',
            uptime: '2 minutes',
            uptimeSeconds: 125
        });

        const memoryCheck = buildMemoryCheck({
            heapUsed: 130 * 1024 * 1024,
            heapTotal: 200 * 1024 * 1024,
            rss: 250 * 1024 * 1024
        });
        expect(memoryCheck.status).toBe('warning');
        expect(memoryCheck.heapUsed).toBe('130 MB');

        expect(buildDatabaseCheck(800, {
            db_size: `${50 * 1024 * 1024}`,
            resumes_count: '12',
            users_count: '3',
            missions_count: '4'
        })).toEqual({
            status: 'ok',
            message: 'PostgreSQL connected',
            latency: '800ms',
            size: '50 MB',
            tables: {
                resumes: 12,
                users: 3,
                missions: 4
            }
        });
    });

    it('updates overall status conservatively', () => {
        expect(updateOverallStatus('healthy', 'warning')).toBe('degraded');
        expect(updateOverallStatus('healthy', 'slow')).toBe('degraded');
        expect(updateOverallStatus('healthy', 'critical')).toBe('unhealthy');
        expect(updateOverallStatus('degraded', 'ok')).toBe('degraded');
    });

    it('builds cache and OCR payloads', () => {
        expect(buildCacheCheck({
            cacheDiagnostics: { backend: 'redis', connected: true, fallbackReason: null },
            settingsCacheSize: 1,
            templatesCacheSize: 2,
            firmsCacheSize: 3,
            cacheRegistry: { settings: { connected: true } }
        })).toMatchObject({
            status: 'ok',
            backend: 'redis',
            settings: 1,
            templates: 2,
            firms: 3
        });

        expect(buildOcrCheck(
            {
                status: 'ok',
                preferredEngine: 'tesseract-cli',
                tesseractCliAvailable: true,
                pdftoppmAvailable: true,
                pythonCommand: 'python3',
                advancedBackend: 'paddleocr',
                advancedBackendAvailable: true,
                notes: 'OCR ready'
            },
            {
                sofficeAvailable: true,
                wordOcrFallbackAvailable: true,
                notes: 'Word OCR ready'
            }
        )).toMatchObject({
            status: 'ok',
            preferredEngine: 'tesseract-cli',
            sofficeAvailable: true,
            message: 'OCR ready | Word OCR ready'
        });
    });

    it('builds public/admin health payloads and connectivity statuses', () => {
        const adminPayload = buildHealthResponsePayload({
            overallStatus: 'healthy',
            responseTime: 42,
            checks: { server: { status: 'ok' } },
            environment: 'test',
            version: '1.2.3'
        });
        expect(adminPayload.status).toBe('healthy');
        expect(adminPayload.responseTime).toBe('42ms');
        expect(adminPayload.environment).toBe('test');

        const publicPayload = buildPublicHealthResponse({
            overallStatus: 'degraded',
            responseTime: 99
        });
        expect(publicPayload.status).toBe('degraded');
        expect(publicPayload.responseTime).toBe('99ms');

        expect(getConfiguredCheck()).toEqual({
            status: 'configured',
            message: 'API key present (use ?deep=true for connectivity test)'
        });
        expect(getNotConfiguredCheck()).toEqual({
            status: 'not_configured',
            message: 'API key missing'
        });
        expect(getFailedConnectivityCheck(new Error('Timeout'))).toEqual({
            status: 'error',
            message: 'Connection timeout'
        });
    });

    it('builds memory diagnostics payload', () => {
        const payload = buildMemoryDiagnosticsPayload({
            memoryUsage: {
                heapUsed: 100 * 1024 * 1024,
                heapTotal: 200 * 1024 * 1024,
                rss: 300 * 1024 * 1024,
                external: 10 * 1024 * 1024,
                arrayBuffers: 5 * 1024 * 1024
            },
            cacheStats: {
                simpleCache: { settings: 1, templates: 2, firms: 3 },
                trends: { size: 4 },
                facts: { size: 5 },
                metiers: { size: 6 },
                esco: { size: 7 },
                tags: {},
                security: { blacklistedTokens: 2, blacklistedUsers: 3 }
            }
        });

        expect(payload.process.heapUsed).toBe('100 MB');
        expect(payload.summary.totalCacheEntries).toBe(28);
        expect(payload.caches.security.estimated).toBe('1 KB');
    });
});
