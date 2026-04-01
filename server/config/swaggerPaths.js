/**
 * Swagger/OpenAPI Paths Configuration
 * Complete API endpoint documentation matching current routes
 */
import { createAuthSwaggerPaths } from './swaggerPaths.auth.js';
import { createComplianceSwaggerPaths } from './swaggerPaths.compliance.js';
import { createDeliverySwaggerPaths } from './swaggerPaths.delivery.js';
import { createMarketSwaggerPaths } from './swaggerPaths.market.js';
import { createOpsSwaggerPaths } from './swaggerPaths.ops.js';
import { createOrgSwaggerPaths } from './swaggerPaths.org.js';
import { createResumeSwaggerPaths } from './swaggerPaths.resumes.js';
import { createWorkflowSwaggerPaths } from './swaggerPaths.workflow.js';

// Helper for common responses
const auth401 = { $ref: '#/components/responses/Unauthorized' };
const forbidden403 = { $ref: '#/components/responses/Forbidden' };
const notFound404 = { $ref: '#/components/responses/NotFound' };
const validation400 = { $ref: '#/components/responses/ValidationError' };
const error500 = {
    description: 'Internal server error',
    content: {
        'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
        }
    }
};
const security = [{ cookieAuth: [] }];
const securityCsrf = [{ cookieAuth: [], csrfToken: [] }];

// Common parameter definitions
const paramId = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Resource UUID'
};
const paramResumeId = {
    name: 'resumeId',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Resume UUID'
};
const paramMissionId = {
    name: 'missionId',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Mission UUID'
};
const paramPage = {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', default: 1 },
    description: 'Page number'
};
const paramLimit = {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', default: 50 },
    description: 'Items per page'
};
const paramSearch = {
    name: 'search',
    in: 'query',
    schema: { type: 'string' },
    description: 'Search query'
};

export const swaggerPaths = {
    ...createAuthSwaggerPaths({
        auth401,
        forbidden403,
        notFound404,
        validation400,
        error500,
        security,
        securityCsrf,
        paramId
    }),

    ...createOrgSwaggerPaths({
        auth401,
        forbidden403,
        notFound404,
        security,
        securityCsrf,
        paramId,
        paramPage,
        paramLimit,
        paramSearch
    }),

    ...createResumeSwaggerPaths({
        auth401,
        forbidden403,
        notFound404,
        security,
        securityCsrf,
        paramId,
        paramPage,
        paramLimit,
        paramSearch
    }),

    ...createDeliverySwaggerPaths({
        auth401,
        notFound404,
        security,
        securityCsrf,
        paramId,
        paramMissionId,
        paramPage,
        paramLimit,
        paramSearch
    }),

    ...createComplianceSwaggerPaths({
        auth401,
        forbidden403,
        notFound404,
        security,
        securityCsrf,
        paramId,
        paramResumeId,
        paramPage,
        paramLimit
    }),

    ...createMarketSwaggerPaths({
        auth401,
        forbidden403,
        notFound404,
        security,
        securityCsrf,
        paramId,
        paramPage,
        paramLimit
    }),

    ...createWorkflowSwaggerPaths({
        auth401,
        notFound404,
        security,
        securityCsrf,
        paramId,
        paramResumeId,
        paramMissionId,
        paramPage,
        paramLimit,
        paramSearch
    }),

    ...createOpsSwaggerPaths({
        auth401,
        forbidden403,
        notFound404,
        validation400,
        error500,
        security,
        securityCsrf,
        paramId,
        paramPage,
        paramLimit
    })
};

export default swaggerPaths;
