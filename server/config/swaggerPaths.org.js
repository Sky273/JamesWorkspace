export function createOrgSwaggerPaths({
    auth401,
    forbidden403,
    notFound404,
    security,
    securityCsrf,
    paramId,
    paramPage,
    paramLimit,
    paramSearch
}) {
    return {
        '/users': {
            get: {
                tags: ['Users'],
                summary: 'List all users (admin)',
                description: 'Get paginated list of all users with firm info',
                security,
                parameters: [paramPage, paramLimit, paramSearch],
                responses: { 200: { description: 'Paginated user list' }, 401: auth401, 403: forbidden403 }
            }
        },
        '/users/{id}': {
            put: {
                tags: ['Users'],
                summary: 'Update user profile',
                description: 'Users can update their own profile; admins can update any user',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'User updated' }, 401: auth401, 404: notFound404 }
            }
        },
        '/firms': {
            get: {
                tags: ['Firms'],
                summary: 'List all firms',
                security,
                responses: { 200: { description: 'Array of firms', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Firm' } } } } }, 401: auth401 }
            },
            post: {
                tags: ['Firms'],
                summary: 'Create firm (admin)',
                security: securityCsrf,
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive'] } } } } } },
                responses: { 201: { description: 'Firm created' }, 401: auth401, 403: forbidden403 }
            }
        },
        '/firms/{id}': {
            get: {
                tags: ['Firms'],
                summary: 'Get firm by ID',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'Firm details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Firm' } } } }, 401: auth401, 404: notFound404 }
            },
            put: {
                tags: ['Firms'],
                summary: 'Update firm (admin)',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Firm updated' }, 401: auth401, 403: forbidden403, 404: notFound404 }
            },
            delete: {
                tags: ['Firms'],
                summary: 'Delete firm (admin)',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Firm deleted' }, 401: auth401, 403: forbidden403 }
            }
        },
        '/firms/{id}/logo': {
            post: {
                tags: ['Firms'],
                summary: 'Upload firm logo',
                security: securityCsrf,
                parameters: [paramId],
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { logo: { type: 'string', format: 'binary' } } } } } },
                responses: { 200: { description: 'Logo uploaded' }, 401: auth401 }
            },
            delete: {
                tags: ['Firms'],
                summary: 'Delete firm logo',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Logo deleted' }, 401: auth401 }
            }
        },
        '/firms/{id}/logo/image': {
            get: {
                tags: ['Firms'],
                summary: 'Get firm logo image',
                parameters: [paramId],
                responses: { 200: { description: 'Logo image', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } }, 404: notFound404 }
            }
        }
    };
}
