import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildHistorySnapshot, buildPersistedMetricsData } from './snapshot.js';
import { createOperationsState } from './state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const METRICS_DIR = process.env.METRICS_DIR || path.join(__dirname, '../../../logs');
export const METRICS_FILE = process.env.METRICS_FILE || path.join(METRICS_DIR, 'metrics.json');
export const METRICS_HISTORY_FILE = process.env.METRICS_HISTORY_FILE || path.join(METRICS_DIR, 'metrics-history.jsonl');
export const SAVE_INTERVAL_MS = 5 * 60 * 1000;
export const HISTORY_INTERVAL_MS = 60 * 60 * 1000;
export const MAX_HISTORY_ENTRIES = Number.parseInt(process.env.METRICS_MAX_HISTORY_ENTRIES || '', 10) || 24 * 30;
export const HISTORY_COMPACTION_INTERVAL = Number.parseInt(process.env.METRICS_HISTORY_COMPACTION_INTERVAL || '', 10) || 100;

let historyLinesCache = [];
let historyLinesCacheFile = null;
let historyOverflowCount = 0;
let persistenceQueue = Promise.resolve();
let metricsFileContentsCache = null;
let metricsFileContentsCacheFile = null;

function getFsPromiseMethod(methodName) {
    const candidate = fsPromises?.[methodName] ?? fsPromises?.default?.[methodName];
    return typeof candidate === 'function' ? candidate.bind(fsPromises.default ?? fsPromises) : null;
}

function getHistoryCacheFile() {
    return process.env.METRICS_HISTORY_FILE || METRICS_HISTORY_FILE;
}

function getMetricsCacheFile() {
    return process.env.METRICS_FILE || METRICS_FILE;
}

function resetHistoryCacheIfNeeded() {
    const currentHistoryFile = getHistoryCacheFile();
    if (historyLinesCacheFile !== currentHistoryFile) {
        historyLinesCache = [];
        historyLinesCacheFile = currentHistoryFile;
        historyOverflowCount = 0;
    }
}

function resetMetricsCacheIfNeeded() {
    const currentMetricsFile = getMetricsCacheFile();
    if (metricsFileContentsCacheFile !== currentMetricsFile) {
        metricsFileContentsCache = null;
        metricsFileContentsCacheFile = currentMetricsFile;
    }
}

async function preloadMetricsFile() {
    resetMetricsCacheIfNeeded();
    const currentMetricsFile = getMetricsCacheFile();
    const readFile = getFsPromiseMethod('readFile');
    if (!readFile) {
        metricsFileContentsCache = null;
        return;
    }

    try {
        metricsFileContentsCache = await readFile(currentMetricsFile, 'utf8');
    } catch {
        metricsFileContentsCache = null;
    }
}

async function preloadHistoryCache() {
    resetHistoryCacheIfNeeded();
    const currentHistoryFile = getHistoryCacheFile();
    const readFile = getFsPromiseMethod('readFile');
    if (!readFile) {
        historyLinesCache = [];
        historyOverflowCount = 0;
        return;
    }

    try {
        const rawHistory = await readFile(currentHistoryFile, 'utf8');
        const loadedHistoryLines = rawHistory.split('\n').filter(Boolean);
        if (loadedHistoryLines.length > MAX_HISTORY_ENTRIES) {
            historyOverflowCount = loadedHistoryLines.length - MAX_HISTORY_ENTRIES;
            historyLinesCache = loadedHistoryLines.slice(-MAX_HISTORY_ENTRIES);
        } else {
            historyLinesCache = loadedHistoryLines;
            historyOverflowCount = 0;
        }
    } catch {
        historyLinesCache = [];
        historyOverflowCount = 0;
    }
}

async function preloadMetricsPersistence() {
    const mkdir = getFsPromiseMethod('mkdir');
    const readFile = getFsPromiseMethod('readFile');

    if (!mkdir || !readFile) {
        historyLinesCache = [];
        historyOverflowCount = 0;
        metricsFileContentsCache = null;
        return;
    }

    try {
        await mkdir(METRICS_DIR, { recursive: true });
    } catch {
        // Continue with deferred writes; save/append still retry the mkdir path.
    }

    await Promise.all([
        preloadMetricsFile(),
        preloadHistoryCache()
    ]);
}

await preloadMetricsPersistence();

function loadHistoryLines() {
    resetHistoryCacheIfNeeded();
    return historyLinesCache;
}

export function ensureMetricsDirectory(log) {
    const mkdir = getFsPromiseMethod('mkdir');
    if (!mkdir) {
        return Promise.resolve();
    }

    return mkdir(METRICS_DIR, { recursive: true }).catch((err) => {
        log.error('Failed to create metrics directory', { error: err.message });
    });
}

function queuePersistenceTask(task, log, errorMessage) {
    const nextTask = persistenceQueue.then(task);
    persistenceQueue = nextTask
        .catch((err) => {
            log.error(errorMessage, { error: err.message });
        })
        .then(() => undefined);
    return persistenceQueue;
}

export function loadMetricsFromDisk(collector, { log, normalizeLLMProviderKey, pruneLLMProviderStats }) {
    try {
        resetMetricsCacheIfNeeded();

        if (metricsFileContentsCache === null) {
            return;
        }

        const data = JSON.parse(metricsFileContentsCache);

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
            collector.operations.batchExports = {
                ...initialOperations.batchExports,
                ...(data.operations.batchExports || {}),
                byFormat: data.operations.batchExports?.byFormat || {},
                bySource: data.operations.batchExports?.bySource || {},
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
    return queuePersistenceTask(async () => {
        try {
            await ensureMetricsDirectory(log);
            const writeFile = getFsPromiseMethod('writeFile');
            if (!writeFile) {
                return;
            }
            const data = buildPersistedMetricsData(collector);
            await writeFile(METRICS_FILE, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            log.error('Failed to save metrics', { error: err.message });
        }
    }, log, 'Failed to save metrics');
}

export function appendMetricsHistory(collector, log) {
    return queuePersistenceTask(async () => {
        try {
            await ensureMetricsDirectory(log);
            const appendFile = getFsPromiseMethod('appendFile');
            const writeFile = getFsPromiseMethod('writeFile');
            if (!appendFile || !writeFile) {
                return;
            }
            const snapshot = buildHistorySnapshot(collector);
            const nextLine = JSON.stringify(snapshot);
            const currentHistoryFile = getHistoryCacheFile();
            const lines = loadHistoryLines(log);

            if (lines.length < MAX_HISTORY_ENTRIES) {
                lines.push(nextLine);
                historyLinesCache = lines;
                await appendFile(currentHistoryFile, `${nextLine}\n`, 'utf8');
                return;
            }

            historyLinesCache = [...lines.slice(-(MAX_HISTORY_ENTRIES - 1)), nextLine];
            historyOverflowCount += 1;
            await appendFile(currentHistoryFile, `${nextLine}\n`, 'utf8');

            if (historyOverflowCount < HISTORY_COMPACTION_INTERVAL) {
                return;
            }

            await writeFile(currentHistoryFile, `${historyLinesCache.join('\n')}\n`, 'utf8');
            historyOverflowCount = 0;
        } catch (err) {
            log.error('Failed to append metrics history', { error: err.message });
        }
    }, log, 'Failed to append metrics history');
}

export function readMetricsHistory(limit, log) {
    try {
        const lines = loadHistoryLines();
        if (lines.length === 0) {
            return [];
        }

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
