import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

const jsonContent = {
    'application/json': {
        schema: { type: 'object' }
    }
};

const noContent = {
    description: 'No content'
};

const okJson = {
    description: 'Successful JSON response',
    content: jsonContent
};

const createdJson = {
    description: 'Resource created',
    content: jsonContent
};

const acceptedJson = {
    description: 'Request accepted for asynchronous processing',
    content: jsonContent
};

const binaryResponse = {
    description: 'Binary file response',
    content: {
        'application/octet-stream': {
            schema: { type: 'string', format: 'binary' }
        }
    }
};

const defaultResponses = {
    400: { $ref: '#/components/responses/ValidationError' },
    401: { $ref: '#/components/responses/Unauthorized' },
    403: { $ref: '#/components/responses/Forbidden' },
    404: { $ref: '#/components/responses/NotFound' },
    429: { $ref: '#/components/responses/RateLimited' },
    500: { $ref: '#/components/responses/InternalError' }
};

const queryParameters = {
    page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Page number'
    },
    limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 250, default: 50 },
        description: 'Items per page'
    },
    search: {
        name: 'search',
        in: 'query',
        schema: { type: 'string' },
        description: 'Search text'
    },
    status: {
        name: 'status',
        in: 'query',
        schema: { type: 'string' },
        description: 'Status filter'
    }
};

function pathParameters(path) {
    return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
        name: match[1],
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: `${match[1]} identifier`
    }));
}

function requestBody(description = 'JSON request payload') {
    return {
        required: true,
        description,
        content: jsonContent
    };
}

function normalizeSecurity(route) {
    if (route.security === 'public') {
        return [];
    }

    if (route.security === 'csrf') {
        return [{ csrfToken: [] }];
    }

    if (route.security === 'cookie') {
        return [{ cookieAuth: [] }];
    }

    if (route.security === 'none') {
        return undefined;
    }

    return [{ cookieAuth: [], csrfToken: [] }];
}

function buildOperation(route) {
    const parameters = [
        ...pathParameters(route.path),
        ...(route.query || []).map((name) => queryParameters[name]).filter(Boolean)
    ];
    const responses = {
        [route.status || 200]: route.response || okJson,
        ...defaultResponses,
        ...(route.responses || {})
    };
    const security = normalizeSecurity(route);
    const operation = {
        tags: [route.tag],
        summary: route.summary,
        description: route.description,
        operationId: route.operationId,
        responses
    };

    if (parameters.length > 0) {
        operation.parameters = parameters;
    }

    if (route.body) {
        operation.requestBody = route.body === true ? requestBody() : route.body;
    }

    if (security !== undefined) {
        operation.security = security;
    }

    return Object.fromEntries(Object.entries(operation).filter(([, value]) => value !== undefined));
}

function route(method, path, tag, summary, options = {}) {
    return {
        method,
        path,
        tag,
        summary,
        operationId: options.operationId || `${method}${path}`.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()),
        ...options
    };
}

export const openApiRouteCatalog = [
    route('get', '/docs', 'Documentation', 'OpenAPI JSON document', { security: 'public' }),
    route('get', '/docs/ui', 'Documentation', 'Interactive Swagger UI', { security: 'public', response: { description: 'HTML documentation shell' } }),

    route('get', '/auth/csrf-token', 'Authentication', 'Issue a CSRF token', { security: 'public' }),
    route('post', '/auth/register', 'Authentication', 'Register a user', { security: 'csrf', body: true, status: 201, response: createdJson }),
    route('post', '/auth/login', 'Authentication', 'Sign in and create a session', { security: 'csrf', body: true }),
    route('post', '/auth/logout', 'Authentication', 'End the current session', { response: noContent, status: 204 }),
    route('post', '/auth/refresh', 'Authentication', 'Rotate the refresh token and renew the session', { security: 'csrf' }),
    route('get', '/auth/me', 'Authentication', 'Return the current authenticated user', { security: 'cookie' }),
    route('post', '/auth/request-password-reset', 'Authentication', 'Request a password reset email', { security: 'csrf', body: true }),
    route('post', '/auth/reset-password', 'Authentication', 'Reset a password with a valid token', { security: 'csrf', body: true }),

    route('get', '/settings', 'Settings', 'Read application settings', { security: 'cookie' }),
    route('get', '/settings/defaults', 'Settings', 'Read default application settings', { security: 'cookie' }),
    route('post', '/settings', 'Settings', 'Create or replace the canonical settings record', { body: true, status: 201, response: createdJson }),
    route('put', '/settings/{id}', 'Settings', 'Update application settings', { body: true }),
    route('post', '/settings/test-llm', 'Settings', 'Test the configured LLM provider', { body: true }),

    route('get', '/resumes', 'Resumes', 'List resumes', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/resumes', 'Resumes', 'Create a resume record', { body: true, status: 201, response: createdJson }),
    route('post', '/resumes/upload', 'Resumes', 'Upload and parse a resume file', { body: { required: true, content: { 'multipart/form-data': { schema: { type: 'object' } } } }, status: 201, response: createdJson }),
    route('get', '/resumes/{id}', 'Resumes', 'Read a resume'),
    route('put', '/resumes/{id}', 'Resumes', 'Update a resume', { body: true }),
    route('delete', '/resumes/{id}', 'Resumes', 'Delete a resume', { response: noContent, status: 204 }),
    route('post', '/resumes/{id}/analyze', 'Resumes', 'Run AI resume analysis', { response: acceptedJson, status: 202 }),
    route('post', '/resumes/{id}/improve', 'Resumes', 'Run AI resume improvement', { body: true, response: acceptedJson, status: 202 }),
    route('get', '/resumes/{id}/versions', 'Resume Versions', 'List resume versions', { security: 'cookie' }),
    route('post', '/resumes/{id}/comments', 'Comments', 'Create a resume comment', { body: true, status: 201, response: createdJson }),

    route('get', '/templates', 'Templates', 'List templates', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/templates', 'Templates', 'Create a template', { body: true, status: 201, response: createdJson }),
    route('get', '/templates/{id}', 'Templates', 'Read a template'),
    route('put', '/templates/{id}', 'Templates', 'Update a template', { body: true }),
    route('delete', '/templates/{id}', 'Templates', 'Delete a template', { response: noContent, status: 204 }),

    route('get', '/missions', 'Missions', 'List missions', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/missions', 'Missions', 'Create a mission', { body: true, status: 201, response: createdJson }),
    route('get', '/missions/{id}', 'Missions', 'Read a mission'),
    route('put', '/missions/{id}', 'Missions', 'Update a mission', { body: true }),
    route('delete', '/missions/{id}', 'Missions', 'Delete a mission', { response: noContent, status: 204 }),

    route('get', '/adaptations', 'Adaptations', 'List adaptations', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/adaptations', 'Adaptations', 'Create a resume adaptation', { body: true, status: 201, response: createdJson }),
    route('get', '/adaptations/{id}', 'Adaptations', 'Read an adaptation'),
    route('put', '/adaptations/{id}', 'Adaptations', 'Update an adaptation', { body: true }),

    route('get', '/clients', 'Clients', 'List clients and prospects', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/clients', 'Clients', 'Create a client or prospect', { body: true, status: 201, response: createdJson }),
    route('get', '/clients/{id}', 'Clients', 'Read a client or prospect'),
    route('put', '/clients/{id}', 'Clients', 'Update a client or prospect', { body: true }),
    route('delete', '/clients/{id}', 'Clients', 'Delete a client or prospect', { response: noContent, status: 204 }),

    route('get', '/deals', 'Deals', 'List deals', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/deals', 'Deals', 'Create a deal', { body: true, status: 201, response: createdJson }),
    route('get', '/deals/{id}', 'Deals', 'Read a deal'),
    route('put', '/deals/{id}', 'Deals', 'Update a deal', { body: true }),
    route('delete', '/deals/{id}', 'Deals', 'Delete a deal', { response: noContent, status: 204 }),

    route('get', '/pipeline', 'Pipeline', 'List pipeline entries', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/pipeline', 'Pipeline', 'Add a candidate to the pipeline', { body: true, status: 201, response: createdJson }),
    route('put', '/pipeline/{id}', 'Pipeline', 'Update a pipeline entry', { body: true }),

    route('get', '/submissions', 'Submissions', 'List resume submissions', { security: 'cookie', query: ['page', 'limit', 'status'] }),
    route('post', '/submissions', 'Submissions', 'Create a resume submission', { body: true, status: 201, response: createdJson }),
    route('post', '/share', 'Share', 'Create a public resume share link', { body: true, status: 201, response: createdJson }),
    route('get', '/share/{token}', 'Share', 'Read a public shared resume', { security: 'public' }),
    route('get', '/consent/{token}', 'Consent', 'Read public consent request', { security: 'public' }),
    route('post', '/consent/{token}', 'Consent', 'Submit public consent response', { security: 'csrf', body: true }),

    route('post', '/chatbot/message', 'Chatbot', 'Send a chatbot message', { body: true }),
    route('post', '/llm/proxy', 'LLM', 'Proxy an LLM request through the configured provider', { body: true }),
    route('get', '/market-radar', 'Market Radar', 'Read market radar data', { security: 'cookie' }),
    route('post', '/market-radar/refresh', 'Market Radar', 'Refresh market radar data', { response: acceptedJson, status: 202 }),
    route('get', '/rome/metiers', 'ROME', 'Search ROME jobs and occupations', { security: 'cookie', query: ['search'] }),

    route('get', '/users', 'Users', 'List users', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/users', 'Users', 'Create a user', { body: true, status: 201, response: createdJson }),
    route('put', '/users/{id}', 'Users', 'Update a user', { body: true }),
    route('get', '/firms', 'Firms', 'List firms', { security: 'cookie', query: ['page', 'limit', 'search', 'status'] }),
    route('post', '/firms', 'Firms', 'Create a firm', { body: true, status: 201, response: createdJson }),
    route('get', '/admin/security-logs', 'Admin', 'List security logs', { security: 'cookie', query: ['page', 'limit'] }),
    route('get', '/metrics', 'Metrics', 'Read operational metrics', { security: 'cookie' }),
    route('get', '/backup/config', 'Backup', 'Read backup configuration', { security: 'cookie' }),
    route('put', '/backup/config', 'Backup', 'Update backup configuration', { body: true }),
    route('post', '/batch-jobs', 'Batch Jobs', 'Create a batch job', { body: true, status: 201, response: createdJson }),
    route('get', '/batch-jobs/{id}', 'Batch Jobs', 'Read a batch job'),
    route('post', '/batch-export', 'Batch Export', 'Create a batch export', { body: true, status: 202, response: acceptedJson }),
    route('get', '/batch-export/{id}/download', 'Batch Export', 'Download a completed batch export', { security: 'cookie', response: binaryResponse }),
    route('get', '/gdpr-audit', 'GDPR Audit', 'List GDPR audit entries', { security: 'cookie', query: ['page', 'limit'] }),
    route('get', '/gdpr/mail/status', 'GDPR Mail', 'Read GDPR mail status', { security: 'cookie' }),
    route('put', '/gdpr/mail/config', 'GDPR Mail', 'Update GDPR mail configuration', { body: true }),
    route('get', '/mail/status', 'Mail', 'Read mail integration status', { security: 'cookie' }),
    route('post', '/calendar/events', 'Calendar', 'Create a calendar event', { body: true, status: 201, response: createdJson }),
    route('get', '/tags', 'Tags', 'List tags', { security: 'cookie' }),
    route('post', '/tags', 'Tags', 'Create a tag', { body: true, status: 201, response: createdJson }),
    route('get', '/email-templates', 'Email Templates', 'List email templates', { security: 'cookie' }),
    route('post', '/email-templates', 'Email Templates', 'Create an email template', { body: true, status: 201, response: createdJson })
];

function buildTags(catalog) {
    return [...new Set(catalog.map((entry) => entry.tag))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name }));
}

function buildPaths(catalog) {
    return catalog.reduce((paths, entry) => {
        paths[entry.path] = {
            ...(paths[entry.path] || {}),
            [entry.method]: buildOperation(entry)
        };
        return paths;
    }, {});
}

export function buildOpenApiDocument(catalog = openApiRouteCatalog) {
    return {
        openapi: '3.1.0',
        info: {
            title: 'ResumeConverter API',
            version: packageJson.version,
            description: 'Operational API surface for ResumeConverter recruiting workflows, AI control plane, GDPR, billing-adjacent credits, and administration.'
        },
        servers: [
            { url: '/api', description: 'Same-origin API root' }
        ],
        tags: buildTags(catalog),
        security: [{ cookieAuth: [] }],
        paths: buildPaths(catalog),
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'accessToken',
                    description: 'HTTP-only access token cookie issued after authentication.'
                },
                csrfToken: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-csrf-token',
                    description: 'CSRF token required for state-changing browser requests.'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    required: ['error'],
                    properties: {
                        error: { type: 'string' },
                        code: { type: 'string' },
                        requestId: { type: 'string' }
                    }
                }
            },
            responses: {
                ValidationError: {
                    description: 'The request payload or parameters are invalid',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                Unauthorized: {
                    description: 'Authentication is required or expired',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                Forbidden: {
                    description: 'The authenticated user is not allowed to perform this action',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                NotFound: {
                    description: 'The requested resource was not found',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                RateLimited: {
                    description: 'Too many requests',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                InternalError: {
                    description: 'Unexpected server error',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                }
            }
        }
    };
}

export const openApiDocument = buildOpenApiDocument();

export default openApiDocument;
