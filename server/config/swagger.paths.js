/**
 * Swagger Paths Configuration
 * All API endpoints documentation
 */

export const swaggerPaths = {
    // ============================================
    // AUTHENTICATION
    // ============================================
    '/auth/signin': {
        post: {
            tags: ['Authentication'],
            summary: 'Sign in user',
            requestBody: {
                required: true,
                content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
            },
            responses: {
                200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                401: { $ref: '#/components/responses/Unauthorized' },
                400: { $ref: '#/components/responses/ValidationError' }
            }
        }
    },
    '/auth/signout': {
        post: {
            tags: ['Authentication'],
            summary: 'Sign out user',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Logout successful' } }
        }
    },
    '/auth/register': {
        post: {
            tags: ['Authentication'],
            summary: 'Register new user',
            requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 }, name: { type: 'string' } } } } }
            },
            responses: { 201: { description: 'User created' }, 400: { $ref: '#/components/responses/ValidationError' }, 409: { description: 'Email already exists' } }
        }
    },
    '/auth/refresh': {
        post: {
            tags: ['Authentication'],
            summary: 'Refresh access token',
            responses: { 200: { description: 'Token refreshed' }, 401: { $ref: '#/components/responses/Unauthorized' } }
        }
    },
    '/auth/me': {
        get: {
            tags: ['Authentication'],
            summary: 'Get current user',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Current user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } }, 401: { $ref: '#/components/responses/Unauthorized' } }
        }
    },

    // ============================================
    // USERS
    // ============================================
    '/users': {
        get: {
            tags: ['Users', 'Admin'],
            summary: 'Get all users (admin only)',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'List of users', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },
    '/users/{id}': {
        get: {
            tags: ['Users'],
            summary: 'Get user by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'User data', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Users', 'Admin'],
            summary: 'Update user (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'User updated' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },

    // ============================================
    // FIRMS
    // ============================================
    '/firms': {
        get: {
            tags: ['Firms'],
            summary: 'Get all firms',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
                { name: 'search', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'List of firms', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } }
        },
        post: {
            tags: ['Firms', 'Admin'],
            summary: 'Create firm (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Firm' } } } },
            responses: { 201: { description: 'Firm created' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },
    '/firms/{id}': {
        get: {
            tags: ['Firms'],
            summary: 'Get firm by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Firm data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Firm' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Firms', 'Admin'],
            summary: 'Update firm (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Firm updated' }, 403: { $ref: '#/components/responses/Forbidden' } }
        },
        delete: {
            tags: ['Firms', 'Admin'],
            summary: 'Delete firm (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Firm deleted' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },

    // ============================================
    // RESUMES
    // ============================================
    '/resumes': {
        get: {
            tags: ['Resumes'],
            summary: 'Get all resumes',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'status', in: 'query', schema: { type: 'string' } },
                { name: 'search', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'List of resumes', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } }
        }
    },
    '/resumes/upload': {
        post: {
            tags: ['Resumes'],
            summary: 'Upload a new resume',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
            responses: { 201: { description: 'Resume uploaded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Resume' } } } } }
        }
    },
    '/resumes/stats': {
        get: {
            tags: ['Resumes'],
            summary: 'Get resume statistics',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Resume statistics', content: { 'application/json': { schema: { type: 'object', properties: { total: { type: 'integer' }, analyzed: { type: 'integer' }, improved: { type: 'integer' }, averageScore: { type: 'number' } } } } } } }
        }
    },
    '/resumes/{id}': {
        get: {
            tags: ['Resumes'],
            summary: 'Get resume by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Resume data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Resume' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Resumes'],
            summary: 'Update resume',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Resume updated' }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        delete: {
            tags: ['Resumes'],
            summary: 'Delete resume',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Resume deleted' }, 404: { $ref: '#/components/responses/NotFound' } }
        }
    },
    '/resumes/{id}/download': {
        get: {
            tags: ['Resumes'],
            summary: 'Download original CV file',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'File download', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        }
    },
    '/resumes/{id}/analyze': {
        post: {
            tags: ['Resumes'],
            summary: 'Analyze resume with AI',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Analysis results' }, 400: { description: 'Resume has no text' } }
        }
    },
    '/resumes/{id}/improve': {
        post: {
            tags: ['Resumes'],
            summary: 'Improve resume with AI',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Improved resume' }, 404: { $ref: '#/components/responses/NotFound' } }
        }
    },
    '/resumes/{id}/match': {
        post: {
            tags: ['Resumes'],
            summary: 'Match resume with mission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['missionId'], properties: { missionId: { type: 'string', format: 'uuid' } } } } } },
            responses: { 200: { description: 'Match analysis' } }
        }
    },
    '/resumes/{id}/adapt': {
        post: {
            tags: ['Resumes'],
            summary: 'Adapt resume for mission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['missionId'], properties: { missionId: { type: 'string', format: 'uuid' } } } } } },
            responses: { 200: { description: 'Adaptation created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Adaptation' } } } } }
        }
    },

    // ============================================
    // RESUME VERSIONS
    // ============================================
    '/resumes/{id}/versions': {
        get: {
            tags: ['Resume Versions'],
            summary: 'Get all versions of a resume',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'List of versions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ResumeVersion' } } } } } }
        },
        post: {
            tags: ['Resume Versions'],
            summary: 'Create a new version',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { change_reason: { type: 'string' } } } } } },
            responses: { 201: { description: 'Version created' } }
        }
    },
    '/resumes/{id}/versions/{versionNumber}': {
        get: {
            tags: ['Resume Versions'],
            summary: 'Get specific version',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                { name: 'versionNumber', in: 'path', required: true, schema: { type: 'integer' } }
            ],
            responses: { 200: { description: 'Version data' }, 404: { $ref: '#/components/responses/NotFound' } }
        }
    },
    '/resumes/{id}/versions/{versionNumber}/restore': {
        post: {
            tags: ['Resume Versions'],
            summary: 'Restore a previous version',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                { name: 'versionNumber', in: 'path', required: true, schema: { type: 'integer' } }
            ],
            responses: { 200: { description: 'Version restored' } }
        }
    },

    // ============================================
    // TEMPLATES
    // ============================================
    '/templates': {
        get: {
            tags: ['Templates'],
            summary: 'Get all templates',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'List of templates', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Template' } } } } } }
        },
        post: {
            tags: ['Templates', 'Admin'],
            summary: 'Create template (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Template' } } } },
            responses: { 201: { description: 'Template created' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },
    '/templates/{id}': {
        get: {
            tags: ['Templates'],
            summary: 'Get template by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Template data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Template' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Templates', 'Admin'],
            summary: 'Update template (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Template updated' }, 403: { $ref: '#/components/responses/Forbidden' } }
        },
        delete: {
            tags: ['Templates', 'Admin'],
            summary: 'Delete template (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Template deleted' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },

    // ============================================
    // MISSIONS
    // ============================================
    '/missions': {
        get: {
            tags: ['Missions'],
            summary: 'Get all missions',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer' } },
                { name: 'limit', in: 'query', schema: { type: 'integer' } },
                { name: 'status', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'List of missions', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } }
        },
        post: {
            tags: ['Missions'],
            summary: 'Create mission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Mission' } } } },
            responses: { 201: { description: 'Mission created' } }
        }
    },
    '/missions/{id}': {
        get: {
            tags: ['Missions'],
            summary: 'Get mission by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Mission data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Mission' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Missions'],
            summary: 'Update mission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Mission updated' }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        delete: {
            tags: ['Missions'],
            summary: 'Delete mission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Mission deleted' }, 404: { $ref: '#/components/responses/NotFound' } }
        }
    },
    '/missions/{id}/find-profiles': {
        post: {
            tags: ['Missions'],
            summary: 'Find matching profiles for a mission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Matching profiles' } }
        }
    },

    // ============================================
    // ADAPTATIONS
    // ============================================
    '/adaptations': {
        get: {
            tags: ['Adaptations'],
            summary: 'Get all adaptations',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'resumeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'missionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'page', in: 'query', schema: { type: 'integer' } },
                { name: 'limit', in: 'query', schema: { type: 'integer' } }
            ],
            responses: { 200: { description: 'List of adaptations', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } }
        }
    },
    '/adaptations/create': {
        post: {
            tags: ['Adaptations'],
            summary: 'Create adaptation',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['resumeId', 'missionId'], properties: { resumeId: { type: 'string', format: 'uuid' }, missionId: { type: 'string', format: 'uuid' } } } } } },
            responses: { 201: { description: 'Adaptation created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Adaptation' } } } } }
        }
    },
    '/adaptations/{id}': {
        get: {
            tags: ['Adaptations'],
            summary: 'Get adaptation by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Adaptation data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Adaptation' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Adaptations'],
            summary: 'Update adaptation',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Adaptation updated' } }
        },
        delete: {
            tags: ['Adaptations'],
            summary: 'Delete adaptation',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Adaptation deleted' } }
        }
    },

    // ============================================
    // CLIENTS
    // ============================================
    '/clients': {
        get: {
            tags: ['Clients'],
            summary: 'Get all clients/prospects',
            description: 'Returns clients filtered by firm (non-admins only see their firm\'s clients)',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'type', in: 'query', schema: { type: 'string', enum: ['client', 'prospect'] } }
            ],
            responses: { 200: { description: 'List of clients', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } }
        },
        post: {
            tags: ['Clients'],
            summary: 'Create client/prospect',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
            responses: { 201: { description: 'Client created' } }
        }
    },
    '/clients/stats': {
        get: {
            tags: ['Clients'],
            summary: 'Get client statistics',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Client statistics', content: { 'application/json': { schema: { type: 'object', properties: { totalClients: { type: 'integer' }, totalProspects: { type: 'integer' }, totalContacts: { type: 'integer' }, totalSubmissions: { type: 'integer' } } } } } } }
        }
    },
    '/clients/{id}': {
        get: {
            tags: ['Clients'],
            summary: 'Get client by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Client data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Clients'],
            summary: 'Update client',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Client updated' }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        delete: {
            tags: ['Clients'],
            summary: 'Delete client',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Client deleted' }, 404: { $ref: '#/components/responses/NotFound' } }
        }
    },
    '/clients/{id}/contacts': {
        get: {
            tags: ['Clients'],
            summary: 'Get contacts for a client',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'List of contacts', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ClientContact' } } } } } }
        },
        post: {
            tags: ['Clients'],
            summary: 'Add contact to client',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientContact' } } } },
            responses: { 201: { description: 'Contact created' } }
        }
    },
    '/clients/{clientId}/contacts/{contactId}': {
        put: {
            tags: ['Clients'],
            summary: 'Update contact',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [
                { name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                { name: 'contactId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
            ],
            responses: { 200: { description: 'Contact updated' } }
        },
        delete: {
            tags: ['Clients'],
            summary: 'Delete contact',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [
                { name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                { name: 'contactId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
            ],
            responses: { 200: { description: 'Contact deleted' } }
        }
    },

    // ============================================
    // SUBMISSIONS
    // ============================================
    '/submissions': {
        get: {
            tags: ['Submissions'],
            summary: 'Get all resume submissions',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'clientId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'resumeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'status', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'List of submissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } }
        },
        post: {
            tags: ['Submissions'],
            summary: 'Create submission record',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ResumeSubmission' } } } },
            responses: { 201: { description: 'Submission created' } }
        }
    },
    '/submissions/{id}': {
        get: {
            tags: ['Submissions'],
            summary: 'Get submission by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Submission data', content: { 'application/json': { schema: { $ref: '#/components/schemas/ResumeSubmission' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        },
        put: {
            tags: ['Submissions'],
            summary: 'Update submission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Submission updated' } }
        },
        delete: {
            tags: ['Submissions'],
            summary: 'Delete submission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Submission deleted' } }
        }
    },

    // ============================================
    // MAIL
    // ============================================
    '/mail/status': {
        get: {
            tags: ['Mail'],
            summary: 'Get mail connection status',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Connection status', content: { 'application/json': { schema: { $ref: '#/components/schemas/MailStatus' } } } } }
        }
    },
    '/mail/connect/{provider}': {
        get: {
            tags: ['Mail'],
            summary: 'Initiate OAuth connection',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['gmail', 'outlook'] } }],
            responses: { 302: { description: 'Redirect to OAuth provider' } }
        }
    },
    '/mail/callback/{provider}': {
        get: {
            tags: ['Mail'],
            summary: 'OAuth callback',
            parameters: [
                { name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['gmail', 'outlook'] } },
                { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
            ],
            responses: { 302: { description: 'Redirect to app' } }
        }
    },
    '/mail/disconnect': {
        post: {
            tags: ['Mail'],
            summary: 'Disconnect mail account',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: { 200: { description: 'Disconnected' } }
        }
    },
    '/mail/draft': {
        post: {
            tags: ['Mail'],
            summary: 'Create email draft with CV attachment',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['to', 'subject'],
                            properties: {
                                to: { type: 'string', format: 'email' },
                                subject: { type: 'string' },
                                body: { type: 'string' },
                                pdfBase64: { type: 'string' },
                                pdfFilename: { type: 'string' },
                                resumeId: { type: 'string', format: 'uuid' },
                                clientId: { type: 'string', format: 'uuid' },
                                contactId: { type: 'string', format: 'uuid' }
                            }
                        }
                    }
                }
            },
            responses: { 200: { description: 'Draft created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, draftId: { type: 'string' }, webLink: { type: 'string' } } } } } } }
        }
    },

    // ============================================
    // SETTINGS
    // ============================================
    '/settings': {
        get: {
            tags: ['Settings'],
            summary: 'Get application settings',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Settings data', content: { 'application/json': { schema: { $ref: '#/components/schemas/LLMSettings' } } } } }
        },
        post: {
            tags: ['Settings', 'Admin'],
            summary: 'Create settings (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LLMSettings' } } } },
            responses: { 201: { description: 'Settings created' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },
    '/settings/{id}': {
        put: {
            tags: ['Settings', 'Admin'],
            summary: 'Update settings (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Settings updated' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },

    // ============================================
    // LLM
    // ============================================
    '/llm/openai': {
        post: {
            tags: ['LLM'],
            summary: 'Proxy request to OpenAI',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { messages: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, content: { type: 'string' } } } }, model: { type: 'string' }, temperature: { type: 'number' } } } } } },
            responses: { 200: { description: 'LLM response' }, 429: { description: 'Rate limit exceeded' } }
        }
    },
    '/llm/anthropic': {
        post: {
            tags: ['LLM'],
            summary: 'Proxy request to Anthropic',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: { 200: { description: 'LLM response' }, 429: { description: 'Rate limit exceeded' } }
        }
    },

    // ============================================
    // CHATBOT
    // ============================================
    '/chatbot/message': {
        post: {
            tags: ['Chatbot'],
            summary: 'Send message to AI chatbot',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['message'],
                            properties: {
                                message: { type: 'string' },
                                conversationHistory: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, content: { type: 'string' } } } }
                            }
                        }
                    }
                }
            },
            responses: { 200: { description: 'Chatbot response', content: { 'application/json': { schema: { type: 'object', properties: { response: { type: 'string' }, model: { type: 'string' } } } } } } }
        }
    },

    // ============================================
    // TAGS
    // ============================================
    '/tags/raw': {
        get: {
            tags: ['Tags'],
            summary: 'Get raw tags from all resumes',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Raw tags by category' } }
        }
    },
    '/tags/cleaned': {
        get: {
            tags: ['Tags'],
            summary: 'Get cleaned/normalized tags',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Cleaned tags' } }
        }
    },
    '/tags/esco': {
        get: {
            tags: ['Tags'],
            summary: 'Get ESCO normalized tags',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'ESCO tags' } }
        }
    },
    '/tags/rename': {
        put: {
            tags: ['Tags'],
            summary: 'Rename a tag across all resumes',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['category', 'oldName', 'newName'], properties: { category: { type: 'string' }, oldName: { type: 'string' }, newName: { type: 'string' } } } } } },
            responses: { 200: { description: 'Tag renamed' } }
        }
    },

    // ============================================
    // MARKET RADAR
    // ============================================
    '/market-radar/facts': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get market facts',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer' } },
                { name: 'limit', in: 'query', schema: { type: 'integer' } },
                { name: 'keyword', in: 'query', schema: { type: 'string' } },
                { name: 'location', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'Market facts' } }
        }
    },
    '/market-radar/facts/all': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get all facts (cached)',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'All facts', content: { 'application/json': { schema: { type: 'object', properties: { facts: { type: 'array', items: { $ref: '#/components/schemas/MarketFact' } }, totalCount: { type: 'integer' } } } } } } }
        }
    },
    '/market-radar/trends': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get market trends',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'type', in: 'query', schema: { type: 'string' } },
                { name: 'regionCode', in: 'query', schema: { type: 'string' } },
                { name: 'codeRome', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'Market trends' } }
        }
    },
    '/market-radar/trends/all': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get all trends (cached)',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'All trends', content: { 'application/json': { schema: { type: 'object', properties: { trends: { type: 'array', items: { $ref: '#/components/schemas/MarketTrend' } }, totalCount: { type: 'integer' } } } } } } }
        }
    },
    '/market-radar/collect': {
        post: {
            tags: ['Market Radar', 'Admin'],
            summary: 'Trigger data collection (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: { 200: { description: 'Collection started' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },

    // ============================================
    // ROME
    // ============================================
    '/rome/metiers': {
        get: {
            tags: ['ROME'],
            summary: 'Get stored métiers',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'codeRome', in: 'query', schema: { type: 'string' } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'page', in: 'query', schema: { type: 'integer' } },
                { name: 'pageSize', in: 'query', schema: { type: 'integer' } }
            ],
            responses: { 200: { description: 'List of métiers', content: { 'application/json': { schema: { type: 'object', properties: { metiers: { type: 'array', items: { $ref: '#/components/schemas/RomeMetier' } }, totalCount: { type: 'integer' } } } } } } }
        }
    },
    '/rome/metiers/{codeRome}': {
        get: {
            tags: ['ROME'],
            summary: 'Get métier by ROME code',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Métier details', content: { 'application/json': { schema: { $ref: '#/components/schemas/RomeMetier' } } } }, 404: { $ref: '#/components/responses/NotFound' } }
        }
    },
    '/rome/collect': {
        post: {
            tags: ['ROME', 'Admin'],
            summary: 'Collect métiers from API (admin only)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: { 200: { description: 'Collection results' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },

    // ============================================
    // HEALTH & METRICS
    // ============================================
    '/health': {
        get: {
            tags: ['Health'],
            summary: 'Health check endpoint',
            description: 'Comprehensive health check including database, LLM APIs, memory, and cache status. Use ?deep=true to perform actual connectivity tests to OpenAI and Anthropic APIs.',
            parameters: [
                { 
                    name: 'deep', 
                    in: 'query', 
                    schema: { type: 'string', enum: ['true', 'false'] },
                    description: 'If true, performs actual API connectivity tests to OpenAI and Anthropic (adds latency)'
                }
            ],
            responses: { 
                200: { 
                    description: 'System healthy or degraded', 
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthCheck' } } } 
                }, 
                503: { 
                    description: 'System unhealthy',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthCheck' } } }
                } 
            }
        }
    },
    '/metrics': {
        get: {
            tags: ['Metrics', 'Admin'],
            summary: 'Get all metrics (admin only)',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Metrics data' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },
    '/metrics/summary': {
        get: {
            tags: ['Metrics', 'Admin'],
            summary: 'Get metrics summary (admin only)',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Metrics summary' } }
        }
    },
    '/metrics/database': {
        get: {
            tags: ['Metrics', 'Admin'],
            summary: 'Get database metrics (admin only)',
            description: 'Returns PostgreSQL database statistics including size, table row counts, dead rows, vacuum status, and connection pool stats. Results are cached for 30 seconds.',
            security: [{ cookieAuth: [] }],
            responses: { 
                200: { 
                    description: 'Database metrics',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    database: {
                                        type: 'object',
                                        properties: {
                                            size: { type: 'integer', description: 'Database size in bytes' },
                                            sizePretty: { type: 'string', example: '150 MB' }
                                        }
                                    },
                                    tables: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                name: { type: 'string' },
                                                rowCount: { type: 'integer' },
                                                deadRows: { type: 'integer' },
                                                lastVacuum: { type: 'string', format: 'date-time', nullable: true },
                                                lastAutovacuum: { type: 'string', format: 'date-time', nullable: true }
                                            }
                                        }
                                    },
                                    connections: {
                                        type: 'object',
                                        properties: {
                                            total: { type: 'integer' },
                                            active: { type: 'integer' },
                                            idle: { type: 'integer' }
                                        }
                                    },
                                    queryTime: { type: 'string', example: '15ms' },
                                    cached: { type: 'boolean' },
                                    cacheAge: { type: 'string', example: '10s' }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },

    // ============================================
    // APM (Application Performance Monitoring)
    // ============================================
    '/metrics/apm': {
        get: {
            tags: ['Metrics', 'Admin'],
            summary: 'Get APM statistics (admin only)',
            description: 'Returns Application Performance Monitoring statistics including slow request counts, thresholds, and top slow endpoints.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'APM statistics',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    totalSlowRequests: { type: 'integer', description: 'Total number of slow requests tracked' },
                                    thresholds: {
                                        type: 'object',
                                        properties: {
                                            slow: { type: 'string', example: '1000ms' },
                                            verySlow: { type: 'string', example: '5000ms' },
                                            critical: { type: 'string', example: '30000ms' }
                                        }
                                    },
                                    breakdown: {
                                        type: 'object',
                                        properties: {
                                            slow: { type: 'integer' },
                                            verySlow: { type: 'integer' },
                                            critical: { type: 'integer' }
                                        }
                                    },
                                    topSlowEndpoints: {
                                        type: 'object',
                                        additionalProperties: {
                                            type: 'object',
                                            properties: {
                                                count: { type: 'integer' },
                                                avgDuration: { type: 'integer' },
                                                maxDuration: { type: 'integer' }
                                            }
                                        }
                                    },
                                    recentSlowRequests: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/SlowRequest' }
                                    }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/metrics/apm/slow-requests': {
        get: {
            tags: ['Metrics', 'Admin'],
            summary: 'Get detailed slow requests list (admin only)',
            description: 'Returns a detailed list of slow requests sorted by duration (slowest first).',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Maximum number of requests to return' }
            ],
            responses: {
                200: {
                    description: 'Slow requests list',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    count: { type: 'integer' },
                                    requests: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/SlowRequest' }
                                    }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        },
        delete: {
            tags: ['Metrics', 'Admin'],
            summary: 'Clear slow requests buffer (admin only)',
            description: 'Clears all tracked slow requests from the APM buffer.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: {
                200: { description: 'Buffer cleared successfully' },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },

    // ============================================
    // CSRF TOKEN
    // ============================================
    '/csrf-token': {
        get: {
            tags: ['Authentication'],
            summary: 'Get CSRF token',
            description: 'Returns a CSRF token required for state-changing requests (POST, PUT, DELETE). The token must be included in the x-csrf-token header.',
            responses: {
                200: {
                    description: 'CSRF token',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    csrfToken: { type: 'string', description: 'CSRF token to include in x-csrf-token header' }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

export default swaggerPaths;
