/**
 * Tests for docs.routes.js
 * OpenAPI/Swagger documentation routes
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/swagger.js', () => ({
    swaggerDocument: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } }
}));

import docsRouter from '../../routes/docs.routes.js';

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
});
