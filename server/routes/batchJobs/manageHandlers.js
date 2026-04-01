import fs from 'fs';
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
import { safeLog } from '../../utils/logger.backend.js';
import { setSafeFileResponseHeaders } from '../../utils/fileResponseSecurity.js';
import { ensureOwnerAccess, getUserContext } from './helpers.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;

function withExportAvailability(job) {
    return {
        ...job,
        export_file_available: !!(job.export_file_path && job.export_file_name && fs.existsSync(job.export_file_path))
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
            status: status || null
        };

        const jobs = userContext.isAdmin
            ? await getAllJobs(options)
            : await getJobsByFirm(userContext.userFirmId, options);

        res.json(jobs.map(withExportAvailability));
    } catch (error) {
        safeLog('error', 'Failed to get batch jobs', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération des jobs' });
    }
}

export async function getJobDetails(req, res) {
    try {
        const { id } = req.params;
        const userContext = getUserContext(req);
        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }
        if (!ensureOwnerAccess(job.firm_id, userContext, res)) {
            return;
        }

        const items = await getJobItems(id);
        res.json({ ...withExportAvailability(job), items });
    } catch (error) {
        safeLog('error', 'Failed to get batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la récupération du job' });
    }
}

export async function cancelJobHandler(req, res) {
    try {
        const { id } = req.params;
        const userContext = getUserContext(req);
        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }
        if (!ensureOwnerAccess(job.firm_id, userContext, res)) {
            return;
        }
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
        const userContext = getUserContext(req);
        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }
        if (!ensureOwnerAccess(job.firm_id, userContext, res)) {
            return;
        }
        if (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.PROCESSING) {
            return res.status(400).json({ error: "Annulez d'abord le job avant de le supprimer" });
        }

        await deleteJob(id);
        res.json({ success: true, message: 'Job supprimé' });
    } catch (error) {
        safeLog('error', 'Failed to delete batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la suppression du job' });
    }
}

export async function downloadJobExport(req, res) {
    try {
        const { id } = req.params;
        const userContext = getUserContext(req);
        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }
        if (!ensureOwnerAccess(job.firm_id, userContext, res)) {
            return;
        }
        if (!job.export_file_path || !job.export_file_name) {
            return res.status(404).json({ error: "Aucun fichier d'export disponible" });
        }
        if (!fs.existsSync(job.export_file_path)) {
            return res.status(404).json({ error: "Fichier d'export non trouvé sur le serveur" });
        }

        setSafeFileResponseHeaders(res, {
            contentType: 'application/zip',
            filename: job.export_file_name
        });

        const fileStream = fs.createReadStream(job.export_file_path);
        fileStream.pipe(res);

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
}

export async function listPendingNames(req, res) {
    try {
        const { id } = req.params;
        const userContext = getUserContext(req);
        const job = await getJob(id);
        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }
        if (!ensureOwnerAccess(job.firm_id, userContext, res)) {
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
