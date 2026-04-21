import fs from 'fs';
import fsPromises from 'fs/promises';
import { pipeline } from 'stream/promises';
import {
    JOB_STATUS,
    ITEM_STATUS,
    clearJobExportFile,
    getJob,
    getJobItem,
    getJobItems,
    getJobsByFirm,
    getAllJobs,
    cancelJob,
    deleteJob,
    getItemsPendingName,
    resumeItemWithName
} from '../../services/batchJobs.service.js';
import { metrics } from '../../services/metrics.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { setSafeFileResponseHeaders } from '../../utils/fileResponseSecurity.js';
import { ensureOwnerAccess, getUserContext } from './helpers.js';
import { isManagedBatchExportPath } from '../../services/batchJobs/maintenance.js';
import { shouldBypassCache } from '../../utils/requestCacheControl.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;

async function fileExists(filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        return false;
    }

    try {
        await fsPromises.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function hasCompleteExportMetadata(job) {
    return !!(job?.export_file_path && job?.export_file_name);
}

function hasIncompleteExportMetadata(job) {
    return !!job?.id && Boolean(job?.export_file_path || job?.export_file_name) && !hasCompleteExportMetadata(job);
}

async function cleanupExportArtifact(jobId, exportFilePath, exportFileName, { clearMetadata = true } = {}) {
    if (!exportFilePath) {
        return false;
    }

    if (!isManagedBatchExportPath(exportFilePath)) {
        safeLog('warn', 'Rejected cleanup for unmanaged batch export artifact', {
            jobId,
            filePath: exportFilePath,
            fileName: exportFileName
        });
        if (clearMetadata) {
            await clearJobExportFile(jobId);
        }
        return false;
    }

    try {
        const deleted = await new Promise((resolve, reject) => {
            fs.unlink(exportFilePath, (error) => {
                if (!error) {
                    resolve(true);
                    return;
                }
                if (error.code === 'ENOENT') {
                    resolve(false);
                    return;
                }
                reject(error);
            });
        });
        if (clearMetadata) {
            try {
                await clearJobExportFile(jobId);
            } catch (error) {
                safeLog('warn', 'Failed to clear export file metadata', {
                    jobId,
                    filePath: exportFilePath,
                    fileName: exportFileName,
                    error: error.message
                });
            }
        }

        if (deleted) {
            metrics.trackCleanupActivity({
                filesDeleted: 1,
                metadata: {
                    source: 'batch_jobs_routes',
                    jobId,
                    fileName: exportFileName || null
                }
            });
        }

        return deleted;
    } catch (error) {
        safeLog('warn', 'Failed to delete export file artifact', {
            jobId,
            filePath: exportFilePath,
            fileName: exportFileName,
            error: error.message
        });
        return false;
    }
}

async function reconcileMissingExportArtifact(job) {
    if (!job?.id) {
        return job;
    }

    if (hasIncompleteExportMetadata(job)) {
        try {
            await clearJobExportFile(job.id);
            safeLog('warn', 'Cleared incomplete export metadata', {
                jobId: job.id,
                filePath: job.export_file_path || null,
                fileName: job.export_file_name || null
            });
            metrics.trackCleanupActivity({
                staleExportRefsCleared: 1,
                metadata: {
                    source: 'batch_jobs_routes',
                    jobId: job.id,
                    reason: 'incomplete_export_metadata'
                }
            });
            return {
                ...job,
                export_file_path: null,
                export_file_name: null
            };
        } catch (error) {
            safeLog('warn', 'Failed to clear incomplete export metadata', {
                jobId: job.id,
                filePath: job.export_file_path || null,
                fileName: job.export_file_name || null,
                error: error.message
            });
            return job;
        }
    }

    if (!hasCompleteExportMetadata(job)) {
        return job;
    }

    if (!isManagedBatchExportPath(job.export_file_path)) {
        try {
            await clearJobExportFile(job.id);
            safeLog('warn', 'Cleared unmanaged export metadata', {
                jobId: job.id,
                filePath: job.export_file_path,
                fileName: job.export_file_name
            });
            metrics.trackCleanupActivity({
                staleExportRefsCleared: 1,
                metadata: {
                    source: 'batch_jobs_routes',
                    jobId: job.id,
                    reason: 'unmanaged_export_artifact'
                }
            });
            return {
                ...job,
                export_file_path: null,
                export_file_name: null
            };
        } catch (error) {
            safeLog('warn', 'Failed to clear unmanaged export metadata', {
                jobId: job.id,
                filePath: job.export_file_path,
                fileName: job.export_file_name,
                error: error.message
            });
            return job;
        }
    }

    if (await fileExists(job.export_file_path)) {
        return job;
    }

    try {
        await clearJobExportFile(job.id);
        safeLog('warn', 'Cleared stale export metadata for missing artifact', {
            jobId: job.id,
            filePath: job.export_file_path,
            fileName: job.export_file_name
        });
        metrics.trackCleanupActivity({
            staleExportRefsCleared: 1,
            metadata: {
                source: 'batch_jobs_routes',
                jobId: job.id,
                reason: 'missing_export_artifact'
            }
        });
        return {
            ...job,
            export_file_path: null,
            export_file_name: null
        };
    } catch (error) {
        safeLog('warn', 'Failed to clear stale export metadata', {
            jobId: job.id,
            filePath: job.export_file_path,
            fileName: job.export_file_name,
            error: error.message
        });
        return job;
    }
}

async function withExportAvailability(job) {
    const { export_file_path, ...jobWithoutPath } = job || {};
    return {
        ...jobWithoutPath,
        export_file_available: hasCompleteExportMetadata(job) && await fileExists(export_file_path)
    };
}

function parseListJobsPagination(query = {}) {
    const parsedLimit = query.limit === undefined ? DEFAULT_LIMIT : Number.parseInt(query.limit, 10);
    const parsedOffset = query.offset === undefined ? DEFAULT_OFFSET : Number.parseInt(query.offset, 10);

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        return { error: 'limit must be a positive integer' };
    }

    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        return { error: 'offset must be a non-negative integer' };
    }

    return {
        limit: Math.min(parsedLimit, MAX_LIMIT),
        offset: parsedOffset
    };
}

async function getAuthorizedJobOrRespond(req, res, jobId) {
    const userContext = getUserContext(req);
    const bypassCache = shouldBypassCache(req);
    const job = await getJob(jobId, { bypassCache });

    if (!job) {
        res.status(404).json({ error: 'Job non trouvé' });
        return null;
    }
    if (!ensureOwnerAccess(job.firm_id, userContext, res)) {
        return null;
    }

    return { job, userContext };
}

function hasActiveJobItems(items = []) {
    return items.some((item) => item.status === ITEM_STATUS.PENDING || item.status === ITEM_STATUS.PROCESSING);
}

export async function listJobs(req, res) {
    try {
        const userContext = getUserContext(req);
        if (!userContext.isAdmin && !userContext.userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const pagination = parseListJobsPagination(req.query);
        if (pagination.error) {
            return res.status(400).json({ error: pagination.error });
        }

        const { status } = req.query;
        const options = {
            limit: pagination.limit,
            offset: pagination.offset,
            status: status || null,
      bypassCache: shouldBypassCache(req)
        };

        const jobs = userContext.isAdmin
            ? await getAllJobs(options)
            : await getJobsByFirm(userContext.userFirmId, options);

        const reconciledJobs = await Promise.all(jobs.map((job) => reconcileMissingExportArtifact(job)));
        res.json(await Promise.all(reconciledJobs.map((job) => withExportAvailability(job))));
    } catch (error) {
        safeLog('error', 'Failed to get batch jobs', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération des jobs' });
    }
}

export async function getJobDetails(req, res) {
    try {
        const { id } = req.params;
        const jobContext = await getAuthorizedJobOrRespond(req, res, id);
        if (!jobContext) {
            return;
        }

        const reconciledJob = await reconcileMissingExportArtifact(jobContext.job);
        const items = await getJobItems(id);
        res.json({ ...(await withExportAvailability(reconciledJob)), items });
    } catch (error) {
        safeLog('error', 'Failed to get batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération du job' });
    }
}

export async function cancelJobHandler(req, res) {
    try {
        const { id } = req.params;
        const jobContext = await getAuthorizedJobOrRespond(req, res, id);
        if (!jobContext) {
            return;
        }

        const { job } = jobContext;
        if (job.status !== JOB_STATUS.PENDING && job.status !== JOB_STATUS.PROCESSING) {
            return res.status(400).json({ error: 'Ce job ne peut pas être annulé' });
        }

        await cancelJob(id);
        const updatedJob = await getJob(id);
        res.json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to cancel batch job', { error: error.message });
        res.status(500).json({ error: "Erreur lors de l'annulation du job" });
    }
}

export async function deleteJobHandler(req, res) {
    try {
        const { id } = req.params;
        const jobContext = await getAuthorizedJobOrRespond(req, res, id);
        if (!jobContext) {
            return;
        }

        const { job } = jobContext;
        if (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.PROCESSING) {
            const items = await getJobItems(id);
            if (hasActiveJobItems(items)) {
                return res.status(400).json({ error: "Annulez d'abord le job avant de le supprimer" });
            }
        }

        await deleteJob(id);
        await cleanupExportArtifact(job.id, job.export_file_path, job.export_file_name, { clearMetadata: false });
        res.json({ success: true, message: 'Job supprimé' });
    } catch (error) {
        safeLog('error', 'Failed to delete batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la suppression du job' });
    }
}

export async function downloadJobExport(req, res) {
    try {
        const { id } = req.params;
        const jobContext = await getAuthorizedJobOrRespond(req, res, id);
        if (!jobContext) {
            return;
        }

        const reconciledJob = await reconcileMissingExportArtifact(jobContext.job);
        if (!hasCompleteExportMetadata(reconciledJob)) {
            return res.status(404).json({ error: "Aucun fichier d'export disponible" });
        }
        if (!await fileExists(reconciledJob.export_file_path)) {
            await reconcileMissingExportArtifact(reconciledJob);
            return res.status(404).json({ error: "Fichier d'export non trouvé sur le serveur" });
        }

        setSafeFileResponseHeaders(res, {
            contentType: 'application/zip',
            filename: reconciledJob.export_file_name
        });

        const fileStream = fs.createReadStream(reconciledJob.export_file_path);
        let downloadCompleted = false;
        try {
            await pipeline(fileStream, res);
            downloadCompleted = true;
            safeLog('info', 'Export file downloaded', { jobId: id, fileName: reconciledJob.export_file_name });
        } finally {
            if (downloadCompleted) {
                const deleted = await cleanupExportArtifact(id, reconciledJob.export_file_path, reconciledJob.export_file_name);
                if (deleted) {
                    safeLog('debug', 'Export file deleted after download', {
                        jobId: id,
                        filePath: reconciledJob.export_file_path
                    });
                }
            }
        }
    } catch (error) {
        safeLog('error', 'Failed to download export file', { error: error.message });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erreur lors du téléchargement' });
        } else {
            res.destroy(error);
        }
    }
}

export async function listPendingNames(req, res) {
    try {
        const { id } = req.params;
        const jobContext = await getAuthorizedJobOrRespond(req, res, id);
        if (!jobContext) {
            return;
        }

        const items = await getItemsPendingName(id);
        res.json({ items });
    } catch (error) {
        safeLog('error', 'Failed to get items pending name', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération des items' });
    }
}

export async function provideNameForItem(req, res) {
    try {
        const { itemId } = req.params;
        const { name } = req.body;
        const userContext = getUserContext(req);

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Le nom du candidat est requis' });
        }

        const item = await getJobItem(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item non trouvé' });
        }
        if (!ensureOwnerAccess(item.firm_id, userContext, res)) {
            return;
        }
        if (item.status !== ITEM_STATUS.PENDING_NAME) {
            return res.status(400).json({ error: `L'item n'est pas en attente de nom (statut actuel: ${item.status})` });
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
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
}

