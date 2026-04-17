export function ensureOperationProviderBucket(operations, operationKey, providerKey, initialState) {
    if (!operations[operationKey].byProvider[providerKey]) {
        operations[operationKey].byProvider[providerKey] = { ...initialState };
    }

    return operations[operationKey].byProvider[providerKey];
}

export function trackUploadActivity(operations, payload = {}) {
    const {
        endpoint = 'upload',
        fileSize = 0,
        mimeType = 'unknown',
        success = true,
        storedInDb = false,
        metadata = {}
    } = payload;

    operations.uploads.total++;
    operations.uploads.bytesReceived += Number(fileSize) || 0;

    if (success) {
        operations.uploads.successful++;
    } else {
        operations.uploads.failed++;
    }

    if (storedInDb) {
        operations.uploads.bytesStoredInDb += Number(fileSize) || 0;
    }

    operations.uploads.byEndpoint[endpoint] = (operations.uploads.byEndpoint[endpoint] || 0) + 1;
    operations.uploads.byMimeType[mimeType] = (operations.uploads.byMimeType[mimeType] || 0) + 1;

    operations.uploads.recent.push({
        timestamp: new Date().toISOString(),
        endpoint,
        fileSize: Number(fileSize) || 0,
        mimeType,
        success,
        storedInDb,
        ...metadata
    });
    if (operations.uploads.recent.length > 50) {
        operations.uploads.recent.shift();
    }
}

export function trackOcrActivity(operations, payload = {}) {
    const {
        pages = 0,
        ocrPageCount = 0,
        failedPages = 0,
        avgConfidence = null,
        extractionTimeMs = 0,
        success = true,
        metadata = {}
    } = payload;

    operations.ocr.runs++;
    if (success) {
        operations.ocr.successfulRuns++;
    } else {
        operations.ocr.failedRuns++;
    }

    operations.ocr.pagesProcessed += Number(pages) || 0;
    operations.ocr.scannedPagesDetected += Number(ocrPageCount) || 0;
    operations.ocr.failedPages += Number(failedPages) || 0;
    operations.ocr.totalExtractionTimeMs += Number(extractionTimeMs) || 0;

    if (avgConfidence !== null && avgConfidence !== undefined && !Number.isNaN(Number(avgConfidence))) {
        operations.ocr.totalConfidence += Number(avgConfidence);
        operations.ocr.confidenceSamples++;
    }

    operations.ocr.recent.push({
        timestamp: new Date().toISOString(),
        pages: Number(pages) || 0,
        ocrPageCount: Number(ocrPageCount) || 0,
        failedPages: Number(failedPages) || 0,
        avgConfidence: avgConfidence === null || avgConfidence === undefined ? null : Number(avgConfidence),
        extractionTimeMs: Number(extractionTimeMs) || 0,
        success,
        ...metadata
    });
    if (operations.ocr.recent.length > 50) {
        operations.ocr.recent.shift();
    }
}

export function trackCleanupActivity(operations, payload = {}) {
    const {
        filesDeleted = 0,
        directoriesDeleted = 0,
        orphanExportFilesDeleted = 0,
        staleExportRefsCleared = 0,
        metadata = {}
    } = payload;

    operations.cleanup.runs++;
    operations.cleanup.filesDeleted += Number(filesDeleted) || 0;
    operations.cleanup.directoriesDeleted += Number(directoriesDeleted) || 0;
    operations.cleanup.orphanExportFilesDeleted += Number(orphanExportFilesDeleted) || 0;
    operations.cleanup.staleExportRefsCleared += Number(staleExportRefsCleared) || 0;

    operations.cleanup.recent.push({
        timestamp: new Date().toISOString(),
        filesDeleted: Number(filesDeleted) || 0,
        directoriesDeleted: Number(directoriesDeleted) || 0,
        orphanExportFilesDeleted: Number(orphanExportFilesDeleted) || 0,
        staleExportRefsCleared: Number(staleExportRefsCleared) || 0,
        ...metadata
    });
    if (operations.cleanup.recent.length > 50) {
        operations.cleanup.recent.shift();
    }
}

export function trackBatchImportActivity(operations, payload = {}) {
    const {
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
    } = payload;

    const normalizedMimeType = typeof mimeType === 'string' && mimeType.trim().length > 0
        ? mimeType.trim().toLowerCase()
        : 'unknown';

    if (event === 'run') {
        operations.batchImports.runs++;
        operations.batchImports.totalInputBytes += Number(fileSize) || 0;
        operations.batchImports.byMimeType[normalizedMimeType] =
            (operations.batchImports.byMimeType[normalizedMimeType] || 0) + 1;
    }

    operations.batchImports.successfulRuns += Number(successfulRuns) || 0;
    operations.batchImports.failedRuns += Number(failedRuns) || 0;
    operations.batchImports.pendingNameRuns += Number(pendingNameRuns) || 0;
    operations.batchImports.improvementRequestedRuns += Number(improvementRequestedRuns) || 0;
    operations.batchImports.resumeRecordsCreated += Number(resumeRecordsCreated) || 0;
    operations.batchImports.textExtractionRuns += Number(textExtractionRuns) || 0;
    operations.batchImports.textExtractionFailures += Number(textExtractionFailures) || 0;
    operations.batchImports.analysisRuns += Number(analysisRuns) || 0;
    operations.batchImports.totalExtractedChars += Number(extractedChars) || 0;
    operations.batchImports.totalDurationMs += Number(durationMs) || 0;

    if ((Number(failedRuns) || 0) > 0 && stage) {
        operations.batchImports.stageFailures[stage] =
            (operations.batchImports.stageFailures[stage] || 0) + (Number(failedRuns) || 0);
    }

    operations.batchImports.recent.push({
        timestamp: new Date().toISOString(),
        event,
        mimeType: normalizedMimeType,
        fileSize: Number(fileSize) || 0,
        extractedChars: Number(extractedChars) || 0,
        durationMs: Number(durationMs) || 0,
        resumeRecordsCreated: Number(resumeRecordsCreated) || 0,
        textExtractionRuns: Number(textExtractionRuns) || 0,
        textExtractionFailures: Number(textExtractionFailures) || 0,
        analysisRuns: Number(analysisRuns) || 0,
        successfulRuns: Number(successfulRuns) || 0,
        failedRuns: Number(failedRuns) || 0,
        pendingNameRuns: Number(pendingNameRuns) || 0,
        improvementRequestedRuns: Number(improvementRequestedRuns) || 0,
        stage,
        ...metadata
    });
    if (operations.batchImports.recent.length > 50) {
        operations.batchImports.recent.shift();
    }
}

export function trackBatchExportActivity(operations, payload = {}) {
    const {
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
    } = payload;

    const normalizedFormat = typeof format === 'string' && format.trim().length > 0
        ? format.trim().toLowerCase()
        : 'unknown';
    const normalizedSource = typeof source === 'string' && source.trim().length > 0
        ? source.trim().toLowerCase()
        : 'unknown';

    if (event === 'run') {
        operations.batchExports.runs++;
        operations.batchExports.byFormat[normalizedFormat] =
            (operations.batchExports.byFormat[normalizedFormat] || 0) + 1;
        operations.batchExports.bySource[normalizedSource] =
            (operations.batchExports.bySource[normalizedSource] || 0) + 1;
    }

    operations.batchExports.successfulRuns += Number(successfulRuns) || 0;
    operations.batchExports.failedRuns += Number(failedRuns) || 0;
    operations.batchExports.requestedResumes += Number(requestedResumes) || 0;
    operations.batchExports.resolvedResumes += Number(resolvedResumes) || 0;
    operations.batchExports.inaccessibleResumes += Number(inaccessibleResumes) || 0;
    operations.batchExports.generatedFiles += Number(generatedFiles) || 0;
    operations.batchExports.failedFiles += Number(failedFiles) || 0;
    operations.batchExports.totalDurationMs += Number(durationMs) || 0;
    operations.batchExports.totalArchiveBytes += Number(archiveBytes) || 0;
    operations.batchExports.truncatedErrors += Number(truncatedErrors) || 0;

    operations.batchExports.recent.push({
        timestamp: new Date().toISOString(),
        event,
        format: normalizedFormat,
        source: normalizedSource,
        requestedResumes: Number(requestedResumes) || 0,
        resolvedResumes: Number(resolvedResumes) || 0,
        inaccessibleResumes: Number(inaccessibleResumes) || 0,
        generatedFiles: Number(generatedFiles) || 0,
        failedFiles: Number(failedFiles) || 0,
        durationMs: Number(durationMs) || 0,
        archiveBytes: Number(archiveBytes) || 0,
        successfulRuns: Number(successfulRuns) || 0,
        failedRuns: Number(failedRuns) || 0,
        truncatedErrors: Number(truncatedErrors) || 0,
        ...metadata
    });
    if (operations.batchExports.recent.length > 50) {
        operations.batchExports.recent.shift();
    }
}

export function trackProfileMatchingActivity(operations, normalizeProviderKey, payload = {}) {
    const {
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
    } = payload;

    const providerKey = normalizeProviderKey(provider);
    if (!operations.profileMatching.byProvider[providerKey]) {
        operations.profileMatching.byProvider[providerKey] = {
            searches: 0,
            batchesStarted: 0,
            batchesRetried: 0,
            batchesFailed: 0,
            normalizationEvents: 0,
            profilesRequested: 0,
            profilesScored: 0,
            profilesExplained: 0,
            profilesReturned: 0
        };
    }

    const bucket = operations.profileMatching.byProvider[providerKey];

    if (event === 'search') {
        operations.profileMatching.searches++;
        bucket.searches++;
    }

    operations.profileMatching.batchesStarted += Number(batchesStarted) || 0;
    operations.profileMatching.batchesRetried += Number(batchesRetried) || 0;
    operations.profileMatching.batchesFailed += Number(batchesFailed) || 0;
    operations.profileMatching.normalizationEvents += Number(normalizationEvents) || 0;
    operations.profileMatching.profilesRequested += Number(profilesRequested) || 0;
    operations.profileMatching.profilesScored += Number(profilesScored) || 0;
    operations.profileMatching.profilesExplained += Number(profilesExplained) || 0;
    operations.profileMatching.profilesReturned += Number(profilesReturned) || 0;

    bucket.batchesStarted += Number(batchesStarted) || 0;
    bucket.batchesRetried += Number(batchesRetried) || 0;
    bucket.batchesFailed += Number(batchesFailed) || 0;
    bucket.normalizationEvents += Number(normalizationEvents) || 0;
    bucket.profilesRequested += Number(profilesRequested) || 0;
    bucket.profilesScored += Number(profilesScored) || 0;
    bucket.profilesExplained += Number(profilesExplained) || 0;
    bucket.profilesReturned += Number(profilesReturned) || 0;

    operations.profileMatching.recent.push({
        timestamp: new Date().toISOString(),
        provider: providerKey,
        event,
        profilesRequested: Number(profilesRequested) || 0,
        profilesScored: Number(profilesScored) || 0,
        profilesExplained: Number(profilesExplained) || 0,
        profilesReturned: Number(profilesReturned) || 0,
        batchesStarted: Number(batchesStarted) || 0,
        batchesRetried: Number(batchesRetried) || 0,
        batchesFailed: Number(batchesFailed) || 0,
        normalizationEvents: Number(normalizationEvents) || 0,
        ...metadata
    });
    if (operations.profileMatching.recent.length > 50) {
        operations.profileMatching.recent.shift();
    }
}

export function trackImprovementActivity(operations, normalizeProviderKey, payload = {}) {
    const {
        provider = 'unknown',
        event = 'run',
        successfulRuns = 0,
        failedRuns = 0,
        fallbackRuns = 0,
        postAnalysisFallbackRuns = 0,
        postAnalysisMergeRuns = 0,
        structuredRuns = 0,
        inputChars = 0,
        outputChars = 0,
        metadata = {}
    } = payload;

    const providerKey = normalizeProviderKey(provider);
    const bucket = ensureOperationProviderBucket(operations, 'improvement', providerKey, {
        runs: 0,
        successfulRuns: 0,
        failedRuns: 0,
        fallbackRuns: 0,
        postAnalysisFallbackRuns: 0,
        postAnalysisMergeRuns: 0,
        structuredRuns: 0,
        inputChars: 0,
        outputChars: 0
    });

    if (event === 'run') {
        operations.improvement.runs++;
        bucket.runs++;
    }

    operations.improvement.successfulRuns += Number(successfulRuns) || 0;
    operations.improvement.failedRuns += Number(failedRuns) || 0;
    operations.improvement.fallbackRuns += Number(fallbackRuns) || 0;
    operations.improvement.postAnalysisFallbackRuns += Number(postAnalysisFallbackRuns) || 0;
    operations.improvement.postAnalysisMergeRuns += Number(postAnalysisMergeRuns) || 0;
    operations.improvement.structuredRuns += Number(structuredRuns) || 0;
    operations.improvement.inputChars += Number(inputChars) || 0;
    operations.improvement.outputChars += Number(outputChars) || 0;

    bucket.successfulRuns += Number(successfulRuns) || 0;
    bucket.failedRuns += Number(failedRuns) || 0;
    bucket.fallbackRuns += Number(fallbackRuns) || 0;
    bucket.postAnalysisFallbackRuns += Number(postAnalysisFallbackRuns) || 0;
    bucket.postAnalysisMergeRuns += Number(postAnalysisMergeRuns) || 0;
    bucket.structuredRuns += Number(structuredRuns) || 0;
    bucket.inputChars += Number(inputChars) || 0;
    bucket.outputChars += Number(outputChars) || 0;

    operations.improvement.recent.push({
        timestamp: new Date().toISOString(),
        provider: providerKey,
        event,
        successfulRuns: Number(successfulRuns) || 0,
        failedRuns: Number(failedRuns) || 0,
        fallbackRuns: Number(fallbackRuns) || 0,
        postAnalysisFallbackRuns: Number(postAnalysisFallbackRuns) || 0,
        postAnalysisMergeRuns: Number(postAnalysisMergeRuns) || 0,
        structuredRuns: Number(structuredRuns) || 0,
        inputChars: Number(inputChars) || 0,
        outputChars: Number(outputChars) || 0,
        ...metadata
    });
    if (operations.improvement.recent.length > 50) {
        operations.improvement.recent.shift();
    }
}

export function trackAiModifyActivity(operations, normalizeProviderKey, payload = {}) {
    const {
        provider = 'unknown',
        event = 'run',
        successfulRuns = 0,
        failedRuns = 0,
        fallbackRuns = 0,
        selectionRuns = 0,
        inputChars = 0,
        outputChars = 0,
        metadata = {}
    } = payload;

    const providerKey = normalizeProviderKey(provider);
    const bucket = ensureOperationProviderBucket(operations, 'aiModify', providerKey, {
        runs: 0,
        successfulRuns: 0,
        failedRuns: 0,
        fallbackRuns: 0,
        selectionRuns: 0,
        inputChars: 0,
        outputChars: 0
    });

    if (event === 'run') {
        operations.aiModify.runs++;
        bucket.runs++;
    }

    operations.aiModify.successfulRuns += Number(successfulRuns) || 0;
    operations.aiModify.failedRuns += Number(failedRuns) || 0;
    operations.aiModify.fallbackRuns += Number(fallbackRuns) || 0;
    operations.aiModify.selectionRuns += Number(selectionRuns) || 0;
    operations.aiModify.inputChars += Number(inputChars) || 0;
    operations.aiModify.outputChars += Number(outputChars) || 0;

    bucket.successfulRuns += Number(successfulRuns) || 0;
    bucket.failedRuns += Number(failedRuns) || 0;
    bucket.fallbackRuns += Number(fallbackRuns) || 0;
    bucket.selectionRuns += Number(selectionRuns) || 0;
    bucket.inputChars += Number(inputChars) || 0;
    bucket.outputChars += Number(outputChars) || 0;

    operations.aiModify.recent.push({
        timestamp: new Date().toISOString(),
        provider: providerKey,
        event,
        successfulRuns: Number(successfulRuns) || 0,
        failedRuns: Number(failedRuns) || 0,
        fallbackRuns: Number(fallbackRuns) || 0,
        selectionRuns: Number(selectionRuns) || 0,
        inputChars: Number(inputChars) || 0,
        outputChars: Number(outputChars) || 0,
        ...metadata
    });
    if (operations.aiModify.recent.length > 50) {
        operations.aiModify.recent.shift();
    }
}

export function trackAdaptationActivity(operations, normalizeProviderKey, payload = {}) {
    const {
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
    } = payload;

    const providerKey = normalizeProviderKey(provider);
    const bucket = ensureOperationProviderBucket(operations, 'adaptation', providerKey, {
        runs: 0,
        matchRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        fallbackRuns: 0,
        structuredRuns: 0,
        inputChars: 0,
        outputChars: 0
    });

    if (event === 'run') {
        operations.adaptation.runs++;
        bucket.runs++;
    }

    operations.adaptation.matchRuns += Number(matchRuns) || 0;
    operations.adaptation.successfulRuns += Number(successfulRuns) || 0;
    operations.adaptation.failedRuns += Number(failedRuns) || 0;
    operations.adaptation.fallbackRuns += Number(fallbackRuns) || 0;
    operations.adaptation.structuredRuns += Number(structuredRuns) || 0;
    operations.adaptation.inputChars += Number(inputChars) || 0;
    operations.adaptation.outputChars += Number(outputChars) || 0;

    bucket.matchRuns += Number(matchRuns) || 0;
    bucket.successfulRuns += Number(successfulRuns) || 0;
    bucket.failedRuns += Number(failedRuns) || 0;
    bucket.fallbackRuns += Number(fallbackRuns) || 0;
    bucket.structuredRuns += Number(structuredRuns) || 0;
    bucket.inputChars += Number(inputChars) || 0;
    bucket.outputChars += Number(outputChars) || 0;

    operations.adaptation.recent.push({
        timestamp: new Date().toISOString(),
        provider: providerKey,
        event,
        matchRuns: Number(matchRuns) || 0,
        successfulRuns: Number(successfulRuns) || 0,
        failedRuns: Number(failedRuns) || 0,
        fallbackRuns: Number(fallbackRuns) || 0,
        structuredRuns: Number(structuredRuns) || 0,
        inputChars: Number(inputChars) || 0,
        outputChars: Number(outputChars) || 0,
        ...metadata
    });
    if (operations.adaptation.recent.length > 50) {
        operations.adaptation.recent.shift();
    }
}
