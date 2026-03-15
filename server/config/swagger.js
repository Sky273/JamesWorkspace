/**
 * Swagger/OpenAPI Configuration
 * API Documentation for ResumeConverter
 * Updated to match current database schema and routes
 */

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
        { name: 'Authentication', description: 'User authentication, session management, and 2FA' },
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
        { name: 'Email Templates', description: 'MJML email template management' },
        { name: 'Consent', description: 'GDPR consent management for resumes' },
        { name: 'GDPR Mail', description: 'GDPR email configuration (admin)' },
        { name: 'LLM', description: 'AI/LLM proxy endpoints' },
        { name: 'Chatbot', description: 'AI chatbot assistant' },
        { name: 'Settings', description: 'Application settings management' },
        { name: 'Tags', description: 'Resume tags management' },
        { name: 'Market Radar', description: 'Labor market data and trends' },
        { name: 'ROME', description: 'ROME métiers and competences' },
        { name: 'Health', description: 'Health check and system status' },
        { name: 'Metrics', description: 'Application metrics and monitoring' },
        { name: 'Admin', description: 'Administrative endpoints (security logs, stats)' },
        { name: 'Pipeline', description: 'Candidate selection pipeline and Kanban board' },
        { name: 'Interviews', description: 'Interview scheduling and management' },
        { name: 'Calendar', description: 'Google Calendar integration' },
        { name: 'Comments', description: 'Resume comments and notes' },
        { name: 'Share', description: 'Resume sharing via QR code' },
        { name: 'GDPR Audit', description: 'GDPR audit log (admin only)' },
        { name: 'Backup', description: 'Database backup management (admin only)' },
        { name: 'Documentation', description: 'API documentation endpoints' }
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
                    totp_enabled: { type: 'boolean', description: 'Whether 2FA is enabled for this user' },
                    totp_enabled_at: { type: 'string', format: 'date-time', nullable: true, description: 'When 2FA was enabled' },
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
                    password: { type: 'string', minLength: 6 },
                    totpCode: { type: 'string', minLength: 6, maxLength: 8, description: '6-digit TOTP code or 8-character backup code (required if 2FA is enabled)' }
                }
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/User' },
                    csrfToken: { type: 'string' },
                    requires2FA: { type: 'boolean', description: 'If true, user must provide TOTP code to complete login' },
                    userId: { type: 'string', format: 'uuid', description: 'User ID (only returned when requires2FA is true)' }
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
            EmailTemplate: {
                type: 'object',
                description: 'MJML email template',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    firm_id: { type: 'string', format: 'uuid', nullable: true },
                    name: { type: 'string', example: 'CV Submission Template' },
                    description: { type: 'string' },
                    subject_template: { type: 'string', example: 'CV de {{candidate.name}} pour {{mission.title}}' },
                    mjml_content: { type: 'string', description: 'MJML markup content' },
                    html_content: { type: 'string', description: 'Compiled HTML (read-only)' },
                    is_default: { type: 'boolean' },
                    is_system: { type: 'boolean', description: 'System templates cannot be modified' },
                    created_by: { type: 'string', format: 'uuid' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' }
                }
            },
            ConsentStatus: {
                type: 'object',
                description: 'GDPR consent status for a resume',
                properties: {
                    consent_status: { type: 'string', enum: ['none', 'pending_consent', 'consent_sent', 'consented', 'refused', 'expired', 'error'] },
                    consent_token: { type: 'string', nullable: true },
                    consent_sent_at: { type: 'string', format: 'date-time', nullable: true },
                    consent_responded_at: { type: 'string', format: 'date-time', nullable: true },
                    consent_expires_at: { type: 'string', format: 'date-time', nullable: true },
                    retention_until: { type: 'string', format: 'date-time', nullable: true },
                    candidate_email: { type: 'string', format: 'email', nullable: true }
                }
            },
            SecurityLog: {
                type: 'object',
                description: 'Security or proxy log entry',
                properties: {
                    timestamp: { type: 'string', format: 'date-time' },
                    level: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'] },
                    message: { type: 'string' },
                    event: { type: 'string', nullable: true },
                    source: { type: 'string', enum: ['security', 'proxy'] },
                    userId: { type: 'string', format: 'uuid', nullable: true },
                    ip: { type: 'string', nullable: true }
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
            },
            // ============================================
            // PIPELINE & INTERVIEWS
            // ============================================
            PipelineStage: {
                type: 'object',
                description: 'Pipeline stage configuration',
                properties: {
                    id: { type: 'string', example: 'new' },
                    label: { type: 'string', example: 'Nouveau' },
                    labelEn: { type: 'string', example: 'New' },
                    color: { type: 'string', example: 'gray' },
                    order: { type: 'integer' }
                }
            },
            PipelineEntry: {
                type: 'object',
                description: 'Candidate pipeline entry',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    resume_id: { type: 'string', format: 'uuid' },
                    resume_name: { type: 'string' },
                    resume_title: { type: 'string' },
                    mission_id: { type: 'string', format: 'uuid', nullable: true },
                    mission_title: { type: 'string', nullable: true },
                    client_id: { type: 'string', format: 'uuid', nullable: true },
                    client_name: { type: 'string', nullable: true },
                    stage: { type: 'string', enum: ['new', 'preselection', 'submitted', 'interview', 'interviewed', 'selected', 'rejected', 'on_hold'] },
                    notes: { type: 'string', nullable: true },
                    global_rating: { type: 'integer', nullable: true },
                    skills: { type: 'array', items: { type: 'string' }, nullable: true },
                    interview_count: { type: 'integer' },
                    next_interview: { type: 'string', format: 'date-time', nullable: true },
                    created_at: { type: 'string', format: 'date-time' },
                    moved_at: { type: 'string', format: 'date-time' },
                    created_by: { type: 'string', format: 'uuid' }
                }
            },
            Interview: {
                type: 'object',
                description: 'Interview scheduled for a pipeline entry',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    pipeline_id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    interview_type: { type: 'string', enum: ['client', 'partner', 'technical', 'hr'] },
                    scheduled_at: { type: 'string', format: 'date-time' },
                    duration_minutes: { type: 'integer', default: 60 },
                    location: { type: 'string', nullable: true },
                    meeting_link: { type: 'string', nullable: true },
                    status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'] },
                    outcome: { type: 'string', enum: ['positive', 'neutral', 'negative', 'to_follow_up'], nullable: true },
                    outcome_notes: { type: 'string', nullable: true },
                    calendar_event_id: { type: 'string', nullable: true },
                    calendar_provider: { type: 'string', enum: ['google', 'outlook'], nullable: true },
                    created_at: { type: 'string', format: 'date-time' },
                    created_by: { type: 'string', format: 'uuid' }
                }
            },
            PipelineHistory: {
                type: 'object',
                description: 'Pipeline stage change history',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    pipeline_id: { type: 'string', format: 'uuid' },
                    from_stage: { type: 'string', nullable: true },
                    to_stage: { type: 'string' },
                    notes: { type: 'string', nullable: true },
                    changed_by: { type: 'string', format: 'uuid' },
                    changed_by_name: { type: 'string' },
                    changed_at: { type: 'string', format: 'date-time' }
                }
            },
            // ============================================
            // RESUME COMMENTS
            // ============================================
            ResumeComment: {
                type: 'object',
                description: 'Comment on a resume',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    resume_id: { type: 'string', format: 'uuid' },
                    user_id: { type: 'string', format: 'uuid' },
                    user_name: { type: 'string' },
                    content: { type: 'string' },
                    is_private: { type: 'boolean', description: 'If true, only visible to the author' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' }
                }
            },
            // ============================================
            // GDPR AUDIT
            // ============================================
            GdprAuditLog: {
                type: 'object',
                description: 'GDPR audit log entry',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    firm_id: { type: 'string', format: 'uuid', nullable: true },
                    firm_name: { type: 'string', nullable: true },
                    user_id: { type: 'string', format: 'uuid', nullable: true },
                    user_name: { type: 'string', nullable: true },
                    action: { type: 'string', example: 'consent_sent' },
                    category: { type: 'string', enum: ['consent', 'data', 'cv', 'automated'] },
                    target_email: { type: 'string', format: 'email', nullable: true },
                    target_resume_id: { type: 'string', format: 'uuid', nullable: true },
                    is_automated: { type: 'boolean' },
                    details: { type: 'object', nullable: true },
                    created_at: { type: 'string', format: 'date-time' }
                }
            },
            // ============================================
            // SHARE (QR CODE)
            // ============================================
            ShareToken: {
                type: 'object',
                description: 'Shareable link token for a resume',
                properties: {
                    token: { type: 'string' },
                    resume_id: { type: 'string', format: 'uuid' },
                    expires_at: { type: 'string', format: 'date-time' }
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
    paths: {}
};

export default swaggerDocument;
