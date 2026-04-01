export function createComplianceSwaggerPaths({
    auth401,
    forbidden403,
    notFound404,
    security,
    securityCsrf,
    paramId,
    paramResumeId,
    paramPage,
    paramLimit
}) {
    return {
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
        }
    };
}
