export function createDeliverySwaggerPaths({
    auth401,
    notFound404,
    security,
    securityCsrf,
    paramId,
    paramMissionId,
    paramPage,
    paramLimit,
    paramSearch
}) {
    return {
        '/missions': {
            get: {
                tags: ['Missions'],
                summary: 'List missions',
                security,
                parameters: [paramPage, paramLimit, paramSearch, { name: 'status', in: 'query', schema: { type: 'string' } }],
                responses: { 200: { description: 'Paginated mission list' }, 401: auth401 }
            },
            post: {
                tags: ['Missions'],
                summary: 'Create mission',
                security: securityCsrf,
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, content: { type: 'string' }, client_id: { type: 'string', format: 'uuid' }, contact_id: { type: 'string', format: 'uuid' } } } } } },
                responses: { 201: { description: 'Mission created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Mission' } } } }, 401: auth401 }
            }
        },
        '/missions/grouped-by-deal': {
            get: {
                tags: ['Missions'],
                summary: 'Get missions grouped by deal',
                security,
                responses: { 200: { description: 'Missions grouped by deal' }, 401: auth401 }
            }
        },
        '/missions/{id}': {
            get: {
                tags: ['Missions'],
                summary: 'Get mission by ID',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'Mission details' }, 401: auth401, 404: notFound404 }
            },
            put: {
                tags: ['Missions'],
                summary: 'Update mission',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Mission updated' }, 401: auth401, 404: notFound404 }
            },
            delete: {
                tags: ['Missions'],
                summary: 'Delete mission',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Mission deleted' }, 401: auth401 }
            }
        },
        '/missions/{missionId}/adaptations': {
            get: {
                tags: ['Missions'],
                summary: 'Get adaptations for mission',
                security,
                parameters: [paramMissionId],
                responses: { 200: { description: 'Array of adaptations' }, 401: auth401 }
            }
        },
        '/missions/{missionId}/keywords-cache': {
            delete: {
                tags: ['Missions'],
                summary: 'Clear mission keywords cache',
                security: securityCsrf,
                parameters: [paramMissionId],
                responses: { 200: { description: 'Cache cleared' }, 401: auth401 }
            }
        },
        '/adaptations': {
            get: {
                tags: ['Adaptations'],
                summary: 'List adaptations',
                description: 'Get all adaptations with optional filters',
                security,
                parameters: [{ name: 'resumeId', in: 'query', schema: { type: 'string' } }, { name: 'missionId', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }],
                responses: { 200: { description: 'Array of adaptations' }, 401: auth401 }
            }
        },
        '/adaptations/grouped-by-deal': {
            get: {
                tags: ['Adaptations'],
                summary: 'Get adaptations grouped by deal',
                security,
                responses: { 200: { description: 'Adaptations grouped by deal' }, 401: auth401 }
            }
        },
        '/adaptations/{id}': {
            get: {
                tags: ['Adaptations'],
                summary: 'Get adaptation by ID',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'Adaptation details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Adaptation' } } } }, 401: auth401, 404: notFound404 }
            },
            put: {
                tags: ['Adaptations'],
                summary: 'Update adaptation',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Adaptation updated' }, 401: auth401, 404: notFound404 }
            },
            delete: {
                tags: ['Adaptations'],
                summary: 'Delete adaptation',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Adaptation deleted' }, 401: auth401 }
            }
        },
        '/clients': {
            get: {
                tags: ['Clients'],
                summary: 'List clients/prospects',
                security,
                parameters: [paramSearch, { name: 'type', in: 'query', schema: { type: 'string', enum: ['client', 'prospect'] } }],
                responses: { 200: { description: 'Array of clients', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Client' } } } } }, 401: auth401 }
            },
            post: {
                tags: ['Clients'],
                summary: 'Create client/prospect',
                security: securityCsrf,
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, type: { type: 'string', enum: ['client', 'prospect'] }, industry: { type: 'string' }, website: { type: 'string' }, address: { type: 'string' } } } } } },
                responses: { 201: { description: 'Client created' }, 401: auth401 }
            }
        },
        '/clients/industries/list': {
            get: {
                tags: ['Clients'],
                summary: 'List industries',
                security,
                responses: { 200: { description: 'Array of industry names' }, 401: auth401 }
            }
        },
        '/clients/{id}': {
            get: {
                tags: ['Clients'],
                summary: 'Get client by ID',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'Client details' }, 401: auth401, 404: notFound404 }
            },
            put: {
                tags: ['Clients'],
                summary: 'Update client',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Client updated' }, 401: auth401, 404: notFound404 }
            },
            delete: {
                tags: ['Clients'],
                summary: 'Delete client',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Client deleted' }, 401: auth401 }
            }
        },
        '/clients/{clientId}/contacts': {
            get: {
                tags: ['Clients'],
                summary: 'List contacts for client',
                security,
                parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Array of contacts', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ClientContact' } } } } }, 401: auth401 }
            },
            post: {
                tags: ['Clients'],
                summary: 'Create contact for client',
                security: securityCsrf,
                parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, role: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, is_primary: { type: 'boolean' } } } } } },
                responses: { 201: { description: 'Contact created' }, 401: auth401 }
            }
        },
        '/clients/{clientId}/contacts/{id}': {
            put: {
                tags: ['Clients'],
                summary: 'Update contact',
                security: securityCsrf,
                parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, paramId],
                responses: { 200: { description: 'Contact updated' }, 401: auth401, 404: notFound404 }
            },
            delete: {
                tags: ['Clients'],
                summary: 'Delete contact',
                security: securityCsrf,
                parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, paramId],
                responses: { 200: { description: 'Contact deleted' }, 401: auth401 }
            }
        }
    };
}
