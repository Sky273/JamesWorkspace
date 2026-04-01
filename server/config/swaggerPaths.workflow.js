export function createWorkflowSwaggerPaths({
    auth401,
    notFound404,
    security,
    securityCsrf,
    paramId,
    paramResumeId,
    paramMissionId,
    paramPage,
    paramLimit,
    paramSearch
}) {
    return {
        '/pipeline/stages': {
            get: { tags: ['Pipeline'], summary: 'Get pipeline stages', security, responses: { 200: { description: 'Array of stage definitions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineStage' } } } } }, 401: auth401 } }
        },
        '/pipeline': {
            post: { tags: ['Pipeline'], summary: 'Create pipeline entry', security: securityCsrf, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['resume_id'], properties: { resume_id: { type: 'string', format: 'uuid' }, mission_id: { type: 'string', format: 'uuid' }, client_id: { type: 'string', format: 'uuid' }, stage: { type: 'string' }, notes: { type: 'string' } } } } } }, responses: { 201: { description: 'Entry created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PipelineEntry' } } } }, 401: auth401 } }
        },
        '/pipeline/overview': {
            get: { tags: ['Pipeline'], summary: 'Get pipeline overview (Kanban)', description: 'Get all pipeline entries grouped by stage for Kanban view', security, parameters: [{ name: 'missionId', in: 'query', schema: { type: 'string' } }, { name: 'clientId', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Pipeline entries by stage' }, 401: auth401 } }
        },
        '/pipeline/stats': {
            get: { tags: ['Pipeline'], summary: 'Get pipeline statistics', security, responses: { 200: { description: 'Pipeline stats' }, 401: auth401 } }
        },
        '/pipeline/{id}': {
            get: { tags: ['Pipeline'], summary: 'Get pipeline entry', security, parameters: [paramId], responses: { 200: { description: 'Pipeline entry details' }, 401: auth401, 404: notFound404 } },
            delete: { tags: ['Pipeline'], summary: 'Delete pipeline entry', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Entry deleted' }, 401: auth401 } }
        },
        '/pipeline/{id}/stage': {
            patch: { tags: ['Pipeline'], summary: 'Update pipeline stage', description: 'Move candidate to a different stage', security: securityCsrf, parameters: [paramId], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['stage'], properties: { stage: { type: 'string' }, notes: { type: 'string' } } } } } }, responses: { 200: { description: 'Stage updated' }, 401: auth401, 404: notFound404 } }
        },
        '/pipeline/{id}/notes': {
            patch: { tags: ['Pipeline'], summary: 'Update pipeline notes', security: securityCsrf, parameters: [paramId], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { notes: { type: 'string' } } } } } }, responses: { 200: { description: 'Notes updated' }, 401: auth401, 404: notFound404 } }
        },
        '/pipeline/{id}/history': {
            get: { tags: ['Pipeline'], summary: 'Get stage change history', security, parameters: [paramId], responses: { 200: { description: 'Array of history entries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PipelineHistory' } } } } }, 401: auth401 } }
        },
        '/pipeline/resume/{resumeId}': {
            get: { tags: ['Pipeline'], summary: 'Get pipeline entries for resume', security, parameters: [paramResumeId], responses: { 200: { description: 'Pipeline entries for resume' }, 401: auth401 } }
        },
        '/pipeline/mission/{missionId}': {
            get: { tags: ['Pipeline'], summary: 'Get pipeline entries for mission', security, parameters: [paramMissionId], responses: { 200: { description: 'Pipeline entries for mission' }, 401: auth401 } }
        },
        '/pipeline/{id}/interviews': {
            post: { tags: ['Interviews'], summary: 'Schedule interview', security: securityCsrf, parameters: [paramId], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'scheduled_at'], properties: { title: { type: 'string' }, description: { type: 'string' }, interview_type: { type: 'string', enum: ['client', 'partner', 'technical', 'hr'] }, scheduled_at: { type: 'string', format: 'date-time' }, duration_minutes: { type: 'integer', default: 60 }, location: { type: 'string' }, meeting_link: { type: 'string' } } } } } }, responses: { 201: { description: 'Interview scheduled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Interview' } } } }, 401: auth401 } },
            get: { tags: ['Interviews'], summary: 'List interviews for pipeline entry', security, parameters: [paramId], responses: { 200: { description: 'Array of interviews' }, 401: auth401 } }
        },
        '/pipeline/interviews/upcoming': {
            get: { tags: ['Interviews'], summary: 'Get upcoming interviews', security, parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 7 } }], responses: { 200: { description: 'Upcoming interviews' }, 401: auth401 } }
        },
        '/pipeline/interviews/{interviewId}': {
            patch: { tags: ['Interviews'], summary: 'Update interview', security: securityCsrf, parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Interview updated' }, 401: auth401, 404: notFound404 } },
            delete: { tags: ['Interviews'], summary: 'Delete interview', security: securityCsrf, parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Interview deleted' }, 401: auth401 } }
        },
        '/pipeline/interviews/{interviewId}/complete': {
            post: { tags: ['Interviews'], summary: 'Complete interview', security: securityCsrf, parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { outcome: { type: 'string', enum: ['positive', 'neutral', 'negative', 'to_follow_up'] }, outcome_notes: { type: 'string' } } } } } }, responses: { 200: { description: 'Interview completed' }, 401: auth401 } }
        },
        '/pipeline/interviews/{interviewId}/cancel': {
            post: { tags: ['Interviews'], summary: 'Cancel interview', security: securityCsrf, parameters: [{ name: 'interviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Interview cancelled' }, 401: auth401 } }
        },
        '/calendar/status': { get: { tags: ['Calendar'], summary: 'Get calendar connection status', security, responses: { 200: { description: 'Calendar connection status' }, 401: auth401 } } },
        '/calendar/auth-url': { get: { tags: ['Calendar'], summary: 'Get Google Calendar OAuth URL', security, responses: { 200: { description: 'OAuth URL' }, 401: auth401 } } },
        '/calendar/callback': { get: { tags: ['Calendar'], summary: 'Google Calendar OAuth callback', responses: { 302: { description: 'Redirect after OAuth' } } } },
        '/calendar/disconnect': { post: { tags: ['Calendar'], summary: 'Disconnect Google Calendar', security: securityCsrf, responses: { 200: { description: 'Disconnected' }, 401: auth401 } } },
        '/calendar/events': {
            get: { tags: ['Calendar'], summary: 'List calendar events', security, responses: { 200: { description: 'Calendar events' }, 401: auth401 } },
            post: { tags: ['Calendar'], summary: 'Create calendar event', security: securityCsrf, responses: { 201: { description: 'Event created' }, 401: auth401 } }
        },
        '/calendar/events/{eventId}': {
            patch: { tags: ['Calendar'], summary: 'Update calendar event', security: securityCsrf, parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Event updated' }, 401: auth401 } },
            delete: { tags: ['Calendar'], summary: 'Delete calendar event', security: securityCsrf, parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Event deleted' }, 401: auth401 } }
        },
        '/resumes/{resumeId}/comments': {
            get: { tags: ['Comments'], summary: 'List resume comments', security, parameters: [paramResumeId], responses: { 200: { description: 'Array of comments', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ResumeComment' } } } } }, 401: auth401 } },
            post: { tags: ['Comments'], summary: 'Add comment', security: securityCsrf, parameters: [paramResumeId], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, is_private: { type: 'boolean', default: false } } } } } }, responses: { 201: { description: 'Comment created' }, 401: auth401 } }
        },
        '/resumes/{resumeId}/comments/count': { get: { tags: ['Comments'], summary: 'Get comment count', security, parameters: [paramResumeId], responses: { 200: { description: 'Comment count' }, 401: auth401 } } },
        '/resumes/{resumeId}/comments/{commentId}': {
            put: { tags: ['Comments'], summary: 'Update comment', security: securityCsrf, parameters: [paramResumeId, { name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Comment updated' }, 401: auth401 } },
            delete: { tags: ['Comments'], summary: 'Delete comment', security: securityCsrf, parameters: [paramResumeId, { name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Comment deleted' }, 401: auth401 } }
        },
        '/share/resume/{resumeId}/generate': { post: { tags: ['Share'], summary: 'Generate shareable link', description: 'Generate a shareable PDF link and QR code for a resume', security: securityCsrf, parameters: [paramResumeId], responses: { 200: { description: 'Share token and QR code', content: { 'application/json': { schema: { $ref: '#/components/schemas/ShareToken' } } } }, 401: auth401 } } },
        '/share/resume/{resumeId}/status': { get: { tags: ['Share'], summary: 'Get share status', security, parameters: [paramResumeId], responses: { 200: { description: 'Share status' }, 401: auth401 } } },
        '/share/resume/{resumeId}/original': { get: { tags: ['Share'], summary: 'Get original file share info', security, parameters: [paramResumeId], responses: { 200: { description: 'Original file info' }, 401: auth401 } } },
        '/share/resume/{resumeId}/revoke': { post: { tags: ['Share'], summary: 'Revoke share links', description: 'Revoke all public share links for a resume', security: securityCsrf, parameters: [paramResumeId], responses: { 200: { description: 'Share links revoked' }, 401: auth401, 404: notFound404 } } },
        '/share/pdf/{token}': { get: { tags: ['Share'], summary: 'Download shared PDF (public)', parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } }, 404: notFound404 } } },
        '/share/file/{token}': { get: { tags: ['Share'], summary: 'Download shared original file (public)', parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Original file' }, 404: notFound404 } } },
        '/deals': {
            get: { tags: ['Clients'], summary: 'List deals', security, parameters: [paramPage, paramLimit, paramSearch], responses: { 200: { description: 'Paginated deal list' }, 401: auth401 } },
            post: { tags: ['Clients'], summary: 'Create deal', security: securityCsrf, responses: { 201: { description: 'Deal created' }, 401: auth401 } }
        },
        '/deals/stats': { get: { tags: ['Clients'], summary: 'Get deal statistics', security, responses: { 200: { description: 'Deal stats' }, 401: auth401 } } },
        '/deals/statuses': { get: { tags: ['Clients'], summary: 'Get deal status list', security, responses: { 200: { description: 'Status options' }, 401: auth401 } } },
        '/deals/priorities': { get: { tags: ['Clients'], summary: 'Get deal priority list', security, responses: { 200: { description: 'Priority options' }, 401: auth401 } } },
        '/deals/resume-statuses': { get: { tags: ['Clients'], summary: 'Get deal resume status list', security, responses: { 200: { description: 'Resume status options' }, 401: auth401 } } },
        '/deals/{id}': {
            get: { tags: ['Clients'], summary: 'Get deal by ID', security, parameters: [paramId], responses: { 200: { description: 'Deal details' }, 401: auth401, 404: notFound404 } },
            put: { tags: ['Clients'], summary: 'Update deal', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Deal updated' }, 401: auth401, 404: notFound404 } },
            delete: { tags: ['Clients'], summary: 'Delete deal', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Deal deleted' }, 401: auth401 } }
        },
        '/deals/{id}/missions': { get: { tags: ['Clients'], summary: 'Get missions for deal', security, parameters: [paramId], responses: { 200: { description: 'Deal missions' }, 401: auth401 } } },
        '/deals/{id}/resumes': {
            get: { tags: ['Clients'], summary: 'Get resumes for deal', security, parameters: [paramId], responses: { 200: { description: 'Deal resumes' }, 401: auth401 } },
            post: { tags: ['Clients'], summary: 'Add resume to deal', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Resume added' }, 401: auth401 } }
        },
        '/deals/{id}/resumes/{resumeId}': {
            put: { tags: ['Clients'], summary: 'Update resume in deal', security: securityCsrf, parameters: [paramId, paramResumeId], responses: { 200: { description: 'Updated' }, 401: auth401 } },
            delete: { tags: ['Clients'], summary: 'Remove resume from deal', security: securityCsrf, parameters: [paramId, paramResumeId], responses: { 200: { description: 'Removed' }, 401: auth401 } }
        },
        '/deals/by-resume/{resumeId}': { get: { tags: ['Clients'], summary: 'Get deals for resume', security, parameters: [paramResumeId], responses: { 200: { description: 'Deals containing resume' }, 401: auth401 } } },
        '/deals/add-resume-to-multiple': { post: { tags: ['Clients'], summary: 'Add resume to multiple deals', security: securityCsrf, responses: { 200: { description: 'Resume added to deals' }, 401: auth401 } } }
    };
}
