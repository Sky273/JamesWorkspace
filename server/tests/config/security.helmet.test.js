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
    it('includes the current Cloudflare inline script hashes in CSP', async () => {
        const app = createTestApp();

        const res = await request(app).get('/test');

        expect(res.status).toBe(200);
        expect(res.headers['content-security-policy']).toContain("script-src 'self'");
        expect(res.headers['content-security-policy']).toContain("script-src-elem 'self'");
        expect(res.headers['content-security-policy']).toContain("'sha256-oR7U6/Q03fkV/ymCI4KGJsn1/qEg14weQX35BoNd6/8='");
        expect(res.headers['content-security-policy']).toContain("'sha256-FID3c60H9c7lktAfbhJ+B/txDAbRaj0JQWM8iPEiRXk='");
        expect(res.headers['content-security-policy']).toContain("'sha256-nileZXtiIiKtSt6FJjdZt1szHltIjlRss/RxLHOpD0U='");
    });
});
