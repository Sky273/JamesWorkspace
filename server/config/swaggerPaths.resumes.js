export function createResumeSwaggerPaths({
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
        '/resumes': {
            get: {
                tags: ['Resumes'],
                summary: 'List resumes',
                description: 'Get all resumes for current user firm (admins see all). Supports pagination and search.',
                security,
                parameters: [paramPage, paramLimit, paramSearch, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'sortBy', in: 'query', schema: { type: 'string' } }, { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } }],
                responses: { 200: { description: 'Paginated resume list' }, 401: auth401 }
            }
        },
        '/resumes/{id}': {
            get: {
                tags: ['Resumes'],
                summary: 'Get resume by ID',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'Resume details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Resume' } } } }, 401: auth401, 404: notFound404 }
            },
            put: {
                tags: ['Resumes'],
                summary: 'Update resume',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Resume updated' }, 401: auth401, 404: notFound404 }
            },
            delete: {
                tags: ['Resumes'],
                summary: 'Delete resume',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Resume deleted' }, 401: auth401, 404: notFound404 }
            }
        },
        '/resumes/{id}/download': {
            get: {
                tags: ['Resumes'],
                summary: 'Download original resume file',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'File download', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }, 401: auth401, 404: notFound404 }
            }
        },
        '/resumes/upload': {
            post: {
                tags: ['Resumes'],
                summary: 'Upload resume file',
                description: 'Upload a PDF or DOCX resume file',
                security: securityCsrf,
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, candidateName: { type: 'string' }, candidateEmail: { type: 'string' }, candidatePhone: { type: 'string' } } } } } },
                responses: { 201: { description: 'Resume uploaded' }, 400: { description: 'Invalid file' }, 401: auth401 }
            }
        },
        '/resumes/extract-doc': {
            post: {
                tags: ['Resumes'],
                summary: 'Extract text from DOCX',
                security: securityCsrf,
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
                responses: { 200: { description: 'Extracted text' }, 401: auth401 }
            }
        },
        '/resumes/extract-pdf': {
            post: {
                tags: ['Resumes'],
                summary: 'Extract text from PDF',
                security: securityCsrf,
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
                responses: { 200: { description: 'Extracted text' }, 401: auth401 }
            }
        },
        '/resumes/{id}/ai-modify': {
            post: {
                tags: ['Resumes'],
                summary: 'AI-modify resume content',
                description: 'Apply AI modifications based on user instructions',
                security: securityCsrf,
                parameters: [paramId],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content', 'instructions'], properties: { content: { type: 'string' }, instructions: { type: 'string' } } } } } },
                responses: { 200: { description: 'Modified content' }, 401: auth401, 404: notFound404 }
            }
        },
        '/resumes/stats': {
            get: {
                tags: ['Resumes'],
                summary: 'Get resume statistics',
                security,
                responses: { 200: { description: 'Stats (counts, averages, etc.)' }, 401: auth401 }
            }
        },
        '/resumes/grouped-by-deal': {
            get: {
                tags: ['Resumes'],
                summary: 'Get resumes grouped by deal',
                security,
                parameters: [paramSearch],
                responses: { 200: { description: 'Resumes grouped by deal' }, 401: auth401 }
            }
        },
        '/resumes/{id}/versions': {
            get: {
                tags: ['Resume Versions'],
                summary: 'List resume versions',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'Array of versions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ResumeVersion' } } } } }, 401: auth401, 404: notFound404 }
            }
        },
        '/resumes/{id}/versions/{versionNumber}': {
            get: {
                tags: ['Resume Versions'],
                summary: 'Get specific version',
                security,
                parameters: [paramId, { name: 'versionNumber', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Version details' }, 401: auth401, 404: notFound404 }
            }
        },
        '/resumes/{id}/versions/{versionNumber}/restore': {
            post: {
                tags: ['Resume Versions'],
                summary: 'Restore version',
                security: securityCsrf,
                parameters: [paramId, { name: 'versionNumber', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Version restored' }, 401: auth401, 404: notFound404 }
            }
        },
        '/templates': {
            get: {
                tags: ['Templates'],
                summary: 'List templates',
                description: 'Get paginated templates with optional search/filter',
                security,
                parameters: [paramPage, paramLimit, paramSearch],
                responses: { 200: { description: 'Paginated template list' }, 401: auth401 }
            },
            post: {
                tags: ['Templates'],
                summary: 'Create template (admin)',
                security: securityCsrf,
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, header_content: { type: 'string' }, template_content: { type: 'string' }, footer_content: { type: 'string' }, stylesheet: { type: 'string' } } } } } },
                responses: { 201: { description: 'Template created' }, 401: auth401, 403: forbidden403 }
            }
        },
        '/templates/{id}': {
            get: {
                tags: ['Templates'],
                summary: 'Get template by ID',
                security,
                parameters: [paramId],
                responses: { 200: { description: 'Template details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Template' } } } }, 401: auth401, 404: notFound404 }
            },
            put: {
                tags: ['Templates'],
                summary: 'Update template (admin)',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Template updated' }, 401: auth401, 403: forbidden403, 404: notFound404 }
            },
            delete: {
                tags: ['Templates'],
                summary: 'Delete template (admin)',
                security: securityCsrf,
                parameters: [paramId],
                responses: { 200: { description: 'Template deleted' }, 401: auth401, 403: forbidden403 }
            }
        }
    };
}
