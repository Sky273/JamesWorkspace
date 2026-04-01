import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    METRICS_HISTORY_FILE,
    MAX_HISTORY_ENTRIES,
    appendMetricsHistory,
    readMetricsHistory
} from '../../services/metrics/persistence.js';

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
    beforeEach(() => {
        fs.rmSync(METRICS_HISTORY_FILE, { force: true });
        vi.clearAllMocks();
    });

    afterEach(() => {
        fs.rmSync(METRICS_HISTORY_FILE, { force: true });
    });

    it('should prune metrics history to the configured maximum size', () => {
        for (let index = 0; index < MAX_HISTORY_ENTRIES + 25; index += 1) {
            appendMetricsHistory(createCollector(index + 1), log);
        }

        const history = readMetricsHistory(MAX_HISTORY_ENTRIES + 100, log);
        expect(history).toHaveLength(MAX_HISTORY_ENTRIES);
        expect(history.at(0)?.requests).toBe(26);
        expect(history.at(-1)?.requests).toBe(MAX_HISTORY_ENTRIES + 25);
    });
});
