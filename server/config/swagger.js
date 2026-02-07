/**
 * Swagger/OpenAPI Configuration
 * API Documentation for ResumeConverter
 */

export const swaggerDocument = {
    openapi: '3.0.3',
    info: {
        title: 'ResumeConverter API',
        version: '1.5.3',
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
        { name: 'ROME', description: 'ROME métiers and competences management' },
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
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', example: 'John Doe' },
                    email: { type: 'string', format: 'email', example: 'john@example.com' },
                    role: { type: 'string', enum: ['admin', 'user', 'viewer'], default: 'user' },
                    status: { type: 'string', enum: ['active', 'inactive', 'pending'], default: 'active' },
                    customer: { type: 'string', example: 'Acme Corp' },
                    customerId: { type: 'string', format: 'uuid', nullable: true },
                    Name: { type: 'string', description: 'Alias for name (legacy)' },
                    Email: { type: 'string', description: 'Alias for email (legacy)' },
                    Role: { type: 'string', description: 'Alias for role (legacy)' },
                    Status: { type: 'string', description: 'Alias for status (legacy)' },
                    CustomerName: { type: 'string', description: 'Alias for customer (legacy)' },
                    createdAt: { type: 'string', format: 'date-time' },
                    lastLogin: { type: 'string', format: 'date-time', nullable: true }
                }
            },
            Resume: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    Name: { type: 'string', example: 'John Doe', description: 'Candidate name (or trigram in anonymous mode)' },
                    'Original Name': { type: 'string', description: 'Original candidate name before anonymization' },
                    Title: { type: 'string', example: 'Senior Developer' },
                    'File Name': { type: 'string' },
                    'Resume File': { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, filename: { type: 'string' }, size: { type: 'integer' }, type: { type: 'string' }, url: { type: 'string' } } } },
                    Status: { type: 'string', enum: ['new', 'pending', 'processing', 'analyzed', 'improved', 'error', 'failed'] },
                    CustomerName: { type: 'string' },
                    'Original Text': { type: 'string' },
                    'Improved Text': { type: 'string' },
                    'Global Rating': { type: 'string', example: '85%' },
                    'Skills Score': { type: 'string', example: '80%' },
                    'Experience Score': { type: 'string', example: '85%' },
                    'Education Score': { type: 'string', example: '75%' },
                    'ATS Score': { type: 'string', example: '88%' },
                    'Executive Summary Score': { type: 'string', example: '90%' },
                    'Hobbies Languages Score': { type: 'string', example: '70%' },
                    'Improved Global Rating': { type: 'string' },
                    'Improved Skills Score': { type: 'string' },
                    'Improved Experience Score': { type: 'string' },
                    'Improved Education Score': { type: 'string' },
                    'Improved ATS Score': { type: 'string' },
                    'Improved Executive Summary Score': { type: 'string' },
                    'Improved Hobbies Languages Score': { type: 'string' },
                    Skills: { type: 'array', items: { type: 'string' } },
                    Industries: { type: 'array', items: { type: 'string' } },
                    Tools: { type: 'array', items: { type: 'string' } },
                    'Soft Skills': { type: 'array', items: { type: 'string' } },
                    'Key Improvements': { type: 'array', items: { type: 'string' } },
                    Summary: { type: 'string' },
                    'Experience Years': { type: 'string' },
                    'Education Level': { type: 'string' },
                    Certifications: { type: 'array', items: { type: 'string' } },
                    Languages: { type: 'array', items: { type: 'string' } },
                    'Created At': { type: 'string', format: 'date-time' },
                    'Analyzed At': { type: 'string', format: 'date-time' },
                    'Updated At': { type: 'string', format: 'date-time' }
                }
            },
            Template: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', example: 'Professional Template' },
                    description: { type: 'string' },
                    popular: { type: 'boolean', default: false },
                    status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
                    tags: { type: 'array', items: { type: 'string' } },
                    previewImage: { type: 'string', nullable: true },
                    headerContent: { type: 'string' },
                    templateContent: { type: 'string' },
                    footerContent: { type: 'string' },
                    footerHeight: { type: 'integer', default: 25 },
                    stylesheet: { type: 'string' },
                    lastUpdated: { type: 'string', format: 'date-time' }
                }
            },
            Mission: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    Title: { type: 'string', example: 'Senior React Developer' },
                    Content: { type: 'string', description: 'HTML content of the mission description' },
                    Customer: { type: 'string' },
                    'Customer ID': { type: 'string', format: 'uuid' },
                    Status: { type: 'string', enum: ['active', 'completed', 'archived'], default: 'active' },
                    Keywords: { type: 'array', items: { type: 'string' }, description: 'AI-extracted keywords for matching' },
                    'Required Skills': { type: 'array', items: { type: 'string' } },
                    'Preferred Skills': { type: 'array', items: { type: 'string' } },
                    'Created At': { type: 'string', format: 'date-time' },
                    'Updated At': { type: 'string', format: 'date-time' }
                }
            },
            Adaptation: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    'Resume ID': { type: 'string', format: 'uuid' },
                    'Mission ID': { type: 'string', format: 'uuid' },
                    'Resume Name': { type: 'string' },
                    'Mission Title': { type: 'string' },
                    'Mission Content': { type: 'string' },
                    'Adapted Text': { type: 'string', description: 'HTML content of the adapted resume' },
                    'Match Score': { type: 'number', example: 85 },
                    'Match Analysis': { type: 'object', description: 'AI analysis of the match' },
                    Status: { type: 'string', enum: ['processing', 'completed', 'failed'] },
                    Customer: { type: 'string' },
                    'Created At': { type: 'string', format: 'date-time' },
                    'Updated At': { type: 'string', format: 'date-time' }
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
            MarketTrend: {
                type: 'object',
                description: 'Market trend data point',
                properties: {
                    id: { type: 'string' },
                    Type: { type: 'string', enum: ['embauche', 'demandeur', 'demandeur_entrant', 'offre', 'tension', 'salaire', 'dynamique'] },
                    CodeRome: { type: 'string', example: 'M1805' },
                    RomeLabel: { type: 'string', example: 'Études et développement informatique' },
                    Region: { type: 'string', example: 'Île-de-France' },
                    RegionCode: { type: 'string', example: '11' },
                    Date: { type: 'string', format: 'date' },
                    Value: { type: 'number' },
                    ValueLabel: { type: 'string' },
                    Metadata: { type: 'object', nullable: true }
                }
            },
            MarketFact: {
                type: 'object',
                description: 'Market fact data point',
                properties: {
                    id: { type: 'string' },
                    Date: { type: 'string', format: 'date' },
                    Source: { type: 'string', enum: ['france_travail', 'adzuna'] },
                    Keyword: { type: 'string' },
                    Location: { type: 'string' },
                    JobCount: { type: 'integer' },
                    MeanSalary: { type: 'number', nullable: true },
                    Metadata: { type: 'object' }
                }
            },
            RomeMetier: {
                type: 'object',
                description: 'ROME métier (job category)',
                properties: {
                    codeRome: { type: 'string', example: 'M1805' },
                    libelleRome: { type: 'string', example: 'Études et développement informatique' },
                    grandDomaine: { type: 'string', example: 'M - Support à l\'entreprise' },
                    domaineProfessionnel: { type: 'string' },
                    appellations: { type: 'array', items: { type: 'object' } },
                    competences: { type: 'array', items: { type: 'object' } }
                }
            },
            Customer: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    Name: { type: 'string', example: 'Acme Corp' },
                    Status: { type: 'string', enum: ['Active', 'Inactive'] },
                    'Created At': { type: 'string', format: 'date-time' }
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
        '/auth/signout': {
            post: {
                tags: ['Authentication'],
                summary: 'Sign out user',
                description: 'Logs out the user by clearing cookies and revoking tokens',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Logout successful' }
                }
            }
        },
        '/auth/register': {
            post: {
                tags: ['Authentication'],
                summary: 'Register new user',
                description: 'Creates a new user account (rate limited)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password', 'name'],
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string', minLength: 6 },
                                    name: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: { description: 'User created successfully' },
                    400: { $ref: '#/components/responses/ValidationError' },
                    409: { description: 'Email already exists' }
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
        '/resumes/stats': {
            get: {
                tags: ['Resumes'],
                summary: 'Get resume statistics',
                description: 'Returns dashboard KPIs including total count, status breakdown, and recent activity',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Resume statistics',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'integer' },
                                        byStatus: { type: 'object' },
                                        recentlyAnalyzed: { type: 'integer' },
                                        recentlyImproved: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/resumes/{id}/download': {
            get: {
                tags: ['Resumes'],
                summary: 'Download original CV file',
                description: 'Downloads the original uploaded CV file',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'File download',
                        content: {
                            'application/octet-stream': {
                                schema: { type: 'string', format: 'binary' }
                            }
                        }
                    },
                    404: { $ref: '#/components/responses/NotFound' }
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
        '/resumes/{id}/improve': {
            post: {
                tags: ['Resumes'],
                summary: 'Improve resume by ID',
                description: 'Improves an existing resume using AI',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Resume improved successfully' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/resumes/{id}/match': {
            post: {
                tags: ['Resumes'],
                summary: 'Match resume with mission',
                description: 'Analyzes how well a resume matches a specific mission',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['missionId'],
                                properties: {
                                    missionId: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Match analysis results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        matchScore: { type: 'number' },
                                        analysis: { type: 'object' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/resumes/{id}/adapt': {
            post: {
                tags: ['Resumes'],
                summary: 'Adapt resume for mission',
                description: 'Creates an adapted version of the resume tailored for a specific mission',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['missionId'],
                                properties: {
                                    missionId: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
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
        '/resumes/{id}/ai-modify': {
            post: {
                tags: ['Resumes'],
                summary: 'AI-powered resume modification',
                description: 'Modifies specific sections of a resume using AI based on user instructions',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['instruction'],
                                properties: {
                                    instruction: { type: 'string', description: 'User instruction for modification' },
                                    section: { type: 'string', description: 'Section to modify (optional)' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Modified resume content' }
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
                tags: ['Templates', 'Admin'],
                summary: 'Create template (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Template' }
                        }
                    }
                },
                responses: {
                    201: { description: 'Template created' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/templates/{id}': {
            get: {
                tags: ['Templates'],
                summary: 'Get template by ID',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'Template data',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Template' }
                            }
                        }
                    },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Templates', 'Admin'],
                summary: 'Update template (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Template' }
                        }
                    }
                },
                responses: {
                    200: { description: 'Template updated' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            delete: {
                tags: ['Templates', 'Admin'],
                summary: 'Delete template (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Template deleted' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' }
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
        '/tags/cleaned/recalculate': {
            post: {
                tags: ['Tags', 'Admin'],
                summary: 'Recalculate cleaned tags for all resumes',
                description: 'Batch processes all resumes to recalculate cleaned/normalized tags',
                security: [{ cookieAuth: [], csrfToken: [] }],
                responses: {
                    200: {
                        description: 'Recalculation results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        totalResumes: { type: 'integer' },
                                        updatedCount: { type: 'integer' },
                                        errorCount: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/tags/esco': {
            get: {
                tags: ['Tags'],
                summary: 'Get ESCO normalized tags',
                description: 'Returns tags mapped to ESCO (European Skills/Competences) taxonomy',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'ESCO tags by category',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        skills: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, uri: { type: 'string' } } } },
                                        industries: { type: 'array', items: { type: 'object' } },
                                        tools: { type: 'array', items: { type: 'object' } },
                                        softSkills: { type: 'array', items: { type: 'object' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/tags/esco/recalculate': {
            post: {
                tags: ['Tags', 'Admin'],
                summary: 'Recalculate ESCO tags for all resumes',
                description: 'Batch processes all resumes to map cleaned tags to ESCO taxonomy',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    language: { type: 'string', enum: ['fr', 'en'], default: 'fr' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Recalculation results' }
                }
            }
        },
        '/tags/rename': {
            put: {
                tags: ['Tags'],
                summary: 'Rename a tag across all resumes',
                description: 'Renames a tag in a specific category across all resumes using optimized SQL',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['category', 'oldName', 'newName'],
                                properties: {
                                    category: { type: 'string', enum: ['Skills', 'Industries', 'Tools', 'Soft Skills'] },
                                    oldName: { type: 'string' },
                                    newName: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Rename results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        updatedCount: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    }
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
                tags: ['Customers', 'Admin'],
                summary: 'Create customer (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Customer' }
                        }
                    }
                },
                responses: {
                    201: { description: 'Customer created' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/customers/{id}': {
            get: {
                tags: ['Customers'],
                summary: 'Get customer by ID',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'Customer data',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Customer' }
                            }
                        }
                    },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Customers', 'Admin'],
                summary: 'Update customer (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Customer' }
                        }
                    }
                },
                responses: {
                    200: { description: 'Customer updated' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            delete: {
                tags: ['Customers', 'Admin'],
                summary: 'Delete customer (admin only)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Customer deleted' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' }
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
        '/market-radar/trends/all': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get all trends for map view',
                description: 'Returns all trends without metadata for efficient map rendering. Uses server-side cache.',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by trend type' }
                ],
                responses: {
                    200: {
                        description: 'All trends grouped by type',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        trends: { type: 'array', items: { $ref: '#/components/schemas/MarketTrend' } },
                                        byType: { type: 'object' },
                                        totalCount: { type: 'integer' },
                                        duration: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/market-radar/trends/{id}/metadata': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get trend metadata',
                description: 'Returns detailed metadata for a specific trend (on-demand loading)',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'Trend with metadata',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/MarketTrend' }
                            }
                        }
                    },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/market-radar/trends/filters': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get trend filter options',
                description: 'Returns available filter values (types, regions, ROME codes)',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Filter options',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        types: { type: 'array', items: { type: 'string' } },
                                        regions: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' } } } },
                                        romeCodes: { type: 'array', items: { type: 'string' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/market-radar/trends/collect': {
            post: {
                tags: ['Market Radar', 'Admin'],
                summary: 'Trigger trends collection (admin only)',
                description: 'Starts background collection of market trends from France Travail API',
                security: [{ cookieAuth: [], csrfToken: [] }],
                responses: {
                    202: { description: 'Collection started in background' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/market-radar/facts/all': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get all facts',
                description: 'Returns all market facts for frontend processing. Uses server-side cache.',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'All facts',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        facts: { type: 'array', items: { $ref: '#/components/schemas/MarketFact' } },
                                        totalCount: { type: 'integer' },
                                        duration: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/market-radar/facts/filters': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get fact filter options',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Available filter options' }
                }
            }
        },
        '/market-radar/facts/summary': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get facts summary',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'Aggregated facts summary' }
                }
            }
        },
        '/market-radar/collect': {
            post: {
                tags: ['Market Radar', 'Admin'],
                summary: 'Trigger full data collection (admin only)',
                description: 'Starts collection from all sources (France Travail, Adzuna)',
                security: [{ cookieAuth: [], csrfToken: [] }],
                responses: {
                    200: { description: 'Collection results' },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/market-radar/search/france-travail': {
            get: {
                tags: ['Market Radar'],
                summary: 'Live search on France Travail',
                description: 'Real-time job search on France Travail API',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'motsCles', in: 'query', schema: { type: 'string' } },
                    { name: 'codeROME', in: 'query', schema: { type: 'string' } },
                    { name: 'departement', in: 'query', schema: { type: 'string' } },
                    { name: 'region', in: 'query', schema: { type: 'string' } },
                    { name: 'typeContrat', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Search results' }
                }
            }
        },
        '/market-radar/search/adzuna': {
            get: {
                tags: ['Market Radar'],
                summary: 'Live search on Adzuna',
                description: 'Real-time job search on Adzuna API',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'what', in: 'query', schema: { type: 'string' } },
                    { name: 'where', in: 'query', schema: { type: 'string' } },
                    { name: 'category', in: 'query', schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Search results' }
                }
            }
        },

        // ============================================
        // ROME MÉTIERS
        // ============================================
        '/rome/metiers': {
            get: {
                tags: ['ROME'],
                summary: 'Get stored métiers',
                description: 'Returns ROME métiers stored in PostgreSQL with pagination',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'codeRome', in: 'query', schema: { type: 'string' } },
                    { name: 'grandDomaine', in: 'query', schema: { type: 'string' } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } }
                ],
                responses: {
                    200: {
                        description: 'List of métiers',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        metiers: { type: 'array', items: { $ref: '#/components/schemas/RomeMetier' } },
                                        totalCount: { type: 'integer' },
                                        pagination: { type: 'object' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/rome/metiers/stats': {
            get: {
                tags: ['ROME'],
                summary: 'Get métiers statistics',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Global statistics',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        totalMetiers: { type: 'integer' },
                                        totalCompetences: { type: 'integer' },
                                        lastUpdate: { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/rome/metiers/{codeRome}': {
            get: {
                tags: ['ROME'],
                summary: 'Get métier by ROME code',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'codeRome', in: 'path', required: true, schema: { type: 'string' }, example: 'M1805' }
                ],
                responses: {
                    200: {
                        description: 'Métier details',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/RomeMetier' }
                            }
                        }
                    },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/rome/collect': {
            post: {
                tags: ['ROME', 'Admin'],
                summary: 'Collect IT métiers (admin only)',
                description: 'Fetches IT métiers from France Travail ROME API and stores them',
                security: [{ cookieAuth: [], csrfToken: [] }],
                responses: {
                    200: {
                        description: 'Collection results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        metiersCollected: { type: 'integer' },
                                        competencesCollected: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    },
                    403: { $ref: '#/components/responses/Forbidden' }
                }
            }
        },
        '/rome/api/grands-domaines': {
            get: {
                tags: ['ROME'],
                summary: 'Get grands domaines (live API)',
                description: 'Fetches grands domaines directly from France Travail ROME API',
                security: [{ cookieAuth: [] }],
                responses: {
                    200: { description: 'List of grands domaines' }
                }
            }
        },
        '/rome/api/search': {
            get: {
                tags: ['ROME'],
                summary: 'Search métiers (live API)',
                description: 'Searches métiers by keyword on France Travail ROME API',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'q', in: 'query', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Search results' }
                }
            }
        },

        // ============================================
        // MISSIONS (additional endpoints)
        // ============================================
        '/missions/{id}': {
            get: {
                tags: ['Missions'],
                summary: 'Get mission by ID',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'Mission data',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Mission' }
                            }
                        }
                    },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Missions'],
                summary: 'Update mission',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Mission updated' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            },
            delete: {
                tags: ['Missions'],
                summary: 'Delete mission',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Mission deleted' },
                    404: { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/missions/{missionId}/adaptations': {
            get: {
                tags: ['Missions', 'Adaptations'],
                summary: 'Get adaptations for a mission',
                security: [{ cookieAuth: [] }],
                parameters: [
                    { name: 'missionId', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: {
                        description: 'List of adaptations',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Adaptation' }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/missions/{missionId}/find-profiles': {
            post: {
                tags: ['Missions'],
                summary: 'Find matching profiles for a mission',
                description: 'Uses AI to extract keywords from mission and find best matching resumes',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'missionId', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    limit: { type: 'integer', default: 10 },
                                    minScore: { type: 'number', default: 0 },
                                    status: { type: 'string' },
                                    weights: { type: 'object' }
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
                                        success: { type: 'boolean' },
                                        keywords: { type: 'object' },
                                        profiles: { type: 'array', items: { type: 'object' } },
                                        totalMatched: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/missions/{missionId}/analyze-profile/{resumeId}': {
            post: {
                tags: ['Missions'],
                summary: 'Detailed profile analysis for a mission',
                description: 'Uses LLM to provide detailed analysis of how well a profile matches a mission',
                security: [{ cookieAuth: [], csrfToken: [] }],
                parameters: [
                    { name: 'missionId', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'resumeId', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    200: { description: 'Detailed analysis results' }
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
