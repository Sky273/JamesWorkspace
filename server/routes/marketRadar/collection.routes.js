/**
 * Market Radar - Data Collection Routes
 * Admin-only endpoints for triggering data collection
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    runFullCollection,
    runSourceCollection,
    invalidateFactsCache
} from '../../services/marketFacts.service.js';
import { createJob, updateJobStatus, updateCollectionJobProgress, JOB_STATUS } from '../../services/batchJobs.service.js';

const router = express.Router();

/**
 * POST /api/market-radar/collect
 * Run full data collection from all sources
 * Admin only - this is a heavy operation
 */
router.post('/collect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Market Radar: Full collection triggered (background)', { 
            userId: req.user.id 
        });

        // Create a tracked job
        const job = await createJob({
            firmId: null,
            userId: req.user.id,
            jobType: 'collect-facts',
            options: { source: 'all' }
        });
        await updateJobStatus(job.id, JOB_STATUS.PROCESSING);

        // Respond immediately with jobId
        res.json({
            success: true,
            message: 'Data collection started in background',
            jobId: job.id
        });

        // Run collection in background (non-blocking)
        setImmediate(async () => {
            try {
                const options = req.body.options || {};
                const summary = await runFullCollection({
                    ...options,
                    onProgress: async (progress) => {
                        await updateCollectionJobProgress(job.id, {
                            total_items: progress.totalFacts || progress.totalExpected || 0,
                            processed_items: (progress.stored || 0) + (progress.failed || 0),
                            success_count: progress.stored || 0,
                            error_count: progress.failed || 0
                        });
                    }
                });

                // Invalidate facts cache after collection
                invalidateFactsCache();
                safeLog('info', 'Market Radar: Facts cache invalidated after collection');

                // Final progress update + mark completed
                await updateCollectionJobProgress(job.id, {
                    total_items: summary.totalFacts || 0,
                    processed_items: summary.totalFacts || 0,
                    success_count: summary.stored || 0,
                    error_count: summary.failed || 0
                });
                await updateJobStatus(job.id, JOB_STATUS.COMPLETED);

                safeLog('info', 'Market Radar: Full collection completed', { jobId: job.id, summary });
            } catch (error) {
                safeLog('error', 'Market Radar: Collection failed', { error: error.message });
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: error.message });
            }
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to start collection', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to start collection' 
        });
    }
});

/**
 * POST /api/market-radar/collect/:source
 * Run data collection for a specific source
 * @param source - 'france_travail' or 'adzuna'
 */
router.post('/collect/:source', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { source } = req.params;
        
        if (!['france_travail', 'adzuna'].includes(source)) {
            return res.status(400).json({ 
                error: 'Invalid source',
                message: 'Source must be "france_travail" or "adzuna"'
            });
        }

        safeLog('info', `Market Radar: ${source} collection triggered (background)`, { 
            userId: req.user.id 
        });

        // Create a tracked job
        const job = await createJob({
            firmId: null,
            userId: req.user.id,
            jobType: 'collect-facts',
            options: { source }
        });
        await updateJobStatus(job.id, JOB_STATUS.PROCESSING);

        // Respond immediately with jobId
        res.json({
            success: true,
            message: `${source} collection started in background`,
            jobId: job.id
        });

        // Run collection in background (non-blocking)
        setImmediate(async () => {
            try {
                const options = req.body.options || {};
                const summary = await runSourceCollection(source, {
                    ...options,
                    onProgress: async (progress) => {
                        await updateCollectionJobProgress(job.id, {
                            total_items: progress.totalExpected || 0,
                            processed_items: (progress.stored || 0) + (progress.failed || 0),
                            success_count: progress.stored || 0,
                            error_count: progress.failed || 0
                        });
                    }
                });

                // Invalidate facts cache after collection
                invalidateFactsCache();
                safeLog('info', 'Market Radar: Facts cache invalidated after source collection');

                // Final progress update + mark completed
                await updateCollectionJobProgress(job.id, {
                    total_items: summary.collected || 0,
                    processed_items: summary.collected || 0,
                    success_count: summary.stored || 0,
                    error_count: summary.failed || 0
                });
                await updateJobStatus(job.id, JOB_STATUS.COMPLETED);

                safeLog('info', `Market Radar: ${source} collection completed`, { jobId: job.id, summary });
            } catch (error) {
                safeLog('error', `Market Radar: ${source} collection failed`, { error: error.message });
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: error.message });
            }
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to start source collection', { 
            source: req.params.source,
            error: error.message 
        });
        res.status(500).json({ 
            error: 'Failed to start collection' 
        });
    }
});

export default router;
