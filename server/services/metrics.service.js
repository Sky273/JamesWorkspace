// ============================================
// METRICS AND MONITORING SERVICE
// ============================================

import { createModuleLogger } from '../utils/logger.backend.js';
import { buildLLMMetricLabel as buildLLMMetricLabelValue, normalizeLLMProviderKey, pruneLLMProviderStats, getTrackedLLMProviderKey, calculateLLMCost, calculateCostByProvider, getModelPricing } from './metrics/llm.js';
import { applyInitialMetricsState } from './metrics/state.js';
import { ensureMetricsDirectory, loadMetricsFromDisk, saveMetricsToDisk, appendMetricsHistory, readMetricsHistory, SAVE_INTERVAL_MS, HISTORY_INTERVAL_MS } from './metrics/persistence.js';
import { buildPublicMetrics } from './metrics/snapshot.js';
import {
    trackUploadActivity as trackUploadOperation,
    trackOcrActivity as trackOcrOperation,
    trackCleanupActivity as trackCleanupOperation,
    trackBatchImportActivity as trackBatchImportOperation,
    trackBatchExportActivity as trackBatchExportOperation,
    trackProfileMatchingActivity as trackProfileMatchingOperation,
    trackImprovementActivity as trackImprovementOperation,
    trackAiModifyActivity as trackAiModifyOperation,
    trackAdaptationActivity as trackAdaptationOperation
} from './metrics/operations.js';

// Module logger
const log = createModuleLogger('metrics');

export function buildLLMMetricLabel(provider, model = '') {
    return buildLLMMetricLabelValue(provider, model);
}

function getTopEntries(sourceMap, limit, keyName) {
    return Object.entries(sourceMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([key, count]) => ({ [keyName]: key, count }));
}

function formatDuration(ms) {
    const uptimeSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    return {
        seconds: uptimeSeconds,
        formatted: `${hours}h ${minutes}m ${seconds}s`
    };
}

function trackCollectorOperation(collector, operationFn, payload) {
    operationFn(collector.operations, collector.normalizeLLMProviderKey.bind(collector), payload);
}

ensureMetricsDirectory(log);

class MetricsCollector {
    constructor() {
        applyInitialMetricsState(this);
        
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
        loadMetricsFromDisk(this, {
            log,
            normalizeLLMProviderKey: this.normalizeLLMProviderKey.bind(this),
            pruneLLMProviderStats
        });
    }
    
    // Save metrics to file
    saveMetrics() {
        saveMetricsToDisk(this, log);
    }
    
    // Append snapshot to history file (for long-term analysis)
    appendToHistory() {
        appendMetricsHistory(this, log);
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
        return normalizeLLMProviderKey(provider);
    }

    pruneLLMProviderStats() {
        this.llm.byProvider = pruneLLMProviderStats(this.llm.byProvider);
    }

    getTrackedLLMProviderKey(provider) {
        return getTrackedLLMProviderKey(this.llm.byProvider, provider);
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
        trackUploadOperation(this.operations, { endpoint, fileSize, mimeType, success, storedInDb, metadata });
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
        trackOcrOperation(this.operations, { pages, ocrPageCount, failedPages, avgConfidence, extractionTimeMs, success, metadata });
    }

    trackCleanupActivity({
        filesDeleted = 0,
        directoriesDeleted = 0,
        orphanExportFilesDeleted = 0,
        staleExportRefsCleared = 0,
        metadata = {}
    } = {}) {
        trackCleanupOperation(this.operations, { filesDeleted, directoriesDeleted, orphanExportFilesDeleted, staleExportRefsCleared, metadata });
    }

    trackBatchImportActivity({
        event = 'run',
        mimeType = 'unknown',
        fileSize = 0,
        extractedChars = 0,
        durationMs = 0,
        resumeRecordsCreated = 0,
        textExtractionRuns = 0,
        textExtractionFailures = 0,
        analysisRuns = 0,
        successfulRuns = 0,
        failedRuns = 0,
        pendingNameRuns = 0,
        improvementRequestedRuns = 0,
        stage = null,
        metadata = {}
    } = {}) {
        trackBatchImportOperation(this.operations, {
            event,
            mimeType,
            fileSize,
            extractedChars,
            durationMs,
            resumeRecordsCreated,
            textExtractionRuns,
            textExtractionFailures,
            analysisRuns,
            successfulRuns,
            failedRuns,
            pendingNameRuns,
            improvementRequestedRuns,
            stage,
            metadata
        });
    }

    trackBatchExportActivity({
        event = 'run',
        format = 'unknown',
        source = 'unknown',
        requestedResumes = 0,
        resolvedResumes = 0,
        inaccessibleResumes = 0,
        generatedFiles = 0,
        failedFiles = 0,
        durationMs = 0,
        archiveBytes = 0,
        successfulRuns = 0,
        failedRuns = 0,
        truncatedErrors = 0,
        metadata = {}
    } = {}) {
        trackBatchExportOperation(this.operations, {
            event,
            format,
            source,
            requestedResumes,
            resolvedResumes,
            inaccessibleResumes,
            generatedFiles,
            failedFiles,
            durationMs,
            archiveBytes,
            successfulRuns,
            failedRuns,
            truncatedErrors,
            metadata
        });
    }

    trackProfileMatchingActivity({
        provider = 'unknown',
        event = 'search',
        profilesRequested = 0,
        profilesScored = 0,
        profilesExplained = 0,
        profilesReturned = 0,
        batchesStarted = 0,
        batchesRetried = 0,
        batchesFailed = 0,
        normalizationEvents = 0,
        metadata = {}
    } = {}) {
        trackCollectorOperation(this, trackProfileMatchingOperation, {
            provider,
            event,
            profilesRequested,
            profilesScored,
            profilesExplained,
            profilesReturned,
            batchesStarted,
            batchesRetried,
            batchesFailed,
            normalizationEvents,
            metadata
        });
    }

    trackImprovementActivity({
        provider = 'unknown',
        event = 'run',
        successfulRuns = 0,
        failedRuns = 0,
        fallbackRuns = 0,
        postAnalysisFallbackRuns = 0,
        structuredRuns = 0,
        inputChars = 0,
        outputChars = 0,
        metadata = {}
    } = {}) {
        trackCollectorOperation(this, trackImprovementOperation, {
            provider,
            event,
            successfulRuns,
            failedRuns,
            fallbackRuns,
            postAnalysisFallbackRuns,
            structuredRuns,
            inputChars,
            outputChars,
            metadata
        });
    }

    trackAiModifyActivity({
        provider = 'unknown',
        event = 'run',
        successfulRuns = 0,
        failedRuns = 0,
        fallbackRuns = 0,
        selectionRuns = 0,
        inputChars = 0,
        outputChars = 0,
        metadata = {}
    } = {}) {
        trackCollectorOperation(this, trackAiModifyOperation, {
            provider,
            event,
            successfulRuns,
            failedRuns,
            fallbackRuns,
            selectionRuns,
            inputChars,
            outputChars,
            metadata
        });
    }

    trackAdaptationActivity({
        provider = 'unknown',
        event = 'run',
        matchRuns = 0,
        successfulRuns = 0,
        failedRuns = 0,
        fallbackRuns = 0,
        structuredRuns = 0,
        inputChars = 0,
        outputChars = 0,
        metadata = {}
    } = {}) {
        trackCollectorOperation(this, trackAdaptationOperation, {
            provider,
            event,
            matchRuns,
            successfulRuns,
            failedRuns,
            fallbackRuns,
            structuredRuns,
            inputChars,
            outputChars,
            metadata
        });
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
        const { seconds: uptimeSeconds, formatted } = formatDuration(uptimeMs);
        
        return {
            ms: uptimeMs,
            seconds: uptimeSeconds,
            formatted
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
        return getTopEntries(this.requests.byEndpoint, limit, 'endpoint');
    }

    // Get top errors
    getTopErrors(limit = 10) {
        return getTopEntries(this.errors.byType, limit, 'type');
    }

    // Calculate LLM cost with accurate per-model pricing
    calculateLLMCost() {
        return calculateLLMCost(this.llm.byProvider);
    }

    // Calculate cost breakdown by provider
    calculateCostByProvider() {
        return calculateCostByProvider(this.llm.byProvider);
    }

    // Get pricing for a specific model (prices per 1M tokens)
    // Updated Q1 2026 with latest OpenAI and Anthropic pricing
    getModelPricing(model) {
        return getModelPricing(model);
    }

    // Get comprehensive metrics
    getMetrics() {
        return buildPublicMetrics(this);
    }

    // Reset metrics (for testing or periodic reset)
    reset() {
        applyInitialMetricsState(this);
        
        // Save reset state
        this.saveMetrics();
    }
    
    // Get metrics history (last N entries)
    getHistory(limit = 24) {
        return readMetricsHistory(limit, log);
    }
}

// Create singleton instance
export const metrics = new MetricsCollector();
