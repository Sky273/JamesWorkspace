import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { passthroughRouterFactory } = vi.hoisted(() => ({
    passthroughRouterFactory: () => {
        const router = express.Router();
        router.use((_req, res) => res.status(501).json({ error: 'not-under-test' }));
        return router;
    }
}));

vi.mock('../../routes/health.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/metrics.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/auth/index.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/settings.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/missions.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/templates.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/firms.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/llm.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/admin.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/adaptations.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/tags.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/users.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/chatbot.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/marketRadar.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/rome.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/clients.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/deals.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/resumeSubmissions.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/mail.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/emailTemplates.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/consent.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/gdprMail.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/gdprAudit.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/twofa.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/share.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/pipeline.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/calendar.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/backup.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/batchExport.routes.js', () => ({ default: passthroughRouterFactory() }));
vi.mock('../../routes/batchJobs.routes.js', () => ({ default: passthroughRouterFactory() }));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (_req, _res, next) => next()
}));

vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: () => (_req, _res, next) => next()
}));

vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (_req, _res, next) => next(),
    validateParams: () => (_req, _res, next) => next(),
    aiModifySchema: {}
}));

vi.mock('../../routes/resumes/crud.routes.js', () => {
    const router = express.Router();
    router.get('/:id', (_req, res) => res.status(200).json({ source: 'crud' }));
    return { default: router };
});

vi.mock('../../routes/resumes/upload.routes.js', () => {
    const router = express.Router();
    router.post('/extract-doc', (_req, res) => res.status(200).json({ source: 'upload' }));
    return { default: router };
});

vi.mock('../../routes/resumes/stats.routes.js', () => {
    const router = express.Router();
    router.get('/stats', (_req, res) => res.status(200).json({ source: 'stats' }));
    return { default: router };
});

vi.mock('../../routes/resumes/versions.routes.js', () => {
    const router = express.Router();
    router.get('/:id/versions', (_req, res) => res.status(200).json({ source: 'versions' }));
    return { default: router };
});

vi.mock('../../routes/resumes/aiModify.handler.js', () => ({
    aiModifyHandler: (_req, res) => res.status(200).json({ source: 'ai-modify' })
}));

vi.mock('../../routes/resumeComments.routes.js', () => {
    const router = express.Router();
    router.get('/:resumeId/comments', (_req, res) => res.status(200).json({ source: 'comments' }));
    return { default: router };
});

import { registerApiRoutes } from '../../config/routeRegistry/apiRoutes.js';

describe('API routes resumes smoke', () => {
    it('mounts stats and comments through a single /api/resumes domain registration', async () => {
        const app = express();
        registerApiRoutes(app);

        const statsRes = await request(app).get('/api/resumes/stats');
        const commentsRes = await request(app).get('/api/resumes/resume-1/comments');

        expect(statsRes.status).toBe(200);
        expect(statsRes.body).toEqual({ source: 'stats' });
        expect(commentsRes.status).toBe(200);
        expect(commentsRes.body).toEqual({ source: 'comments' });
    });
});
