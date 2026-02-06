/**
 * Swagger/OpenAPI Configuration
 * API Documentation for ResumeConverter
 */

export const swaggerDocument = {
    openapi: '3.0.3',
    info: {
        title: 'ResumeConverter API',
        version: '1.5.1',
        description: 'API for managing resumes, templates, missions, and adaptations with AI-powered analysis and improvement. Includes AI chatbot assistant, market radar, and comprehensive metrics. Supports anonymous CV mode with trigram-based anonymization.',
        contact: {
            name: 'API Support'
        },
        license: {
            name: 'Private'
        }
    },
    servers: [
        {
            url: '/api',
            description: 'API Server'
        }
    ],
    tags: [
        { name: 'Authentication', description: 'User authentication and session management' },
        { name: 'Resumes', description: 'Resume CRUD and AI analysis' },
        { name: 'Templates', description: 'Resume template management' },
        { name: 'Missions', description: 'Job mission management' },
        { name: 'Adaptations', description: 'Resume-to-mission adaptations' },
        { name: 'LLM', description: 'AI/LLM proxy endpoints' },
        { name: 'Chatbot', description: 'AI chatbot assistant' },
        { name: 'Settings', description: 'Application settings management' },
        { name: 'Health', description: 'Health check and system status' },
        { name: 'Metrics', description: 'Application metrics and monitoring' },
        { name: 'Tags', description: 'Resume tags management' },
        { name: 'Customers', description: 'Customer management' },
        { name: 'Users', description: 'User management' },
        { name: 'Market Radar', description: 'Labor market data and trends' },
        { name: 'Admin', description: 'Administrative endpoints' }
    ],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'accessToken',
                description: 'JWT token stored in httpOnly cookie'
            },
            csrfToken: {
                type: 'apiKey',
                in: 'header',
                name: 'x-csrf-token',
                description: 'CSRF token for state-changing requests'
            }
        },
        schemas: {
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'recABCDEF123456' },
                    Name: { type: 'string', example: 'John Doe' },
                    Email: { type: 'string', format: 'email', example: 'john@example.com' },
                    Role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
                    Status: { type: 'string', enum: ['Active', 'Inactive', 'Pending'] },
                    CustomerName: { type: 'string', example: 'Acme Corp' }
                }
            },
            Resume: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'recABCDEF123456' },
                    Name: { type: 'string', example: 'John Doe', description: 'Candidate name (or trigram in anonymous mode)' },
                    'Original Name': { type: 'string', example: 'John Doe', description: 'Original candidate name before anonymization' },
                    Title: { type: 'string', example: 'Senior Developer' },
                    Status: { type: 'string', enum: ['New', 'Pending', 'Processing', 'Analyzed', 'Improved', 'Error', 'Failed'] },
                    'Original Text': { type: 'string' },
                    'Improved Text': { type: 'string' },
                    'Global Rating': { type: 'string', example: '85%' },
                    'Executive Summary Score': { type: 'string', example: '90%' },
                    'Skills Score': { type: 'string', example: '80%' },
                    'Experience Score': { type: 'string', example: '85%' },
                    'Education Score': { type: 'string', example: '75%' },
                    'ATS Score': { type: 'string', example: '88%' },
                    'Hobbies Languages Score': { type: 'string', example: '70%' },
                    CustomerName: { type: 'string' },
                    'Created At': { type: 'string', format: 'date-time' },
                    'Analysis Date': { type: 'string', format: 'date-time' },
                    'Last Improved': { type: 'string', format: 'date-time' }
                }
            },
            Template: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'recABCDEF123456' },
                    Name: { type: 'string', example: 'Professional Template' },
                    Content: { type: 'string' },
                    Description: { type: 'string' },
                    Category: { type: 'string' },
                    'Is Default': { type: 'boolean' }
                }
            },
            Mission: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'recABCDEF123456' },
                    Title: { type: 'string', example: 'Senior React Developer' },
                    Content: { type: 'string' },
                    Customer: { type: 'string' },
                    Status: { type: 'string', enum: ['Active', 'Completed', 'Archived'] }
                }
            },
            Adaptation: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'recABCDEF123456' },
                    Resume: { type: 'array', items: { type: 'string' } },
                    Mission: { type: 'array', items: { type: 'string' } },
                    'Adapted Text': { type: 'string' },
                    'Match Score': { type: 'number', example: 85 },
                    Status: { type: 'string', enum: ['Processing', 'Completed', 'Failed'] }
                }
            },
            PaginatedResponse: {
                type: 'object',
                properties: {
                    data: { type: 'array', items: { type: 'object' } },
                    pagination: {
                        type: 'object',
                        properties: {
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            hasMore: { type: 'boolean' },
                            nextOffset: { type: 'string', nullable: true }
                        }
                    }
                }
            },
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    message: { type: 'string' }
                }
            },
            LoginRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 6 }
                }
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/User' },
                    csrfToken: { type: 'string' }
                }
            },
            Settings: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'recABCDEF123456' },
                    llmModel: { type: 'string', example: 'gpt-4o', description: 'LLM model to use for AI operations' },
                    cvMode: { type: 'string', enum: ['nominative', 'anonymous'], example: 'nominative', description: 'CV mode: nominative (with personal info) or anonymous (with trigram)' },
                    chatbotEnabled: { type: 'string', enum: ['on', 'off'], example: 'on' },
                    'Analysis Prompt': { type: 'string', description: 'Custom prompt for CV analysis' },
                    'Improvement Prompt': { type: 'string', description: 'Custom prompt for CV improvement. Use {ANONYMIZATION_RULES} placeholder for mode-specific rules' },
                    'Match Analysis Prompt': { type: 'string' },
                    'Adaptation Prompt': { type: 'string' },
                    'Executive Summary Weight': { type: 'number', example: 20 },
                    'Skills Weight': { type: 'number', example: 20 },
                    'Experience Weight': { type: 'number', example: 20 },
                    'Education Weight': { type: 'number', example: 15 },
                    'ATS Weight': { type: 'number', example: 15 },
                    'Hobbies Languages Weight': { type: 'number', example: 10 }
                }
            },
            ChatbotMessage: {
                type: 'object',
                required: ['message'],
                properties: {
                    message: { type: 'string', example: 'Comment puis-je analyser un CV ?' },
                    conversationHistory: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                role: { type: 'string', enum: ['user', 'assistant'] },
                                content: { type: 'string' }
                            }
                        }
                    }
                }
            },
            ChatbotResponse: {
                type: 'object',
                properties: {
                    response: { type: 'string' },
                    model: { type: 'string', example: 'gpt-4o' },
                    usage: {
                        type: 'object',
                        properties: {
                            prompt_tokens: { type: 'integer' },
                            completion_tokens: { type: 'integer' },
                            total_tokens: { type: 'integer' }
                        }
                    }
                }
            },
            ResumeAnalysis: {
                type: 'object',
                description: 'AI analysis results for a resume',
                properties: {
                    name: { type: 'string', example: 'John Doe', description: 'Candidate name (or trigram in anonymous mode)' },
                    originalName: { type: 'string', example: 'John Doe', description: 'Original name before anonymization (only in anonymous mode)' },
                    title: { type: 'string', example: 'Senior Developer' },
                    globalRating: { type: 'string', example: '85%' },
                    executiveSummaryRating: { type: 'string', example: '90%' },
                    skillsRating: { type: 'string', example: '80%' },
                    experiencesRating: { type: 'string', example: '85%' },
                    educationRating: { type: 'string', example: '75%' },
                    atsOptimizationRating: { type: 'string', example: '88%' },
                    hobbiesLanguagesRating: { type: 'string', example: '70%' },
                    tags: {
                        type: 'object',
                        properties: {
                            skills: { type: 'array', items: { type: 'string' }, example: ['JavaScript', 'React', 'Node.js'] },
                            industries: { type: 'array', items: { type: 'string' }, example: ['Technology', 'Finance'] },
                            tools: { type: 'array', items: { type: 'string' }, example: ['Git', 'Docker', 'AWS'] },
                            softSkills: { type: 'array', items: { type: 'string' }, example: ['Leadership', 'Communication'] }
                        }
                    },
                    suggestions: {
                        type: 'object',
                        properties: {
                            executiveSummary: { type: 'array', items: { type: 'string' } },
                            skills: { type: 'array', items: { type: 'string' } },
                            experiences: { type: 'array', items: { type: 'string' } },
                            education: { type: 'array', items: { type: 'string' } },
                            hobbiesLanguages: { type: 'array', items: { type: 'string' } },
                            atsOptimization: { type: 'array', items: { type: 'string' } }
                        }
                    }
                }
            }
        },
        responses: {
            Unauthorized: {
                description: 'Authentication required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            Forbidden: {
                description: 'Insufficient permissions',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            NotFound: {
                description: 'Resource not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' }
                    }
                }
            },
            ValidationError: {
                description: 'Validation error',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string' },
                                details: { type: 'array', items: { type: 'object' } }
                            }
                        }
                    }
                }
            }
        }
    },
    paths: {
        // ============================================
        // AUTHENTICATION
        // ============================================
        '/auth/signin': {
            post: {
                tags: ['Authentication'],
                summary: 'Sign in user',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LoginRequest' }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginResponse' }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    400: { $ref: '#/components/responses/ValidationError' }
                }
            }
        },
        '/auth/logout': {
            post: {
                tags: ['Authentication'],
                summary: 'Sign out user',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Logout successful' }
                }
            }
        },
        '/auth/refresh': {
            post: {
                tags: ['Authentication'],
                summary: 'Refresh access token',
                responses: {
                    200: { description: 'Token refreshed' },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
            }
        },
        '/auth/me': {
            get: {
                tags: ['Authentication'],
                summary: 'Get current user',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Current user data',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/User' }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
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
                    { name: 'status', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'List of resumes',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaginatedResponse' }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
            }
        },
        '/resumes/{id}': {
            get: {
                tags: ['Resumes'],
                summary: 'Get resume by ID',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'Resume data',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Resume' }
                            }
                        }
                    },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Resumes'],
                summary: 'Update resume',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Resume' }
                        }
                    }
                },
                responses: {
                    200: { description: 'Resume updated' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            delete: {
                tags: ['Resumes'],
                summary: 'Delete resume',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Resume deleted' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/resumes/upload': {
            post: {
                tags: ['Resumes'],
                summary: 'Upload a new resume',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: { type: 'string', format: 'binary' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Resume uploaded',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Resume' }
                            }
                        }
                    },
                    400: { $ref: '#/components/responses/ValidationError' }
                }
            }
        },
        '/resumes/{id}/analyze': {
            post: {
                tags: ['Resumes'],
                summary: 'Analyze resume with AI',
                description: 'Analyzes a resume using AI. In anonymous mode (cvMode=anonymous), the candidate name is replaced with a trigram.',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'Analysis results including ratings and suggestions',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ResumeAnalysis' }
                            }
                        }
                    },
                    400: { description: 'Resume has no text content' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    500: { description: 'LLM model not configured' }
                }
            }
        },
        '/resumes/analyze-text': {
            post: {
                tags: ['Resumes'],
                summary: 'Analyze resume text directly',
                description: 'Analyzes raw resume text without requiring an existing resume record. In anonymous mode, the candidate name is replaced with a trigram.',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['text'],
                                properties: {
                                    text: { type: 'string', description: 'Raw resume text to analyze' }
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
                                schema: { $ref: '#/components/schemas/ResumeAnalysis' }
                            }
                        }
                    },
                    400: { description: 'Text is required' },
                    500: { description: 'LLM model not configured' }
                }
            }
        },
        '/resumes/improve': {
            post: {
                tags: ['Resumes'],
                summary: 'Improve resume with AI',
                description: 'Improves a resume using AI based on analysis. In anonymous mode (cvMode=anonymous), personal information is removed and replaced with a trigram.',
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
                                    analysis: {
                                        type: 'object',
                                        description: 'Previous analysis results',
                                        properties: {
                                            name: { type: 'string', description: 'Candidate name (or trigram)' },
                                            originalName: { type: 'string', description: 'Original name before anonymization' },
                                            title: { type: 'string' },
                                            globalRating: { type: 'string' },
                                            suggestions: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Improved resume with new analysis',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        improvedText: { type: 'string', description: 'Improved resume HTML' },
                                        analysis: { $ref: '#/components/schemas/ResumeAnalysis' }
                                    }
                                }
                            }
                        }
                    },
                    400: { description: 'Resume text is required' },
                    500: { description: 'LLM model not configured' }
                }
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
                responses: {
                    200: {
                        description: 'List of templates',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Template' }
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['Templates'],
                summary: 'Create template',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Template' }
                        }
                    }
                },
                responses: {
                    201: { description: 'Template created' }
                }
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
                    { name: 'limit', in: 'query', schema: { type: 'integer' } }
                ],
                responses: {
                    200: {
                        description: 'List of missions',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaginatedResponse' }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['Missions'],
                summary: 'Create mission',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Mission' }
                        }
                    }
                },
                responses: {
                    201: { description: 'Mission created' }
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
                    { name: 'resumeId', in: 'query', schema: { type: 'string' } },
                    { name: 'missionId', in: 'query', schema: { type: 'string' } },
                    { name: 'page', in: 'query', schema: { type: 'integer' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer' } }
                ],
                responses: {
                    200: {
                        description: 'List of adaptations',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaginatedResponse' }
                            }
                        }
                    }
                }
            }
        },
        '/adaptations/create': {
            post: {
                tags: ['Adaptations'],
                summary: 'Create adaptation (adapt resume to mission)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['resumeId', 'missionId'],
                                properties: {
                                    resumeId: { type: 'string' },
                                    missionId: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Adaptation created',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Adaptation' }
                            }
                        }
                    }
                }
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
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    messages: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                                                content: { type: 'string' }
                                            }
                                        }
                                    },
                                    model: { type: 'string' },
                                    temperature: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'LLM response' },
                    429: { description: 'Rate limit exceeded' }
                }
            }
        },
        '/llm/anthropic': {
            post: {
                tags: ['LLM'],
                summary: 'Proxy request to Anthropic',
                security: [{ cookieAuth: [], csrfToken: [] }],
                responses: {
                    200: { description: 'LLM response' },
                    429: { description: 'Rate limit exceeded' }
                }
            }
        },
        '/llm/circuit-breakers': {
            get: {
                tags: ['LLM', 'Admin'],
                summary: 'Get circuit breaker states (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Circuit breaker states',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        openai: {
                                            type: 'object',
                                            properties: {
                                                state: { type: 'string', enum: ['CLOSED', 'OPEN', 'HALF_OPEN'] },
                                                failures: { type: 'integer' }
                                            }
                                        },
                                        anthropic: { type: 'object' },
                                        airtable: { type: 'object' }
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
        // SETTINGS
        // ============================================
        '/settings': {
            get: {
                tags: ['Settings'],
                summary: 'Get application settings',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Settings data',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Settings' }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' }
                }
            },
            post: {
                tags: ['Settings', 'Admin'],
                summary: 'Create settings (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Settings' }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Settings created',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Settings' }
                            }
                        }
                    },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/settings/{id}': {
            put: {
                tags: ['Settings', 'Admin'],
                summary: 'Update settings (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Settings' }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Settings updated',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Settings' }
                            }
                        }
                    },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            }
        },

        // ============================================
        // CHATBOT
        // ============================================
        '/chatbot/message': {
            post: {
                tags: ['Chatbot'],
                summary: 'Send message to AI chatbot',
                description: 'Send a message to the AI assistant chatbot. The chatbot uses the LLM model configured in settings and has access to the user guide for contextual help.',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ChatbotMessage' }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Chatbot response',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ChatbotResponse' }
                            }
                        }
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    429: { description: 'Rate limit exceeded' },
                    500: { description: 'LLM service error' }
                }
            }
        },

        // ============================================
        // ADMIN
        // ============================================
        '/admin/metrics': {
            get: {
                tags: ['Admin'],
                summary: 'Get application metrics (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Metrics data' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/auth/users': {
            get: {
                tags: ['Admin'],
                summary: 'Get all users (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'List of users',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/User' }
                                }
                            }
                        }
                    },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            },
            post: {
                tags: ['Admin'],
                summary: 'Create user (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                responses: {
                    201: { description: 'User created' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },

        // ============================================
        // HEALTH
        // ============================================
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check endpoint',
                description: 'Returns comprehensive health status including server, database, memory, and cache status',
                responses: {
                    200: {
                        description: 'System is healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                                        timestamp: { type: 'string', format: 'date-time' },
                                        responseTime: { type: 'string', example: '15ms' },
                                        checks: {
                                            type: 'object',
                                            properties: {
                                                server: { type: 'object' },
                                                database: {
                                                    type: 'object',
                                                    properties: {
                                                        status: { type: 'string' },
                                                        latency: { type: 'string' },
                                                        size: { type: 'string' },
                                                        tables: { type: 'object' }
                                                    }
                                                },
                                                memory: { type: 'object' },
                                                cache: { type: 'object' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    503: { description: 'System is unhealthy' }
                }
            }
        },

        // ============================================
        // METRICS
        // ============================================
        '/metrics': {
            get: {
                tags: ['Metrics'],
                summary: 'Get all metrics (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Complete metrics data' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/metrics/summary': {
            get: {
                tags: ['Metrics'],
                summary: 'Get metrics summary (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Metrics summary',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        uptime: { type: 'string' },
                                        requests: { type: 'object' },
                                        cache: { type: 'object' },
                                        errors: { type: 'object' },
                                        memory: { type: 'object' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/metrics/database': {
            get: {
                tags: ['Metrics'],
                summary: 'Get database metrics (admin only)',
                description: 'Returns PostgreSQL database statistics including size, table stats, and connection info',
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
                                                size: { type: 'integer' },
                                                sizePretty: { type: 'string', example: '50 MB' }
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
                                                    lastAnalyze: { type: 'string', format: 'date-time', nullable: true }
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
                                        queryTime: { type: 'string', example: '25ms' },
                                        timestamp: { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/metrics/performance': {
            get: {
                tags: ['Metrics'],
                summary: 'Get performance metrics (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Performance metrics' }
                }
            }
        },
        '/metrics/llm': {
            get: {
                tags: ['Metrics'],
                summary: 'Get LLM usage metrics (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'LLM metrics',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        requests: { type: 'integer' },
                                        byProvider: { type: 'object' },
                                        totalTokens: { type: 'integer' },
                                        errors: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/metrics/cache': {
            get: {
                tags: ['Metrics'],
                summary: 'Get cache metrics (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Cache metrics' }
                }
            }
        },
        '/metrics/errors': {
            get: {
                tags: ['Metrics'],
                summary: 'Get error metrics (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Error metrics' }
                }
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
                responses: {
                    200: {
                        description: 'Raw tags by category',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        skills: { type: 'array', items: { type: 'string' } },
                                        industries: { type: 'array', items: { type: 'string' } },
                                        tools: { type: 'array', items: { type: 'string' } },
                                        softSkills: { type: 'array', items: { type: 'string' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/tags/cleaned': {
            get: {
                tags: ['Tags'],
                summary: 'Get cleaned/normalized tags',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Cleaned tags by category' }
                }
            }
        },

        // ============================================
        // CUSTOMERS
        // ============================================
        '/customers': {
            get: {
                tags: ['Customers'],
                summary: 'Get all customers',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
                    { name: 'search', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'List of customers',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaginatedResponse' }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['Customers'],
                summary: 'Create customer (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                responses: {
                    201: { description: 'Customer created' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },

        // ============================================
        // USERS
        // ============================================
        '/users': {
            get: {
                tags: ['Users'],
                summary: 'Get all users (admin only)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'List of users' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/users/{id}': {
            get: {
                tags: ['Users'],
                summary: 'Get user by ID',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'User data' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Users'],
                summary: 'Update user (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'User updated' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },

        // ============================================
        // MARKET RADAR
        // ============================================
        '/market-radar/facts': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get market facts',
                description: 'Returns labor market data collected from France Travail and other sources',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                    { name: 'keyword', in: 'query', schema: { type: 'string' } },
                    { name: 'location', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Market facts data' }
                }
            }
        },
        '/market-radar/trends': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get market trends',
                description: 'Returns aggregated labor market trends by region and job type',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'type', in: 'query', schema: { type: 'string' } },
                    { name: 'regionCode', in: 'query', schema: { type: 'string' } },
                    { name: 'codeRome', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Market trends data' }
                }
            }
        },
        '/market-radar/trends/summary': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get trends summary',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Aggregated trends summary' }
                }
            }
        },

        // ============================================
        // API DOCUMENTATION
        // ============================================
        '/docs': {
            get: {
                tags: ['Admin'],
                summary: 'Get OpenAPI specification',
                responses: {
                    200: { description: 'OpenAPI JSON specification' }
                }
            }
        },
        '/docs/ui': {
            get: {
                tags: ['Admin'],
                summary: 'Swagger UI',
                description: 'Interactive API documentation interface',
                responses: {
                    200: { description: 'Swagger UI HTML page' }
                }
            }
        }
    }
};
