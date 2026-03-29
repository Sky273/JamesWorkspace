// ============================================
// METRICS AND MONITORING SERVICE
// ============================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from '../utils/logger.backend.js';

// Module logger
const log = createModuleLogger('metrics');

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Metrics file configuration
const METRICS_DIR = path.join(__dirname, '../../logs');
const METRICS_FILE = path.join(METRICS_DIR, 'metrics.json');
const METRICS_HISTORY_FILE = path.join(METRICS_DIR, 'metrics-history.jsonl');
const SAVE_INTERVAL_MS = 5 * 60 * 1000; // Save every 5 minutes
const HISTORY_INTERVAL_MS = 60 * 60 * 1000; // Append to history every hour
const MAX_LLM_PROVIDER_KEYS = 50;
const LLM_PROVIDER_FALLBACK_KEY = 'other';


function sanitizeLLMMetricPart(value) {
    const sanitized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 40);

    return sanitized || 'unknown';
}

export function buildLLMMetricLabel(provider, model = '') {
    const normalizedProvider = sanitizeLLMMetricPart(provider);
    if (!model) {
        return normalizedProvider;
    }

    return `${normalizedProvider}:${sanitizeLLMMetricPart(model)}`;
}

// Ensure metrics directory exists
try {
    if (!fs.existsSync(METRICS_DIR)) {
        fs.mkdirSync(METRICS_DIR, { recursive: true });
    }
} catch (err) {
    log.error('Failed to create metrics directory', { error: err.message });
}

class MetricsCollector {
    constructor() {
        this.startTime = Date.now();
        this.requests = {
            total: 0,
            byMethod: {},
            byEndpoint: {},
            byStatus: {},
            responseTimes: []
        };
        this.errors = {
            total: 0,
            byType: {},
            byEndpoint: {},
            recent: []
        };
        this.cache = {
            hits: 0,
            misses: 0
        };
        this.llm = {
            requests: 0,
            byProvider: {},
            totalTokens: 0,
            errors: 0
        };
        this.operations = {
            uploads: {
                total: 0,
                successful: 0,
                failed: 0,
                bytesReceived: 0,
                bytesStoredInDb: 0,
                byEndpoint: {},
                byMimeType: {},
                recent: []
            },
            ocr: {
                runs: 0,
                successfulRuns: 0,
                failedRuns: 0,
                pagesProcessed: 0,
                scannedPagesDetected: 0,
                failedPages: 0,
                totalConfidence: 0,
                confidenceSamples: 0,
                totalExtractionTimeMs: 0,
                recent: []
            },
            cleanup: {
                runs: 0,
                filesDeleted: 0,
                directoriesDeleted: 0,
                orphanExportFilesDeleted: 0,
                staleExportRefsCleared: 0,
                recent: []
            },
            profileMatching: {
                searches: 0,
                batchesStarted: 0,
                batchesRetried: 0,
                batchesFailed: 0,
                profilesRequested: 0,
                profilesScored: 0,
                byProvider: {},
                recent: []
            }
        };
        
        // Persistence intervals
        this.saveInterval = null;
        this.historyInterval = null;
        
        // Load persisted metrics on startup
        this.loadMetrics();
        
        // Start periodic saving
        this.startPeriodicSave();
    }
    
    // Load metrics from file on startup
    loadMetrics() {
        try {
            if (fs.existsSync(METRICS_FILE)) {
                const data = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
                
                // Restore cumulative metrics (not response times or recent errors)
                if (data.requests) {
                    this.requests.total = data.requests.total || 0;
                    this.requests.byMethod = data.requests.byMethod || {};
                    this.requests.byEndpoint = data.requests.byEndpoint || {};
                    this.requests.byStatus = data.requests.byStatus || {};
                }
                if (data.errors) {
                    this.errors.total = data.errors.total || 0;
                    this.errors.byType = data.errors.byType || {};
                    this.errors.byEndpoint = data.errors.byEndpoint || {};
                }
                if (data.cache) {
                    this.cache.hits = data.cache.hits || 0;
                    this.cache.misses = data.cache.misses || 0;
                }
                if (data.llm) {
                    this.llm.requests = data.llm.requests || 0;
                    const loadedProviders = data.llm.byProvider || {};
                    this.llm.byProvider = Object.fromEntries(
                        Object.entries(loadedProviders).map(([provider, stats]) => [
                            this.normalizeLLMProviderKey(provider),
                            {
                                requests: stats?.requests || 0,
                                totalTokens: stats?.totalTokens || 0,
                                inputTokens: stats?.inputTokens || 0,
                                outputTokens: stats?.outputTokens || 0
                            }
                        ])
                    );
                    this.pruneLLMProviderStats();
                    this.llm.totalTokens = data.llm.totalTokens || 0;
                    this.llm.errors = data.llm.errors || 0;
                }
                if (data.operations) {
                    this.operations.uploads = {
                        ...this.operations.uploads,
                        ...(data.operations.uploads || {}),
                        recent: []
                    };
                    this.operations.ocr = {
                        ...this.operations.ocr,
                        ...(data.operations.ocr || {}),
                        recent: []
                    };
                    this.operations.cleanup = {
                        ...this.operations.cleanup,
                        ...(data.operations.cleanup || {}),
                        recent: []
                    };
                    this.operations.profileMatching = {
                        ...this.operations.profileMatching,
                        ...(data.operations.profileMatching || {}),
                        recent: []
                    };
                }
                
                log.debug('Metrics loaded from file');
            }
        } catch (err) {
            log.error('Failed to load metrics', { error: err.message });
        }
    }
    
    // Save metrics to file
    saveMetrics() {
        try {
            const data = {
                savedAt: new Date().toISOString(),
                startTime: this.startTime,
                requests: {
                    total: this.requests.total,
                    byMethod: this.requests.byMethod,
                    byEndpoint: this.requests.byEndpoint,
                    byStatus: this.requests.byStatus
                },
                errors: {
                    total: this.errors.total,
                    byType: this.errors.byType,
                    byEndpoint: this.errors.byEndpoint
                },
                cache: this.cache,
                llm: {
                    requests: this.llm.requests,
                    byProvider: this.llm.byProvider,
                    totalTokens: this.llm.totalTokens,
                    errors: this.llm.errors
                },
                operations: {
                    uploads: {
                        total: this.operations.uploads.total,
                        successful: this.operations.uploads.successful,
                        failed: this.operations.uploads.failed,
                        bytesReceived: this.operations.uploads.bytesReceived,
                        bytesStoredInDb: this.operations.uploads.bytesStoredInDb,
                        byEndpoint: this.operations.uploads.byEndpoint,
                        byMimeType: this.operations.uploads.byMimeType
                    },
                    ocr: {
                        runs: this.operations.ocr.runs,
                        successfulRuns: this.operations.ocr.successfulRuns,
                        failedRuns: this.operations.ocr.failedRuns,
                        pagesProcessed: this.operations.ocr.pagesProcessed,
                        scannedPagesDetected: this.operations.ocr.scannedPagesDetected,
                        failedPages: this.operations.ocr.failedPages,
                        totalConfidence: this.operations.ocr.totalConfidence,
                        confidenceSamples: this.operations.ocr.confidenceSamples,
                        totalExtractionTimeMs: this.operations.ocr.totalExtractionTimeMs
                    },
                    cleanup: {
                        runs: this.operations.cleanup.runs,
                        filesDeleted: this.operations.cleanup.filesDeleted,
                        directoriesDeleted: this.operations.cleanup.directoriesDeleted,
                        orphanExportFilesDeleted: this.operations.cleanup.orphanExportFilesDeleted,
                        staleExportRefsCleared: this.operations.cleanup.staleExportRefsCleared
                    },
                    profileMatching: {
                        searches: this.operations.profileMatching.searches,
                        batchesStarted: this.operations.profileMatching.batchesStarted,
                        batchesRetried: this.operations.profileMatching.batchesRetried,
                        batchesFailed: this.operations.profileMatching.batchesFailed,
                        profilesRequested: this.operations.profileMatching.profilesRequested,
                        profilesScored: this.operations.profileMatching.profilesScored,
                        byProvider: this.operations.profileMatching.byProvider
                    }
                }
            };
            
            fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            log.error('Failed to save metrics', { error: err.message });
        }
    }
    
    // Append snapshot to history file (for long-term analysis)
    appendToHistory() {
        try {
            const snapshot = {
                timestamp: new Date().toISOString(),
                uptime: this.getUptime().seconds,
                requests: this.requests.total,
                errors: this.errors.total,
                cacheHitRate: this.getCacheHitRate(),
                llmRequests: this.llm.requests,
                llmTokens: this.llm.totalTokens,
                llmCost: this.calculateLLMCost(),
                avgResponseTime: this.getAverageResponseTime(),
                memoryUsed: process.memoryUsage().heapUsed
            };
            
            fs.appendFileSync(METRICS_HISTORY_FILE, JSON.stringify(snapshot) + '\n', 'utf8');
        } catch (err) {
            log.error('Failed to append metrics history', { error: err.message });
        }
    }
    
    // Start periodic save intervals
    startPeriodicSave() {
        // Save current metrics every 5 minutes
        this.saveInterval = setInterval(() => {
            this.saveMetrics();
        }, SAVE_INTERVAL_MS);
        
        // Append to history every hour
        this.historyInterval = setInterval(() => {
            this.appendToHistory();
        }, HISTORY_INTERVAL_MS);
        
        log.info('Metrics persistence started');
    }
    
    // Stop periodic saves (for graceful shutdown)
    stopPeriodicSave() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        if (this.historyInterval) {
            clearInterval(this.historyInterval);
            this.historyInterval = null;
        }
        
        // Final save before shutdown
        this.saveMetrics();
        this.appendToHistory();
        
        log.info('Metrics persistence stopped');
    }

    // Track incoming request
    trackRequest(method, endpoint) {
        this.requests.total++;
        this.requests.byMethod[method] = (this.requests.byMethod[method] || 0) + 1;
        
        // Normalize endpoint (remove various ID formats to prevent unbounded growth)
        const normalizedEndpoint = this.normalizeEndpoint(endpoint);
        this.requests.byEndpoint[normalizedEndpoint] = (this.requests.byEndpoint[normalizedEndpoint] || 0) + 1;
        
        // Limit byEndpoint size to prevent memory leak (keep top 200 endpoints)
        if (Object.keys(this.requests.byEndpoint).length > 200) {
            this.pruneEndpointStats();
        }
    }
    
    // Normalize endpoint path to prevent unbounded growth
    normalizeEndpoint(endpoint) {
        return endpoint
            // Remove UUIDs (8-4-4-4-12 format)
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            // Remove numeric IDs
            .replace(/\/\d+/g, '/:id')
            // Remove any remaining long alphanumeric strings (likely IDs)
            .replace(/\/[a-zA-Z0-9]{20,}/g, '/:id');
    }
    
    // Prune endpoint stats to keep only top endpoints by count
    pruneEndpointStats() {
        const entries = Object.entries(this.requests.byEndpoint);
        entries.sort((a, b) => b[1] - a[1]); // Sort by count descending
        const top100 = entries.slice(0, 100);
        this.requests.byEndpoint = Object.fromEntries(top100);
        
        // Also prune error endpoints
        const errorEntries = Object.entries(this.errors.byEndpoint);
        errorEntries.sort((a, b) => b[1] - a[1]);
        this.errors.byEndpoint = Object.fromEntries(errorEntries.slice(0, 100));
    }

    // Track response
    trackResponse(statusCode, responseTime) {
        const statusCategory = `${Math.floor(statusCode / 100)}xx`;
        this.requests.byStatus[statusCategory] = (this.requests.byStatus[statusCategory] || 0) + 1;
        
        // Keep last 500 response times for percentile calculations (reduced for memory)
        this.requests.responseTimes.push(responseTime);
        if (this.requests.responseTimes.length > 500) {
            // Remove oldest entries to prevent unbounded growth
            this.requests.responseTimes.splice(0, this.requests.responseTimes.length - 500);
        }
    }

    // Track error
    trackError(error, endpoint) {
        this.errors.total++;
        
        const errorType = error.name || 'UnknownError';
        this.errors.byType[errorType] = (this.errors.byType[errorType] || 0) + 1;
        
        const normalizedEndpoint = this.normalizeEndpoint(endpoint);
        this.errors.byEndpoint[normalizedEndpoint] = (this.errors.byEndpoint[normalizedEndpoint] || 0) + 1;
        
        // Keep last 50 errors (reduced for memory)
        this.errors.recent.push({
            timestamp: new Date().toISOString(),
            type: errorType,
            message: error.message,
            endpoint: normalizedEndpoint
        });
        if (this.errors.recent.length > 50) {
            this.errors.recent.shift();
        }
    }

    // Track cache hit/miss
    trackCacheHit() {
        this.cache.hits++;
    }

    trackCacheMiss() {
        this.cache.misses++;
    }

    normalizeLLMProviderKey(provider) {
        const [rawProvider = 'unknown', ...rawModelParts] = String(provider || 'unknown').split(':');
        return buildLLMMetricLabel(rawProvider, rawModelParts.join(':'));
    }

    pruneLLMProviderStats() {
        const entries = Object.entries(this.llm.byProvider);
        if (entries.length <= MAX_LLM_PROVIDER_KEYS) {
            return;
        }

        const fallbackStats = this.llm.byProvider[LLM_PROVIDER_FALLBACK_KEY] || {
            requests: 0,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0
        };

        const sortedEntries = entries
            .filter(([key]) => key !== LLM_PROVIDER_FALLBACK_KEY)
            .sort(([, a], [, b]) => b.requests - a.requests);

        const keptEntries = sortedEntries.slice(0, MAX_LLM_PROVIDER_KEYS - 1);
        const prunedEntries = sortedEntries.slice(MAX_LLM_PROVIDER_KEYS - 1);

        const mergedFallback = prunedEntries.reduce((acc, [, stats]) => ({
            requests: acc.requests + (stats.requests || 0),
            totalTokens: acc.totalTokens + (stats.totalTokens || 0),
            inputTokens: acc.inputTokens + (stats.inputTokens || 0),
            outputTokens: acc.outputTokens + (stats.outputTokens || 0)
        }), { ...fallbackStats });

        this.llm.byProvider = Object.fromEntries([
            ...keptEntries,
            [LLM_PROVIDER_FALLBACK_KEY, mergedFallback]
        ]);
    }

    getTrackedLLMProviderKey(provider) {
        const normalizedKey = this.normalizeLLMProviderKey(provider);
        if (this.llm.byProvider[normalizedKey]) {
            return normalizedKey;
        }

        const hasFallbackBucket = Boolean(this.llm.byProvider[LLM_PROVIDER_FALLBACK_KEY]);
        const maxDistinctKeys = hasFallbackBucket ? MAX_LLM_PROVIDER_KEYS : MAX_LLM_PROVIDER_KEYS - 1;

        if (Object.keys(this.llm.byProvider).length < maxDistinctKeys) {
            return normalizedKey;
        }

        return LLM_PROVIDER_FALLBACK_KEY;
    }

    // Track LLM request with token breakdown
    trackLLMRequest(provider, tokens = 0, success = true, inputTokens = 0, outputTokens = 0) {
        this.llm.requests++;

        const providerKey = this.getTrackedLLMProviderKey(provider);
        if (!this.llm.byProvider[providerKey]) {
            this.llm.byProvider[providerKey] = {
                requests: 0,
                totalTokens: 0,
                inputTokens: 0,
                outputTokens: 0
            };
        }

        this.llm.byProvider[providerKey].requests++;
        this.llm.byProvider[providerKey].totalTokens += tokens;
        this.llm.byProvider[providerKey].inputTokens += inputTokens;
        this.llm.byProvider[providerKey].outputTokens += outputTokens;
        
        this.llm.totalTokens += tokens;
        
        if (!success) {
            this.llm.errors++;
        }
    }

    trackUploadActivity({
        endpoint = 'upload',
        fileSize = 0,
        mimeType = 'unknown',
        success = true,
        storedInDb = false,
        metadata = {}
    } = {}) {
        this.operations.uploads.total++;
        this.operations.uploads.bytesReceived += Number(fileSize) || 0;

        if (success) {
            this.operations.uploads.successful++;
        } else {
            this.operations.uploads.failed++;
        }

        if (storedInDb) {
            this.operations.uploads.bytesStoredInDb += Number(fileSize) || 0;
        }

        this.operations.uploads.byEndpoint[endpoint] = (this.operations.uploads.byEndpoint[endpoint] || 0) + 1;
        this.operations.uploads.byMimeType[mimeType] = (this.operations.uploads.byMimeType[mimeType] || 0) + 1;

        this.operations.uploads.recent.push({
            timestamp: new Date().toISOString(),
            endpoint,
            fileSize: Number(fileSize) || 0,
            mimeType,
            success,
            storedInDb,
            ...metadata
        });
        if (this.operations.uploads.recent.length > 50) {
            this.operations.uploads.recent.shift();
        }
    }

    trackOcrActivity({
        pages = 0,
        ocrPageCount = 0,
        failedPages = 0,
        avgConfidence = null,
        extractionTimeMs = 0,
        success = true,
        metadata = {}
    } = {}) {
        this.operations.ocr.runs++;
        if (success) {
            this.operations.ocr.successfulRuns++;
        } else {
            this.operations.ocr.failedRuns++;
        }

        this.operations.ocr.pagesProcessed += Number(pages) || 0;
        this.operations.ocr.scannedPagesDetected += Number(ocrPageCount) || 0;
        this.operations.ocr.failedPages += Number(failedPages) || 0;
        this.operations.ocr.totalExtractionTimeMs += Number(extractionTimeMs) || 0;

        if (avgConfidence !== null && avgConfidence !== undefined && !Number.isNaN(Number(avgConfidence))) {
            this.operations.ocr.totalConfidence += Number(avgConfidence);
            this.operations.ocr.confidenceSamples++;
        }

        this.operations.ocr.recent.push({
            timestamp: new Date().toISOString(),
            pages: Number(pages) || 0,
            ocrPageCount: Number(ocrPageCount) || 0,
            failedPages: Number(failedPages) || 0,
            avgConfidence: avgConfidence === null || avgConfidence === undefined ? null : Number(avgConfidence),
            extractionTimeMs: Number(extractionTimeMs) || 0,
            success,
            ...metadata
        });
        if (this.operations.ocr.recent.length > 50) {
            this.operations.ocr.recent.shift();
        }
    }

    trackCleanupActivity({
        filesDeleted = 0,
        directoriesDeleted = 0,
        orphanExportFilesDeleted = 0,
        staleExportRefsCleared = 0,
        metadata = {}
    } = {}) {
        this.operations.cleanup.runs++;
        this.operations.cleanup.filesDeleted += Number(filesDeleted) || 0;
        this.operations.cleanup.directoriesDeleted += Number(directoriesDeleted) || 0;
        this.operations.cleanup.orphanExportFilesDeleted += Number(orphanExportFilesDeleted) || 0;
        this.operations.cleanup.staleExportRefsCleared += Number(staleExportRefsCleared) || 0;

        this.operations.cleanup.recent.push({
            timestamp: new Date().toISOString(),
            filesDeleted: Number(filesDeleted) || 0,
            directoriesDeleted: Number(directoriesDeleted) || 0,
            orphanExportFilesDeleted: Number(orphanExportFilesDeleted) || 0,
            staleExportRefsCleared: Number(staleExportRefsCleared) || 0,
            ...metadata
        });
        if (this.operations.cleanup.recent.length > 50) {
            this.operations.cleanup.recent.shift();
        }
    }

    trackProfileMatchingActivity({
        provider = 'unknown',
        event = 'search',
        profilesRequested = 0,
        profilesScored = 0,
        batchesStarted = 0,
        batchesRetried = 0,
        batchesFailed = 0,
        metadata = {}
    } = {}) {
        const providerKey = this.normalizeLLMProviderKey(provider);
        if (!this.operations.profileMatching.byProvider[providerKey]) {
            this.operations.profileMatching.byProvider[providerKey] = {
                searches: 0,
                batchesStarted: 0,
                batchesRetried: 0,
                batchesFailed: 0,
                profilesRequested: 0,
                profilesScored: 0
            };
        }

        const bucket = this.operations.profileMatching.byProvider[providerKey];

        if (event === 'search') {
            this.operations.profileMatching.searches++;
            bucket.searches++;
        }

        this.operations.profileMatching.batchesStarted += Number(batchesStarted) || 0;
        this.operations.profileMatching.batchesRetried += Number(batchesRetried) || 0;
        this.operations.profileMatching.batchesFailed += Number(batchesFailed) || 0;
        this.operations.profileMatching.profilesRequested += Number(profilesRequested) || 0;
        this.operations.profileMatching.profilesScored += Number(profilesScored) || 0;

        bucket.batchesStarted += Number(batchesStarted) || 0;
        bucket.batchesRetried += Number(batchesRetried) || 0;
        bucket.batchesFailed += Number(batchesFailed) || 0;
        bucket.profilesRequested += Number(profilesRequested) || 0;
        bucket.profilesScored += Number(profilesScored) || 0;

        this.operations.profileMatching.recent.push({
            timestamp: new Date().toISOString(),
            provider: providerKey,
            event,
            profilesRequested: Number(profilesRequested) || 0,
            profilesScored: Number(profilesScored) || 0,
            batchesStarted: Number(batchesStarted) || 0,
            batchesRetried: Number(batchesRetried) || 0,
            batchesFailed: Number(batchesFailed) || 0,
            ...metadata
        });
        if (this.operations.profileMatching.recent.length > 50) {
            this.operations.profileMatching.recent.shift();
        }
    }

    // Calculate percentiles
    calculatePercentile(percentile) {
        if (this.requests.responseTimes.length === 0) return 0;
        
        const sorted = [...this.requests.responseTimes].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    // Get average response time
    getAverageResponseTime() {
        if (this.requests.responseTimes.length === 0) return 0;
        const sum = this.requests.responseTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.requests.responseTimes.length);
    }

    // Get cache hit rate
    getCacheHitRate() {
        const total = this.cache.hits + this.cache.misses;
        if (total === 0) return 0;
        return Math.round((this.cache.hits / total) * 100);
    }

    // Get error rate
    getErrorRate() {
        if (this.requests.total === 0) return 0;
        return ((this.errors.total / this.requests.total) * 100).toFixed(2);
    }

    // Get uptime
    getUptime() {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        
        return {
            ms: uptimeMs,
            seconds: uptimeSeconds,
            formatted: `${hours}h ${minutes}m ${seconds}s`
        };
    }

    // Get requests in time window
    getRequestsInWindow(windowMs) {
        // This is a simplified version - in production you'd want a time-series database
        // For now, we estimate based on total requests and uptime
        const uptimeMs = Date.now() - this.startTime;
        if (uptimeMs === 0) return 0;
        
        const requestsPerMs = this.requests.total / uptimeMs;
        return Math.round(requestsPerMs * windowMs);
    }

    // Get top endpoints by request count
    getTopEndpoints(limit = 10) {
        return Object.entries(this.requests.byEndpoint)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([endpoint, count]) => ({ endpoint, count }));
    }

    // Get top errors
    getTopErrors(limit = 10) {
        return Object.entries(this.errors.byType)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([type, count]) => ({ type, count }));
    }

    // Calculate LLM cost with accurate per-model pricing
    calculateLLMCost() {
        let totalCost = 0;
        
        for (const [provider, stats] of Object.entries(this.llm.byProvider)) {
            const pricing = this.getModelPricing(provider);
            
            // If we have input/output breakdown, use it
            if (stats.inputTokens > 0 || stats.outputTokens > 0) {
                const inputCost = (stats.inputTokens / 1_000_000) * pricing.input;
                const outputCost = (stats.outputTokens / 1_000_000) * pricing.output;
                totalCost += inputCost + outputCost;
            } else if (stats.totalTokens > 0) {
                // Fallback: estimate 70% input, 30% output when breakdown not available
                const estimatedInput = stats.totalTokens * 0.7;
                const estimatedOutput = stats.totalTokens * 0.3;
                const inputCost = (estimatedInput / 1_000_000) * pricing.input;
                const outputCost = (estimatedOutput / 1_000_000) * pricing.output;
                totalCost += inputCost + outputCost;
            }
        }
        
        return totalCost.toFixed(4);
    }

    // Calculate cost breakdown by provider
    calculateCostByProvider() {
        const costs = {};
        
        for (const [provider, stats] of Object.entries(this.llm.byProvider)) {
            const pricing = this.getModelPricing(provider);
            
            let inputTokens = stats.inputTokens;
            let outputTokens = stats.outputTokens;
            let isEstimated = false;
            
            // If no breakdown available, estimate from total
            if (inputTokens === 0 && outputTokens === 0 && stats.totalTokens > 0) {
                inputTokens = Math.round(stats.totalTokens * 0.7);
                outputTokens = Math.round(stats.totalTokens * 0.3);
                isEstimated = true;
            }
            
            const inputCost = (inputTokens / 1_000_000) * pricing.input;
            const outputCost = (outputTokens / 1_000_000) * pricing.output;
            
            costs[provider] = {
                inputCost: inputCost.toFixed(4),
                outputCost: outputCost.toFixed(4),
                totalCost: (inputCost + outputCost).toFixed(4),
                inputTokens: inputTokens,
                outputTokens: outputTokens,
                isEstimated: isEstimated
            };
        }
        
        return costs;
    }

    // Get pricing for a specific model (prices per 1M tokens)
    // Updated Q1 2026 with latest OpenAI and Anthropic pricing
    getModelPricing(model) {
        const modelLower = model.toLowerCase();
        
        // ============================================
        // OpenAI pricing (Q1 2026)
        // ============================================
        
        // GPT-5.2 models (Feb 2026 - current flagship)
        if (modelLower.includes('gpt-5.2-pro')) {
            return { input: 21.00, output: 168.00 }; // GPT-5.2 Pro (premium tier)
        }
        if (modelLower.includes('gpt-5.2')) {
            return { input: 1.75, output: 14.00 }; // GPT-5.2 (flagship)
        }
        
        // GPT-5 mini/nano models
        if (modelLower.includes('gpt-5-nano') || modelLower.includes('gpt-5.2-nano')) {
            return { input: 0.05, output: 0.40 }; // GPT-5 Nano (smallest)
        }
        if (modelLower.includes('gpt-5-mini') || modelLower.includes('gpt-5.2-mini')) {
            return { input: 0.25, output: 2.00 }; // GPT-5 Mini
        }
        
        // GPT-5.1 models (deprecated but still supported)
        if (modelLower.includes('gpt-5.1')) {
            return { input: 4.00, output: 12.00 }; // GPT-5.1
        }
        
        // GPT-5 base models (deprecated)
        if (modelLower.includes('gpt-5-pro')) {
            return { input: 8.00, output: 24.00 }; // GPT-5 Pro
        }
        if (modelLower.includes('gpt-5-codex')) {
            return { input: 6.00, output: 18.00 }; // GPT-5 Codex
        }
        if (modelLower.includes('gpt-5')) {
            return { input: 3.00, output: 10.00 }; // GPT-5 base (deprecated)
        }
        
        // GPT-4.1 models (deprecated)
        if (modelLower.includes('gpt-4.1-nano')) {
            return { input: 0.10, output: 0.40 }; // GPT-4.1 Nano
        }
        if (modelLower.includes('gpt-4.1-mini')) {
            return { input: 0.40, output: 1.60 }; // GPT-4.1 Mini
        }
        if (modelLower.includes('gpt-4.1')) {
            return { input: 2.00, output: 8.00 }; // GPT-4.1
        }
        
        // GPT-4o models (deprecated)
        if (modelLower.includes('gpt-4o-mini')) {
            return { input: 0.15, output: 0.60 }; // GPT-4o Mini
        }
        if (modelLower.includes('gpt-4o')) {
            return { input: 2.50, output: 10.00 }; // GPT-4o
        }
        
        // GPT-4 models (deprecated)
        if (modelLower.includes('gpt-4-turbo')) {
            return { input: 10.00, output: 30.00 }; // GPT-4 Turbo
        }
        if (modelLower.includes('gpt-4')) {
            return { input: 30.00, output: 60.00 }; // GPT-4
        }
        
        // GPT-3.5 (deprecated)
        if (modelLower.includes('gpt-3.5-turbo')) {
            return { input: 0.50, output: 1.50 }; // GPT-3.5 Turbo
        }
        
        // o1/o3 reasoning models
        if (modelLower.includes('o3-pro')) {
            return { input: 20.00, output: 80.00 }; // o3-pro
        }
        if (modelLower.includes('o3-mini')) {
            return { input: 1.10, output: 4.40 }; // o3-mini
        }
        if (modelLower.includes('o3')) {
            return { input: 10.00, output: 40.00 }; // o3
        }
        if (modelLower.includes('o1-pro')) {
            return { input: 150.00, output: 600.00 }; // o1-pro
        }
        if (modelLower.includes('o1-preview')) {
            return { input: 15.00, output: 60.00 }; // o1-preview
        }
        if (modelLower.includes('o1-mini')) {
            return { input: 3.00, output: 12.00 }; // o1-mini
        }
        if (modelLower.includes('o1')) {
            return { input: 15.00, output: 60.00 }; // o1
        }
        
        // ============================================
        // Anthropic pricing (Q1 2026)
        // ============================================
        
        // Claude 4.6 models (current generation)
        if (modelLower.includes('claude-opus-4.6') || modelLower.includes('claude-4-opus')) {
            return { input: 5.00, output: 25.00 }; // Claude Opus 4.6
        }
        if (modelLower.includes('claude-sonnet-4.6') || modelLower.includes('claude-4-sonnet')) {
            return { input: 3.00, output: 15.00 }; // Claude Sonnet 4.6
        }
        if (modelLower.includes('claude-haiku-4.5') || modelLower.includes('claude-4-haiku')) {
            return { input: 1.00, output: 5.00 }; // Claude Haiku 4.5
        }
        
        // Claude 3.x models (deprecated but still supported)
        if (modelLower.includes('claude-3-opus') || modelLower.includes('claude-opus-4.1')) {
            return { input: 15.00, output: 75.00 }; // Claude 3 Opus / Opus 4.1 (deprecated)
        }
        if (modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-3.5-sonnet')) {
            return { input: 3.00, output: 15.00 }; // Claude 3.5 Sonnet
        }
        if (modelLower.includes('claude-3-sonnet')) {
            return { input: 3.00, output: 15.00 }; // Claude 3 Sonnet
        }
        if (modelLower.includes('claude-3-haiku')) {
            return { input: 0.25, output: 1.25 }; // Claude 3 Haiku (deprecated)
        }
        
        // Generic Claude fallback (use Sonnet pricing)
        if (modelLower.includes('claude')) {
            return { input: 3.00, output: 15.00 }; // Default Claude pricing
        }
        
        // Default fallback (conservative estimate based on GPT-5.2)
        return { input: 1.75, output: 14.00 };
    }

    // Get comprehensive metrics
    getMetrics() {
        const uptime = this.getUptime();
        
        return {
            server: {
                uptime: uptime.formatted,
                uptimeSeconds: uptime.seconds,
                startTime: new Date(this.startTime).toISOString()
            },
            requests: {
                total: this.requests.total,
                last24h: this.getRequestsInWindow(24 * 60 * 60 * 1000),
                lastHour: this.getRequestsInWindow(60 * 60 * 1000),
                byMethod: this.requests.byMethod,
                byStatus: this.requests.byStatus,
                topEndpoints: this.getTopEndpoints(10)
            },
            performance: {
                avgResponseTime: this.getAverageResponseTime(),
                minResponseTime: this.requests.responseTimes.length > 0 ? Math.min(...this.requests.responseTimes) : 0,
                maxResponseTime: this.requests.responseTimes.length > 0 ? Math.max(...this.requests.responseTimes) : 0,
                p50: this.calculatePercentile(50),
                p95: this.calculatePercentile(95),
                p99: this.calculatePercentile(99)
            },
            cache: {
                hits: this.cache.hits,
                misses: this.cache.misses,
                hitRate: this.getCacheHitRate() / 100,
                total: this.cache.hits + this.cache.misses
            },
            errors: {
                total: this.errors.total,
                rate: parseFloat(this.getErrorRate()) / 100,
                byType: this.errors.byType,
                topErrors: this.getTopErrors(5),
                recent: this.errors.recent.slice(-10)
            },
            llm: {
                requests: this.llm.requests,
                byProvider: this.llm.byProvider,
                totalTokens: this.llm.totalTokens,
                errors: this.llm.errors,
                estimatedCost: this.calculateLLMCost(),
                costByProvider: this.calculateCostByProvider(),
                successRate: this.llm.requests > 0 
                    ? `${(((this.llm.requests - this.llm.errors) / this.llm.requests) * 100).toFixed(2)}%`
                    : '0%'
            },
            operations: {
                uploads: {
                    total: this.operations.uploads.total,
                    successful: this.operations.uploads.successful,
                    failed: this.operations.uploads.failed,
                    bytesReceived: this.operations.uploads.bytesReceived,
                    bytesStoredInDb: this.operations.uploads.bytesStoredInDb
                },
                ocr: {
                    runs: this.operations.ocr.runs,
                    successfulRuns: this.operations.ocr.successfulRuns,
                    failedRuns: this.operations.ocr.failedRuns,
                    pagesProcessed: this.operations.ocr.pagesProcessed,
                    scannedPagesDetected: this.operations.ocr.scannedPagesDetected,
                    failedPages: this.operations.ocr.failedPages
                },
                cleanup: {
                    runs: this.operations.cleanup.runs,
                    filesDeleted: this.operations.cleanup.filesDeleted,
                    directoriesDeleted: this.operations.cleanup.directoriesDeleted,
                    orphanExportFilesDeleted: this.operations.cleanup.orphanExportFilesDeleted,
                    staleExportRefsCleared: this.operations.cleanup.staleExportRefsCleared
                },
                profileMatching: {
                    searches: this.operations.profileMatching.searches,
                    batchesStarted: this.operations.profileMatching.batchesStarted,
                    batchesRetried: this.operations.profileMatching.batchesRetried,
                    batchesFailed: this.operations.profileMatching.batchesFailed,
                    profilesRequested: this.operations.profileMatching.profilesRequested,
                    profilesScored: this.operations.profileMatching.profilesScored,
                    byProvider: this.operations.profileMatching.byProvider,
                    recent: this.operations.profileMatching.recent.slice(-10)
                }
            },
            memory: {
                heapUsed: process.memoryUsage().heapUsed,
                heapTotal: process.memoryUsage().heapTotal,
                rss: process.memoryUsage().rss,
                external: process.memoryUsage().external
            }
        };
    }

    // Reset metrics (for testing or periodic reset)
    reset() {
        this.startTime = Date.now();
        this.requests = {
            total: 0,
            byMethod: {},
            byEndpoint: {},
            byStatus: {},
            responseTimes: []
        };
        this.errors = {
            total: 0,
            byType: {},
            byEndpoint: {},
            recent: []
        };
        this.cache = {
            hits: 0,
            misses: 0
        };
        this.llm = {
            requests: 0,
            byProvider: {},
            totalTokens: 0,
            errors: 0
        };
        this.operations = {
            uploads: {
                total: 0,
                successful: 0,
                failed: 0,
                bytesReceived: 0,
                bytesStoredInDb: 0,
                byEndpoint: {},
                byMimeType: {},
                recent: []
            },
            ocr: {
                runs: 0,
                successfulRuns: 0,
                failedRuns: 0,
                pagesProcessed: 0,
                scannedPagesDetected: 0,
                failedPages: 0,
                totalConfidence: 0,
                confidenceSamples: 0,
                totalExtractionTimeMs: 0,
                recent: []
            },
            cleanup: {
                runs: 0,
                filesDeleted: 0,
                directoriesDeleted: 0,
                orphanExportFilesDeleted: 0,
                staleExportRefsCleared: 0,
                recent: []
            },
            profileMatching: {
                searches: 0,
                batchesStarted: 0,
                batchesRetried: 0,
                batchesFailed: 0,
                profilesRequested: 0,
                profilesScored: 0,
                byProvider: {},
                recent: []
            }
        };
        
        // Save reset state
        this.saveMetrics();
    }
    
    // Get metrics history (last N entries)
    getHistory(limit = 24) {
        try {
            if (!fs.existsSync(METRICS_HISTORY_FILE)) {
                return [];
            }
            
            const content = fs.readFileSync(METRICS_HISTORY_FILE, 'utf8');
            const lines = content.trim().split('\n').filter(Boolean);
            const entries = lines.slice(-limit).map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(Boolean);
            
            return entries;
        } catch (err) {
            log.error('Failed to read metrics history', { error: err.message });
            return [];
        }
    }
}

// Create singleton instance
export const metrics = new MetricsCollector();

export default metrics;





