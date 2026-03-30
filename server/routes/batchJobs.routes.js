/**
 * Batch Jobs Routes
 * API endpoints for managing batch processing jobs
 */

import express from 'express';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, batchImproveSchema, batchAdaptSchema, batchMatchSchema, batchProfileSearchSchema, batchProfileAnalysisSchema, batchDealExportSchema, provideNameSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import multer from 'multer';
import * as missionsService from '../services/missions.service.js';
import {
    JOB_STATUS,
    ITEM_STATUS,
    createJob,
    addJobItems,
    addJobResumeIds,
    addJobTaskItems,
    addJobExportItems,
    getJob,
    getJobItems,
    getJobsByFirm,
    getAllJobs,
    cancelJob,
    deleteJob,
    getJobItem,
    resumeItemWithName,
    getItemsPendingName,
    getDealForExport,
    getResumesForDeal,
    getAdaptationsForDeal,
    updateJobStatus
} from '../services/batchJobs.service.js';

const router = express.Router();

function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

function normalizeBatchJobPayload(payload = {}) {
    return {
        ...payload,
        firm_id: getFirstDefinedValue(payload, ['firm_id', 'firmId']),
        templateId: getFirstDefinedValue(payload, ['templateId', 'template_id']),
        exportFormat: getFirstDefinedValue(payload, ['exportFormat', 'export_format']),
        exportFormats: getFirstDefinedValue(payload, ['exportFormats', 'export_formats']),
        deleteAfterExport: getFirstDefinedValue(payload, ['deleteAfterExport', 'delete_after_export']),
        relativePaths: getFirstDefinedValue(payload, ['relativePaths', 'relative_paths']),
        resumeIds: getFirstDefinedValue(payload, ['resumeIds', 'resume_ids']),
        resumeId: getFirstDefinedValue(payload, ['resumeId', 'resume_id']),
        dealId: getFirstDefinedValue(payload, ['dealId', 'deal_id']),
        profileType: getFirstDefinedValue(payload, ['profileType', 'profile_type']),
        candidateName: getFirstDefinedValue(payload, ['candidateName', 'candidate_name']),
        candidateEmail: getFirstDefinedValue(payload, ['candidateEmail', 'candidate_email']),
        missionId: getFirstDefinedValue(payload, ['missionId', 'mission_id'])
    };
}

// Configure multer for file uploads (store in memory for batch processing)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
        files: 200 // Max 200 files per request
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Type de fichier non supporte : ${file.mimetype}`));
        }
    }
});

/**
 * POST /api/batch-jobs
 * Create a new batch job with files
 */
router.post('/', authenticateToken, upload.array('files', 200), async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id; // JWT uses firmId

        const normalizedPayload = normalizeBatchJobPayload(req.body);

        // Get firm_id from request or use user's firm
        let firmId = userFirmId;
        if (isAdmin && normalizedPayload.firm_id) {
            firmId = normalizedPayload.firm_id; // Keep as string (UUID)
        }

        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID requis' });
        }

        // Parse options - handle both string 'true' and boolean true
        // Parse exportFormats - can be JSON string array or single format string for backward compatibility
        let exportFormats = ['pdf'];
        if (normalizedPayload.exportFormats) {
            try {
                exportFormats = typeof normalizedPayload.exportFormats === 'string' 
                    ? JSON.parse(normalizedPayload.exportFormats) 
                    : normalizedPayload.exportFormats;
            } catch {
                exportFormats = [normalizedPayload.exportFormats];
            }
        } else if (normalizedPayload.exportFormat) {
            exportFormats = [normalizedPayload.exportFormat];
        }

        const options = {
            improve: req.body.improve === 'true' || req.body.improve === true,
            export: req.body.export === 'true' || req.body.export === true,
            exportFormats: exportFormats,
            templateId: normalizedPayload.templateId || null,
            deleteAfterExport: normalizedPayload.deleteAfterExport === 'true' || normalizedPayload.deleteAfterExport === true,
            profileType: normalizedPayload.profileType || undefined,
            candidateName: normalizedPayload.candidateName || undefined,
            candidateEmail: normalizedPayload.candidateEmail || undefined
        };

        // Create the job
        const job = await createJob({
            firmId,
            userId,
            jobType: 'import',
            options
        });

        let relativePaths = [];
        if (normalizedPayload.relativePaths) {
            try {
                relativePaths = typeof normalizedPayload.relativePaths === 'string' 
                    ? JSON.parse(normalizedPayload.relativePaths) 
                    : normalizedPayload.relativePaths;
            } catch {
                relativePaths = [];
            }
        }

        const items = (req.files || []).map((file, index) => ({
            fileName: file.originalname,
            fileData: file.buffer,
            fileMimeType: file.mimetype,
            relativePath: relativePaths[index] || null
        }));

        const responsePayload = {
            id: job.id,
            status: job.status,
            firm_id: job.firm_id,
            user_id: job.user_id,
            job_type: job.job_type,
            total_items: req.files?.length || 0,
            processed_items: job.processed_items || 0,
            success_count: job.success_count || 0,
            error_count: job.error_count || 0,
            options: job.options,
            created_at: job.created_at
        };

        safeLog('info', 'Batch job created via API', { 
            jobId: job.id, 
            fileCount: items.length,
            totalItems: responsePayload.total_items,
            options 
        });

        res.status(201).json(responsePayload);

        void (async () => {
            try {
                if (items.length === 0) {
                    safeLog('warn', 'No files received for batch job', { jobId: job.id });
                    return;
                }

                safeLog('info', 'Adding items to job', { 
                    jobId: job.id, 
                    itemCount: items.length,
                    fileNames: items.map(i => i.fileName),
                    fileSizes: items.map(i => i.fileData?.length || 0),
                    hasRelativePaths: relativePaths.length > 0,
                    relativePaths: relativePaths.slice(0, 5)
                });

                const addedCount = await addJobItems(job.id, items);
                safeLog('info', 'Items added to job', { jobId: job.id, addedCount });
            } catch (stagingError) {
                safeLog('error', 'Failed to stage items for batch job after job creation', { jobId: job.id, error: stagingError.message });
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: stagingError.message });
            }
        })();
    } catch (error) {
        safeLog('error', 'Failed to create batch job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
    }
});

/**
 * POST /api/batch-jobs/improve
 * Create a batch improvement job for existing resumes
 */
router.post('/improve', authenticateToken, validateBody(batchImproveSchema), async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const { resumeIds, options: jobOptions = {} } = normalizedPayload;

        safeLog('info', 'Batch improvement job request received', {
            userId,
            isAdmin,
            userFirmId,
            requestedFirmId: normalizedPayload.firm_id || null,
            resumeCount: Array.isArray(resumeIds) ? resumeIds.length : 0,
            hasOptions: !!jobOptions && Object.keys(jobOptions).length > 0
        });

        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs requis' });
        }

        // Get firm_id from request or use user's firm
        let firmId = userFirmId;
        if (isAdmin && normalizedPayload.firm_id) {
            firmId = normalizedPayload.firm_id;
        }

        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID requis' });
        }

        // Create the job
        const job = await createJob({
            firmId,
            userId,
            jobType: 'improve',
            options: {
                ...jobOptions,
                improve: true
            }
        });

        // Add resume IDs to the job
        await addJobResumeIds(job.id, resumeIds);

        // Get updated job with counts
        const updatedJob = await getJob(job.id);

        safeLog('info', 'Batch improvement job created via API', { 
            jobId: job.id, 
            resumeCount: resumeIds.length 
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create batch improvement job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
    }
});

/**
 * POST /api/batch-jobs/adapt
 * Create a batch adaptation job for existing resumes and a mission
 */
router.post('/adapt', authenticateToken, validateBody(batchAdaptSchema), async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const { resumeIds, missionId, options: jobOptions = {} } = normalizedPayload;

        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs requis' });
        }

        if (!missionId) {
            return res.status(400).json({ error: 'Mission ID requis' });
        }

        let firmId = userFirmId;
        if (isAdmin && normalizedPayload.firm_id) {
            firmId = normalizedPayload.firm_id;
        }

        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID requis' });
        }

        const job = await createJob({
            firmId,
            userId,
            jobType: 'adapt',
            options: {
                ...jobOptions,
                missionId,
                adapt: true
            }
        });

        await addJobResumeIds(job.id, resumeIds);
        const updatedJob = await getJob(job.id);

        safeLog('info', 'Batch adaptation job created via API', {
            jobId: job.id,
            resumeCount: resumeIds.length,
            missionId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create batch adaptation job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la cr?ation du job' });
    }
});

/**
 * POST /api/batch-jobs/match
 * Create a batch match-analysis job for existing resumes and a mission
 */
router.post('/match', authenticateToken, validateBody(batchMatchSchema), async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const { resumeIds, missionId, options: jobOptions = {} } = normalizedPayload;

        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs requis' });
        }

        if (!missionId) {
            return res.status(400).json({ error: 'Mission ID requis' });
        }

        let firmId = userFirmId;
        if (isAdmin && normalizedPayload.firm_id) {
            firmId = normalizedPayload.firm_id;
        }

        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID requis' });
        }

        const job = await createJob({
            firmId,
            userId,
            jobType: 'match',
            options: {
                ...jobOptions,
                missionId,
                match: true
            }
        });

        await addJobResumeIds(job.id, resumeIds);
        const updatedJob = await getJob(job.id);

        safeLog('info', 'Batch match job created via API', {
            jobId: job.id,
            resumeCount: resumeIds.length,
            missionId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create batch match job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
    }
});

/**
 * POST /api/batch-jobs/profile-search
 * Create a profile matching search job for a mission
 */
router.post('/profile-search', authenticateToken, validateBody(batchProfileSearchSchema), async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const missionId = normalizedPayload.missionId;

        let firmId = userFirmId;
        if (isAdmin && normalizedPayload.firm_id) {
            firmId = normalizedPayload.firm_id;
        }

        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID requis' });
        }

        const missionRecord = await missionsService.findMission(missionId);
        if (!missionRecord) {
            return res.status(404).json({ error: 'Mission non trouvée' });
        }

        const missionFirmId = missionRecord.firm_id || missionRecord.firm;
        if (!isAdmin && missionFirmId !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const job = await createJob({
            firmId,
            userId,
            jobType: 'profile-search',
            options: {
                missionId,
                limit: normalizedPayload.limit ?? 0,
                minScore: normalizedPayload.minScore ?? 0,
                status: normalizedPayload.status ?? null,
                weights: normalizedPayload.weights,
                dealId: normalizedPayload.dealId || null,
                searchFirmId: isAdmin && !normalizedPayload.firm_id ? null : firmId
            }
        });

        await addJobTaskItems(job.id, [{
            fileName: missionRecord.title || `Mission ${missionId}`,
            sourceType: 'profile-search'
        }]);

        const updatedJob = await getJob(job.id);

        safeLog('info', 'Profile search job created via API', {
            jobId: job.id,
            missionId,
            requestedBy: userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create profile search job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
    }
});

/**
 * POST /api/batch-jobs/profile-analysis
 * Create a detailed profile analysis job for a mission/resume pair
 */
router.post('/profile-analysis', authenticateToken, validateBody(batchProfileAnalysisSchema), async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const resumeId = normalizedPayload.resumeId || normalizedPayload.resume_id;
        const missionId = normalizedPayload.missionId;

        let firmId = userFirmId;
        if (isAdmin && normalizedPayload.firm_id) {
            firmId = normalizedPayload.firm_id;
        }

        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID requis' });
        }

        const missionRecord = await missionsService.findMission(missionId);
        if (!missionRecord) {
            return res.status(404).json({ error: 'Mission non trouvée' });
        }

        const missionFirmId = missionRecord.firm_id || missionRecord.firm;
        if (!isAdmin && missionFirmId !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const job = await createJob({
            firmId,
            userId,
            jobType: 'profile-analysis',
            options: {
                missionId
            }
        });

        await addJobTaskItems(job.id, [{
            resumeId,
            fileName: `Profile Analysis ${resumeId}`,
            sourceType: 'profile-analysis'
        }]);

        const updatedJob = await getJob(job.id);

        safeLog('info', 'Profile analysis job created via API', {
            jobId: job.id,
            missionId,
            resumeId,
            requestedBy: userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create profile analysis job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
    }
});

/**
 * POST /api/batch-jobs/deal-export
 * Create a batch export job for a deal (CVs + adaptations)
 */
router.post('/deal-export', authenticateToken, validateBody(batchDealExportSchema), async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const { dealId, templateId, exportFormats = ['pdf'] } = normalizedPayload;

        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID requis' });
        }
        if (!templateId) {
            return res.status(400).json({ error: 'Template ID requis' });
        }

        // Verify deal exists and user has access
        const deal = await getDealForExport(dealId);
        if (!deal) {
            return res.status(404).json({ error: 'Affaire non trouvée' });
        }

        if (!isAdmin && deal.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // 1. Get resumes linked to the deal
        const dealResumes = await getResumesForDeal(dealId);

        // 2. Get adaptations linked to missions of this deal
        const dealAdaptations = await getAdaptationsForDeal(dealId);

        const totalItems = dealResumes.length + dealAdaptations.length;
        if (totalItems === 0) {
            return res.status(400).json({ error: 'Aucun CV ni adaptation ? exporter pour cette affaire' });
        }

        // Create the job
        const job = await createJob({
            firmId: deal.firm_id,
            userId,
            jobType: 'deal-export',
            options: {
                dealId,
                dealTitle: deal.title,
                templateId,
                exportFormats: Array.isArray(exportFormats) ? exportFormats : [exportFormats],
                export: true
            }
        });

        // Build export items
        const exportItems = [];

        for (const resume of dealResumes) {
            exportItems.push({
                resumeId: resume.id,
                adaptationId: null,
                sourceType: 'resume',
                fileName: resume.name || 'CV',
                relativePath: resume.relative_path || null,
                originalName: resume.source_file_name || null
            });
        }

        for (const adaptation of dealAdaptations) {
            exportItems.push({
                resumeId: adaptation.resume_id,
                adaptationId: adaptation.id,
                sourceType: 'adaptation',
                fileName: `${adaptation.candidate_name || 'Candidat'} - ${adaptation.mission_name || 'Mission'}`,
                originalName: adaptation.source_file_name || null,
                relativePath: adaptation.relative_path || null
            });
        }

        await addJobExportItems(job.id, exportItems);

        const updatedJob = await getJob(job.id);

        safeLog('info', 'Deal export job created', {
            jobId: job.id,
            dealId,
            dealTitle: deal.title,
            resumeCount: dealResumes.length,
            adaptationCount: dealAdaptations.length,
            exportFormats
        });

        res.status(201).json({
            ...updatedJob,
            resumeCount: dealResumes.length,
            adaptationCount: dealAdaptations.length
        });
    } catch (error) {
        safeLog('error', 'Failed to create deal export job', { error: error.message });
        res.status(500).json({ error: error.message || "Erreur lors de la création du job d'export" });
    }
});

/**
 * GET /api/batch-jobs
 * Get all jobs for the current user's firm (or all for admin)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const { limit = 50, offset = 0, status } = req.query;

        let jobs;
        if (isAdmin) {
            jobs = await getAllJobs({ 
                limit: parseInt(limit, 10), 
                offset: parseInt(offset, 10),
                status: status || null
            });
        } else {
            jobs = await getJobsByFirm(userFirmId, { 
                limit: parseInt(limit, 10), 
                offset: parseInt(offset, 10),
                status: status || null
            });
        }

        // Check export file availability on disk for each job
        const jobsWithAvailability = jobs.map(job => ({
            ...job,
            export_file_available: !!(job.export_file_path && job.export_file_name && fs.existsSync(job.export_file_path))
        }));

        res.json(jobsWithAvailability);
    } catch (error) {
        safeLog('error', 'Failed to get batch jobs', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération des jobs' });
    }
});

/**
 * GET /api/batch-jobs/:id
 * Get a specific job with its items
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }

        // Check access rights
        if (!isAdmin && job.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // Get job items
        const items = await getJobItems(id);

        const export_file_available = !!(job.export_file_path && job.export_file_name && fs.existsSync(job.export_file_path));
        res.json({ ...job, items, export_file_available });
    } catch (error) {
        safeLog('error', 'Failed to get batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération du job' });
    }
});

/**
 * POST /api/batch-jobs/:id/cancel
 * Cancel a job
 */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }

        // Check access rights
        if (!isAdmin && job.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // Can only cancel pending or processing jobs
        if (job.status !== JOB_STATUS.PENDING && job.status !== JOB_STATUS.PROCESSING) {
            return res.status(400).json({ error: 'Ce job ne peut pas ?tre annul?' });
        }

        await cancelJob(id);

        const updatedJob = await getJob(id);
        res.json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to cancel batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de l\'annulation du job' });
    }
});

/**
 * DELETE /api/batch-jobs/:id
 * Delete a job
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }

        // Check access rights
        if (!isAdmin && job.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // Can only delete completed, failed, or cancelled jobs
        if (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.PROCESSING) {
            return res.status(400).json({ error: 'Annulez d\'abord le job avant de le supprimer' });
        }

        await deleteJob(id);

        res.json({ success: true, message: 'Job supprim?' });
    } catch (error) {
        safeLog('error', 'Failed to delete batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la suppression du job' });
    }
});

/**
 * GET /api/batch-jobs/:id/download
 * Download the export ZIP file for a completed job
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }

        // Check access rights
        if (!isAdmin && job.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        // Check if export file exists
        if (!job.export_file_path || !job.export_file_name) {
            return res.status(404).json({ error: 'Aucun fichier d\'export disponible' });
        }

        // Check if file exists on disk
        if (!fs.existsSync(job.export_file_path)) {
            return res.status(404).json({ error: "Fichier d'export non trouvé sur le serveur" });
        }

        // Send file
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${job.export_file_name}"`);
        
        const fileStream = fs.createReadStream(job.export_file_path);
        fileStream.pipe(res);

        // Delete file after download completes to free disk space
        res.on('finish', () => {
            fs.unlink(job.export_file_path, (err) => {
                if (err && err.code !== 'ENOENT') {
                    safeLog('warn', 'Failed to delete export file after download', { 
                        filePath: job.export_file_path, 
                        error: err.message 
                    });
                } else {
                    clearJobExportFile(id).catch((clearErr) => {
                        safeLog('warn', 'Failed to clear export file metadata after download', {
                            jobId: id,
                            error: clearErr.message
                        });
                    });
                    safeLog('debug', 'Export file deleted after download', { 
                        filePath: job.export_file_path 
                    });
                }
            });
        });

        safeLog('info', 'Export file downloaded', { jobId: id, fileName: job.export_file_name });
    } catch (error) {
        safeLog('error', 'Failed to download export file', { error: error.message });
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
});

/**
 * GET /api/batch-jobs/:id/pending-names
 * Get items waiting for name input
 */
router.get('/:id/pending-names', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        const job = await getJob(id);
        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }

        // Check access
        if (!isAdmin && job.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        const items = await getItemsPendingName(id);
        res.json({ items });
    } catch (error) {
        safeLog('error', 'Failed to get items pending name', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération des items' });
    }
});

/**
 * POST /api/batch-jobs/items/:itemId/provide-name
 * Provide name for an item waiting for name input and resume processing
 */
router.post('/items/:itemId/provide-name', authenticateToken, validateParams('itemId'), validateBody(provideNameSchema), async (req, res) => {
    try {
        const { itemId } = req.params;
        const { name } = req.body;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = req.user?.firmId || req.user?.firm_id;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Le nom du candidat est requis' });
        }

        const item = await getJobItem(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item non trouvé' });
        }

        // Check access
        if (!isAdmin && item.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }

        if (item.status !== ITEM_STATUS.PENDING_NAME) {
            return res.status(400).json({ 
                error: `L'item n'est pas en attente de nom (statut actuel: ${item.status})` 
            });
        }

        const updatedItem = await resumeItemWithName(itemId, name.trim());
        
        safeLog('info', 'Name provided for batch item', { 
            itemId, 
            providedName: name.trim(),
            fileName: item.file_name 
        });

        res.json({ 
            success: true, 
            message: 'Nom fourni, le traitement va reprendre',
            item: updatedItem 
        });
    } catch (error) {
        safeLog('error', 'Failed to provide name for item', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la mise ? jour' });
    }
});

export default router;
