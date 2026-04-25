import { describe, expect, it } from 'vitest';

import {
    buildOpenApiDocument,
    openApiDocument,
    openApiRouteCatalog
} from '../../config/openapi.js';

describe('OpenAPI document', () => {
    it('builds a current OpenAPI 3.1 document from the route catalog', () => {
        const document = buildOpenApiDocument(openApiRouteCatalog);

        expect(document.openapi).toBe('3.1.0');
        expect(document.info.title).toBe('ResumeConverter API');
        expect(document.info.version).toBe('1.9.2');
        expect(document.servers).toEqual([{ url: '/api', description: 'Same-origin API root' }]);
        expect(document.paths['/auth/login'].post.tags).toEqual(['Authentication']);
        expect(document.paths['/resumes'].get.tags).toEqual(['Resumes']);
        expect(document.paths['/settings'].get.tags).toEqual(['Settings']);
        expect(document.paths['/docs'].get.tags).toEqual(['Documentation']);
        expect(document.paths['/docs/ui'].get.tags).toEqual(['Documentation']);
    });

    it('marks unsafe methods with cookie and CSRF security requirements', () => {
        const login = openApiDocument.paths['/auth/login'].post;
        const updateSettings = openApiDocument.paths['/settings/{id}'].put;

        expect(login.security).toEqual([{ csrfToken: [] }]);
        expect(updateSettings.security).toEqual([{ cookieAuth: [], csrfToken: [] }]);
    });

    it('defines reusable auth and error components', () => {
        expect(openApiDocument.components.securitySchemes.cookieAuth).toEqual(expect.objectContaining({
            type: 'apiKey',
            in: 'cookie',
            name: 'accessToken'
        }));
        expect(openApiDocument.components.securitySchemes.csrfToken).toEqual(expect.objectContaining({
            type: 'apiKey',
            in: 'header',
            name: 'x-csrf-token'
        }));
        expect(openApiDocument.components.responses.Unauthorized.description).toBe('Authentication is required or expired');
        expect(openApiDocument.components.schemas.Error.required).toContain('error');
    });

    it('exposes reusable domain schemas and references them from request bodies', () => {
        expect(Object.keys(openApiDocument.components.schemas).length).toBeGreaterThanOrEqual(30);
        expect(openApiDocument.components.schemas.SignInRequest.properties.email.format).toBe('email');
        expect(openApiDocument.components.schemas.UpdateSettingsRequest.properties.llmProvider.enum).toContain('openai');
        expect(openApiDocument.components.schemas.CreateClientRequest.properties.type.enum).toContain('prospect');
        expect(openApiDocument.components.schemas.BatchImproveRequest.properties.resumeIds.items.format).toBe('uuid');

        expect(openApiDocument.paths['/auth/login'].post.requestBody.content['application/json'].schema)
            .toEqual({ $ref: '#/components/schemas/SignInRequest' });
        expect(openApiDocument.paths['/settings'].post.requestBody.content['application/json'].schema)
            .toEqual({ $ref: '#/components/schemas/UpdateSettingsRequest' });
        expect(openApiDocument.paths['/clients'].post.requestBody.content['application/json'].schema)
            .toEqual({ $ref: '#/components/schemas/CreateClientRequest' });
        expect(openApiDocument.paths['/batch-jobs/improve'].post.requestBody.content['application/json'].schema)
            .toEqual({ $ref: '#/components/schemas/BatchImproveRequest' });
    });
});
