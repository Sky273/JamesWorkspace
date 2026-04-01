/**
 * Tests for docs.routes.js
 * OpenAPI/Swagger documentation routes
 */

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../config/swagger.js', () => ({
    swaggerDocument: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } }
}));

import docsRouter from '../../routes/docs.routes.js';

function createTestApp() {
    const app = express();
    app.use('/api/docs', docsRouter);
    return app;
}

describe('Docs Routes', () => {
    it('should export an express router', () => {
        expect(docsRouter).toBeDefined();
        expect(typeof docsRouter).toBe('function');
    });

    it('should have GET / route', () => {
        const routes = docsRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));

        expect(routes.find(r => r.path === '/' && r.methods.includes('get'))).toBeDefined();
    });

    it('should have GET /ui route', () => {
        const routes = docsRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));

        expect(routes.find(r => r.path === '/ui' && r.methods.includes('get'))).toBeDefined();
    });

    it('should return the OpenAPI document on GET /', async () => {
        const app = createTestApp();

        const res = await request(app).get('/api/docs');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } });
    });

    it('should redirect /ui to /api/docs without looping', async () => {
        const app = createTestApp();

        const res = await request(app).get('/api/docs/ui');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/api/docs');
    });
});
