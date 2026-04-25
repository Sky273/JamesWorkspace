const uuid = { type: 'string', format: 'uuid' };
const email = { type: 'string', format: 'email' };
const dateTime = { type: 'string', format: 'date-time' };
const nullableString = { type: ['string', 'null'] };
const stringArray = { type: 'array', items: { type: 'string' } };
const jsonObject = { type: 'object', additionalProperties: true };

const objectSchema = (properties, required = []) => ({
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false
});

const idListSchema = (maxItems = 500) => ({
    type: 'array',
    minItems: 1,
    maxItems,
    items: uuid
});

export const openApiSchemas = {
    Error: objectSchema({
        error: { type: 'string' },
        code: { type: 'string' },
        requestId: { type: 'string' },
        details: {
            type: 'array',
            items: objectSchema({
                field: { type: 'string' },
                message: { type: 'string' },
                code: { type: 'string' }
            })
        }
    }, ['error']),
    SignInRequest: objectSchema({
        email,
        password: { type: 'string', minLength: 8, maxLength: 100 },
        totpCode: { type: 'string', minLength: 6, maxLength: 8 }
    }, ['email', 'password']),
    RegisterRequest: objectSchema({
        email,
        password: { type: 'string', minLength: 8, maxLength: 100 },
        name: { type: 'string', minLength: 1, maxLength: 255 },
        website: { type: 'string', maxLength: 255 },
        formRenderedAt: { type: 'integer', minimum: 1 },
        captchaToken: { type: 'string', maxLength: 4096 },
        captchaProvider: { type: 'string', enum: ['turnstile', 'hcaptcha'] }
    }, ['email', 'password', 'name', 'formRenderedAt']),
    ForgotPasswordRequest: objectSchema({ email }, ['email']),
    ResetPasswordRequest: objectSchema({
        token: { type: 'string', minLength: 32, maxLength: 256 },
        password: { type: 'string', minLength: 8, maxLength: 100 }
    }, ['token', 'password']),
    TotpCodeRequest: objectSchema({
        code: { type: 'string', minLength: 6, maxLength: 8 }
    }, ['code']),
    CreateUserRequest: objectSchema({
        email,
        name: { type: 'string', minLength: 1, maxLength: 255 },
        jobTitle: { type: 'string', maxLength: 255 },
        phone: { type: 'string', maxLength: 50 },
        role: { type: 'string', enum: ['user', 'admin', 'localAdmin'] },
        status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
        firmId: uuid
    }, ['email', 'name', 'firmId']),
    UpdateUserRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        email,
        status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
        role: { type: 'string', enum: ['user', 'admin', 'localAdmin'] },
        jobTitle: nullableString,
        phone: nullableString,
        firmId: uuid
    }),
    CreateFirmRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        status: { type: 'string' },
        logo_url: { type: 'string' }
    }, ['name']),
    UpdateFirmRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        status: { type: 'string' },
        logo_url: nullableString,
        logoUrl: nullableString
    }),
    UpdateSettingsRequest: objectSchema({
        llmProvider: { type: 'string', enum: ['openai', 'anthropic', 'huggingface', 'gemma', 'deepseek', 'glm', 'minimax', 'ollama'] },
        llmModel: { type: 'string', maxLength: 100 },
        ollamaBaseUrl: { type: 'string', format: 'uri', maxLength: 500 },
        ollamaVisionModel: { type: 'string', maxLength: 100 },
        llmModelParameters: jsonObject,
        cvMode: { type: 'string', enum: ['nominative', 'anonymous'] },
        chatbotEnabled: { type: 'string', enum: ['on', 'off'] },
        webglEnabled: { type: 'string', enum: ['on', 'off'] },
        publicHomeEnabled: { type: 'boolean' },
        preAnalysisEnabled: { type: 'boolean' },
        allowUserRegistrationWithoutApproval: { type: 'boolean' },
        firmInitialCredits: { type: 'integer', minimum: 0, maximum: 1000000 },
        aiCreditResumeAnalysis: { type: 'integer', minimum: 0, maximum: 1000000 },
        aiCreditResumeImprovement: { type: 'integer', minimum: 0, maximum: 1000000 },
        aiCreditResumeAdaptation: { type: 'integer', minimum: 0, maximum: 1000000 },
        aiCreditResumeMatch: { type: 'integer', minimum: 0, maximum: 1000000 }
    }),
    UpdateResumeRequest: objectSchema({
        originalText: { type: 'string' },
        improvedText: { type: 'string' },
        analysis: { type: 'string' },
        skills: { oneOf: [{ type: 'string' }, stringArray] },
        industries: { oneOf: [{ type: 'string' }, stringArray] },
        tools: { oneOf: [{ type: 'string' }, stringArray] },
        softSkills: { oneOf: [{ type: 'string' }, stringArray] },
        status: { type: 'string', enum: ['Pending', 'Processing', 'Analyzed', 'Improved', 'Error', 'Active', 'active', 'analyzed', 'improved'] },
        name: { type: 'string', maxLength: 255 },
        title: { type: 'string', maxLength: 255 },
        globalRating: { oneOf: [{ type: 'string' }, { type: 'number' }] }
    }),
    AiModifyRequest: objectSchema({
        content: { type: 'string', minLength: 1 },
        instructions: { type: 'string', minLength: 1, maxLength: 5000 },
        selectedText: nullableString
    }, ['content', 'instructions']),
    CreateTemplateRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        headerContent: { type: 'string' },
        templateContent: { type: 'string', minLength: 1 },
        footerContent: { type: 'string' },
        footerHeight: { type: 'number', minimum: 10, maximum: 250 },
        stylesheet: { type: 'string' },
        status: { type: 'string', enum: ['active', 'inactive'] },
        tags: stringArray,
        popular: { type: 'boolean' },
        previewImage: { type: 'string' },
        firmId: uuid
    }, ['name', 'templateContent']),
    UpdateTemplateRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string' },
        headerContent: { type: 'string' },
        templateContent: { type: 'string' },
        footerContent: { type: 'string' },
        footerHeight: { type: 'number', minimum: 10, maximum: 250 },
        stylesheet: { type: 'string' },
        status: { type: 'string', enum: ['active', 'inactive'] },
        tags: stringArray,
        popular: { type: 'boolean' },
        previewImage: { type: 'string' },
        firmId: uuid
    }),
    CreateMissionRequest: objectSchema({
        title: { type: 'string', minLength: 1, maxLength: 500 },
        content: { type: 'string' },
        status: { type: 'string', enum: ['Active', 'Closed', 'Draft', 'active', 'closed', 'draft'] },
        customer: { type: 'string' },
        clientId: uuid,
        contactId: uuid,
        firmId: uuid,
        dealId: uuid,
        keywords: { oneOf: [{ type: 'string' }, stringArray] },
        requiredSkills: { oneOf: [{ type: 'string' }, stringArray] },
        preferredSkills: { oneOf: [{ type: 'string' }, stringArray] }
    }, ['title']),
    UpdateMissionRequest: objectSchema({
        title: { type: 'string', minLength: 1, maxLength: 500 },
        content: { type: 'string' },
        status: { type: 'string', enum: ['Active', 'Closed', 'Draft', 'active', 'closed', 'draft'] },
        clientId: uuid,
        contactId: uuid,
        firmId: uuid,
        dealId: uuid,
        keywords: { oneOf: [{ type: 'string' }, stringArray] },
        requiredSkills: { oneOf: [{ type: 'string' }, stringArray] },
        preferredSkills: { oneOf: [{ type: 'string' }, stringArray] }
    }),
    UpdateAdaptationRequest: objectSchema({
        adaptedText: { type: 'string' },
        adaptedTitle: nullableString,
        status: { type: 'string', maxLength: 50 },
        matchScore: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        matchAnalysis: { type: 'string' }
    }),
    CreateClientRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        type: { type: 'string', enum: ['client', 'prospect'] },
        industry: { type: 'string', maxLength: 255 },
        website: { type: 'string', format: 'uri' },
        address: { type: 'string', maxLength: 500 },
        notes: { type: 'string', maxLength: 5000 },
        status: { type: 'string', enum: ['active', 'inactive'] },
        firmId: uuid,
        firm_id: uuid
    }, ['name']),
    UpdateClientRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        type: { type: 'string', enum: ['client', 'prospect'] },
        industry: { type: 'string', maxLength: 255 },
        website: { type: 'string', format: 'uri' },
        address: { type: 'string', maxLength: 500 },
        notes: { type: 'string', maxLength: 5000 },
        status: { type: 'string', enum: ['active', 'inactive'] },
        firmId: uuid,
        firm_id: uuid
    }),
    CreateContactRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        email,
        phone: { type: 'string', maxLength: 50 },
        role: { type: 'string', maxLength: 255 },
        isPrimary: { type: 'boolean' },
        is_primary: { type: 'boolean' }
    }, ['name']),
    UpdateContactRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        email,
        phone: { type: 'string', maxLength: 50 },
        role: { type: 'string', maxLength: 255 },
        isPrimary: { type: 'boolean' },
        is_primary: { type: 'boolean' }
    }),
    CreateDealRequest: objectSchema({
        title: { type: 'string', minLength: 1, maxLength: 500 },
        description: nullableString,
        clientId: uuid,
        contactId: uuid,
        status: { type: 'string', enum: ['open', 'won', 'lost', 'on_hold'] },
        expectedStartDate: nullableString,
        expectedEndDate: nullableString,
        budgetMin: { type: ['number', 'null'] },
        budgetMax: { type: ['number', 'null'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        tags: stringArray,
        notes: nullableString
    }, ['title']),
    UpdateDealRequest: objectSchema({
        title: { type: 'string', minLength: 1, maxLength: 500 },
        description: nullableString,
        clientId: uuid,
        contactId: uuid,
        status: { type: 'string', enum: ['open', 'won', 'lost', 'on_hold'] },
        expectedStartDate: nullableString,
        expectedEndDate: nullableString,
        budgetMin: { type: ['number', 'null'] },
        budgetMax: { type: ['number', 'null'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        tags: stringArray,
        notes: nullableString
    }),
    AddDealResumeRequest: objectSchema({
        resumeId: uuid,
        notes: nullableString,
        status: { type: 'string', maxLength: 50 }
    }, ['resumeId']),
    UpdateDealResumeRequest: objectSchema({
        status: { type: 'string', minLength: 1, maxLength: 50 },
        notes: nullableString
    }, ['status']),
    CreatePipelineEntryRequest: objectSchema({
        resumeId: uuid,
        adaptationId: uuid,
        missionId: uuid,
        clientId: uuid,
        stage: { type: 'string', enum: ['new', 'sourced', 'screening', 'interview', 'offer', 'hired', 'rejected'] },
        notes: { type: 'string', maxLength: 5000 }
    }, ['resumeId']),
    UpdatePipelineEntryRequest: objectSchema({
        stage: { type: 'string', enum: ['new', 'sourced', 'screening', 'interview', 'offer', 'hired', 'rejected'] },
        notes: { type: 'string', maxLength: 5000 },
        missionId: uuid,
        clientId: uuid
    }),
    CreateSubmissionRequest: objectSchema({
        resumeId: uuid,
        clientId: uuid,
        contactId: uuid,
        missionId: uuid,
        notes: nullableString,
        sentAt: nullableString,
        status: { type: 'string', maxLength: 50 }
    }, ['resumeId', 'clientId', 'contactId']),
    UpdateSubmissionRequest: objectSchema({
        status: { type: 'string', maxLength: 50 },
        notes: nullableString
    }),
    CreateCommentRequest: objectSchema({
        content: { type: 'string', minLength: 1, maxLength: 5000 },
        isPrivate: { type: 'boolean' }
    }, ['content']),
    UpdateCommentRequest: objectSchema({
        content: { type: 'string', minLength: 1, maxLength: 5000 }
    }, ['content']),
    BatchImproveRequest: objectSchema({
        resumeIds: idListSchema(),
        options: jsonObject,
        firmId: { oneOf: [{ type: 'string' }, { type: 'number' }] }
    }, ['resumeIds']),
    BatchAdaptRequest: objectSchema({
        resumeIds: idListSchema(),
        missionId: uuid,
        options: jsonObject,
        firmId: { oneOf: [{ type: 'string' }, { type: 'number' }] }
    }, ['resumeIds', 'missionId']),
    BatchMatchRequest: objectSchema({
        resumeIds: idListSchema(),
        missionId: uuid,
        options: jsonObject,
        firmId: { oneOf: [{ type: 'string' }, { type: 'number' }] }
    }, ['resumeIds', 'missionId']),
    BatchProfileSearchRequest: objectSchema({
        missionId: uuid,
        limit: { type: 'number', minimum: 0, maximum: 100 },
        minScore: { type: 'number', minimum: 0, maximum: 100 },
        status: { type: 'string', maxLength: 50 },
        weights: { type: 'object', additionalProperties: { type: 'number' } },
        dealId: uuid,
        firmId: { oneOf: [{ type: 'string' }, { type: 'number' }] }
    }, ['missionId']),
    BatchProfileAnalysisRequest: objectSchema({
        resumeId: uuid,
        missionId: uuid,
        firmId: { oneOf: [{ type: 'string' }, { type: 'number' }] }
    }, ['resumeId', 'missionId']),
    BatchDealExportRequest: objectSchema({
        dealId: uuid,
        templateId: uuid,
        exportFormats: { type: 'array', items: { type: 'string', enum: ['pdf', 'docx'] } }
    }, ['dealId', 'templateId']),
    BatchExportRequest: objectSchema({
        resumeIds: idListSchema(100),
        templateId: uuid,
        format: { type: 'string', enum: ['pdf', 'docx'] },
        exportFormat: { type: 'string', enum: ['pdf', 'docx'] }
    }, ['resumeIds', 'templateId']),
    ChatbotMessageRequest: objectSchema({
        message: { type: 'string', minLength: 1, maxLength: 10000 },
        conversationHistory: {
            type: 'array',
            maxItems: 50,
            items: objectSchema({
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string' }
            }, ['role', 'content'])
        }
    }, ['message']),
    LlmProxyRequest: objectSchema({
        model: { type: 'string', maxLength: 100 },
        messages: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: objectSchema({
                role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                content: { type: 'string', maxLength: 100000 }
            }, ['role', 'content'])
        },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        max_tokens: { type: 'number', minimum: 1, maximum: 200000 },
        stream: { type: 'boolean' }
    }, ['messages']),
    GdprMailConfigRequest: objectSchema({
        provider: { type: 'string', enum: ['gmail', 'smtp', 'auto'] },
        smtpHost: { type: 'string', maxLength: 255 },
        smtpPort: { type: 'integer', minimum: 1, maximum: 65535 },
        smtpSecure: { type: 'boolean' },
        smtpUser: { type: 'string', maxLength: 255 },
        smtpPassword: { type: 'string', maxLength: 1000 },
        clearSmtpPassword: { type: 'boolean' },
        smtpFromName: { type: 'string', maxLength: 255 },
        smtpFromEmail: { type: 'string', maxLength: 255 },
        googleGdprRedirectUri: { type: 'string', maxLength: 500 }
    }, ['provider']),
    CreateMailDraftRequest: objectSchema({
        to: { type: 'string', minLength: 1, maxLength: 500 },
        subject: { type: 'string', maxLength: 1000 },
        body: { type: 'string' },
        pdfBase64: { type: 'string' },
        pdfFilename: { type: 'string', maxLength: 500 },
        provider: { type: 'string', enum: ['gmail', 'outlook'] },
        resumeId: uuid,
        clientId: uuid,
        contactId: uuid,
        missionId: uuid,
        versionNumber: { type: 'number' },
        templateId: uuid,
        templateContext: jsonObject
    }, ['to']),
    CreateCalendarEventRequest: objectSchema({
        summary: { type: 'string', minLength: 1, maxLength: 500 },
        title: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string', maxLength: 5000 },
        start: { type: 'string' },
        end: { type: 'string' },
        startDateTime: dateTime,
        endDateTime: dateTime,
        location: { type: 'string', maxLength: 500 },
        attendees: { type: 'array', items: objectSchema({ email }, ['email']) }
    }),
    CreateEmailTemplateRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: nullableString,
        subjectTemplate: { type: 'string', minLength: 1, maxLength: 500 },
        mjmlContent: { type: 'string', minLength: 1 },
        isDefault: { type: 'boolean' }
    }, ['name', 'subjectTemplate', 'mjmlContent']),
    UpdateEmailTemplateRequest: objectSchema({
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: nullableString,
        subjectTemplate: { type: 'string', minLength: 1, maxLength: 500 },
        mjmlContent: { type: 'string', minLength: 1 },
        isDefault: { type: 'boolean' }
    }),
    BackupSettingsRequest: objectSchema({
        backup_target: { type: 'string', enum: ['local', 'remote'] },
        protocol: { type: 'string', enum: ['ftp', 'ftps', 'sftp'] },
        tls_mode: { type: 'string', enum: ['none', 'explicit', 'implicit'] },
        host: { type: 'string', maxLength: 255 },
        port: { type: 'number', minimum: 1, maximum: 65535 },
        username: { type: 'string', maxLength: 255 },
        password: { type: 'string' },
        remote_path: { type: 'string', maxLength: 500 },
        daily_enabled: { type: 'boolean' },
        daily_time: { type: 'string', pattern: '^\\d{2}:\\d{2}(:\\d{2})?$' },
        weekly_enabled: { type: 'boolean' },
        monthly_enabled: { type: 'boolean' }
    }),
    TestBackupConnectionRequest: objectSchema({
        protocol: { type: 'string', enum: ['ftp', 'ftps', 'sftp'] },
        tls_mode: { type: 'string', enum: ['none', 'explicit', 'implicit'] },
        host: { type: 'string', minLength: 1, maxLength: 255 },
        port: { type: 'number', minimum: 1, maximum: 65535 },
        username: { type: 'string', minLength: 1, maxLength: 255 },
        password: { type: 'string' },
        remote_path: { type: 'string', maxLength: 500 }
    }, ['host', 'username']),
    RestoreBackupRequest: objectSchema({
        filename: { type: 'string', minLength: 1, maxLength: 255, pattern: '^backup-(daily|weekly|monthly|manual)-[A-Za-z0-9_-]+-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.sql\\.gz$' },
        confirmText: { type: 'string', const: 'RESTORE' }
    }, ['filename', 'confirmText']),
    ConsentInitializeRequest: objectSchema({
        resumeId: uuid,
        profileType: { type: 'string', minLength: 1, maxLength: 100 },
        candidateName: { type: 'string', minLength: 1, maxLength: 255 },
        candidateEmail: email
    }, ['resumeId', 'profileType', 'candidateName']),
    ConsentRespondRequest: objectSchema({
        action: { type: 'string', enum: ['accept', 'refuse'] }
    }, ['action']),
    TagRenameRequest: objectSchema({
        category: { type: 'string', enum: ['Skills', 'Industries', 'Tools', 'Soft Skills'] },
        oldName: { type: 'string', minLength: 1, maxLength: 255 },
        newName: { type: 'string', minLength: 1, maxLength: 255 }
    }, ['category', 'oldName', 'newName']),
    SharePdfRequest: objectSchema({
        htmlContent: { type: 'string', minLength: 1, maxLength: 5242880 },
        filename: { type: 'string', minLength: 1, maxLength: 255 },
        stylesheet: { type: 'string', maxLength: 204800 },
        headerContent: { type: 'string', maxLength: 262144 },
        footerContent: { type: 'string', maxLength: 262144 },
        footerHeight: { type: 'number', minimum: 10, maximum: 250 }
    }, ['htmlContent'])
};
