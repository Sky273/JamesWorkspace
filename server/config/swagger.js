/**
 * Swagger/OpenAPI Configuration
 * API Documentation for ResumeConverter
 * Updated to match current database schema and routes
 */

import { swaggerPaths } from './swagger.paths.js';

export const swaggerDocument = {
    openapi: '3.0.3',
    info: {
        title: 'ResumeConverter API',
        version: '2.0.0',
        description: 'API for managing resumes, templates, missions, and adaptations with AI-powered analysis and improvement. Includes AI chatbot assistant, market radar, client/prospect management, and comprehensive metrics.',
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
        { name: 'Users', description: 'User management' },
        { name: 'Firms', description: 'Firm/organization management' },
        { name: 'Resumes', description: 'Resume CRUD and AI analysis' },
        { name: 'Resume Versions', description: 'Resume version history' },
        { name: 'Templates', description: 'Resume template management' },
        { name: 'Missions', description: 'Job mission management' },
        { name: 'Adaptations', description: 'Resume-to-mission adaptations' },
        { name: 'Clients', description: 'Client and prospect management' },
        { name: 'Submissions', description: 'Resume submission tracking' },
        { name: 'Mail', description: 'Email OAuth and draft creation' },
        { name: 'LLM', description: 'AI/LLM proxy endpoints' },
        { name: 'Chatbot', description: 'AI chatbot assistant' },
        { name: 'Settings', description: 'Application settings management' },
        { name: 'Tags', description: 'Resume tags management' },
        { name: 'Market Radar', description: 'Labor market data and trends' },
        { name: 'ROME', description: 'ROME métiers and competences' },
        { name: 'Health', description: 'Health check and system status' },
        { name: 'Metrics', description: 'Application metrics and monitoring' },
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
            // ============================================
            // CORE SCHEMAS
            // ============================================
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    role: { type: 'string', enum: ['admin', 'user'] },
                    status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
                    firm_id: { type: 'string', format: 'uuid', nullable: true },
                    firm_name: { type: 'string', nullable: true },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                    last_login: { type: 'string', format: 'date-time', nullable: true }
                }
            },
            Firm: {
                type: 'object',
                description: 'Organization/company using the platform',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', example: 'Acme Corp' },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' }
                }
            },
            Resume: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', description: 'Candidate name' },
                    original_name: { type: 'string', description: 'Original name before anonymization' },
                    title: { type: 'string', example: 'Senior Developer' },
                    file_name: { type: 'string' },
                    resume_file_url: { type: 'string' },
                    resume_file_size: { type: 'integer' },
                    resume_file_type: { type: 'string' },
                    status: { type: 'string', enum: ['new', 'pending', 'processing', 'analyzed', 'improved', 'error', 'failed', 'active', 'inactive', 'archived'] },
                    firm_id: { type: 'string', format: 'uuid' },
                    firm_name: { type: 'string' },
                    original_text: { type: 'string' },
                    improved_text: { type: 'string' },
                    global_rating: { type: 'integer', minimum: 0, maximum: 100 },
                    skills_score: { type: 'integer' },
                    experience_score: { type: 'integer' },
                    education_score: { type: 'integer' },
                    ats_score: { type: 'integer' },
                    executive_summary_score: { type: 'integer' },
                    hobbies_languages_score: { type: 'integer' },
                    improved_global_rating: { type: 'integer' },
                    skills: { type: 'array', items: { type: 'string' } },
                    industries: { type: 'array', items: { type: 'string' } },
                    tools: { type: 'array', items: { type: 'string' } },
                    soft_skills: { type: 'array', items: { type: 'string' } },
                    key_improvements: { type: 'string' },
                    summary: { type: 'string' },
                    experience_years: { type: 'integer' },
                    education_level: { type: 'string' },
                    certifications: { type: 'array', items: { type: 'string' } },
                    languages: { type: 'array', items: { type: 'string' } },
                    template_id: { type: 'string', format: 'uuid' },
                    current_version: { type: 'integer' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                    analyzed_at: { type: 'string', format: 'date-time' }
                }
            },
            ResumeVersion: {
                type: 'object',
                description: 'Historical version of an improved CV',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    resume_id: { type: 'string', format: 'uuid' },
                    version_number: { type: 'integer' },
                    improved_text: { type: 'string' },
                    improved_global_rating: { type: 'integer' },
                    improved_skills_score: { type: 'integer' },
                    improved_experience_score: { type: 'integer' },
                    improved_education_score: { type: 'integer' },
                    improved_ats_score: { type: 'integer' },
                    change_reason: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    created_by: { type: 'string', format: 'uuid' }
                }
            },
            Template: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    popular: { type: 'boolean' },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                    tags: { type: 'array', items: { type: 'string' } },
                    preview_image_url: { type: 'string' },
                    header_content: { type: 'string' },
                    template_content: { type: 'string' },
                    footer_content: { type: 'string' },
                    footer_height: { type: 'integer' },
                    stylesheet: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' }
                }
            },
            Mission: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    content: { type: 'string', description: 'HTML content of the mission' },
                    firm_id: { type: 'string', format: 'uuid' },
                    firm: { type: 'string' },
                    client_id: { type: 'string', format: 'uuid' },
                    status: { type: 'string', enum: ['active', 'completed', 'archived'] },
                    keywords: { type: 'array', items: { type: 'string' } },
                    required_skills: { type: 'array', items: { type: 'string' } },
                    preferred_skills: { type: 'array', items: { type: 'string' } },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' }
                }
            },
            Adaptation: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    resume_id: { type: 'string', format: 'uuid' },
                    mission_id: { type: 'string', format: 'uuid' },
                    resume_name: { type: 'string' },
                    mission_title: { type: 'string' },
                    mission_content: { type: 'string' },
                    adapted_text: { type: 'string' },
                    adaptation_notes: { type: 'string' },
                    match_score: { type: 'number' },
                    match_analysis: { type: 'object' },
                    status: { type: 'string', enum: ['draft', 'processing', 'completed', 'final', 'sent', 'archived', 'failed'] },
                    firm_id: { type: 'string', format: 'uuid' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' }
                }
            },
            Client: {
                type: 'object',
                description: 'Client or prospect organization',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    firm_id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['client', 'prospect'] },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                    address: { type: 'string' },
                    website: { type: 'string' },
                    industry: { type: 'string' },
                    notes: { type: 'string' },
                    contacts_count: { type: 'integer' },
                    submissions_count: { type: 'integer' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' }
                }
            },
            ClientContact: {
                type: 'object',
                description: 'Contact person for a client/prospect',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    client_id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    role: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    is_primary: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' }
                }
            },
            ResumeSubmission: {
                type: 'object',
                description: 'Record of a CV submission to a client',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    resume_id: { type: 'string', format: 'uuid' },
                    client_id: { type: 'string', format: 'uuid' },
                    contact_id: { type: 'string', format: 'uuid' },
                    mission_id: { type: 'string', format: 'uuid', nullable: true },
                    firm_id: { type: 'string', format: 'uuid' },
                    sent_at: { type: 'string', format: 'date-time' },
                    sent_by: { type: 'string', format: 'uuid' },
                    notes: { type: 'string' },
                    status: { type: 'string', enum: ['sent', 'viewed', 'rejected', 'accepted', 'pending'] },
                    resume_name: { type: 'string' },
                    client_name: { type: 'string' },
                    contact_name: { type: 'string' },
                    contact_email: { type: 'string' }
                }
            },
            LLMSettings: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    llm_model: { type: 'string', example: 'gpt-4o' },
                    cv_mode: { type: 'string', enum: ['nominative', 'anonymous'] },
                    chatbot_enabled: { type: 'string', enum: ['on', 'off'] },
                    analysis_prompt: { type: 'string' },
                    improvement_prompt: { type: 'string' },
                    match_analysis_prompt: { type: 'string' },
                    adaptation_prompt: { type: 'string' },
                    executive_summary_weight: { type: 'integer' },
                    skills_weight: { type: 'integer' },
                    experience_weight: { type: 'integer' },
                    education_weight: { type: 'integer' },
                    ats_weight: { type: 'integer' },
                    hobbies_languages_weight: { type: 'integer' },
                    status: { type: 'string', enum: ['active', 'inactive'] }
                }
            },
            MarketTrend: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    type: { type: 'string', enum: ['embauche', 'demandeur', 'demandeur_entrant', 'offre', 'tension', 'salaire', 'dynamique'] },
                    code_rome: { type: 'string' },
                    rome_label: { type: 'string' },
                    region: { type: 'string' },
                    region_code: { type: 'string' },
                    date: { type: 'string', format: 'date' },
                    value: { type: 'number' },
                    value_label: { type: 'string' },
                    metadata: { type: 'object' }
                }
            },
            MarketFact: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    keyword: { type: 'string' },
                    location: { type: 'string' },
                    region: { type: 'string' },
                    source: { type: 'string', enum: ['france_travail', 'adzuna'] },
                    job_count: { type: 'integer' },
                    mean_salary: { type: 'number' },
                    date: { type: 'string', format: 'date' },
                    metadata: { type: 'object' }
                }
            },
            RomeMetier: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    code_rome: { type: 'string', example: 'M1805' },
                    libelle: { type: 'string' },
                    code_ogr: { type: 'string' },
                    libelle_ogr: { type: 'string' },
                    code_domaine_professionnel: { type: 'string' },
                    libelle_domaine_professionnel: { type: 'string' },
                    code_grand_domaine: { type: 'string' },
                    libelle_grand_domaine: { type: 'string' },
                    competences: { type: 'array', items: { type: 'object' } },
                    savoir_faire: { type: 'array', items: { type: 'object' } },
                    savoir_etre: { type: 'array', items: { type: 'object' } }
                }
            },
            MailStatus: {
                type: 'object',
                properties: {
                    connected: { type: 'boolean' },
                    provider: { type: 'string', enum: ['gmail', 'outlook'] },
                    email: { type: 'string', format: 'email' }
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
                            totalCount: { type: 'integer' },
                            nextPage: { type: 'integer', nullable: true }
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
            SlowRequest: {
                type: 'object',
                description: 'A slow request tracked by APM',
                properties: {
                    timestamp: { type: 'string', format: 'date-time', description: 'When the request started' },
                    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'HTTP method' },
                    path: { type: 'string', description: 'Original request path' },
                    endpoint: { type: 'string', description: 'Normalized endpoint (IDs replaced with :id)' },
                    duration: { type: 'integer', description: 'Request duration in milliseconds' },
                    severity: { type: 'string', enum: ['slow', 'very_slow', 'critical'], description: 'Severity based on duration thresholds' },
                    statusCode: { type: 'integer', description: 'HTTP response status code' },
                    userId: { type: 'string', format: 'uuid', nullable: true, description: 'User ID if authenticated' },
                    userAgent: { type: 'string', nullable: true, description: 'User agent (truncated to 100 chars)' },
                    breakdown: { 
                        type: 'object', 
                        nullable: true,
                        description: 'Timing breakdown if trace sampling enabled',
                        additionalProperties: { type: 'integer' }
                    }
                }
            },
            HealthCheck: {
                type: 'object',
                description: 'Health check response',
                properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    responseTime: { type: 'string', example: '45ms' },
                    version: { type: 'string' },
                    environment: { type: 'string', enum: ['development', 'production'] },
                    checks: {
                        type: 'object',
                        properties: {
                            server: { type: 'object' },
                            database: { type: 'object' },
                            openai: { type: 'object' },
                            anthropic: { type: 'object' },
                            memory: { type: 'object' },
                            cache: { type: 'object' }
                        }
                    }
                }
            }
        },
        responses: {
            Unauthorized: {
                description: 'Authentication required',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
            },
            Forbidden: {
                description: 'Insufficient permissions',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
            },
            NotFound: {
                description: 'Resource not found',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
            },
            ValidationError: {
                description: 'Validation error',
                content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' }, details: { type: 'array', items: { type: 'object' } } } } } }
            }
        }
    },
    paths: swaggerPaths
};

export default swaggerDocument;
