/**
 * Swagger/OpenAPI Paths Configuration
 * Complete API endpoint documentation matching current routes
 */

// Helper for common responses
const auth401 = { $ref: '#/components/responses/Unauthorized' };
const forbidden403 = { $ref: '#/components/responses/Forbidden' };
const notFound404 = { $ref: '#/components/responses/NotFound' };
const validation400 = { $ref: '#/components/responses/ValidationError' };
const error500 = { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
const security = [{ cookieAuth: [] }];
const securityCsrf = [{ cookieAuth: [], csrfToken: [] }];

// Common parameter definitions
const paramId = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Resource UUID' };
const paramResumeId = { name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Resume UUID' };
const paramMissionId = { name: 'missionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Mission UUID' };
const paramPage = { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' };
const paramLimit = { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Items per page' };
const paramSearch = { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search query' };

export const swaggerPaths = {
    // ============================================
    // AUTHENTICATION
    // ============================================
    '/auth/signin': {
        post: {
            tags: ['Authentication'],
            summary: 'Sign in',
            description: 'Authenticate with email and password. Returns JWT tokens in httpOnly cookies.',
            requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
            responses: {
                200: { description: 'Login successful (or requires 2FA)', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                401: { description: 'Invalid credentials' },
                403: { description: 'Account inactive' },
                429: { description: 'Too many login attempts' },
                500: error500
            }
        }
    },
    '/auth/register': {
        post: {
            tags: ['Authentication'],
            summary: 'Register new user',
            description: 'Create a new user account (status: pending until approved by admin)',
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 }, name: { type: 'string' } } } } } },
            responses: {
                201: { description: 'User registered successfully' },
                409: { description: 'Email already exists' },
                429: { description: 'Rate limited' },
                500: error500
            }
        }
    },
    '/auth/refresh': {
        post: {
            tags: ['Authentication'],
            summary: 'Refresh access token',
            description: 'Use refresh token cookie to get a new access token',
            responses: {
                200: { description: 'Token refreshed', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
                401: { description: 'Invalid or expired refresh token' },
                500: error500
            }
        }
    },
    '/auth/logout': {
        post: {
            tags: ['Authentication'],
            summary: 'Sign out',
            description: 'Revoke tokens and clear cookies',
            security,
            responses: {
                200: { description: 'Signed out successfully' },
                500: error500
            }
        }
    },
    '/auth/me': {
        get: {
            tags: ['Authentication'],
            summary: 'Get current user',
            description: 'Get the currently authenticated user profile',
            security,
            responses: {
                200: { description: 'Current user', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
                401: auth401,
                404: notFound404,
                500: error500
            }
        }
    },
    '/auth/google': {
        get: {
            tags: ['Authentication'],
            summary: 'Initiate Google OAuth',
            description: 'Start Google OAuth flow for login or account linking',
            parameters: [
                { name: 'action', in: 'query', schema: { type: 'string', enum: ['login', 'link'] } },
                { name: 'returnUrl', in: 'query', schema: { type: 'string' } }
            ],
            responses: { 302: { description: 'Redirect to Google consent screen' } }
        }
    },
    '/auth/google/callback': {
        get: {
            tags: ['Authentication'],
            summary: 'Google OAuth callback',
            description: 'Handle Google OAuth callback after user consent',
            responses: { 302: { description: 'Redirect to application with auth result' } }
        }
    },
    '/auth/google/status': {
        get: {
            tags: ['Authentication'],
            summary: 'Google link status',
            description: 'Check if current user has a linked Google account',
            security,
            responses: { 200: { description: 'Google link status' }, 401: auth401 }
        }
    },
    '/auth/google/unlink': {
        post: {
            tags: ['Authentication'],
            summary: 'Unlink Google account',
            security: securityCsrf,
            responses: { 200: { description: 'Google account unlinked' }, 401: auth401 }
        }
    },
    '/auth/forgot-password': {
        post: {
            tags: ['Authentication'],
            summary: 'Request password reset',
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
            responses: { 200: { description: 'Reset email sent (always returns 200 for security)' } }
        }
    },
    '/auth/reset-password': {
        post: {
            tags: ['Authentication'],
            summary: 'Reset password with token',
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 6 } } } } } },
            responses: { 200: { description: 'Password reset successful' }, 400: { description: 'Invalid or expired token' } }
        }
    },
    '/auth/users': {
        post: {
            tags: ['Authentication'],
            summary: 'Create user (admin)',
            description: 'Admin creates a new user with specified role and firm',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', enum: ['admin', 'user'] }, firm_id: { type: 'string', format: 'uuid' } } } } } },
            responses: { 201: { description: 'User created' }, 401: auth401, 403: forbidden403, 409: { description: 'Email exists' } }
        }
    },
    '/auth/users/{id}': {
        put: {
            tags: ['Authentication'],
            summary: 'Update user (admin)',
            security: securityCsrf,
            parameters: [paramId],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, status: { type: 'string' }, firm_id: { type: 'string' }, password: { type: 'string' } } } } } },
            responses: { 200: { description: 'User updated' }, 401: auth401, 403: forbidden403, 404: notFound404 }
        },
        delete: {
            tags: ['Authentication'],
            summary: 'Delete user (admin)',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'User deleted' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // 2FA
    // ============================================
    '/2fa/status': {
        get: {
            tags: ['Authentication'],
            summary: 'Get 2FA status',
            security,
            responses: { 200: { description: '2FA status for current user' }, 401: auth401 }
        }
    },
    '/2fa/setup': {
        post: {
            tags: ['Authentication'],
            summary: 'Setup 2FA',
            description: 'Generate TOTP secret and QR code',
            security: securityCsrf,
            responses: { 200: { description: 'TOTP secret and QR code' }, 401: auth401 }
        }
    },
    '/2fa/verify': {
        post: {
            tags: ['Authentication'],
            summary: 'Verify and enable 2FA',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string', minLength: 6 } } } } } },
            responses: { 200: { description: '2FA enabled' }, 400: { description: 'Invalid code' }, 401: auth401 }
        }
    },
    '/2fa/disable': {
        post: {
            tags: ['Authentication'],
            summary: 'Disable 2FA',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } } },
            responses: { 200: { description: '2FA disabled' }, 401: auth401 }
        }
    },
    '/2fa/backup-codes/regenerate': {
        post: {
            tags: ['Authentication'],
            summary: 'Regenerate backup codes',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } } },
            responses: { 200: { description: 'New backup codes' }, 401: auth401 }
        }
    },

    // ============================================
    // USERS
    // ============================================
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

    // ============================================
    // FIRMS
    // ============================================
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
    },

    // ============================================
    // RESUMES
    // ============================================
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
    '/resumes/analyze': {
        post: {
            tags: ['Resumes'],
            summary: 'Analyze resume (deprecated)',
            description: 'Analyze resume text using AI. Prefer /analyze-text.',
            security: securityCsrf,
            responses: { 200: { description: 'Analysis results' }, 401: auth401 }
        }
    },
    '/resumes/analyze-text': {
        post: {
            tags: ['Resumes'],
            summary: 'Analyze resume text',
            description: 'AI-powered analysis: scores, tags, suggestions. Long-running operation.',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } } },
            responses: { 200: { description: 'Analysis with scores and tags' }, 401: auth401, 500: error500 }
        }
    },
    '/resumes/improve': {
        post: {
            tags: ['Resumes'],
            summary: 'Improve resume text',
            description: 'AI-powered resume improvement with re-analysis. Long-running operation.',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, analysis: { type: 'object' } } } } } },
            responses: { 200: { description: 'Improved text and new analysis' }, 401: auth401, 500: error500 }
        }
    },
    '/resumes/{id}/improve': {
        post: {
            tags: ['Resumes'],
            summary: 'Improve specific resume',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Resume improved' }, 401: auth401, 404: notFound404 }
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
    '/resumes/{id}/match': {
        post: {
            tags: ['Resumes'],
            summary: 'Match resume to mission',
            description: 'AI analysis of resume-mission match score',
            security: securityCsrf,
            parameters: [paramId],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['missionId'], properties: { missionId: { type: 'string', format: 'uuid' } } } } } },
            responses: { 200: { description: 'Match analysis' }, 401: auth401, 404: notFound404 }
        }
    },
    '/resumes/{id}/adapt': {
        post: {
            tags: ['Adaptations'],
            summary: 'Create resume adaptation',
            description: 'AI-powered adaptation of resume for a specific mission. Long-running.',
            security: securityCsrf,
            parameters: [paramId],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['missionId'], properties: { missionId: { type: 'string', format: 'uuid' } } } } } },
            responses: { 200: { description: 'Adaptation created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Adaptation' } } } }, 401: auth401 }
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

    // ============================================
    // RESUME VERSIONS
    // ============================================
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

    // ============================================
    // TEMPLATES
    // ============================================
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
    },
    '/templates/extract-from-cv': {
        post: {
            tags: ['Templates'],
            summary: 'Extract template from CV (admin)',
            description: 'AI-powered extraction of template from uploaded DOCX/PDF',
            security: securityCsrf,
            requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
            responses: { 200: { description: 'Extracted template components' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // MISSIONS
    // ============================================
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
    '/missions/{missionId}/find-profiles': {
        post: {
            tags: ['Missions'],
            summary: 'Find matching profiles',
            description: 'AI-powered search for resumes matching a mission',
            security: securityCsrf,
            parameters: [paramMissionId],
            responses: { 200: { description: 'Matching profiles with scores' }, 401: auth401 }
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
    '/missions/{missionId}/analyze-profile/{resumeId}': {
        post: {
            tags: ['Missions'],
            summary: 'Analyze profile for mission',
            security: securityCsrf,
            parameters: [paramMissionId, paramResumeId],
            responses: { 200: { description: 'Profile analysis' }, 401: auth401 }
        }
    },

    // ============================================
    // ADAPTATIONS
    // ============================================
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

    // ============================================
    // CLIENTS
    // ============================================
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
    },

    // ============================================
    // SUBMISSIONS
    // ============================================
    '/submissions': {
        get: {
            tags: ['Submissions'],
            summary: 'List submissions',
            security,
            parameters: [{ name: 'resumeId', in: 'query', schema: { type: 'string' } }, { name: 'clientId', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Array of submissions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ResumeSubmission' } } } } }, 401: auth401 }
        },
        post: {
            tags: ['Submissions'],
            summary: 'Create submission',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['resume_id', 'client_id', 'contact_id'], properties: { resume_id: { type: 'string', format: 'uuid' }, client_id: { type: 'string', format: 'uuid' }, contact_id: { type: 'string', format: 'uuid' }, mission_id: { type: 'string', format: 'uuid' }, notes: { type: 'string' } } } } } },
            responses: { 201: { description: 'Submission created' }, 401: auth401 }
        }
    },
    '/submissions/stats/summary': {
        get: {
            tags: ['Submissions'],
            summary: 'Submission statistics',
            security,
            responses: { 200: { description: 'Summary stats' }, 401: auth401 }
        }
    },
    '/submissions/{id}': {
        get: {
            tags: ['Submissions'],
            summary: 'Get submission by ID',
            security,
            parameters: [paramId],
            responses: { 200: { description: 'Submission details' }, 401: auth401, 404: notFound404 }
        },
        put: {
            tags: ['Submissions'],
            summary: 'Update submission',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Submission updated' }, 401: auth401, 404: notFound404 }
        },
        delete: {
            tags: ['Submissions'],
            summary: 'Delete submission',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Submission deleted' }, 401: auth401 }
        }
    },

    // ============================================
    // MAIL
    // ============================================
    '/mail/status': {
        get: {
            tags: ['Mail'],
            summary: 'Get mail connection status',
            security,
            responses: { 200: { description: 'Connection status', content: { 'application/json': { schema: { $ref: '#/components/schemas/MailStatus' } } } }, 401: auth401 }
        }
    },
    '/mail/auth/gmail': {
        get: {
            tags: ['Mail'],
            summary: 'Initiate Gmail OAuth',
            security,
            responses: { 200: { description: 'OAuth URL' }, 401: auth401 }
        }
    },
    '/mail/callback/gmail': {
        get: {
            tags: ['Mail'],
            summary: 'Gmail OAuth callback',
            responses: { 302: { description: 'Redirect after OAuth' } }
        }
    },
    '/mail/draft': {
        post: {
            tags: ['Mail'],
            summary: 'Create email draft',
            description: 'Create a draft email with optional attachments via Gmail/Outlook',
            security: securityCsrf,
            responses: { 200: { description: 'Draft created' }, 401: auth401 }
        }
    },
    '/mail/disconnect': {
        delete: {
            tags: ['Mail'],
            summary: 'Disconnect mail account',
            security: securityCsrf,
            responses: { 200: { description: 'Disconnected' }, 401: auth401 }
        }
    },

    // ============================================
    // EMAIL TEMPLATES
    // ============================================
    '/email-templates': {
        get: {
            tags: ['Email Templates'],
            summary: 'List email templates',
            security,
            responses: { 200: { description: 'Array of email templates', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/EmailTemplate' } } } } }, 401: auth401 }
        },
        post: {
            tags: ['Email Templates'],
            summary: 'Create email template',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'subject_template', 'mjml_content'], properties: { name: { type: 'string' }, description: { type: 'string' }, subject_template: { type: 'string' }, mjml_content: { type: 'string' } } } } } },
            responses: { 201: { description: 'Template created' }, 401: auth401 }
        }
    },
    '/email-templates/keywords': {
        get: {
            tags: ['Email Templates'],
            summary: 'List available template keywords',
            security,
            responses: { 200: { description: 'Available keywords for template variables' }, 401: auth401 }
        }
    },
    '/email-templates/default': {
        get: {
            tags: ['Email Templates'],
            summary: 'Get default email template',
            security,
            responses: { 200: { description: 'Default template' }, 401: auth401 }
        }
    },
    '/email-templates/compile': {
        post: {
            tags: ['Email Templates'],
            summary: 'Compile MJML to HTML',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mjml_content'], properties: { mjml_content: { type: 'string' } } } } } },
            responses: { 200: { description: 'Compiled HTML' }, 401: auth401 }
        }
    },
    '/email-templates/{id}': {
        get: {
            tags: ['Email Templates'],
            summary: 'Get email template by ID',
            security,
            parameters: [paramId],
            responses: { 200: { description: 'Email template details' }, 401: auth401, 404: notFound404 }
        },
        put: {
            tags: ['Email Templates'],
            summary: 'Update email template',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Template updated' }, 401: auth401, 404: notFound404 }
        },
        delete: {
            tags: ['Email Templates'],
            summary: 'Delete email template',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Template deleted' }, 401: auth401 }
        }
    },
    '/email-templates/{id}/duplicate': {
        post: {
            tags: ['Email Templates'],
            summary: 'Duplicate email template',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 201: { description: 'Template duplicated' }, 401: auth401 }
        }
    },
    '/email-templates/{id}/preview': {
        post: {
            tags: ['Email Templates'],
            summary: 'Preview email template',
            description: 'Render template with sample data',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Rendered preview HTML' }, 401: auth401 }
        }
    },

    // ============================================
    // CONSENT
    // ============================================
    '/consent/initialize': {
        post: {
            tags: ['Consent'],
            summary: 'Initialize GDPR consent',
            security: securityCsrf,
            responses: { 200: { description: 'Consent initialized' }, 401: auth401 }
        }
    },
    '/consent/{resumeId}/send': {
        post: {
            tags: ['Consent'],
            summary: 'Send consent request',
            security: securityCsrf,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Consent email sent' }, 401: auth401 }
        }
    },
    '/consent/{resumeId}/resend': {
        post: {
            tags: ['Consent'],
            summary: 'Resend consent request',
            security: securityCsrf,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Consent email resent' }, 401: auth401 }
        }
    },
    '/consent/{resumeId}/status': {
        get: {
            tags: ['Consent'],
            summary: 'Get consent status',
            security,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Consent status', content: { 'application/json': { schema: { $ref: '#/components/schemas/ConsentStatus' } } } }, 401: auth401 }
        }
    },
    '/consent/run-checks': {
        post: {
            tags: ['Consent'],
            summary: 'Run consent checks (admin)',
            description: 'Batch check for expired consents and send reminders',
            security: securityCsrf,
            responses: { 200: { description: 'Check results' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/consent/respond/{token}': {
        get: {
            tags: ['Consent'],
            summary: 'Get consent form (public)',
            parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Consent form HTML' }, 400: { description: 'Invalid or expired token' } }
        },
        post: {
            tags: ['Consent'],
            summary: 'Submit consent response (public)',
            parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Consent recorded' }, 400: { description: 'Invalid token' } }
        }
    },

    // ============================================
    // GDPR MAIL
    // ============================================
    '/gdpr/mail/status': {
        get: {
            tags: ['GDPR Mail'],
            summary: 'Get GDPR mail status (admin)',
            security,
            responses: { 200: { description: 'GDPR mail connection status' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/gdpr/mail/auth-url': {
        get: {
            tags: ['GDPR Mail'],
            summary: 'Get GDPR Gmail OAuth URL (admin)',
            security,
            responses: { 200: { description: 'OAuth URL' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/gdpr/mail/callback': {
        get: {
            tags: ['GDPR Mail'],
            summary: 'GDPR Gmail OAuth callback',
            responses: { 302: { description: 'Redirect after OAuth' } }
        }
    },
    '/gdpr/mail/disconnect': {
        post: {
            tags: ['GDPR Mail'],
            summary: 'Disconnect GDPR mail (admin)',
            security: securityCsrf,
            responses: { 200: { description: 'Disconnected' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/gdpr/mail/test': {
        post: {
            tags: ['GDPR Mail'],
            summary: 'Send test GDPR email (admin)',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
            responses: { 200: { description: 'Test email sent' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // GDPR AUDIT
    // ============================================
    '/gdpr-audit/logs': {
        get: {
            tags: ['GDPR Audit'],
            summary: 'Get GDPR audit logs (admin)',
            security,
            parameters: [paramPage, paramLimit, { name: 'action', in: 'query', schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'firmId', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Paginated audit logs' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/gdpr-audit/stats': {
        get: {
            tags: ['GDPR Audit'],
            summary: 'Get GDPR audit statistics (admin)',
            security,
            responses: { 200: { description: 'Audit statistics' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/gdpr-audit/firms': {
        get: {
            tags: ['GDPR Audit'],
            summary: 'Get firms for audit filter (admin)',
            security,
            responses: { 200: { description: 'Firms list' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/gdpr-audit/actions': {
        get: {
            tags: ['GDPR Audit'],
            summary: 'Get audit action types (admin)',
            security,
            responses: { 200: { description: 'Action types' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/gdpr-audit/export/{email}': {
        get: {
            tags: ['GDPR Audit'],
            summary: 'Export audit logs for email (admin)',
            security,
            parameters: [{ name: 'email', in: 'path', required: true, schema: { type: 'string', format: 'email' } }],
            responses: { 200: { description: 'Audit data for email' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // LLM
    // ============================================
    '/llm/openai': {
        post: {
            tags: ['LLM'],
            summary: 'OpenAI proxy',
            description: 'Proxy requests to OpenAI API (server-side API key)',
            security: securityCsrf,
            responses: { 200: { description: 'OpenAI response' }, 401: auth401 }
        }
    },
    '/llm/anthropic': {
        post: {
            tags: ['LLM'],
            summary: 'Anthropic proxy',
            description: 'Proxy requests to Anthropic Claude API (server-side API key)',
            security: securityCsrf,
            responses: { 200: { description: 'Anthropic response' }, 401: auth401 }
        }
    },
    '/llm/chat/completions': {
        post: {
            tags: ['LLM'],
            summary: 'OpenAI chat completions (alias)',
            security: securityCsrf,
            responses: { 200: { description: 'Chat completion response' }, 401: auth401 }
        }
    },
    '/llm/messages': {
        post: {
            tags: ['LLM'],
            summary: 'Anthropic messages (alias)',
            security: securityCsrf,
            responses: { 200: { description: 'Messages response' }, 401: auth401 }
        }
    },
    '/llm/circuit-breakers': {
        get: {
            tags: ['LLM'],
            summary: 'Get circuit breaker status (admin)',
            security,
            responses: { 200: { description: 'Circuit breaker states' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // CHATBOT
    // ============================================
    '/chatbot/message': {
        post: {
            tags: ['Chatbot'],
            summary: 'Send chatbot message',
            description: 'Send a message to the AI chatbot assistant',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' }, context: { type: 'object' } } } } } },
            responses: { 200: { description: 'Chatbot response' }, 401: auth401 }
        }
    },
    '/chatbot/status': {
        get: {
            tags: ['Chatbot'],
            summary: 'Get chatbot status',
            security,
            responses: { 200: { description: 'Chatbot availability status' }, 401: auth401 }
        }
    },

    // ============================================
    // SETTINGS
    // ============================================
    '/settings': {
        get: {
            tags: ['Settings'],
            summary: 'Get settings',
            security,
            responses: { 200: { description: 'LLM settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/LLMSettings' } } } }, 401: auth401 }
        },
        post: {
            tags: ['Settings'],
            summary: 'Create settings (admin)',
            security: securityCsrf,
            responses: { 201: { description: 'Settings created' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/settings/{id}': {
        put: {
            tags: ['Settings'],
            summary: 'Update settings (admin)',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Settings updated' }, 401: auth401, 403: forbidden403, 404: notFound404 }
        }
    },

    // ============================================
    // TAGS
    // ============================================
    '/tags': {
        get: {
            tags: ['Tags'],
            summary: 'Get all raw tags',
            security,
            responses: { 200: { description: 'Aggregated tags from resumes' }, 401: auth401 }
        }
    },
    '/tags/cleaned': {
        get: {
            tags: ['Tags'],
            summary: 'Get cleaned tags',
            security,
            responses: { 200: { description: 'Cleaned/normalized tags' }, 401: auth401 }
        }
    },
    '/tags/cleaned/recalculate': {
        post: {
            tags: ['Tags'],
            summary: 'Recalculate cleaned tags',
            description: 'Batch recalculate cleaned tags for all resumes',
            security: securityCsrf,
            responses: { 200: { description: 'Recalculation results' }, 401: auth401 }
        }
    },
    '/tags/esco': {
        get: {
            tags: ['Tags'],
            summary: 'Get ESCO normalized tags',
            security,
            responses: { 200: { description: 'ESCO normalized tags' }, 401: auth401 }
        }
    },
    '/tags/esco/recalculate': {
        post: {
            tags: ['Tags'],
            summary: 'Recalculate ESCO tags',
            security: securityCsrf,
            requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { language: { type: 'string', default: 'fr' } } } } } },
            responses: { 200: { description: 'Recalculation results' }, 401: auth401 }
        }
    },
    '/tags/rename': {
        put: {
            tags: ['Tags'],
            summary: 'Rename tag across all resumes',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['category', 'oldName', 'newName'], properties: { category: { type: 'string', enum: ['skills', 'industries', 'tools', 'softSkills'] }, oldName: { type: 'string' }, newName: { type: 'string' } } } } } },
            responses: { 200: { description: 'Tag renamed' }, 401: auth401 }
        }
    },

    // ============================================
    // MARKET RADAR - Collection
    // ============================================
    '/market-radar/collect': {
        post: {
            tags: ['Market Radar'],
            summary: 'Run full data collection (admin)',
            description: 'Collect data from all sources (France Travail + Adzuna). Heavy operation.',
            security: securityCsrf,
            responses: { 200: { description: 'Collection results' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/market-radar/collect/{source}': {
        post: {
            tags: ['Market Radar'],
            summary: 'Collect from specific source (admin)',
            security: securityCsrf,
            parameters: [{ name: 'source', in: 'path', required: true, schema: { type: 'string', enum: ['france_travail', 'adzuna'] } }],
            responses: { 200: { description: 'Collection results' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // MARKET RADAR - Search
    // ============================================
    '/market-radar/search/france-travail': {
        get: {
            tags: ['Market Radar'],
            summary: 'Search France Travail API',
            security,
            parameters: [{ name: 'motsCles', in: 'query', schema: { type: 'string' } }, { name: 'codeROME', in: 'query', schema: { type: 'string' } }, { name: 'departement', in: 'query', schema: { type: 'string' } }, { name: 'region', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'France Travail search results' }, 401: auth401 }
        }
    },
    '/market-radar/search/adzuna': {
        get: {
            tags: ['Market Radar'],
            summary: 'Search Adzuna API',
            security,
            parameters: [{ name: 'what', in: 'query', schema: { type: 'string' } }, { name: 'where', in: 'query', schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Adzuna search results' }, 401: auth401 }
        }
    },
    '/market-radar/salary-histogram': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get salary histogram (Adzuna)',
            security,
            parameters: [{ name: 'what', in: 'query', schema: { type: 'string' } }, { name: 'where', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Salary distribution data' }, 401: auth401 }
        }
    },
    '/market-radar/top-companies': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get top hiring companies (Adzuna)',
            security,
            parameters: [{ name: 'what', in: 'query', schema: { type: 'string' } }, { name: 'where', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Top companies list' }, 401: auth401 }
        }
    },

    // ============================================
    // MARKET RADAR - Facts
    // ============================================
    '/market-radar/facts': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get market facts (paginated)',
            security,
            parameters: [{ name: 'startDate', in: 'query', schema: { type: 'string' } }, { name: 'endDate', in: 'query', schema: { type: 'string' } }, { name: 'source', in: 'query', schema: { type: 'string' } }, { name: 'keyword', in: 'query', schema: { type: 'string' } }, paramPage, paramLimit],
            responses: { 200: { description: 'Paginated market facts' }, 401: auth401 }
        }
    },
    '/market-radar/facts/all': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get all facts (cached)',
            security,
            responses: { 200: { description: 'All market facts' }, 401: auth401 }
        }
    },
    '/market-radar/facts/filters': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get facts filter options',
            security,
            responses: { 200: { description: 'Filter options' }, 401: auth401 }
        }
    },
    '/market-radar/facts/summary': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get facts summary',
            security,
            responses: { 200: { description: 'Aggregated summary' }, 401: auth401 }
        }
    },
    '/market-radar/facts/cache/refresh': {
        post: {
            tags: ['Market Radar'],
            summary: 'Refresh facts cache (admin)',
            security: securityCsrf,
            responses: { 200: { description: 'Cache refreshed' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/market-radar/latest/{type}': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get latest facts by type',
            security,
            parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string' } }, { name: 'source', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Latest facts' }, 401: auth401 }
        }
    },
    '/market-radar/trend/{keyword}': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get trend for keyword',
            security,
            parameters: [{ name: 'keyword', in: 'path', required: true, schema: { type: 'string' } }, { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }],
            responses: { 200: { description: 'Trend data' }, 401: auth401 }
        }
    },
    '/market-radar/regional': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get regional comparison',
            security,
            parameters: [{ name: 'date', in: 'query', schema: { type: 'string' } }, { name: 'source', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Regional comparison data' }, 401: auth401 }
        }
    },

    // ============================================
    // MARKET RADAR - Reference
    // ============================================
    '/market-radar/referentiel/{type}': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get reference data (France Travail)',
            security,
            parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string' }, description: 'Reference type (metiers, appellations, domaines...)' }],
            responses: { 200: { description: 'Reference data' }, 401: auth401 }
        }
    },
    '/market-radar/categories': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get job categories (Adzuna)',
            security,
            responses: { 200: { description: 'Job categories' }, 401: auth401 }
        }
    },
    '/market-radar/config': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get radar configuration',
            security,
            responses: { 200: { description: 'Config with ROME codes, regions, keywords' }, 401: auth401 }
        }
    },

    // ============================================
    // MARKET RADAR - Trends
    // ============================================
    '/market-radar/trends': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get market trends (paginated)',
            security,
            parameters: [{ name: 'type', in: 'query', schema: { type: 'string' } }, { name: 'codeRome', in: 'query', schema: { type: 'string' } }, { name: 'regionCode', in: 'query', schema: { type: 'string' } }, paramPage, paramLimit],
            responses: { 200: { description: 'Market trends data' }, 401: auth401 }
        }
    },
    '/market-radar/trends/all': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get all trends (for map)',
            security,
            parameters: [{ name: 'type', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'All trends grouped by type' }, 401: auth401 }
        }
    },
    '/market-radar/trends/summary': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get trends summary',
            security,
            responses: { 200: { description: 'Aggregated trends summary' }, 401: auth401 }
        }
    },
    '/market-radar/trends/filters': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get trend filter options',
            security,
            responses: { 200: { description: 'Available types, regions, ROME codes' }, 401: auth401 }
        }
    },
    '/market-radar/trends/{id}/metadata': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get trend metadata',
            security,
            parameters: [paramId],
            responses: { 200: { description: 'Trend metadata' }, 401: auth401, 404: notFound404 }
        }
    },
    '/market-radar/trends/collect': {
        post: {
            tags: ['Market Radar'],
            summary: 'Collect trends (admin)',
            description: 'Trigger market trends collection (background task)',
            security: securityCsrf,
            responses: { 200: { description: 'Collection started' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/market-radar/trends/collect-dynamics': {
        post: {
            tags: ['Market Radar'],
            summary: 'Collect employment dynamics (admin)',
            security: securityCsrf,
            responses: { 200: { description: 'Collection started' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/market-radar/trends/cache/refresh': {
        post: {
            tags: ['Market Radar'],
            summary: 'Refresh trends cache (admin)',
            security: securityCsrf,
            responses: { 200: { description: 'Cache refreshed' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/market-radar/trends/verify/{type}/{regionCode}/{codeRome}': {
        get: {
            tags: ['Market Radar'],
            summary: 'Verify trend data (admin)',
            description: 'Compare stored data with live API response',
            security,
            parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string' } }, { name: 'regionCode', in: 'path', required: true, schema: { type: 'string' } }, { name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Verification result' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/market-radar/trends/audit': {
        get: {
            tags: ['Market Radar'],
            summary: 'Get trends audit report (admin)',
            security,
            responses: { 200: { description: 'Freshness report' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // ROME
    // ============================================
    '/rome/metiers': {
        get: {
            tags: ['ROME'],
            summary: 'Get ROME métiers',
            description: 'Search and list ROME 4.0 job classifications',
            security,
            parameters: [{ name: 'codeRome', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }, paramPage, paramLimit],
            responses: { 200: { description: 'Array of métiers', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RomeMetier' } } } } }, 401: auth401 }
        }
    },
    '/rome/metiers/stats': {
        get: {
            tags: ['ROME'],
            summary: 'Get ROME statistics',
            security,
            responses: { 200: { description: 'ROME collection stats' }, 401: auth401 }
        }
    },
    '/rome/metiers/{codeRome}': {
        get: {
            tags: ['ROME'],
            summary: 'Get métier by ROME code',
            security,
            parameters: [{ name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Métier details' }, 401: auth401, 404: notFound404 }
        }
    },
    '/rome/api/grands-domaines': {
        get: { tags: ['ROME'], summary: 'Get grands domaines (live API)', security, responses: { 200: { description: 'Grands domaines list' }, 401: auth401 } }
    },
    '/rome/api/domaines': {
        get: { tags: ['ROME'], summary: 'Get domaines (live API)', security, responses: { 200: { description: 'Domaines list' }, 401: auth401 } }
    },
    '/rome/api/metiers': {
        get: { tags: ['ROME'], summary: 'Get all métiers (live API)', security, responses: { 200: { description: 'Métiers list' }, 401: auth401 } }
    },
    '/rome/api/metiers/it': {
        get: { tags: ['ROME'], summary: 'Get IT métiers (live API)', security, responses: { 200: { description: 'IT métiers' }, 401: auth401 } }
    },
    '/rome/api/metiers/{codeRome}': {
        get: {
            tags: ['ROME'], summary: 'Get métier details (live API)', security,
            parameters: [{ name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Métier details' }, 401: auth401, 404: notFound404 }
        }
    },
    '/rome/api/metiers/{codeRome}/competences': {
        get: {
            tags: ['ROME'], summary: 'Get competences for métier (live API)', security,
            parameters: [{ name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Competences list' }, 401: auth401, 404: notFound404 }
        }
    },
    '/rome/api/search': {
        get: {
            tags: ['ROME'], summary: 'Search métiers (live API)', security,
            parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Search results' }, 401: auth401 }
        }
    },
    '/rome/collect': {
        post: {
            tags: ['ROME'],
            summary: 'Collect ROME data (admin)',
            description: 'Fetch and store ROME 4.0 data from France Travail API',
            security: securityCsrf,
            responses: { 200: { description: 'Collection results' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // PIPELINE
    // ============================================
    '/pipeline/stages': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline stages',
            security,
            responses: { 200: { description: 'Array of stage definitions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineStage' } } } } }, 401: auth401 }
        }
    },
    '/pipeline': {
        post: {
            tags: ['Pipeline'],
            summary: 'Create pipeline entry',
            security: securityCsrf,
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['resume_id'], properties: { resume_id: { type: 'string', format: 'uuid' }, mission_id: { type: 'string', format: 'uuid' }, client_id: { type: 'string', format: 'uuid' }, stage: { type: 'string' }, notes: { type: 'string' } } } } } },
            responses: { 201: { description: 'Entry created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PipelineEntry' } } } }, 401: auth401 }
        }
    },
    '/pipeline/overview': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline overview (Kanban)',
            description: 'Get all pipeline entries grouped by stage for Kanban view',
            security,
            parameters: [{ name: 'missionId', in: 'query', schema: { type: 'string' } }, { name: 'clientId', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Pipeline entries by stage' }, 401: auth401 }
        }
    },
    '/pipeline/stats': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline statistics',
            security,
            responses: { 200: { description: 'Pipeline stats' }, 401: auth401 }
        }
    },
    '/pipeline/{id}': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline entry',
            security,
            parameters: [paramId],
            responses: { 200: { description: 'Pipeline entry details' }, 401: auth401, 404: notFound404 }
        },
        delete: {
            tags: ['Pipeline'],
            summary: 'Delete pipeline entry',
            security: securityCsrf,
            parameters: [paramId],
            responses: { 200: { description: 'Entry deleted' }, 401: auth401 }
        }
    },
    '/pipeline/{id}/stage': {
        patch: {
            tags: ['Pipeline'],
            summary: 'Update pipeline stage',
            description: 'Move candidate to a different stage',
            security: securityCsrf,
            parameters: [paramId],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['stage'], properties: { stage: { type: 'string' }, notes: { type: 'string' } } } } } },
            responses: { 200: { description: 'Stage updated' }, 401: auth401, 404: notFound404 }
        }
    },
    '/pipeline/{id}/notes': {
        patch: {
            tags: ['Pipeline'],
            summary: 'Update pipeline notes',
            security: securityCsrf,
            parameters: [paramId],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { notes: { type: 'string' } } } } } },
            responses: { 200: { description: 'Notes updated' }, 401: auth401, 404: notFound404 }
        }
    },
    '/pipeline/{id}/history': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get stage change history',
            security,
            parameters: [paramId],
            responses: { 200: { description: 'Array of history entries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineHistory' } } } } }, 401: auth401 }
        }
    },
    '/pipeline/resume/{resumeId}': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline entries for resume',
            security,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Pipeline entries for resume' }, 401: auth401 }
        }
    },
    '/pipeline/mission/{missionId}': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline entries for mission',
            security,
            parameters: [paramMissionId],
            responses: { 200: { description: 'Pipeline entries for mission' }, 401: auth401 }
        }
    },

    // ============================================
    // INTERVIEWS
    // ============================================
    '/pipeline/{id}/interviews': {
        post: {
            tags: ['Interviews'],
            summary: 'Schedule interview',
            security: securityCsrf,
            parameters: [paramId],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'scheduled_at'], properties: { title: { type: 'string' }, description: { type: 'string' }, interview_type: { type: 'string', enum: ['client', 'partner', 'technical', 'hr'] }, scheduled_at: { type: 'string', format: 'date-time' }, duration_minutes: { type: 'integer', default: 60 }, location: { type: 'string' }, meeting_link: { type: 'string' } } } } } },
            responses: { 201: { description: 'Interview scheduled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Interview' } } } }, 401: auth401 }
        },
        get: {
            tags: ['Interviews'],
            summary: 'List interviews for pipeline entry',
            security,
            parameters: [paramId],
            responses: { 200: { description: 'Array of interviews' }, 401: auth401 }
        }
    },
    '/pipeline/interviews/upcoming': {
        get: {
            tags: ['Interviews'],
            summary: 'Get upcoming interviews',
            security,
            parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 7 } }],
            responses: { 200: { description: 'Upcoming interviews' }, 401: auth401 }
        }
    },
    '/pipeline/interviews/{interviewId}': {
        patch: {
            tags: ['Interviews'],
            summary: 'Update interview',
            security: securityCsrf,
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Interview updated' }, 401: auth401, 404: notFound404 }
        },
        delete: {
            tags: ['Interviews'],
            summary: 'Delete interview',
            security: securityCsrf,
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Interview deleted' }, 401: auth401 }
        }
    },
    '/pipeline/interviews/{interviewId}/complete': {
        post: {
            tags: ['Interviews'],
            summary: 'Complete interview',
            security: securityCsrf,
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { outcome: { type: 'string', enum: ['positive', 'neutral', 'negative', 'to_follow_up'] }, outcome_notes: { type: 'string' } } } } } },
            responses: { 200: { description: 'Interview completed' }, 401: auth401 }
        }
    },
    '/pipeline/interviews/{interviewId}/cancel': {
        post: {
            tags: ['Interviews'],
            summary: 'Cancel interview',
            security: securityCsrf,
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Interview cancelled' }, 401: auth401 }
        }
    },

    // ============================================
    // CALENDAR
    // ============================================
    '/calendar/status': {
        get: {
            tags: ['Calendar'],
            summary: 'Get calendar connection status',
            security,
            responses: { 200: { description: 'Calendar connection status' }, 401: auth401 }
        }
    },
    '/calendar/auth-url': {
        get: {
            tags: ['Calendar'],
            summary: 'Get Google Calendar OAuth URL',
            security,
            responses: { 200: { description: 'OAuth URL' }, 401: auth401 }
        }
    },
    '/calendar/callback': {
        get: {
            tags: ['Calendar'],
            summary: 'Google Calendar OAuth callback',
            responses: { 302: { description: 'Redirect after OAuth' } }
        }
    },
    '/calendar/disconnect': {
        post: {
            tags: ['Calendar'],
            summary: 'Disconnect Google Calendar',
            security: securityCsrf,
            responses: { 200: { description: 'Disconnected' }, 401: auth401 }
        }
    },
    '/calendar/events': {
        get: {
            tags: ['Calendar'],
            summary: 'List calendar events',
            security,
            responses: { 200: { description: 'Calendar events' }, 401: auth401 }
        },
        post: {
            tags: ['Calendar'],
            summary: 'Create calendar event',
            security: securityCsrf,
            responses: { 201: { description: 'Event created' }, 401: auth401 }
        }
    },
    '/calendar/events/{eventId}': {
        patch: {
            tags: ['Calendar'],
            summary: 'Update calendar event',
            security: securityCsrf,
            parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Event updated' }, 401: auth401 }
        },
        delete: {
            tags: ['Calendar'],
            summary: 'Delete calendar event',
            security: securityCsrf,
            parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Event deleted' }, 401: auth401 }
        }
    },

    // ============================================
    // COMMENTS
    // ============================================
    '/resumes/{resumeId}/comments': {
        get: {
            tags: ['Comments'],
            summary: 'List resume comments',
            security,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Array of comments', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ResumeComment' } } } } }, 401: auth401 }
        },
        post: {
            tags: ['Comments'],
            summary: 'Add comment',
            security: securityCsrf,
            parameters: [paramResumeId],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, is_private: { type: 'boolean', default: false } } } } } },
            responses: { 201: { description: 'Comment created' }, 401: auth401 }
        }
    },
    '/resumes/{resumeId}/comments/count': {
        get: {
            tags: ['Comments'],
            summary: 'Get comment count',
            security,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Comment count' }, 401: auth401 }
        }
    },
    '/resumes/{resumeId}/comments/{commentId}': {
        put: {
            tags: ['Comments'],
            summary: 'Update comment',
            security: securityCsrf,
            parameters: [paramResumeId, { name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Comment updated' }, 401: auth401 }
        },
        delete: {
            tags: ['Comments'],
            summary: 'Delete comment',
            security: securityCsrf,
            parameters: [paramResumeId, { name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Comment deleted' }, 401: auth401 }
        }
    },

    // ============================================
    // SHARE
    // ============================================
    '/share/resume/{resumeId}/generate': {
        post: {
            tags: ['Share'],
            summary: 'Generate shareable link',
            description: 'Generate a shareable PDF link and QR code for a resume',
            security: securityCsrf,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Share token and QR code', content: { 'application/json': { schema: { $ref: '#/components/schemas/ShareToken' } } } }, 401: auth401 }
        }
    },
    '/share/resume/{resumeId}/status': {
        get: {
            tags: ['Share'],
            summary: 'Get share status',
            security,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Share status' }, 401: auth401 }
        }
    },
    '/share/resume/{resumeId}/original': {
        get: {
            tags: ['Share'],
            summary: 'Get original file share info',
            security,
            parameters: [paramResumeId],
            responses: { 200: { description: 'Original file info' }, 401: auth401 }
        }
    },
    '/share/pdf/{token}': {
        get: {
            tags: ['Share'],
            summary: 'Download shared PDF (public)',
            parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } }, 404: notFound404 }
        }
    },
    '/share/file/{token}': {
        get: {
            tags: ['Share'],
            summary: 'Download shared original file (public)',
            parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Original file' }, 404: notFound404 }
        }
    },

    // ============================================
    // DEALS
    // ============================================
    '/deals': {
        get: {
            tags: ['Clients'],
            summary: 'List deals',
            security,
            parameters: [paramPage, paramLimit, paramSearch],
            responses: { 200: { description: 'Paginated deal list' }, 401: auth401 }
        },
        post: {
            tags: ['Clients'],
            summary: 'Create deal',
            security: securityCsrf,
            responses: { 201: { description: 'Deal created' }, 401: auth401 }
        }
    },
    '/deals/stats': {
        get: { tags: ['Clients'], summary: 'Get deal statistics', security, responses: { 200: { description: 'Deal stats' }, 401: auth401 } }
    },
    '/deals/statuses': {
        get: { tags: ['Clients'], summary: 'Get deal status list', security, responses: { 200: { description: 'Status options' }, 401: auth401 } }
    },
    '/deals/priorities': {
        get: { tags: ['Clients'], summary: 'Get deal priority list', security, responses: { 200: { description: 'Priority options' }, 401: auth401 } }
    },
    '/deals/resume-statuses': {
        get: { tags: ['Clients'], summary: 'Get deal resume status list', security, responses: { 200: { description: 'Resume status options' }, 401: auth401 } }
    },
    '/deals/{id}': {
        get: { tags: ['Clients'], summary: 'Get deal by ID', security, parameters: [paramId], responses: { 200: { description: 'Deal details' }, 401: auth401, 404: notFound404 } },
        put: { tags: ['Clients'], summary: 'Update deal', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Deal updated' }, 401: auth401, 404: notFound404 } },
        delete: { tags: ['Clients'], summary: 'Delete deal', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Deal deleted' }, 401: auth401 } }
    },
    '/deals/{id}/missions': {
        get: { tags: ['Clients'], summary: 'Get missions for deal', security, parameters: [paramId], responses: { 200: { description: 'Deal missions' }, 401: auth401 } }
    },
    '/deals/{id}/resumes': {
        get: { tags: ['Clients'], summary: 'Get resumes for deal', security, parameters: [paramId], responses: { 200: { description: 'Deal resumes' }, 401: auth401 } },
        post: { tags: ['Clients'], summary: 'Add resume to deal', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Resume added' }, 401: auth401 } }
    },
    '/deals/{id}/resumes/{resumeId}': {
        put: { tags: ['Clients'], summary: 'Update resume in deal', security: securityCsrf, parameters: [paramId, paramResumeId], responses: { 200: { description: 'Updated' }, 401: auth401 } },
        delete: { tags: ['Clients'], summary: 'Remove resume from deal', security: securityCsrf, parameters: [paramId, paramResumeId], responses: { 200: { description: 'Removed' }, 401: auth401 } }
    },
    '/deals/by-resume/{resumeId}': {
        get: { tags: ['Clients'], summary: 'Get deals for resume', security, parameters: [paramResumeId], responses: { 200: { description: 'Deals containing resume' }, 401: auth401 } }
    },
    '/deals/add-resume-to-multiple': {
        post: { tags: ['Clients'], summary: 'Add resume to multiple deals', security: securityCsrf, responses: { 200: { description: 'Resume added to deals' }, 401: auth401 } }
    },

    // ============================================
    // HEALTH (mounted at /health — use "Root Server" in Swagger UI)
    // ============================================
    '/health': {
        get: {
            tags: ['Health'],
            summary: 'Health check',
            description: 'Basic health check (public); detailed info for authenticated admins. **Use the Root Server** (`/`) to call this endpoint.',
            servers: [{ url: '/', description: 'Root Server' }],
            responses: { 200: { description: 'Health status', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthCheck' } } } } }
        }
    },
    '/health/memory': {
        get: {
            tags: ['Health'],
            summary: 'Memory usage (admin)',
            description: '**Use the Root Server** (`/`) to call this endpoint.',
            servers: [{ url: '/', description: 'Root Server' }],
            security,
            responses: { 200: { description: 'Memory stats' }, 401: auth401, 403: forbidden403 }
        }
    },
    '/health/storage': {
        get: {
            tags: ['Health'],
            summary: 'Storage usage (admin)',
            description: '**Use the Root Server** (`/`) to call this endpoint.',
            servers: [{ url: '/', description: 'Root Server' }],
            security,
            responses: { 200: { description: 'Storage stats' }, 401: auth401, 403: forbidden403 }
        }
    },

    // ============================================
    // METRICS
    // ============================================
    '/metrics': {
        get: { tags: ['Metrics'], summary: 'Get all metrics (admin)', security, responses: { 200: { description: 'All metrics' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/summary': {
        get: { tags: ['Metrics'], summary: 'Metrics summary (admin)', security, responses: { 200: { description: 'Summary' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/performance': {
        get: { tags: ['Metrics'], summary: 'Performance metrics (admin)', security, responses: { 200: { description: 'Performance data' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/errors': {
        get: { tags: ['Metrics'], summary: 'Error metrics (admin)', security, responses: { 200: { description: 'Error data' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/cache': {
        get: { tags: ['Metrics'], summary: 'Cache metrics (admin)', security, responses: { 200: { description: 'Cache stats' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/llm': {
        get: { tags: ['Metrics'], summary: 'LLM usage metrics (admin)', security, responses: { 200: { description: 'LLM stats' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/database': {
        get: { tags: ['Metrics'], summary: 'Database metrics (admin)', security, responses: { 200: { description: 'DB stats' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/apm': {
        get: { tags: ['Metrics'], summary: 'APM metrics (admin)', security, responses: { 200: { description: 'APM data' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/apm/slow-requests': {
        get: { tags: ['Metrics'], summary: 'Slow requests (admin)', security, responses: { 200: { description: 'Slow request list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SlowRequest' } } } } }, 401: auth401, 403: forbidden403 } },
        delete: { tags: ['Metrics'], summary: 'Clear slow requests (admin)', security: securityCsrf, responses: { 200: { description: 'Cleared' }, 401: auth401, 403: forbidden403 } }
    },
    '/metrics/reset': {
        post: { tags: ['Metrics'], summary: 'Reset metrics (admin)', security: securityCsrf, responses: { 200: { description: 'Metrics reset' }, 401: auth401, 403: forbidden403 } }
    },

    // ============================================
    // ADMIN
    // ============================================
    '/admin/security-logs': {
        get: {
            tags: ['Admin'],
            summary: 'Get security logs',
            security,
            parameters: [paramPage, paramLimit, { name: 'level', in: 'query', schema: { type: 'string' } }, { name: 'event', in: 'query', schema: { type: 'string' } }],
            responses: { 200: { description: 'Paginated security logs', content: { 'application/json': { schema: { type: 'object', properties: { logs: { type: 'array', items: { $ref: '#/components/schemas/SecurityLog' } }, total: { type: 'integer' } } } } } }, 401: auth401, 403: forbidden403 }
        }
    },
    '/admin/security-filters': {
        get: { tags: ['Admin'], summary: 'Get security log filter options', security, responses: { 200: { description: 'Filter options' }, 401: auth401, 403: forbidden403 } }
    },
    '/admin/security-stats': {
        get: { tags: ['Admin'], summary: 'Get security statistics', security, responses: { 200: { description: 'Security stats' }, 401: auth401, 403: forbidden403 } }
    },
    '/admin/cache-stats': {
        get: { tags: ['Admin'], summary: 'Get cache statistics', security, responses: { 200: { description: 'Cache stats' }, 401: auth401, 403: forbidden403 } }
    },
    '/admin/users': {
        get: { tags: ['Admin'], summary: 'Get users overview (admin)', security, responses: { 200: { description: 'Users with activity' }, 401: auth401, 403: forbidden403 } }
    },

    // ============================================
    // BACKUP
    // ============================================
    '/backup/settings': {
        get: { tags: ['Backup'], summary: 'Get backup settings (admin)', security, responses: { 200: { description: 'Backup config' }, 401: auth401, 403: forbidden403 } },
        put: { tags: ['Backup'], summary: 'Update backup settings (admin)', security: securityCsrf, responses: { 200: { description: 'Settings updated' }, 401: auth401, 403: forbidden403 } }
    },
    '/backup/test-connection': {
        post: { tags: ['Backup'], summary: 'Test FTP/SFTP connection (admin)', security: securityCsrf, responses: { 200: { description: 'Connection test result' }, 401: auth401, 403: forbidden403 } }
    },
    '/backup/run': {
        post: { tags: ['Backup'], summary: 'Run backup now (admin)', security: securityCsrf, responses: { 200: { description: 'Backup started' }, 401: auth401, 403: forbidden403 } }
    },
    '/backup/history': {
        get: { tags: ['Backup'], summary: 'Get backup history (admin)', security, responses: { 200: { description: 'Backup history' }, 401: auth401, 403: forbidden403 } }
    },
    '/backup/history/{id}': {
        delete: { tags: ['Backup'], summary: 'Delete backup record (admin)', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Record deleted' }, 401: auth401, 403: forbidden403 } }
    },
    '/backup/list-remote': {
        get: { tags: ['Backup'], summary: 'List remote backups (admin)', security, responses: { 200: { description: 'Remote backup files' }, 401: auth401, 403: forbidden403 } }
    },
    '/backup/restore': {
        post: { tags: ['Backup'], summary: 'Restore from backup (admin)', security: securityCsrf, responses: { 200: { description: 'Restore initiated' }, 401: auth401, 403: forbidden403 } }
    },
    '/backup/scheduler-status': {
        get: { tags: ['Backup'], summary: 'Get scheduler status (admin)', security, responses: { 200: { description: 'Scheduler status' }, 401: auth401, 403: forbidden403 } }
    },

    // ============================================
    // BATCH JOBS
    // ============================================
    '/batch-jobs': {
        get: { tags: ['Resumes'], summary: 'List batch jobs', security, responses: { 200: { description: 'Array of batch jobs' }, 401: auth401 } },
        post: {
            tags: ['Resumes'],
            summary: 'Create batch import job',
            description: 'Upload multiple resume files for batch processing',
            security: securityCsrf,
            requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } },
            responses: { 201: { description: 'Batch job created' }, 401: auth401 }
        }
    },
    '/batch-jobs/improve': {
        post: { tags: ['Resumes'], summary: 'Create batch improve job', security: securityCsrf, responses: { 201: { description: 'Improve job created' }, 401: auth401 } }
    },
    '/batch-jobs/deal-export': {
        post: { tags: ['Resumes'], summary: 'Create deal export job', security: securityCsrf, responses: { 201: { description: 'Export job created' }, 401: auth401 } }
    },
    '/batch-jobs/{id}': {
        get: { tags: ['Resumes'], summary: 'Get batch job details', security, parameters: [paramId], responses: { 200: { description: 'Job details with items' }, 401: auth401, 404: notFound404 } },
        delete: { tags: ['Resumes'], summary: 'Delete batch job', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Job deleted' }, 401: auth401 } }
    },
    '/batch-jobs/{id}/cancel': {
        post: { tags: ['Resumes'], summary: 'Cancel batch job', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Job cancelled' }, 401: auth401 } }
    },
    '/batch-jobs/{id}/download': {
        get: { tags: ['Resumes'], summary: 'Download batch job result', security, parameters: [paramId], responses: { 200: { description: 'ZIP file', content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } } }, 401: auth401, 404: notFound404 } }
    },
    '/batch-jobs/{id}/pending-names': {
        get: { tags: ['Resumes'], summary: 'Get items pending name', security, parameters: [paramId], responses: { 200: { description: 'Items needing names' }, 401: auth401 } }
    },
    '/batch-jobs/items/{itemId}/provide-name': {
        post: {
            tags: ['Resumes'],
            summary: 'Provide name for batch item',
            security: securityCsrf,
            parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } },
            responses: { 200: { description: 'Name provided' }, 401: auth401 }
        }
    },

    // ============================================
    // BATCH EXPORT
    // ============================================
    '/batch-export': {
        post: {
            tags: ['Resumes'],
            summary: 'Batch export resumes',
            description: 'Export multiple resumes as PDF/DOCX in a ZIP file',
            security: securityCsrf,
            responses: { 200: { description: 'ZIP download', content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } } }, 401: auth401 }
        }
    },

    // ============================================
    // DOCUMENTATION
    // ============================================
    '/docs': {
        get: {
            tags: ['Documentation'],
            summary: 'OpenAPI JSON specification',
            responses: { 200: { description: 'OpenAPI 3.0 JSON document' } }
        }
    },
    '/docs/ui': {
        get: {
            tags: ['Documentation'],
            summary: 'Swagger UI',
            responses: { 200: { description: 'Interactive API documentation page' } }
        }
    }
};

export default swaggerPaths;
