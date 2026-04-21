import healthRoutes from '../../routes/health.routes.js';
import metricsRoutes from '../../routes/metrics.routes.js';
import authRoutes from '../../routes/auth/index.js';
import settingsRoutes from '../../routes/settings.routes.js';
import missionsRoutes from '../../routes/missions.routes.js';
import resumesRoutes from '../../routes/resumes.routes.js';
import templatesRoutes from '../../routes/templates.routes.js';
import firmsRoutes from '../../routes/firms.routes.js';
import llmRoutes from '../../routes/llm.routes.js';
import adminRoutes from '../../routes/admin.routes.js';
import adaptationsRoutes from '../../routes/adaptations.routes.js';
import tagsRoutes from '../../routes/tags.routes.js';
import usersRoutes from '../../routes/users.routes.js';
import chatbotRoutes from '../../routes/chatbot.routes.js';
import marketRadarRoutes from '../../routes/marketRadar.routes.js';
import romeRoutes from '../../routes/rome.routes.js';
import clientsRoutes from '../../routes/clients.routes.js';
import resumeSubmissionsRoutes from '../../routes/resumeSubmissions.routes.js';
import mailRoutes from '../../routes/mail.routes.js';
import emailTemplatesRoutes from '../../routes/emailTemplates.routes.js';
import consentRoutes from '../../routes/consent.routes.js';
import gdprMailRoutes from '../../routes/gdprMail.routes.js';
import twofaRoutes from '../../routes/twofa.routes.js';
import gdprAuditRoutes from '../../routes/gdprAudit.routes.js';
import shareRoutes from '../../routes/share.routes.js';
import pipelineRoutes from '../../routes/pipeline.routes.js';
import calendarRoutes from '../../routes/calendar.routes.js';
import backupRoutes from '../../routes/backup.routes.js';
import batchExportRoutes from '../../routes/batchExport.routes.js';
import batchJobsRoutes from '../../routes/batchJobs.routes.js';
import dealsRoutes from '../../routes/deals.routes.js';

function registerRouteEntries(app, entries) {
    for (const [path, routeModule] of entries) {
        app.use(path, routeModule);
    }
}

export function registerCoreApiRoutes(app) {
    registerRouteEntries(app, [
        ['/health', healthRoutes],
        ['/api/metrics', metricsRoutes],
        ['/api/auth', authRoutes],
        ['/api/settings', settingsRoutes],
        ['/api/admin', adminRoutes],
        ['/api/users', usersRoutes],
        ['/api/firms', firmsRoutes],
        ['/api/2fa', twofaRoutes],
    ]);
}

export function registerResumeDomainRoutes(app) {
    registerRouteEntries(app, [
        ['/api/resumes', resumesRoutes],
        ['/api/templates', templatesRoutes],
        ['/api/adaptations', adaptationsRoutes],
        ['/api/submissions', resumeSubmissionsRoutes],
        ['/api/consent', consentRoutes],
        ['/api/share', shareRoutes],
        ['/api/batch-export', batchExportRoutes],
        ['/api/batch-jobs', batchJobsRoutes],
    ]);
}

export function registerBusinessDomainRoutes(app) {
    registerRouteEntries(app, [
        ['/api/missions', missionsRoutes],
        ['/api/clients', clientsRoutes],
        ['/api/deals', dealsRoutes],
        ['/api/pipeline', pipelineRoutes],
        ['/api/calendar', calendarRoutes],
        ['/api/tags', tagsRoutes],
    ]);
}

export function registerIntelligenceRoutes(app) {
    registerRouteEntries(app, [
        ['/api/llm', llmRoutes],
        ['/api/chatbot', chatbotRoutes],
        ['/api/market-radar', marketRadarRoutes],
        ['/api/rome', romeRoutes],
    ]);
}

export function registerOperationsRoutes(app) {
    registerRouteEntries(app, [
        ['/api/mail', mailRoutes],
        ['/api/email-templates', emailTemplatesRoutes],
        ['/api/gdpr/mail', gdprMailRoutes],
        ['/api/gdpr-audit', gdprAuditRoutes],
        ['/api/backup', backupRoutes],
    ]);
}
