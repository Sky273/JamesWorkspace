import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import { registerSwaggerRoutes } from '../../config/routeRegistry/swaggerRoutes.js';

function createTestApp() {
    const app = express();
    registerSwaggerRoutes(app);
    return app;
}

describe('Swagger/OpenAPI routes', () => {
    it('serves the generated OpenAPI JSON document without caching', async () => {
        const app = createTestApp();

        const response = await request(app).get('/api/docs');

        expect(response.status).toBe(200);
        expect(response.type).toBe('application/json');
        expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
        expect(response.body.openapi).toBe('3.1.0');
        expect(response.body.paths['/auth/login'].post).toBeDefined();
    });

    it('serves a local Swagger UI shell without CDN dependencies or inline scripts', async () => {
        const app = createTestApp();

        const response = await request(app).get('/api/docs/ui');

        expect(response.status).toBe(200);
        expect(response.type).toBe('text/html');
        expect(response.text).toContain('/api/docs/assets/swagger-ui.css');
        expect(response.text).toContain('/api/docs/assets/swagger-ui-bundle.js');
        expect(response.text).toContain('/api/docs/assets/swagger-initializer.js');
        expect(response.text).not.toContain('unpkg.com');
        expect(response.text).not.toContain('<script>');
    });

    it('serves Swagger UI assets from the local package', async () => {
        const app = createTestApp();

        const response = await request(app).get('/api/docs/assets/swagger-initializer.js');

        expect(response.status).toBe(200);
        expect(response.type).toContain('javascript');
        expect(response.text).toContain("url: '/api/docs'");
        expect(response.text).toContain("request.credentials = 'include'");
    });
});
