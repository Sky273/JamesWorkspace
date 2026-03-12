/**
 * Batch Jobs Routes
 * API endpoints for managing batch processing jobs
 */

import express from 'express';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import multer from 'multer';
import {
    JOB_STATUS,
    createJob,
    addJobItems,
    addJobResumeIds,
    getJob,
    getJobItems,
    getJobsByFirm,
    getAllJobs,
    cancelJob,
    deleteJob
} from '../services/batchJobs.service.js';

const router = express.Router();

// Configure multer for file uploads (store in memory for batch processing)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
        files: 100 // Max 100 files per request
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
            cb(new Error(`Type de fichier non supporté: ${file.mimetype}`));
        }
    }
});

/**
 * POST /api/batch-jobs
 * Create a new batch job with files
 */
router.post('/', authenticateToken, upload.array('files', 100), async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role?.toLowerCase();
        const userFirmId = req.user?.firmId || req.user?.firm_id; // JWT uses firmId
        const isAdmin = userRole === 'admin';

        // Get firm_id from request or use user's firm
        let firmId = userFirmId;
        if (isAdmin && req.body.firm_id) {
            firmId = req.body.firm_id; // Keep as string (UUID)
        }

        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID requis' });
        }

        // Parse options - handle both string 'true' and boolean true
        // Parse exportFormats - can be JSON string array or single format string for backward compatibility
        let exportFormats = ['pdf'];
        if (req.body.exportFormats) {
            try {
                exportFormats = typeof req.body.exportFormats === 'string' 
                    ? JSON.parse(req.body.exportFormats) 
                    : req.body.exportFormats;
            } catch {
                exportFormats = [req.body.exportFormats]; // Single format as fallback
            }
        } else if (req.body.exportFormat) {
            // Backward compatibility with single format
            exportFormats = [req.body.exportFormat];
        }

        const options = {
            improve: req.body.improve === 'true' || req.body.improve === true,
            export: req.body.export === 'true' || req.body.export === true,
            exportFormats: exportFormats,
            templateId: req.body.templateId || null,
            deleteAfterExport: req.body.deleteAfterExport === 'true' || req.body.deleteAfterExport === true
        };

        // Create the job
        const job = await createJob({
            firmId,
            userId,
            jobType: 'import',
            options
        });

        // Add files to the job
        if (req.files && req.files.length > 0) {
            // Parse relative paths if provided (JSON array matching files order)
            let relativePaths = [];
            if (req.body.relativePaths) {
                try {
                    relativePaths = typeof req.body.relativePaths === 'string' 
                        ? JSON.parse(req.body.relativePaths) 
                        : req.body.relativePaths;
                } catch {
                    relativePaths = [];
                }
            }

            const items = req.files.map((file, index) => ({
                fileName: file.originalname,
                fileData: file.buffer,
                fileMimeType: file.mimetype,
                relativePath: relativePaths[index] || null
            }));

            safeLog('info', 'Adding items to job', { 
                jobId: job.id, 
                itemCount: items.length,
                fileNames: items.map(i => i.fileName),
                fileSizes: items.map(i => i.fileData?.length || 0),
                hasRelativePaths: relativePaths.length > 0
            });

            const addedCount = await addJobItems(job.id, items);
            safeLog('info', 'Items added to job', { jobId: job.id, addedCount });
        } else {
            safeLog('warn', 'No files received for batch job', { jobId: job.id });
        }

        // Get updated job with counts
        const updatedJob = await getJob(job.id);

        safeLog('info', 'Batch job created via API', { 
            jobId: job.id, 
            fileCount: req.files?.length || 0,
            totalItems: updatedJob?.total_items,
            options 
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create batch job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
    }
});

/**
 * POST /api/batch-jobs/improve
 * Create a batch improvement job for existing resumes
 */
router.post('/improve', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role?.toLowerCase();
        const userFirmId = req.user?.firmId || req.user?.firm_id;
        const isAdmin = userRole === 'admin';

        const { resumeIds, options: jobOptions = {} } = req.body;

        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs requis' });
        }

        // Get firm_id from request or use user's firm
        let firmId = userFirmId;
        if (isAdmin && req.body.firm_id) {
            firmId = parseInt(req.body.firm_id, 10);
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
 * GET /api/batch-jobs
 * Get all jobs for the current user's firm (or all for admin)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userRole = req.user?.role?.toLowerCase();
        const userFirmId = req.user?.firmId || req.user?.firm_id;
        const isAdmin = userRole === 'admin';

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

        res.json(jobs);
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
        const userRole = req.user?.role?.toLowerCase();
        const userFirmId = req.user?.firmId || req.user?.firm_id;
        const isAdmin = userRole === 'admin';

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

        res.json({ ...job, items });
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
        const userRole = req.user?.role?.toLowerCase();
        const userFirmId = req.user?.firmId || req.user?.firm_id;
        const isAdmin = userRole === 'admin';

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
            return res.status(400).json({ error: 'Ce job ne peut pas être annulé' });
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
        const userRole = req.user?.role?.toLowerCase();
        const userFirmId = req.user?.firmId || req.user?.firm_id;
        const isAdmin = userRole === 'admin';

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

        res.json({ success: true, message: 'Job supprimé' });
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
        const userRole = req.user?.role?.toLowerCase();
        const userFirmId = req.user?.firmId || req.user?.firm_id;
        const isAdmin = userRole === 'admin';

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
            return res.status(404).json({ error: 'Fichier d\'export non trouvé sur le serveur' });
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

export default router;
