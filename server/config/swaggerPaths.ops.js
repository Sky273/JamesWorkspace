export function createOpsSwaggerPaths({
    auth401,
    forbidden403,
    notFound404,
    validation400,
    error500,
    security,
    securityCsrf,
    paramId,
    paramPage,
    paramLimit
}) {
    return {
        '/health': {
            get: { tags: ['Health'], summary: 'Health check', description: 'Basic health check (public); detailed info for authenticated admins. **Use the Root Server** (`/`) to call this endpoint.', servers: [{ url: '/', description: 'Root Server' }], responses: { 200: { description: 'Health status', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthCheck' } } } } } }
        },
        '/health/memory': {
            get: { tags: ['Health'], summary: 'Memory usage (admin)', description: '**Use the Root Server** (`/`) to call this endpoint.', servers: [{ url: '/', description: 'Root Server' }], security, responses: { 200: { description: 'Memory stats' }, 401: auth401, 403: forbidden403 } }
        },
        '/health/storage': {
            get: { tags: ['Health'], summary: 'Storage usage (admin)', description: '**Use the Root Server** (`/`) to call this endpoint.', servers: [{ url: '/', description: 'Root Server' }], security, responses: { 200: { description: 'Storage stats' }, 401: auth401, 403: forbidden403 } }
        },
        '/metrics': { get: { tags: ['Metrics'], summary: 'Get all metrics (admin)', security, responses: { 200: { description: 'All metrics' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/summary': { get: { tags: ['Metrics'], summary: 'Metrics summary (admin)', security, responses: { 200: { description: 'Summary' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/performance': { get: { tags: ['Metrics'], summary: 'Performance metrics (admin)', security, responses: { 200: { description: 'Performance data' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/errors': { get: { tags: ['Metrics'], summary: 'Error metrics (admin)', security, responses: { 200: { description: 'Error data' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/cache': { get: { tags: ['Metrics'], summary: 'Cache metrics (admin)', security, responses: { 200: { description: 'Cache stats' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/llm': { get: { tags: ['Metrics'], summary: 'LLM usage metrics (admin)', security, responses: { 200: { description: 'LLM stats' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/database': { get: { tags: ['Metrics'], summary: 'Database metrics (admin)', security, responses: { 200: { description: 'DB stats' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/apm': { get: { tags: ['Metrics'], summary: 'APM metrics (admin)', security, responses: { 200: { description: 'APM data' }, 401: auth401, 403: forbidden403 } } },
        '/metrics/apm/slow-requests': {
            get: { tags: ['Metrics'], summary: 'Slow requests (admin)', security, responses: { 200: { description: 'Slow request list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SlowRequest' } } } } }, 401: auth401, 403: forbidden403 } },
            delete: { tags: ['Metrics'], summary: 'Clear slow requests (admin)', security: securityCsrf, responses: { 200: { description: 'Cleared' }, 401: auth401, 403: forbidden403 } }
        },
        '/metrics/reset': { post: { tags: ['Metrics'], summary: 'Reset metrics (admin)', security: securityCsrf, responses: { 200: { description: 'Metrics reset' }, 401: auth401, 403: forbidden403 } } },
        '/admin/security-logs': { get: { tags: ['Admin'], summary: 'Get security logs', security, parameters: [paramPage, paramLimit, { name: 'level', in: 'query', schema: { type: 'string' } }, { name: 'event', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Paginated security logs', content: { 'application/json': { schema: { type: 'object', properties: { logs: { type: 'array', items: { $ref: '#/components/schemas/SecurityLog' } }, total: { type: 'integer' } } } } } }, 401: auth401, 403: forbidden403 } } },
        '/admin/security-filters': { get: { tags: ['Admin'], summary: 'Get security log filter options', security, responses: { 200: { description: 'Filter options' }, 401: auth401, 403: forbidden403 } } },
        '/admin/security-stats': { get: { tags: ['Admin'], summary: 'Get security statistics', security, responses: { 200: { description: 'Security stats' }, 401: auth401, 403: forbidden403 } } },
        '/admin/cache-stats': { get: { tags: ['Admin'], summary: 'Get cache statistics', security, responses: { 200: { description: 'Cache stats' }, 401: auth401, 403: forbidden403 } } },
        '/admin/users': { get: { tags: ['Admin'], summary: 'Get users overview (admin)', security, responses: { 200: { description: 'Users with activity' }, 401: auth401, 403: forbidden403 } } },
        '/backup/settings': {
            get: { tags: ['Backup'], summary: 'Get backup settings (admin)', security, responses: { 200: { description: 'Backup config' }, 401: auth401, 403: forbidden403 } },
            put: { tags: ['Backup'], summary: 'Update backup settings (admin)', security: securityCsrf, responses: { 200: { description: 'Settings updated' }, 401: auth401, 403: forbidden403 } }
        },
        '/backup/test-connection': { post: { tags: ['Backup'], summary: 'Test FTP/SFTP connection (admin)', security: securityCsrf, responses: { 200: { description: 'Connection test result' }, 401: auth401, 403: forbidden403 } } },
        '/backup/run': { post: { tags: ['Backup'], summary: 'Run backup now (admin)', security: securityCsrf, responses: { 200: { description: 'Backup started' }, 401: auth401, 403: forbidden403 } } },
        '/backup/history': { get: { tags: ['Backup'], summary: 'Get backup history (admin)', security, responses: { 200: { description: 'Backup history' }, 401: auth401, 403: forbidden403 } } },
        '/backup/history/{id}': { delete: { tags: ['Backup'], summary: 'Delete backup record (admin)', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Record deleted' }, 401: auth401, 403: forbidden403 } } },
        '/backup/list-remote': { get: { tags: ['Backup'], summary: 'List remote backups (admin)', security, responses: { 200: { description: 'Remote backup files' }, 401: auth401, 403: forbidden403 } } },
        '/backup/restore': { post: { tags: ['Backup'], summary: 'Restore from backup (admin)', security: securityCsrf, responses: { 200: { description: 'Restore initiated' }, 401: auth401, 403: forbidden403 } } },
        '/backup/scheduler-status': { get: { tags: ['Backup'], summary: 'Get scheduler status (admin)', security, responses: { 200: { description: 'Scheduler status' }, 401: auth401, 403: forbidden403 } } },
        '/batch-jobs': {
            get: { tags: ['Resumes'], summary: 'List batch jobs', security, responses: { 200: { description: 'Array of batch jobs' }, 401: auth401 } },
            post: { tags: ['Resumes'], summary: 'Create batch import job', description: 'Upload multiple resume files for batch processing', security: securityCsrf, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } }, responses: { 201: { description: 'Batch job created' }, 401: auth401 } }
        },
        '/batch-jobs/improve': { post: { tags: ['Resumes'], summary: 'Create batch improve job', security: securityCsrf, responses: { 201: { description: 'Improve job created' }, 401: auth401 } } },
        '/batch-jobs/adapt': { post: { tags: ['Resumes'], summary: 'Create batch adaptation job', security: securityCsrf, responses: { 201: { description: 'Adaptation job created' }, 401: auth401 } } },
        '/batch-jobs/match': { post: { tags: ['Resumes'], summary: 'Create batch match-analysis job', security: securityCsrf, responses: { 201: { description: 'Match-analysis job created' }, 401: auth401 } } },
        '/batch-jobs/profile-search': { post: { tags: ['Missions'], summary: 'Create profile matching search job', security: securityCsrf, responses: { 201: { description: 'Profile search job created' }, 401: auth401 } } },
        '/batch-jobs/profile-analysis': { post: { tags: ['Missions'], summary: 'Create detailed profile analysis job', security: securityCsrf, responses: { 201: { description: 'Profile analysis job created' }, 401: auth401 } } },
        '/batch-jobs/deal-export': { post: { tags: ['Resumes'], summary: 'Create deal export job', security: securityCsrf, responses: { 201: { description: 'Export job created' }, 401: auth401 } } },
        '/batch-jobs/{id}': {
            get: { tags: ['Resumes'], summary: 'Get batch job details', security, parameters: [paramId], responses: { 200: { description: 'Job details with items' }, 401: auth401, 404: notFound404 } },
            delete: { tags: ['Resumes'], summary: 'Delete batch job', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Job deleted' }, 401: auth401 } }
        },
        '/batch-jobs/{id}/cancel': { post: { tags: ['Resumes'], summary: 'Cancel batch job', security: securityCsrf, parameters: [paramId], responses: { 200: { description: 'Job cancelled' }, 401: auth401 } } },
        '/batch-jobs/{id}/download': { get: { tags: ['Resumes'], summary: 'Download batch job result', security, parameters: [paramId], responses: { 200: { description: 'ZIP file', content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } } }, 401: auth401, 404: notFound404 } } },
        '/batch-jobs/{id}/pending-names': { get: { tags: ['Resumes'], summary: 'Get items pending name', security, parameters: [paramId], responses: { 200: { description: 'Items needing names' }, 401: auth401 } } },
        '/batch-jobs/items/{itemId}/provide-name': { post: { tags: ['Resumes'], summary: 'Provide name for batch item', security: securityCsrf, parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } }, responses: { 200: { description: 'Name provided' }, 401: auth401 } } },
        '/batch-export': { post: { tags: ['Resumes'], summary: 'Batch export resumes', description: 'Export multiple resumes as PDF/DOCX in a ZIP file', security: securityCsrf, responses: { 200: { description: 'ZIP download', content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } } }, 401: auth401 } } },
        '/chatbot/message': { post: { tags: ['Chatbot'], summary: 'Send chatbot message', description: 'Assistant conversationnel adossé au guide utilisateur', security: securityCsrf, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' }, conversationHistory: { type: 'array', items: { type: 'object', properties: { role: { type: 'string', enum: ['user', 'assistant'] }, content: { type: 'string' } } } } } } } } }, responses: { 200: { description: 'Chatbot response' }, 401: auth401, 500: error500 } } },
        '/chatbot/status': { get: { tags: ['Chatbot'], summary: 'Get chatbot status', security, responses: { 200: { description: 'Chatbot status' }, 401: auth401 } } },
'/llm/openai': { post: { tags: ['LLM'], summary: 'Proxy OpenAI-compatible request', description: 'Server-side OpenAI-compatible proxy. Depending on the configured provider and requested model, requests may be routed to OpenAI, Hugging Face, DeepSeek, GLM (Z.AI), MiniMax or Ollama.', security: securityCsrf, responses: { 200: { description: 'OpenAI-compatible response' }, 400: validation400, 401: auth401, 500: error500 } } },
        '/llm/anthropic': { post: { tags: ['LLM'], summary: 'Proxy Anthropic-compatible request', description: 'Server-side Anthropic-compatible proxy. Depending on the configured provider and requested model, requests may be routed to Anthropic or MiniMax.', security: securityCsrf, responses: { 200: { description: 'Anthropic-compatible response' }, 400: validation400, 401: auth401, 500: error500 } } },
'/llm/chat/completions': { post: { tags: ['LLM'], summary: 'Unified OpenAI-compatible completions proxy', description: 'Unified OpenAI-compatible endpoint for OpenAI, Hugging Face, DeepSeek, GLM (Z.AI), MiniMax and Ollama, selected by runtime configuration and model family.', security: securityCsrf, responses: { 200: { description: 'OpenAI-compatible response' }, 400: validation400, 401: auth401, 500: error500 } } },
        '/llm/messages': { post: { tags: ['LLM'], summary: 'Unified Anthropic-compatible messages proxy', description: 'Unified Anthropic-compatible endpoint for Anthropic and Anthropic-compatible upstreams such as MiniMax.', security: securityCsrf, responses: { 200: { description: 'Anthropic-compatible response' }, 400: validation400, 401: auth401, 500: error500 } } },
'/llm/circuit-breakers': { get: { tags: ['LLM'], summary: 'Get LLM family circuit-breaker indicators', description: 'Return circuit-breaker indicators for the configured LLM families: openai, anthropic, huggingface, deepseek, glm, minimax and ollama.', security, responses: { 200: { description: 'Circuit-breaker indicators' }, 401: auth401, 403: forbidden403 } } },
        '/docs': { get: { tags: ['Documentation'], summary: 'OpenAPI JSON specification', responses: { 200: { description: 'OpenAPI 3.0 JSON document' } } } },
        '/docs/ui': { get: { tags: ['Documentation'], summary: 'Swagger UI', responses: { 200: { description: 'Interactive API documentation page' } } } },
        '/generate-pdf': { post: { tags: ['Templates'], summary: 'Generate PDF document via PDF server proxy', description: 'Render HTML content to PDF through the internal PDF server. **Use the Root Server** (`/`) to call this endpoint.', servers: [{ url: '/', description: 'Root Server' }], security, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['htmlContent', 'filename'], properties: { htmlContent: { type: 'string' }, filename: { type: 'string' }, stylesheet: { type: 'string' }, headerContent: { type: 'string' }, footerContent: { type: 'string' }, footerHeight: { type: 'integer' }, format: { type: 'string', enum: ['pdf'] } } } } } }, responses: { 200: { description: 'Generated PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } }, 400: validation400, 401: auth401, 500: error500 } } },
        '/generate-docx': { post: { tags: ['Templates'], summary: 'Generate DOCX document via PDF server proxy', description: 'Render HTML content to DOCX through the internal PDF server. **Use the Root Server** (`/`) to call this endpoint.', servers: [{ url: '/', description: 'Root Server' }], security, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['htmlContent', 'filename'], properties: { htmlContent: { type: 'string' }, filename: { type: 'string' }, stylesheet: { type: 'string' }, headerContent: { type: 'string' }, footerContent: { type: 'string' }, footerHeight: { type: 'integer' }, format: { type: 'string', enum: ['doc', 'docx'] } } } } } }, responses: { 200: { description: 'Generated DOCX file', content: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { schema: { type: 'string', format: 'binary' } } } }, 400: validation400, 401: auth401, 500: error500 } } }
    };
}
