import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

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

import resumesRouter from '../../routes/resumes/index.js';

describe('Resumes aggregate router', () => {
    it('routes comments through the resumes domain router', async () => {
        const app = express();
        app.use('/api/resumes', resumesRouter);

        const res = await request(app).get('/api/resumes/resume-1/comments');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ source: 'comments' });
    });
});
