export function createRequestsState() {
    return {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatus: {},
        responseTimes: []
    };
}

export function createErrorsState() {
    return {
        total: 0,
        byType: {},
        byEndpoint: {},
        recent: []
    };
}

export function createCacheState() {
    return {
        hits: 0,
        misses: 0
    };
}

export function createLlmState() {
    return {
        requests: 0,
        byProvider: {},
        totalTokens: 0,
        errors: 0
    };
}

export function createOperationsState() {
    return {
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
        batchImports: {
            runs: 0,
            successfulRuns: 0,
            failedRuns: 0,
            pendingNameRuns: 0,
            improvementRequestedRuns: 0,
            resumeRecordsCreated: 0,
            textExtractionRuns: 0,
            textExtractionFailures: 0,
            analysisRuns: 0,
            totalInputBytes: 0,
            totalExtractedChars: 0,
            totalDurationMs: 0,
            byMimeType: {},
            stageFailures: {},
            recent: []
        },
        aiModify: {
            runs: 0,
            successfulRuns: 0,
            failedRuns: 0,
            fallbackRuns: 0,
            selectionRuns: 0,
            inputChars: 0,
            outputChars: 0,
            byProvider: {},
            recent: []
        },
        improvement: {
            runs: 0,
            successfulRuns: 0,
            failedRuns: 0,
            fallbackRuns: 0,
            structuredRuns: 0,
            inputChars: 0,
            outputChars: 0,
            byProvider: {},
            recent: []
        },
        adaptation: {
            runs: 0,
            matchRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            fallbackRuns: 0,
            structuredRuns: 0,
            inputChars: 0,
            outputChars: 0,
            byProvider: {},
            recent: []
        },
        profileMatching: {
            searches: 0,
            batchesStarted: 0,
            batchesRetried: 0,
            batchesFailed: 0,
            normalizationEvents: 0,
            profilesRequested: 0,
            profilesScored: 0,
            profilesExplained: 0,
            profilesReturned: 0,
            byProvider: {},
            recent: []
        }
    };
}

export function applyInitialMetricsState(target) {
    target.startTime = Date.now();
    target.requests = createRequestsState();
    target.errors = createErrorsState();
    target.cache = createCacheState();
    target.llm = createLlmState();
    target.operations = createOperationsState();
}
