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
    '/resumes/{id}/ai-modify': {
        post: {
            tags: ['Resumes'],
            summary: 'AI-powered resume modification',
            description: 'Modify specific sections of a resume using AI based on user instructions.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['instruction'],
                            properties: {
                                instruction: { type: 'string', description: 'User instruction for AI modification' },
                                section: { type: 'string', description: 'Specific section to modify (optional)' },
                                currentText: { type: 'string', description: 'Current resume text to modify' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: { description: 'Modified resume text', content: { 'application/json': { schema: { type: 'object', properties: { modifiedText: { type: 'string' }, changes: { type: 'array', items: { type: 'string' } } } } } } },
                400: { description: 'Instruction required' }
            }
        }
    },
    '/resumes/analyze': {
        post: {
            tags: ['Resumes'],
            summary: 'Analyze resume text',
            description: 'Analyze resume text using AI to extract skills, experience, and provide scores.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['text'],
                            properties: {
                                text: { type: 'string', description: 'Resume text to analyze' },
                                resumeId: { type: 'string', format: 'uuid', description: 'Resume ID to update with analysis results' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Analysis results',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    scores: { type: 'object' },
                                    tags: { type: 'object' },
                                    summary: { type: 'string' },
                                    keyImprovements: { type: 'array', items: { type: 'string' } }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    '/resumes/analyze-text': {
        post: {
            tags: ['Resumes'],
            summary: 'Analyze raw text',
            description: 'Analyze raw text without associating with a resume record.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } }
            },
            responses: { 200: { description: 'Analysis results' } }
        }
    },
    '/resumes/improve': {
        post: {
            tags: ['Resumes'],
            summary: 'Improve resume text',
            description: 'Improve resume text using AI to enhance content, formatting, and impact.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['text'],
                            properties: {
                                text: { type: 'string', description: 'Resume text to improve' },
                                resumeId: { type: 'string', format: 'uuid' },
                                templateId: { type: 'string', format: 'uuid' }
                            }
                        }
                    }
                }
            },
            responses: { 200: { description: 'Improved resume text' } }
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
            description: 'Uses AI to find the best matching resumes for a mission based on skills, experience, and other criteria.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                limit: { type: 'integer', default: 10, description: 'Max profiles to return' },
                                minScore: { type: 'integer', default: 0, description: 'Minimum match score (0-100)' },
                                status: { type: 'string', description: 'Filter by resume status' },
                                weights: { type: 'object', description: 'Custom weights for scoring criteria' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Matching profiles with scores',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    profiles: { type: 'array', items: { type: 'object' } },
                                    mission: { type: 'object' },
                                    totalFound: { type: 'integer' }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    '/missions/{missionId}/adaptations': {
        get: {
            tags: ['Missions', 'Adaptations'],
            summary: 'Get adaptations for a mission',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'missionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'List of adaptations', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Adaptation' } } } } }
            }
        }
    },
    '/missions/{missionId}/keywords-cache': {
        delete: {
            tags: ['Missions'],
            summary: 'Clear cached keywords for a mission',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'missionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Cache cleared' } }
        }
    },
    '/missions/{missionId}/analyze-profile/{resumeId}': {
        post: {
            tags: ['Missions'],
            summary: 'Detailed LLM analysis of a profile for a mission',
            description: 'Performs in-depth AI analysis comparing a specific resume against mission requirements.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [
                { name: 'missionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                { name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
            ],
            responses: {
                200: {
                    description: 'Detailed analysis results',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    matchScore: { type: 'integer' },
                                    strengths: { type: 'array', items: { type: 'string' } },
                                    gaps: { type: 'array', items: { type: 'string' } },
                                    recommendations: { type: 'array', items: { type: 'string' } }
                                }
                            }
                        }
                    }
                }
            }
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
    // EMAIL TEMPLATES
    // ============================================
    '/email-templates': {
        get: {
            tags: ['Email Templates'],
            summary: 'Get all email templates',
            description: 'Returns templates for the user\'s firm. Admins can also see system templates.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'List of templates', content: { 'application/json': { schema: { type: 'object', properties: { templates: { type: 'array', items: { $ref: '#/components/schemas/EmailTemplate' } } } } } } }
            }
        },
        post: {
            tags: ['Email Templates'],
            summary: 'Create email template',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['name', 'subjectTemplate', 'mjmlContent'],
                            properties: {
                                name: { type: 'string' },
                                description: { type: 'string' },
                                subjectTemplate: { type: 'string' },
                                mjmlContent: { type: 'string' },
                                isDefault: { type: 'boolean' }
                            }
                        }
                    }
                }
            },
            responses: { 201: { description: 'Template created', content: { 'application/json': { schema: { type: 'object', properties: { template: { $ref: '#/components/schemas/EmailTemplate' } } } } } } }
        }
    },
    '/email-templates/keywords': {
        get: {
            tags: ['Email Templates'],
            summary: 'Get available template keywords',
            description: 'Returns list of keywords that can be used in templates for substitution.',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Available keywords', content: { 'application/json': { schema: { type: 'object', properties: { keywords: { type: 'array', items: { type: 'object' } } } } } } } }
        }
    },
    '/email-templates/default': {
        get: {
            tags: ['Email Templates'],
            summary: 'Get default template',
            description: 'Returns the default email template for the user\'s firm.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'Default template', content: { 'application/json': { schema: { type: 'object', properties: { template: { $ref: '#/components/schemas/EmailTemplate' } } } } } },
                404: { description: 'No default template found' }
            }
        }
    },
    '/email-templates/compile': {
        post: {
            tags: ['Email Templates'],
            summary: 'Compile MJML to HTML',
            description: 'Compiles MJML content to HTML for live preview in editor.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['mjmlContent'],
                            properties: {
                                mjmlContent: { type: 'string' },
                                subjectTemplate: { type: 'string' },
                                context: { type: 'object' }
                            }
                        }
                    }
                }
            },
            responses: { 200: { description: 'Compiled HTML', content: { 'application/json': { schema: { type: 'object', properties: { html: { type: 'string' }, subject: { type: 'string' } } } } } } }
        }
    },
    '/email-templates/{id}': {
        get: {
            tags: ['Email Templates'],
            summary: 'Get template by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'Template data', content: { 'application/json': { schema: { type: 'object', properties: { template: { $ref: '#/components/schemas/EmailTemplate' } } } } } },
                404: { $ref: '#/components/responses/NotFound' }
            }
        },
        put: {
            tags: ['Email Templates'],
            summary: 'Update template',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['name', 'subjectTemplate', 'mjmlContent'],
                            properties: {
                                name: { type: 'string' },
                                description: { type: 'string' },
                                subjectTemplate: { type: 'string' },
                                mjmlContent: { type: 'string' },
                                isDefault: { type: 'boolean' }
                            }
                        }
                    }
                }
            },
            responses: { 200: { description: 'Template updated' }, 403: { description: 'Cannot modify system template' } }
        },
        delete: {
            tags: ['Email Templates'],
            summary: 'Delete template',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Template deleted' }, 403: { description: 'Cannot delete system template' } }
        }
    },
    '/email-templates/{id}/duplicate': {
        post: {
            tags: ['Email Templates'],
            summary: 'Duplicate template',
            description: 'Creates a copy of the template for the user\'s firm.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 201: { description: 'Template duplicated', content: { 'application/json': { schema: { type: 'object', properties: { template: { $ref: '#/components/schemas/EmailTemplate' } } } } } } }
        }
    },
    '/email-templates/{id}/preview': {
        post: {
            tags: ['Email Templates'],
            summary: 'Preview template with context',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { context: { type: 'object' } } } } } },
            responses: { 200: { description: 'Rendered template', content: { 'application/json': { schema: { type: 'object', properties: { html: { type: 'string' }, subject: { type: 'string' } } } } } } }
        }
    },

    // ============================================
    // CONSENT (GDPR)
    // ============================================
    '/consent/initialize': {
        post: {
            tags: ['Consent'],
            summary: 'Initialize consent for a resume',
            description: 'Creates a consent record for a resume and prepares it for sending.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['resumeId', 'profileType', 'candidateName'],
                            properties: {
                                resumeId: { type: 'string', format: 'uuid' },
                                profileType: { type: 'string', enum: ['candidate', 'consultant'] },
                                candidateName: { type: 'string' },
                                candidateEmail: { type: 'string', format: 'email' }
                            }
                        }
                    }
                }
            },
            responses: { 200: { description: 'Consent initialized', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, consent: { $ref: '#/components/schemas/ConsentStatus' } } } } } } }
        }
    },
    '/consent/{resumeId}/send': {
        post: {
            tags: ['Consent'],
            summary: 'Send consent request email',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Email sent', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, sentTo: { type: 'string' } } } } } } }
        }
    },
    '/consent/{resumeId}/resend': {
        post: {
            tags: ['Consent'],
            summary: 'Resend consent request with new token',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Email resent' } }
        }
    },
    '/consent/{resumeId}/status': {
        get: {
            tags: ['Consent'],
            summary: 'Get consent status',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Consent status', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, consent: { $ref: '#/components/schemas/ConsentStatus' } } } } } } }
        }
    },
    '/consent/run-checks': {
        post: {
            tags: ['Consent', 'Admin'],
            summary: 'Run consent checks (admin)',
            description: 'Manually triggers consent expiration checks and cleanup.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: { 200: { description: 'Checks completed' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },
    '/consent/respond/{token}': {
        get: {
            tags: ['Consent'],
            summary: 'Get consent request info (public)',
            description: 'Public endpoint for consent response page. Returns candidate and firm info.',
            parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: { description: 'Consent info', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, candidateName: { type: 'string' }, firmName: { type: 'string' } } } } } },
                404: { description: 'Invalid token' },
                410: { description: 'Token expired' }
            }
        },
        post: {
            tags: ['Consent'],
            summary: 'Record consent response (public)',
            description: 'Public endpoint to record candidate consent decision.',
            parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['accept', 'refuse'] } } } } }
            },
            responses: {
                200: { description: 'Response recorded', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, status: { type: 'string' }, retentionUntil: { type: 'string', format: 'date-time' } } } } } },
                410: { description: 'Token expired' }
            }
        }
    },

    // ============================================
    // GDPR MAIL (Admin)
    // ============================================
    '/gdpr/mail/status': {
        get: {
            tags: ['GDPR Mail', 'Admin'],
            summary: 'Get GDPR mail connection status',
            description: 'Returns the global GDPR Gmail connection status.',
            security: [{ cookieAuth: [] }],
            responses: { 200: { description: 'Connection status', content: { 'application/json': { schema: { type: 'object', properties: { connected: { type: 'boolean' }, email: { type: 'string' } } } } } } }
        }
    },
    '/gdpr/mail/auth-url': {
        get: {
            tags: ['GDPR Mail', 'Admin'],
            summary: 'Get Gmail OAuth URL (admin)',
            description: 'Returns OAuth URL to connect Gmail for GDPR emails.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'Auth URL', content: { 'application/json': { schema: { type: 'object', properties: { authUrl: { type: 'string' } } } } } },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/gdpr/mail/callback': {
        get: {
            tags: ['GDPR Mail'],
            summary: 'Gmail OAuth callback',
            description: 'Handles OAuth callback from Google. Returns HTML to close popup.',
            parameters: [
                { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'HTML response to close popup' } }
        }
    },
    '/gdpr/mail/disconnect': {
        post: {
            tags: ['GDPR Mail', 'Admin'],
            summary: 'Disconnect GDPR Gmail (admin)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: { 200: { description: 'Disconnected' }, 403: { $ref: '#/components/responses/Forbidden' } }
        }
    },
    '/gdpr/mail/test': {
        post: {
            tags: ['GDPR Mail', 'Admin'],
            summary: 'Send test email (admin)',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
            responses: { 200: { description: 'Test email sent' } }
        }
    },

    // ============================================
    // ADMIN (Security Logs)
    // ============================================
    '/admin/security-logs': {
        get: {
            tags: ['Admin'],
            summary: 'Get security and proxy logs (admin)',
            description: 'Returns combined security and proxy logs with filtering and pagination.',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
                { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
                { name: 'level', in: 'query', schema: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'] } },
                { name: 'event', in: 'query', schema: { type: 'string' } },
                { name: 'source', in: 'query', schema: { type: 'string', enum: ['security', 'proxy'] } }
            ],
            responses: {
                200: {
                    description: 'Logs list',
                    content: { 'application/json': { schema: { type: 'object', properties: { logs: { type: 'array', items: { $ref: '#/components/schemas/SecurityLog' } }, total: { type: 'integer' }, offset: { type: 'integer' }, limit: { type: 'integer' } } } } }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/admin/security-filters': {
        get: {
            tags: ['Admin'],
            summary: 'Get available log filters (admin)',
            description: 'Returns unique values for level, event, and source filters.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'Filter options', content: { 'application/json': { schema: { type: 'object', properties: { levels: { type: 'array', items: { type: 'string' } }, events: { type: 'array', items: { type: 'string' } }, sources: { type: 'array', items: { type: 'string' } } } } } } },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/admin/security-stats': {
        get: {
            tags: ['Admin'],
            summary: 'Get security statistics (admin)',
            description: 'Returns aggregated statistics for security and proxy logs.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'Security stats',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    total: { type: 'integer' },
                                    byLevel: { type: 'object', additionalProperties: { type: 'integer' } },
                                    byEvent: { type: 'object', additionalProperties: { type: 'integer' } },
                                    bySource: { type: 'object', properties: { security: { type: 'integer' }, proxy: { type: 'integer' } } },
                                    recent: { type: 'object', properties: { last24h: { type: 'integer' }, lastHour: { type: 'integer' } } }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/admin/users': {
        get: {
            tags: ['Admin'],
            summary: 'Get all users (admin)',
            description: 'Returns all users in the system.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'Users list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },

    // ============================================
    // TWO-FACTOR AUTHENTICATION (2FA)
    // ============================================
    '/2fa/status': {
        get: {
            tags: ['Authentication'],
            summary: 'Get 2FA status for current user',
            description: 'Returns whether 2FA is enabled, when it was enabled, and how many backup codes remain.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: '2FA status',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    enabled: { type: 'boolean', description: 'Whether 2FA is enabled' },
                                    enabledAt: { type: 'string', format: 'date-time', nullable: true },
                                    backupCodesRemaining: { type: 'integer', description: 'Number of unused backup codes' }
                                }
                            }
                        }
                    }
                },
                401: { $ref: '#/components/responses/Unauthorized' }
            }
        }
    },
    '/2fa/setup': {
        post: {
            tags: ['Authentication'],
            summary: 'Generate TOTP secret for 2FA setup',
            description: 'Generates a new TOTP secret and QR code for setting up 2FA. The secret is stored temporarily until verified.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: {
                200: {
                    description: 'Setup data with QR code',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    secret: { type: 'string', description: 'Base32-encoded TOTP secret (for manual entry)' },
                                    qrCodeDataUrl: { type: 'string', description: 'Data URL of QR code image' },
                                    backupCodes: { type: 'array', items: { type: 'string' }, description: '8 backup codes for recovery' },
                                    message: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                401: { $ref: '#/components/responses/Unauthorized' }
            }
        }
    },
    '/2fa/verify': {
        post: {
            tags: ['Authentication'],
            summary: 'Verify TOTP code and enable 2FA',
            description: 'Verifies the TOTP code from the authenticator app and enables 2FA if valid.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['code'],
                            properties: {
                                code: { type: 'string', minLength: 6, maxLength: 6, description: '6-digit TOTP code' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: { description: '2FA enabled successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } } } } },
                400: { description: 'Invalid code', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } } } } },
                401: { $ref: '#/components/responses/Unauthorized' }
            }
        }
    },
    '/2fa/disable': {
        post: {
            tags: ['Authentication'],
            summary: 'Disable 2FA',
            description: 'Disables 2FA for the current user. Requires a valid TOTP code or backup code.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['code'],
                            properties: {
                                code: { type: 'string', description: 'TOTP code or backup code' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: { description: '2FA disabled successfully' },
                400: { description: 'Invalid code' },
                401: { $ref: '#/components/responses/Unauthorized' }
            }
        }
    },
    '/2fa/backup-codes/regenerate': {
        post: {
            tags: ['Authentication'],
            summary: 'Regenerate backup codes',
            description: 'Generates new backup codes, invalidating all previous ones. Requires a valid TOTP code.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['code'],
                            properties: {
                                code: { type: 'string', description: 'Current TOTP code' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'New backup codes generated',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    backupCodes: { type: 'array', items: { type: 'string' } }
                                }
                            }
                        }
                    }
                },
                400: { description: 'Invalid code' },
                401: { $ref: '#/components/responses/Unauthorized' }
            }
        }
    },

    // ============================================
    // PIPELINE (Candidate Selection)
    // ============================================
    '/pipeline/stages': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get all pipeline stages',
            description: 'Returns the configured pipeline stages with labels and colors.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'List of stages',
                    content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineStage' } } } }
                }
            }
        }
    },
    '/pipeline': {
        post: {
            tags: ['Pipeline'],
            summary: 'Add resume to pipeline',
            description: 'Adds a resume to the selection pipeline, optionally linked to a mission and/or client.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['resumeId'],
                            properties: {
                                resumeId: { type: 'string', format: 'uuid' },
                                missionId: { type: 'string', format: 'uuid' },
                                clientId: { type: 'string', format: 'uuid' },
                                stage: { type: 'string', default: 'new' },
                                notes: { type: 'string' }
                            }
                        }
                    }
                }
            },
            responses: {
                201: { description: 'Pipeline entry created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PipelineEntry' } } } },
                400: { description: 'Resume ID required' }
            }
        }
    },
    '/pipeline/{id}': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline entry by ID',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'Pipeline entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/PipelineEntry' } } } },
                404: { $ref: '#/components/responses/NotFound' }
            }
        },
        delete: {
            tags: ['Pipeline'],
            summary: 'Remove from pipeline',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Removed from pipeline' } }
        }
    },
    '/pipeline/resume/{resumeId}': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline entries for a resume',
            description: 'Returns all pipeline entries where this resume is included.',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'Pipeline entries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineEntry' } } } } }
            }
        }
    },
    '/pipeline/mission/{missionId}': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline entries for a mission (Kanban view)',
            description: 'Returns all candidates in the pipeline for a specific mission, used for Kanban board display.',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'missionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'Pipeline entries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineEntry' } } } } }
            }
        }
    },
    '/pipeline/overview': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline overview grouped by stage',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'clientId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'missionId', in: 'query', schema: { type: 'string', format: 'uuid' } }
            ],
            responses: { 200: { description: 'Pipeline overview by stage' } }
        }
    },
    '/pipeline/stats': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline statistics',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'missionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'clientId', in: 'query', schema: { type: 'string', format: 'uuid' } }
            ],
            responses: { 200: { description: 'Pipeline statistics' } }
        }
    },
    '/pipeline/{id}/stage': {
        patch: {
            tags: ['Pipeline'],
            summary: 'Move candidate to different stage',
            description: 'Changes the pipeline stage for a candidate. Records history.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['stage'],
                            properties: {
                                stage: { type: 'string' },
                                notes: { type: 'string' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: { description: 'Stage updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/PipelineEntry' } } } },
                400: { description: 'Invalid stage' }
            }
        }
    },
    '/pipeline/{id}/notes': {
        patch: {
            tags: ['Pipeline'],
            summary: 'Update pipeline notes',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                content: { 'application/json': { schema: { type: 'object', properties: { notes: { type: 'string' } } } } }
            },
            responses: { 200: { description: 'Notes updated' } }
        }
    },
    '/pipeline/{id}/history': {
        get: {
            tags: ['Pipeline'],
            summary: 'Get pipeline history',
            description: 'Returns the stage change history for a pipeline entry.',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'History entries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineHistory' } } } } }
            }
        }
    },

    // ============================================
    // INTERVIEWS
    // ============================================
    '/pipeline/{id}/interviews': {
        get: {
            tags: ['Interviews'],
            summary: 'Get interviews for a pipeline entry',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'List of interviews', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Interview' } } } } }
            }
        },
        post: {
            tags: ['Interviews'],
            summary: 'Schedule an interview',
            description: 'Schedules a new interview for a pipeline entry. Only "client" type interviews move the candidate to "interview" stage.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['title', 'scheduledAt'],
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                                interviewType: { type: 'string', enum: ['client', 'partner', 'technical', 'hr'] },
                                scheduledAt: { type: 'string', format: 'date-time' },
                                durationMinutes: { type: 'integer', default: 60 },
                                location: { type: 'string' },
                                meetingLink: { type: 'string' },
                                attendees: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' } } } },
                                calendarEventId: { type: 'string' },
                                calendarProvider: { type: 'string', enum: ['google', 'outlook'] }
                            }
                        }
                    }
                }
            },
            responses: {
                201: { description: 'Interview scheduled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Interview' } } } },
                400: { description: 'Title and scheduled date required' }
            }
        }
    },
    '/pipeline/interviews/upcoming': {
        get: {
            tags: ['Interviews'],
            summary: 'Get upcoming interviews',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'days', in: 'query', schema: { type: 'integer', default: 30 }, description: 'Number of days to look ahead' }
            ],
            responses: {
                200: { description: 'Upcoming interviews', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Interview' } } } } }
            }
        }
    },
    '/pipeline/interviews/{interviewId}': {
        patch: {
            tags: ['Interviews'],
            summary: 'Update an interview',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Interview updated' } }
        },
        delete: {
            tags: ['Interviews'],
            summary: 'Delete an interview',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Interview deleted' } }
        }
    },
    '/pipeline/interviews/{interviewId}/complete': {
        post: {
            tags: ['Interviews'],
            summary: 'Complete an interview with outcome',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['outcome'],
                            properties: {
                                outcome: { type: 'string', enum: ['positive', 'neutral', 'negative', 'to_follow_up'] },
                                outcomeNotes: { type: 'string' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: { description: 'Interview completed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Interview' } } } },
                400: { description: 'Outcome required' }
            }
        }
    },
    '/pipeline/interviews/{interviewId}/cancel': {
        post: {
            tags: ['Interviews'],
            summary: 'Cancel an interview',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: { 200: { description: 'Interview cancelled' } }
        }
    },

    // ============================================
    // CALENDAR (Google Calendar Integration)
    // ============================================
    '/calendar/status': {
        get: {
            tags: ['Calendar'],
            summary: 'Check calendar connection status',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'Connection status', content: { 'application/json': { schema: { type: 'object', properties: { connected: { type: 'boolean' } } } } } }
            }
        }
    },
    '/calendar/auth-url': {
        get: {
            tags: ['Calendar'],
            summary: 'Get Google Calendar OAuth URL',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'Auth URL', content: { 'application/json': { schema: { type: 'object', properties: { authUrl: { type: 'string' } } } } } }
            }
        }
    },
    '/calendar/callback': {
        get: {
            tags: ['Calendar'],
            summary: 'Google Calendar OAuth callback',
            parameters: [
                { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'HTML response to close popup' } }
        }
    },
    '/calendar/disconnect': {
        post: {
            tags: ['Calendar'],
            summary: 'Disconnect Google Calendar',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: { 200: { description: 'Calendar disconnected' } }
        }
    },
    '/calendar/events': {
        get: {
            tags: ['Calendar'],
            summary: 'Get upcoming calendar events',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }
            ],
            responses: { 200: { description: 'Calendar events' } }
        },
        post: {
            tags: ['Calendar'],
            summary: 'Create calendar event',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['title', 'startTime', 'endTime'],
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                                startTime: { type: 'string', format: 'date-time' },
                                endTime: { type: 'string', format: 'date-time' },
                                location: { type: 'string' },
                                attendees: { type: 'array', items: { type: 'object', properties: { email: { type: 'string' } } } }
                            }
                        }
                    }
                }
            },
            responses: { 201: { description: 'Event created' } }
        }
    },
    '/calendar/events/{eventId}': {
        put: {
            tags: ['Calendar'],
            summary: 'Update calendar event',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Event updated' } }
        },
        delete: {
            tags: ['Calendar'],
            summary: 'Delete calendar event',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Event deleted' } }
        }
    },

    // ============================================
    // RESUME COMMENTS
    // ============================================
    '/resumes/{resumeId}/comments': {
        get: {
            tags: ['Comments'],
            summary: 'Get comments for a resume',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: {
                    description: 'List of comments',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    comments: { type: 'array', items: { $ref: '#/components/schemas/ResumeComment' } },
                                    count: { type: 'integer' }
                                }
                            }
                        }
                    }
                }
            }
        },
        post: {
            tags: ['Comments'],
            summary: 'Add comment to a resume',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['content'],
                            properties: {
                                content: { type: 'string' },
                                isPrivate: { type: 'boolean', default: false }
                            }
                        }
                    }
                }
            },
            responses: {
                201: { description: 'Comment added', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, comment: { $ref: '#/components/schemas/ResumeComment' } } } } } },
                400: { description: 'Content required' }
            }
        }
    },
    '/resumes/{resumeId}/comments/{commentId}': {
        put: {
            tags: ['Comments'],
            summary: 'Update a comment',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [
                { name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                { name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
            ],
            responses: { 200: { description: 'Comment updated' }, 403: { description: 'Can only edit own comments' } }
        },
        delete: {
            tags: ['Comments'],
            summary: 'Delete a comment',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [
                { name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                { name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
            ],
            responses: { 200: { description: 'Comment deleted' }, 403: { description: 'Can only delete own comments' } }
        }
    },

    // ============================================
    // SHARE (QR Code)
    // ============================================
    '/share/resume/{resumeId}/generate': {
        post: {
            tags: ['Share'],
            summary: 'Generate shareable PDF link',
            description: 'Generates a PDF from HTML content and creates a shareable link with QR code.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['htmlContent'],
                            properties: {
                                htmlContent: { type: 'string' },
                                filename: { type: 'string' },
                                stylesheet: { type: 'string' },
                                headerContent: { type: 'string' },
                                footerContent: { type: 'string' },
                                footerHeight: { type: 'integer' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: { description: 'Share token generated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, token: { type: 'string' } } } } } },
                400: { description: 'HTML content required' }
            }
        }
    },
    '/share/resume/{resumeId}/original': {
        post: {
            tags: ['Share'],
            summary: 'Generate shareable link for original CV',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'resumeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'Share token generated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, token: { type: 'string' } } } } } }
            }
        }
    },
    '/share/view/{token}': {
        get: {
            tags: ['Share'],
            summary: 'View shared resume (public)',
            description: 'Public endpoint to view a shared resume PDF.',
            parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: { description: 'PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
                404: { description: 'Invalid or expired token' }
            }
        }
    },

    // ============================================
    // GDPR AUDIT LOG
    // ============================================
    '/gdpr-audit/logs': {
        get: {
            tags: ['GDPR Audit', 'Admin'],
            summary: 'Get GDPR audit logs (admin)',
            description: 'Returns paginated GDPR audit logs with filtering options.',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'firmId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'action', in: 'query', schema: { type: 'string' } },
                { name: 'category', in: 'query', schema: { type: 'string', enum: ['consent', 'data', 'cv', 'automated'] } },
                { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'targetEmail', in: 'query', schema: { type: 'string' } },
                { name: 'isAutomated', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
                { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
                { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'created_at' } },
                { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } }
            ],
            responses: {
                200: {
                    description: 'Paginated audit logs',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    logs: { type: 'array', items: { $ref: '#/components/schemas/GdprAuditLog' } },
                                    pagination: { $ref: '#/components/schemas/PaginatedResponse/properties/pagination' }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/gdpr-audit/stats': {
        get: {
            tags: ['GDPR Audit', 'Admin'],
            summary: 'Get GDPR audit statistics (admin)',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'firmId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }
            ],
            responses: {
                200: {
                    description: 'Audit statistics',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    total: { type: 'integer' },
                                    byCategory: { type: 'object', additionalProperties: { type: 'integer' } },
                                    byAction: { type: 'object', additionalProperties: { type: 'integer' } },
                                    automated: { type: 'integer' },
                                    manual: { type: 'integer' }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/gdpr-audit/firms': {
        get: {
            tags: ['GDPR Audit', 'Admin'],
            summary: 'Get firms for audit filter (admin)',
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: 'List of firms', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } } } },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/gdpr-audit/actions': {
        get: {
            tags: ['GDPR Audit', 'Admin'],
            summary: 'Get available GDPR actions and categories',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'Actions and categories',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    actions: { type: 'array', items: { type: 'string' } },
                                    categories: { type: 'array', items: { type: 'string' } }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    '/gdpr-audit/export/{targetEmail}': {
        get: {
            tags: ['GDPR Audit', 'Admin'],
            summary: 'Export audit logs for a specific email (admin)',
            security: [{ cookieAuth: [] }],
            parameters: [{ name: 'targetEmail', in: 'path', required: true, schema: { type: 'string', format: 'email' } }],
            responses: {
                200: { description: 'Audit logs for email' },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },

    // ============================================
    // SUBMISSIONS STATS
    // ============================================
    '/submissions/stats/summary': {
        get: {
            tags: ['Submissions'],
            summary: 'Get submission statistics',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'Submission statistics',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    total_submissions: { type: 'integer' },
                                    sent: { type: 'integer' },
                                    viewed: { type: 'integer' },
                                    accepted: { type: 'integer' },
                                    rejected: { type: 'integer' },
                                    pending: { type: 'integer' },
                                    unique_clients: { type: 'integer' },
                                    unique_resumes: { type: 'integer' }
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    // ============================================
    // BACKUP (Admin only)
    // ============================================
    '/backup/settings': {
        get: {
            tags: ['Backup', 'Admin'],
            summary: 'Get backup settings',
            description: 'Get current backup configuration including FTP/SFTP settings and schedule. Password is not returned.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'Backup settings',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    protocol: { type: 'string', enum: ['ftp', 'ftps', 'sftp'] },
                                    tls_mode: { type: 'string', enum: ['none', 'explicit', 'implicit'] },
                                    host: { type: 'string' },
                                    port: { type: 'integer' },
                                    username: { type: 'string' },
                                    hasPassword: { type: 'boolean' },
                                    remote_path: { type: 'string' },
                                    daily_enabled: { type: 'boolean' },
                                    daily_time: { type: 'string' },
                                    daily_retention: { type: 'integer' },
                                    weekly_enabled: { type: 'boolean' },
                                    weekly_day: { type: 'integer' },
                                    weekly_time: { type: 'string' },
                                    weekly_retention: { type: 'integer' },
                                    monthly_enabled: { type: 'boolean' },
                                    monthly_day: { type: 'integer' },
                                    monthly_time: { type: 'string' },
                                    monthly_retention: { type: 'integer' },
                                    schedulerStatus: { type: 'object' }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        },
        put: {
            tags: ['Backup', 'Admin'],
            summary: 'Update backup settings',
            description: 'Update backup configuration including FTP/SFTP connection and schedule settings.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                protocol: { type: 'string', enum: ['ftp', 'ftps', 'sftp'] },
                                tls_mode: { type: 'string', enum: ['none', 'explicit', 'implicit'] },
                                host: { type: 'string' },
                                port: { type: 'integer' },
                                username: { type: 'string' },
                                password: { type: 'string' },
                                remote_path: { type: 'string' },
                                daily_enabled: { type: 'boolean' },
                                daily_time: { type: 'string' },
                                daily_retention: { type: 'integer' },
                                weekly_enabled: { type: 'boolean' },
                                weekly_day: { type: 'integer' },
                                weekly_time: { type: 'string' },
                                weekly_retention: { type: 'integer' },
                                monthly_enabled: { type: 'boolean' },
                                monthly_day: { type: 'integer' },
                                monthly_time: { type: 'string' },
                                monthly_retention: { type: 'integer' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: { description: 'Settings updated' },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/backup/test-connection': {
        post: {
            tags: ['Backup', 'Admin'],
            summary: 'Test FTP/SFTP connection',
            description: 'Test connection to the configured FTP/SFTP server. If password is not provided, uses the stored password.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['host', 'username'],
                            properties: {
                                protocol: { type: 'string', enum: ['ftp', 'ftps', 'sftp'] },
                                tls_mode: { type: 'string', enum: ['none', 'explicit', 'implicit'] },
                                host: { type: 'string' },
                                port: { type: 'integer' },
                                username: { type: 'string' },
                                password: { type: 'string' },
                                remote_path: { type: 'string' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Connection test result',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/backup/run': {
        post: {
            tags: ['Backup', 'Admin'],
            summary: 'Run manual backup',
            description: 'Trigger a manual database backup and upload to the configured FTP/SFTP server.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            responses: {
                200: {
                    description: 'Backup result',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    filename: { type: 'string' },
                                    size: { type: 'integer' },
                                    uploaded: { type: 'boolean' }
                                }
                            }
                        }
                    }
                },
                403: { $ref: '#/components/responses/Forbidden' },
                500: { description: 'Backup failed' }
            }
        }
    },
    '/backup/history': {
        get: {
            tags: ['Backup', 'Admin'],
            summary: 'Get backup history',
            description: 'Get list of past backup operations with their status.',
            security: [{ cookieAuth: [] }],
            parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
            ],
            responses: {
                200: {
                    description: 'Backup history',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        backup_type: { type: 'string' },
                                        filename: { type: 'string' },
                                        file_size: { type: 'integer' },
                                        status: { type: 'string', enum: ['pending', 'running', 'success', 'failed'] },
                                        error_message: { type: 'string' },
                                        started_at: { type: 'string', format: 'date-time' },
                                        completed_at: { type: 'string', format: 'date-time' },
                                        uploaded: { type: 'boolean' }
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
    '/backup/history/{id}': {
        delete: {
            tags: ['Backup', 'Admin'],
            summary: 'Delete backup history entry',
            description: 'Delete a specific backup history entry.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
            responses: {
                200: { description: 'Entry deleted' },
                403: { $ref: '#/components/responses/Forbidden' }
            }
        }
    },
    '/backup/list-remote': {
        get: {
            tags: ['Backup', 'Admin'],
            summary: 'List remote backups',
            description: 'List backup files available on the remote FTP/SFTP server.',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'Remote backup files',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    files: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                name: { type: 'string' },
                                                size: { type: 'integer' },
                                                date: { type: 'string', format: 'date-time' }
                                            }
                                        }
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
    '/backup/restore': {
        post: {
            tags: ['Backup', 'Admin'],
            summary: 'Restore database from backup',
            description: 'Download a backup file from the remote server and restore the database. WARNING: This will overwrite all current data.',
            security: [{ cookieAuth: [], csrfToken: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['filename'],
                            properties: {
                                filename: { type: 'string', description: 'Name of the backup file to restore' }
                            }
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Restore result',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                400: { description: 'Filename required' },
                403: { $ref: '#/components/responses/Forbidden' },
                500: { description: 'Restore failed' }
            }
        }
    },
    '/backup/scheduler-status': {
        get: {
            tags: ['Backup', 'Admin'],
            summary: 'Get scheduler status',
            description: 'Get the current status of the backup scheduler (active jobs, next run times).',
            security: [{ cookieAuth: [] }],
            responses: {
                200: {
                    description: 'Scheduler status',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    daily: { type: 'boolean' },
                                    weekly: { type: 'boolean' },
                                    monthly: { type: 'boolean' }
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
    // API DOCUMENTATION
    // ============================================
    '/docs': {
        get: {
            tags: ['Documentation'],
            summary: 'Get OpenAPI specification',
            description: 'Returns the OpenAPI/Swagger specification as JSON.',
            responses: {
                200: { description: 'OpenAPI specification JSON' }
            }
        }
    },
    '/docs/ui': {
        get: {
            tags: ['Documentation'],
            summary: 'Swagger UI',
            description: 'Interactive API documentation using Swagger UI.',
            responses: {
                200: { description: 'HTML page with Swagger UI' }
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
