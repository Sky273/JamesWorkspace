import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildHistorySnapshot, buildPersistedMetricsData } from './snapshot.js';
import { createOperationsState } from './state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const METRICS_DIR = path.join(__dirname, '../../../logs');
export const METRICS_FILE = path.join(METRICS_DIR, 'metrics.json');
export const METRICS_HISTORY_FILE = path.join(METRICS_DIR, 'metrics-history.jsonl');
export const SAVE_INTERVAL_MS = 5 * 60 * 1000;
export const HISTORY_INTERVAL_MS = 60 * 60 * 1000;
export const MAX_HISTORY_ENTRIES = 24 * 30;

export function ensureMetricsDirectory(log) {
    try {
        if (!fs.existsSync(METRICS_DIR)) {
            fs.mkdirSync(METRICS_DIR, { recursive: true });
        }
    } catch (err) {
        log.error('Failed to create metrics directory', { error: err.message });
    }
}

export function loadMetricsFromDisk(collector, { log, normalizeLLMProviderKey, pruneLLMProviderStats }) {
    try {
        if (!fs.existsSync(METRICS_FILE)) {
            return;
        }

        const data = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));

        if (data.requests) {
            collector.requests.total = data.requests.total || 0;
            collector.requests.byMethod = data.requests.byMethod || {};
            collector.requests.byEndpoint = data.requests.byEndpoint || {};
            collector.requests.byStatus = data.requests.byStatus || {};
        }
        if (data.errors) {
            collector.errors.total = data.errors.total || 0;
            collector.errors.byType = data.errors.byType || {};
            collector.errors.byEndpoint = data.errors.byEndpoint || {};
        }
        if (data.cache) {
            collector.cache.hits = data.cache.hits || 0;
            collector.cache.misses = data.cache.misses || 0;
        }
        if (data.llm) {
            collector.llm.requests = data.llm.requests || 0;
            const loadedProviders = data.llm.byProvider || {};
            collector.llm.byProvider = Object.fromEntries(
                Object.entries(loadedProviders).map(([provider, stats]) => [
                    normalizeLLMProviderKey(provider),
                    {
                        requests: stats?.requests || 0,
                        totalTokens: stats?.totalTokens || 0,
                        inputTokens: stats?.inputTokens || 0,
                        outputTokens: stats?.outputTokens || 0
                    }
                ])
            );
            collector.llm.byProvider = pruneLLMProviderStats(collector.llm.byProvider);
            collector.llm.totalTokens = data.llm.totalTokens || 0;
            collector.llm.errors = data.llm.errors || 0;
        }
        if (data.operations) {
            const initialOperations = createOperationsState();
            collector.operations.uploads = {
                ...initialOperations.uploads,
                ...(data.operations.uploads || {}),
                recent: []
            };
            collector.operations.ocr = {
                ...initialOperations.ocr,
                ...(data.operations.ocr || {}),
                recent: []
            };
            collector.operations.cleanup = {
                ...initialOperations.cleanup,
                ...(data.operations.cleanup || {}),
                recent: []
            };
            collector.operations.batchImports = {
                ...initialOperations.batchImports,
                ...(data.operations.batchImports || {}),
                byMimeType: data.operations.batchImports?.byMimeType || {},
                stageFailures: data.operations.batchImports?.stageFailures || {},
                recent: []
            };
            collector.operations.aiModify = {
                ...initialOperations.aiModify,
                ...(data.operations.aiModify || {}),
                byProvider: data.operations.aiModify?.byProvider || {},
                recent: []
            };
            collector.operations.improvement = {
                ...initialOperations.improvement,
                ...(data.operations.improvement || {}),
                byProvider: data.operations.improvement?.byProvider || {},
                recent: []
            };
            collector.operations.adaptation = {
                ...initialOperations.adaptation,
                ...(data.operations.adaptation || {}),
                byProvider: data.operations.adaptation?.byProvider || {},
                recent: []
            };
            collector.operations.profileMatching = {
                ...initialOperations.profileMatching,
                ...(data.operations.profileMatching || {}),
                recent: []
            };
        }

        log.debug('Metrics loaded from file');
    } catch (err) {
        log.error('Failed to load metrics', { error: err.message });
    }
}

export function saveMetricsToDisk(collector, log) {
    try {
        const data = buildPersistedMetricsData(collector);
        fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        log.error('Failed to save metrics', { error: err.message });
    }
}

export function appendMetricsHistory(collector, log) {
    try {
        ensureMetricsDirectory(log);
        const snapshot = buildHistorySnapshot(collector);
        const nextLine = JSON.stringify(snapshot);
        let lines = [];

        if (fs.existsSync(METRICS_HISTORY_FILE)) {
            lines = fs.readFileSync(METRICS_HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
        }

        lines.push(nextLine);
        if (lines.length > MAX_HISTORY_ENTRIES) {
            lines = lines.slice(-MAX_HISTORY_ENTRIES);
        }

        fs.writeFileSync(METRICS_HISTORY_FILE, `${lines.join('\n')}\n`, 'utf8');
    } catch (err) {
        log.error('Failed to append metrics history', { error: err.message });
    }
}

export function readMetricsHistory(limit, log) {
    try {
        if (!fs.existsSync(METRICS_HISTORY_FILE)) {
            return [];
        }

        const content = fs.readFileSync(METRICS_HISTORY_FILE, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        return lines.slice(-limit).map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(Boolean);
    } catch (err) {
        log.error('Failed to read metrics history', { error: err.message });
        return [];
    }
}
