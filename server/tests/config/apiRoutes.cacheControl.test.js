import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../routes/health.routes.js', () => ({ default: {} }));
vi.mock('../../routes/metrics.routes.js', () => ({ default: {} }));
vi.mock('../../routes/auth/index.js', () => ({ default: {} }));
vi.mock('../../routes/settings.routes.js', () => ({ default: {} }));
vi.mock('../../routes/missions.routes.js', () => ({ default: {} }));
vi.mock('../../routes/resumes.routes.js', () => ({ default: {} }));
vi.mock('../../routes/templates.routes.js', () => ({ default: {} }));
vi.mock('../../routes/firms.routes.js', () => ({ default: {} }));
vi.mock('../../routes/llm.routes.js', () => ({ default: {} }));
vi.mock('../../routes/admin.routes.js', () => ({ default: {} }));
vi.mock('../../routes/adaptations.routes.js', () => ({ default: {} }));
vi.mock('../../routes/tags.routes.js', () => ({ default: {} }));
vi.mock('../../routes/users.routes.js', () => ({ default: {} }));
vi.mock('../../routes/chatbot.routes.js', () => ({ default: {} }));
vi.mock('../../routes/marketRadar.routes.js', () => ({ default: {} }));
vi.mock('../../routes/rome.routes.js', () => ({ default: {} }));
vi.mock('../../routes/clients.routes.js', () => ({ default: {} }));
vi.mock('../../routes/resumeSubmissions.routes.js', () => ({ default: {} }));
vi.mock('../../routes/mail.routes.js', () => ({ default: {} }));
vi.mock('../../routes/emailTemplates.routes.js', () => ({ default: {} }));
vi.mock('../../routes/consent.routes.js', () => ({ default: {} }));
vi.mock('../../routes/gdprMail.routes.js', () => ({ default: {} }));
vi.mock('../../routes/twofa.routes.js', () => ({ default: {} }));
vi.mock('../../routes/gdprAudit.routes.js', () => ({ default: {} }));
vi.mock('../../routes/share.routes.js', () => ({ default: {} }));
vi.mock('../../routes/pipeline.routes.js', () => ({ default: {} }));
vi.mock('../../routes/calendar.routes.js', () => ({ default: {} }));
vi.mock('../../routes/backup.routes.js', () => ({ default: {} }));
vi.mock('../../routes/batchExport.routes.js', () => ({ default: {} }));
vi.mock('../../routes/batchJobs.routes.js', () => ({ default: {} }));
vi.mock('../../routes/deals.routes.js', () => ({ default: {} }));

import { registerCacheControl } from '../../config/routeRegistry/apiRoutes.js';

function createTestApp() {
    const app = express();
    registerCacheControl(app);
    app.get('/api/test', (_req, res) => {
        res.json({ ok: true });
    });
    app.post('/api/test', (_req, res) => {
        res.status(204).end();
    });
    return app;
}

describe('registerCacheControl', () => {
    it('uses revalidation headers for safe API reads', async () => {
        const app = createTestApp();

        const res = await request(app).get('/api/test');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('private, no-cache, max-age=0, must-revalidate');
        expect(res.headers['pragma']).toBe('no-cache');
        expect(res.headers['expires']).toBe('0');
        expect(res.headers['surrogate-control']).toBeUndefined();
    });

    it('keeps no-store headers for API mutations', async () => {
        const app = createTestApp();

        const res = await request(app).post('/api/test');

        expect(res.status).toBe(204);
        expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
        expect(res.headers['pragma']).toBe('no-cache');
        expect(res.headers['expires']).toBe('0');
        expect(res.headers['surrogate-control']).toBe('no-store');
    });
});
