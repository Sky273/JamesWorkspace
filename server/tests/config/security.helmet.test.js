import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/constants.js', () => ({
    ALLOWED_ORIGINS: ['https://resumeconverter.net']
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { configureHelmet } from '../../config/security.js';

function createTestApp() {
    const app = express();
    configureHelmet(app);
    app.get('/test', (_req, res) => {
        res.json({ ok: true });
    });
    return app;
}

describe('configureHelmet', () => {
    it('includes a per-response script nonce and the legacy Cloudflare hashes in CSP', async () => {
        const app = createTestApp();

        const res = await request(app).get('/test');

        expect(res.status).toBe(200);
        expect(res.headers['content-security-policy']).toContain("script-src 'self'");
        expect(res.headers['content-security-policy']).toMatch(/'nonce-[A-Za-z0-9+/]+=*'/);
        expect(res.headers['content-security-policy']).not.toContain("script-src-elem");
        expect(res.headers['content-security-policy']).toContain("'sha256-oR7U6/Q03fkV/ymCI4KGJsn1/qEg14weQX35BoNd6/8='");
        expect(res.headers['content-security-policy']).toContain("'sha256-FID3c60H9c7lktAfbhJ+B/txDAbRaj0JQWM8iPEiRXk='");
        expect(res.headers['content-security-policy']).toContain("'sha256-nileZXtiIiKtSt6FJjdZt1szHltIjlRss/RxLHOpD0U='");
        expect(res.headers['content-security-policy']).toContain("'sha256-9/iGFMNY/CbhlXfMrWEY3i4mlcr9rSmQhnjr6XrXZ+Y='");
        expect(res.headers['content-security-policy']).toContain("'sha256-UFeEB6QOsP3dj5nAthz/Vj+mBX8YsHKuWsej2r/bdtQ='");
        expect(res.headers['content-security-policy']).toContain("'sha256-qaj05s9NhZOXkIoIZ+kerlMPfSrHx/V6d1npNfWzDPg='");
        expect(res.headers['content-security-policy']).toContain("'sha256-rhg1WTVNH6IH7t21vpjRMtoTx/6b+Ehu0Ah6+2f5srg='");
        expect(res.headers['content-security-policy']).toContain("'sha256-xdWZbq58NNjYTvyvH8NKkmmavhR878q1602rldMTf1k='");
    });

    it('generates a distinct CSP script nonce per response', async () => {
        const app = createTestApp();

        const first = await request(app).get('/test');
        const second = await request(app).get('/test');

        const noncePattern = /'nonce-([^']+)'/;
        const firstNonce = first.headers['content-security-policy'].match(noncePattern)?.[1];
        const secondNonce = second.headers['content-security-policy'].match(noncePattern)?.[1];

        expect(firstNonce).toBeTruthy();
        expect(secondNonce).toBeTruthy();
        expect(firstNonce).not.toBe(secondNonce);
    });
});
