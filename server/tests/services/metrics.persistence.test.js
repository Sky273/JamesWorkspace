import fs from 'fs';
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
    let readMetricsHistory;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-persistence-test-'));
        historyFile = path.join(tempDir, 'metrics-history.jsonl');
        process.env.METRICS_DIR = tempDir;
        process.env.METRICS_FILE = path.join(tempDir, 'metrics.json');
        process.env.METRICS_HISTORY_FILE = historyFile;
    });

    afterEach(() => {
        delete process.env.METRICS_DIR;
        delete process.env.METRICS_FILE;
        delete process.env.METRICS_HISTORY_FILE;
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should prune metrics history to the configured maximum size', async () => {
        ({
            MAX_HISTORY_ENTRIES: maxHistoryEntries,
            HISTORY_COMPACTION_INTERVAL: historyCompactionInterval,
            appendMetricsHistory,
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
});
