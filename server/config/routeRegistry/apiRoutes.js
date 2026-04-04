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
import resumeCommentsRoutes from '../../routes/resumeComments.routes.js';
import shareRoutes from '../../routes/share.routes.js';
import pipelineRoutes from '../../routes/pipeline.routes.js';
import calendarRoutes from '../../routes/calendar.routes.js';
import backupRoutes from '../../routes/backup.routes.js';
import batchExportRoutes from '../../routes/batchExport.routes.js';
import batchJobsRoutes from '../../routes/batchJobs.routes.js';
import dealsRoutes from '../../routes/deals.routes.js';

export function registerCacheControl(app) {
    app.use('/api', (req, res, next) => {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        });
        next();
    });
}

export function registerApiRoutes(app) {
    app.use('/health', healthRoutes);
    app.use('/api/metrics', metricsRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/missions', missionsRoutes);
    app.use('/api/resumes', resumesRoutes);
    app.use('/api/templates', templatesRoutes);
    app.use('/api/firms', firmsRoutes);
    app.use('/api/llm', llmRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/adaptations', adaptationsRoutes);
    app.use('/api/tags', tagsRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/chatbot', chatbotRoutes);
    app.use('/api/market-radar', marketRadarRoutes);
    app.use('/api/rome', romeRoutes);
    app.use('/api/clients', clientsRoutes);
    app.use('/api/deals', dealsRoutes);
    app.use('/api/submissions', resumeSubmissionsRoutes);
    app.use('/api/mail', mailRoutes);
    app.use('/api/email-templates', emailTemplatesRoutes);
    app.use('/api/consent', consentRoutes);
    app.use('/api/gdpr/mail', gdprMailRoutes);
    app.use('/api/gdpr-audit', gdprAuditRoutes);
    app.use('/api/2fa', twofaRoutes);
    app.use('/api/resumes', resumeCommentsRoutes);
    app.use('/api/share', shareRoutes);
    app.use('/api/pipeline', pipelineRoutes);
    app.use('/api/calendar', calendarRoutes);
    app.use('/api/backup', backupRoutes);
    app.use('/api/batch-export', batchExportRoutes);
    app.use('/api/batch-jobs', batchJobsRoutes);
}
