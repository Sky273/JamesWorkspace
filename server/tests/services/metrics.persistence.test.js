import fs from 'node:fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const log = {
    error: vi.fn(),
    debug: vi.fn()
};

function createCollector(requestTotal) {
    return {
        startTime: Date.now(),
        requests: { total: requestTotal, byMethod: {}, byEndpoint: {}, byStatus: {}, responseTimes: [] },
        errors: { total: 0, byType: {}, byEndpoint: {}, recent: [] },
        cache: { hits: 0, misses: 0 },
        llm: { requests: 0, byProvider: {}, totalTokens: 0, errors: 0 },
        operations: {
            uploads: { recent: [] },
            ocr: { recent: [] },
            cleanup: { recent: [] },
            batchImports: { recent: [], byMimeType: {}, stageFailures: {} },
            aiModify: { recent: [], byProvider: {} },
            improvement: { recent: [], byProvider: {} },
            adaptation: { recent: [], byProvider: {} },
            profileMatching: { recent: [] }
        },
        getUptime: () => ({ seconds: 1 }),
        getCacheHitRate: () => 0,
        calculateLLMCost: () => 0,
        getAverageResponseTime: () => 0
    };
}

describe('metrics persistence', () => {
    let tempDir;
    let historyFile;
    let maxHistoryEntries;
    let historyCompactionInterval;
    let appendMetricsHistory;
    let loadMetricsFromDisk;
    let readMetricsHistory;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-persistence-test-'));
        historyFile = path.join(tempDir, 'metrics-history.jsonl');
        process.env.METRICS_DIR = tempDir;
        process.env.METRICS_FILE = path.join(tempDir, 'metrics.json');
        process.env.METRICS_HISTORY_FILE = historyFile;
        process.env.METRICS_MAX_HISTORY_ENTRIES = '12';
        process.env.METRICS_HISTORY_COMPACTION_INTERVAL = '4';
    });

    afterEach(() => {
        delete process.env.METRICS_DIR;
        delete process.env.METRICS_FILE;
        delete process.env.METRICS_HISTORY_FILE;
        delete process.env.METRICS_MAX_HISTORY_ENTRIES;
        delete process.env.METRICS_HISTORY_COMPACTION_INTERVAL;
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should prune metrics history to the configured maximum size', async () => {
        ({
            MAX_HISTORY_ENTRIES: maxHistoryEntries,
            HISTORY_COMPACTION_INTERVAL: historyCompactionInterval,
            appendMetricsHistory,
            loadMetricsFromDisk,
            readMetricsHistory
        } = await import('../../services/metrics/persistence.js'));

        for (let index = 0; index < maxHistoryEntries + 25; index += 1) {
            await appendMetricsHistory(createCollector(index + 1), log);
        }

        const history = readMetricsHistory(maxHistoryEntries + 100, log);
        expect(history).toHaveLength(maxHistoryEntries);
        expect(history.at(0)?.requests).toBe(26);
        expect(history.at(-1)?.requests).toBe(maxHistoryEntries + 25);
        expect(fs.existsSync(historyFile)).toBe(true);
    }, 15000);

    it('should defer history compaction instead of rewriting on every overflow append', async () => {
        ({
            MAX_HISTORY_ENTRIES: maxHistoryEntries,
            HISTORY_COMPACTION_INTERVAL: historyCompactionInterval,
            appendMetricsHistory,
            loadMetricsFromDisk,
            readMetricsHistory
        } = await import('../../services/metrics/persistence.js'));

        const totalEntries = maxHistoryEntries + historyCompactionInterval - 1;
        for (let index = 0; index < totalEntries; index += 1) {
            await appendMetricsHistory(createCollector(index + 1), log);
        }

        const rawLines = fs.readFileSync(historyFile, 'utf8').trim().split('\n').filter(Boolean);
        const history = readMetricsHistory(maxHistoryEntries + 10, log);

        expect(rawLines).toHaveLength(totalEntries);
        expect(history).toHaveLength(maxHistoryEntries);
        expect(history.at(0)?.requests).toBe(totalEntries - maxHistoryEntries + 1);
        expect(history.at(-1)?.requests).toBe(totalEntries);
    }, 15000);

    it('should preload existing metrics and history without sync fs reads', async () => {
        const persistedMetrics = {
            requests: {
                total: 7,
                byMethod: { GET: 3 },
                byEndpoint: { '/api/users': 2 },
                byStatus: { 200: 5 }
            },
            errors: {
                total: 1,
                byType: { Error: 1 },
                byEndpoint: { '/api/users': 1 }
            },
            cache: {
                hits: 2,
                misses: 1
            },
            llm: {
                requests: 4,
                byProvider: {
                    openai: {
                        requests: 4,
                        totalTokens: 40,
                        inputTokens: 10,
                        outputTokens: 30
                    }
                },
                totalTokens: 40,
                errors: 1
            },
            operations: {
                uploads: {
                    total: 1,
                    successful: 1,
                    failed: 0,
                    bytesReceived: 10,
                    bytesStoredInDb: 5,
                    byEndpoint: { '/upload': 1 },
                    byMimeType: { 'application/pdf': 1 }
                },
                ocr: {},
                cleanup: {},
                batchImports: {},
                batchExports: {
                    byFormat: { pdf: 1 },
                    bySource: { http: 1 }
                },
                aiModify: {},
                improvement: {},
                adaptation: {},
                profileMatching: {}
            }
        };
        const persistedHistory = [
            { requests: 11, errors: 2 },
            { requests: 12, errors: 3 }
        ];

        fs.writeFileSync(process.env.METRICS_FILE, JSON.stringify(persistedMetrics, null, 2));
        fs.writeFileSync(historyFile, `${persistedHistory.map((entry) => JSON.stringify(entry)).join('\n')}\n`);

        const existsSyncSpy = vi.spyOn(fs, 'existsSync');
        const readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
        const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync');

        ({
            appendMetricsHistory,
            loadMetricsFromDisk,
            readMetricsHistory
        } = await import('../../services/metrics/persistence.js'));

        const collector = createCollector(0);
        loadMetricsFromDisk(collector, {
            log,
            normalizeLLMProviderKey: (provider) => provider,
            pruneLLMProviderStats: (stats) => stats
        });

        expect(collector.requests.total).toBe(7);
        expect(collector.llm.byProvider.openai.totalTokens).toBe(40);
        expect(collector.operations.batchExports.byFormat.pdf).toBe(1);

        const history = readMetricsHistory(10, log);
        expect(history).toHaveLength(2);
        expect(history[0].requests).toBe(11);
        expect(history[1].errors).toBe(3);

        await appendMetricsHistory(createCollector(13), log);
        const updatedHistory = await fs.promises.readFile(historyFile, 'utf8');
        expect(updatedHistory).toContain('"requests":13');

        expect(existsSyncSpy).not.toHaveBeenCalled();
        expect(readFileSyncSpy).not.toHaveBeenCalled();
        expect(mkdirSyncSpy).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    }, 15000);
});
