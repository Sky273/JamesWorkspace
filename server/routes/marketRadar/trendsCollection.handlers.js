import { FRENCH_REGIONS } from '../../services/franceTravail.service.js';
import { getStatDynamiqueEmploi } from '../../services/marketTrends.service.js';
import { createJob, updateJobStatus, updateCollectionJobProgress, JOB_STATUS } from '../../services/batchJobs.service.js';
import {
    collectMarketTrends,
    storeTrend,
    invalidateTrendsCache
} from '../../services/marketTrends.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { extractRawValue } from '../../services/marketTrends/extractors.js';

function createCollectionResponse(res, payload) {
    res.json({
        success: true,
        ...payload
    });
}

export async function collectAllTrends(req, res) {
    try {
        safeLog('info', 'Market Radar: Trends collection triggered (background)', { userId: req.user.id });

        const job = await createJob({
            firmId: null,
            userId: req.user.id,
            jobType: 'collect-trends',
            options: { source: 'all' }
        });
        await updateJobStatus(job.id, JOB_STATUS.PROCESSING);

        createCollectionResponse(res, {
            message: 'Collection started in background',
            jobId: job.id,
            estimatedDuration: '30-60 minutes'
        });

        setImmediate(async () => {
            const startTime = Date.now();
            let createdCount = 0;
            let updatedCount = 0;
            let failedCount = 0;
            let processedCount = 0;
            let totalExpected = 0;
            let lastProgressLog = 0;
            const PROGRESS_INTERVAL_MS = 5000;

            try {
                safeLog('info', 'Market Radar: Background collection starting...');

                await collectMarketTrends({
                    onTotalEstimated: async (total) => {
                        totalExpected = total;
                        await updateCollectionJobProgress(job.id, {
                            total_items: total,
                            processed_items: 0,
                            success_count: 0,
                            error_count: 0
                        });
                    },
                    onTrendCollected: async (trend) => {
                        try {
                            const result = await storeTrend(trend);
                            if (result.action === 'created') createdCount += 1;
                            else if (result.action === 'updated') updatedCount += 1;
                            else if (result.action === 'failed') {
                                safeLog('warn', 'Market Radar: Failed to store trend', {
                                    error: result.error,
                                    trendType: result.trend?.type,
                                    regionCode: result.trend?.regionCode,
                                    codeRome: result.trend?.codeRome
                                });
                                throw new Error(result.error || 'Trend storage failed');
                            }
                        } catch (storeError) {
                            safeLog('error', 'Market Radar: Exception storing trend', {
                                error: storeError.message,
                                trendType: trend?.type
                            });
                            throw storeError;
                        }
                    },
                    onItemProcessed: async (event) => {
                        processedCount += 1;

                        if (event?.status === 'failed') {
                            failedCount += 1;
                        }

                        const now = Date.now();
                        if (now - lastProgressLog > PROGRESS_INTERVAL_MS) {
                            await updateCollectionJobProgress(job.id, {
                                processed_items: processedCount,
                                success_count: createdCount + updatedCount,
                                error_count: failedCount
                            });
                            const memUsage = process.memoryUsage();
                            safeLog('info', 'Market Radar: Trends collection progress', {
                                processed: processedCount,
                                created: createdCount,
                                updated: updatedCount,
                                failed: failedCount,
                                elapsed: `${Math.round((now - startTime) / 1000)}s`,
                                lastStatus: event?.status,
                                lastType: event?.type,
                                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
                            });
                            lastProgressLog = now;
                        }
                    }
                });

                const duration = Date.now() - startTime;
                const finalMemUsage = process.memoryUsage();
                invalidateTrendsCache();

                await updateCollectionJobProgress(job.id, {
                    total_items: totalExpected || processedCount,
                    processed_items: processedCount,
                    success_count: createdCount + updatedCount,
                    error_count: failedCount
                });
                await updateJobStatus(job.id, JOB_STATUS.COMPLETED);

                safeLog('info', 'Market Radar: Background collection completed', {
                    jobId: job.id,
                    totalProcessed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    successRate: processedCount > 0 ? `${Math.round(((createdCount + updatedCount) / processedCount) * 100)}%` : 'N/A',
                    duration: `${Math.round(duration / 1000)}s`,
                    finalHeapMB: Math.round(finalMemUsage.heapUsed / 1024 / 1024)
                });
            } catch (error) {
                const errorMemUsage = process.memoryUsage();
                safeLog('error', 'Market Radar: Background collection failed', {
                    error: error.message,
                    stack: error.stack,
                    processed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    heapUsedMB: Math.round(errorMemUsage.heapUsed / 1024 / 1024)
                });
                await updateCollectionJobProgress(job.id, {
                    total_items: processedCount,
                    processed_items: processedCount,
                    success_count: createdCount + updatedCount,
                    error_count: failedCount
                });
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: error.message });
            } finally {
                if (global.gc) {
                    global.gc();
                    safeLog('debug', 'Market Radar: Forced garbage collection after main collection');
                }
            }
        });
    } catch {
        safeLog('error', 'Market Radar: Failed to start collection');
        res.status(500).json({ error: 'Failed to start collection' });
    }
}

export async function collectDynamicsOnly(req, res) {
    try {
        safeLog('info', 'Market Radar: DYN_1 dynamics collection triggered (background)', { userId: req.user.id });

        const job = await createJob({
            firmId: null,
            userId: req.user.id,
            jobType: 'collect-trends',
            options: { source: 'dynamics' }
        });
        await updateJobStatus(job.id, JOB_STATUS.PROCESSING);
        await updateCollectionJobProgress(job.id, { total_items: FRENCH_REGIONS.length });

        createCollectionResponse(res, {
            message: 'DYN_1 dynamics collection started in background',
            jobId: job.id,
            estimatedDuration: '1-2 minutes'
        });

        setImmediate(async () => {
            const startTime = Date.now();
            let createdCount = 0;
            let updatedCount = 0;
            let failedCount = 0;
            let skippedCount = 0;
            let processedCount = 0;

            try {
                const collectionDate = new Date().toISOString().split('T')[0];
                const totalRegions = FRENCH_REGIONS.length;

                safeLog('info', 'MarketTrends: Starting DYN_1 collection', { totalRegions, collectionDate });

                const extractLabel = (apiData) => {
                    if (apiData?.libIndicateur) return apiData.libIndicateur;
                    if (apiData?.listeValeursParPeriode?.[0]?.libPeriode) {
                        return `Dynamique emploi - ${apiData.listeValeursParPeriode[0].libPeriode}`;
                    }
                    return "Dynamique de l'emploi";
                };

                for (let i = 0; i < FRENCH_REGIONS.length; i += 1) {
                    const region = FRENCH_REGIONS[i];
                    processedCount += 1;

                    try {
                        await new Promise(resolve => setTimeout(resolve, 500));

                        let data = await getStatDynamiqueEmploi({
                            codeTerritoire: region.code,
                            codeTypeTerritoire: 'REG',
                            codeTypeActivite: 'MOYENNE',
                            codeActivite: 'MOYENNE',
                            codeTypePeriode: 'TRIMESTRE',
                            dernierePeriode: true,
                            sansCaracteristiques: true
                        });

                        if (!data) {
                            skippedCount += 1;
                            safeLog('debug', 'MarketTrends: DYN_1 no data for region', {
                                region: region.name,
                                regionCode: region.code,
                                progress: `${processedCount}/${totalRegions}`
                            });
                            continue;
                        }

                        const value = extractRawValue(data);

                        if (value === null) {
                            skippedCount += 1;
                            safeLog('debug', 'MarketTrends: DYN_1 no usable value for region', {
                                region: region.name,
                                regionCode: region.code,
                                progress: `${processedCount}/${totalRegions}`
                            });
                            continue;
                        }

                        const trend = {
                            date: collectionDate,
                            type: 'dynamique_emploi',
                            region: region.name,
                            regionCode: region.code,
                            value,
                            valueLabel: extractLabel(data),
                            metadata: data
                        };

                        data = null;

                        try {
                            const result = await storeTrend(trend);
                            if (result.action === 'created') createdCount += 1;
                            else if (result.action === 'updated') updatedCount += 1;
                            else if (result.action === 'failed') {
                                failedCount += 1;
                                safeLog('warn', 'Market Radar: Failed to store DYN_1 trend', { regionCode: region.code });
                            }
                        } catch {
                            failedCount += 1;
                            safeLog('error', 'Market Radar: Exception storing DYN_1 trend', { regionCode: region.code });
                        }
                    } catch {
                        failedCount += 1;
                        safeLog('warn', 'MarketTrends: Failed to collect DYN_1 for region', {
                            region: region.name,
                            regionCode: region.code,
                            progress: `${processedCount}/${totalRegions}`
                        });
                    }
                }

                const duration = Date.now() - startTime;
                const memUsage = process.memoryUsage();
                invalidateTrendsCache();
                const totalAccounted = createdCount + updatedCount + failedCount + skippedCount;

                await updateCollectionJobProgress(job.id, {
                    processed_items: processedCount,
                    success_count: createdCount + updatedCount,
                    error_count: failedCount
                });
                await updateJobStatus(job.id, JOB_STATUS.COMPLETED);

                safeLog('info', 'Market Radar: DYN_1 collection completed', {
                    jobId: job.id,
                    totalRegions,
                    processed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    skipped: skippedCount,
                    totalAccounted,
                    accountingMatch: totalAccounted === totalRegions ? 'OK' : 'MISMATCH',
                    successRate: processedCount > 0 ? `${Math.round(((createdCount + updatedCount) / processedCount) * 100)}%` : 'N/A',
                    duration: `${Math.round(duration / 1000)}s`,
                    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
                });
            } catch (error) {
                const errorMemUsage = process.memoryUsage();
                safeLog('error', 'Market Radar: DYN_1 collection failed', {
                    processed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    skipped: skippedCount,
                    heapUsedMB: Math.round(errorMemUsage.heapUsed / 1024 / 1024)
                });
                await updateCollectionJobProgress(job.id, {
                    processed_items: processedCount,
                    success_count: createdCount + updatedCount,
                    error_count: failedCount
                });
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: error.message });
            } finally {
                if (global.gc) {
                    global.gc();
                    safeLog('debug', 'Market Radar: Forced garbage collection after DYN_1 collection');
                }
            }
        });
    } catch {
        safeLog('error', 'Market Radar: Failed to start DYN_1 collection');
        res.status(500).json({ error: 'Failed to start DYN_1 collection' });
    }
}
