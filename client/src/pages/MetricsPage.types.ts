export interface Metrics {
  server?: { uptimeSeconds?: number; startTime?: string };
  requests?: {
    total?: number;
    last24h?: number;
    byMethod?: Record<string, number>;
    byStatus?: Record<string, number>;
    topEndpoints?: Array<{ endpoint?: string; path?: string; count?: number }>;
  };
  performance?: { avgResponseTime?: number; minResponseTime?: number; maxResponseTime?: number };
  errors?: { rate?: number; total?: number };
  memory?: { heapUsed?: number; heapTotal?: number; rss?: number; external?: number };
  cache?: { hitRate?: number; hits?: number; misses?: number };
  llm?: {
    requests?: number;
    totalTokens?: number;
    estimatedCost?: number;
    byProvider?: Record<string, { requests?: number } | number>;
  };
}

export interface DatabaseMetrics {
  database?: { size?: number; sizePretty?: string };
  binaryStorage?: {
    resumesWithBinary?: number;
    resumeBinaryBytes?: number;
    avgResumeBinaryBytes?: number;
    maxResumeBinaryBytes?: number;
    batchItemsWithFileData?: number;
    batchFileDataBytes?: number;
  };
  tables?: Array<{ name: string; rowCount: number; deadRows: number; lastVacuum?: string; lastAnalyze?: string }>;
  connections?: { total?: number; active?: number; idle?: number };
  queryTime?: string;
  timestamp?: string;
}

export interface CacheAdminMetrics {
  cacheBackend?: {
    backend?: string;
    connected?: boolean | null;
    fallbackReason?: string | null;
  };
  caches?: {
    settings?: {
      entries?: number;
      cache?: {
        backend?: string;
        effectiveBackend?: string;
        connected?: boolean | null;
        disabledReason?: string | null;
      };
    };
  };
}

export interface OperationsMetrics {
  ocrRuntime?: {
    status?: string;
    preferredEngine?: string;
    tesseractAvailable?: boolean;
    pdftoppmAvailable?: boolean;
    pythonCommand?: string | null;
    advancedBackendConfigured?: string;
    advancedBackendAvailable?: boolean;
    notes?: string;
  };
  operations?: {
    uploads?: {
      total?: number;
      successful?: number;
      failed?: number;
      bytesReceived?: number;
      bytesStoredInDb?: number;
      byEndpoint?: Record<string, number>;
      byMimeType?: Record<string, number>;
    };
    ocr?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      pagesProcessed?: number;
      scannedPagesDetected?: number;
      failedPages?: number;
      totalConfidence?: number;
      confidenceSamples?: number;
      totalExtractionTimeMs?: number;
    };
    cleanup?: {
      runs?: number;
      filesDeleted?: number;
      directoriesDeleted?: number;
      orphanExportFilesDeleted?: number;
      staleExportRefsCleared?: number;
    };
    batchImports?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      pendingNameRuns?: number;
      improvementRequestedRuns?: number;
      resumeRecordsCreated?: number;
      textExtractionRuns?: number;
      textExtractionFailures?: number;
      analysisRuns?: number;
      totalInputBytes?: number;
      totalExtractedChars?: number;
      totalDurationMs?: number;
      byMimeType?: Record<string, number>;
      stageFailures?: Record<string, number>;
      recent?: Array<{
        timestamp?: string;
        event?: string;
        mimeType?: string;
        fileSize?: number;
        extractedChars?: number;
        durationMs?: number;
        successfulRuns?: number;
        failedRuns?: number;
        pendingNameRuns?: number;
        stage?: string | null;
        error?: string;
      }>;
    };
    aiModify?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      fallbackRuns?: number;
      selectionRuns?: number;
      inputChars?: number;
      outputChars?: number;
      recent?: Array<{
        timestamp?: string;
        provider?: string;
        event?: string;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        selectionRuns?: number;
        inputChars?: number;
        outputChars?: number;
        source?: string;
      }>;
      byProvider?: Record<string, {
        runs?: number;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        selectionRuns?: number;
        inputChars?: number;
        outputChars?: number;
      }>;
    };
    improvement?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      fallbackRuns?: number;
      structuredRuns?: number;
      inputChars?: number;
      outputChars?: number;
      recent?: Array<{
        timestamp?: string;
        provider?: string;
        event?: string;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        structuredRuns?: number;
        inputChars?: number;
        outputChars?: number;
        source?: string;
      }>;
      byProvider?: Record<string, {
        runs?: number;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        structuredRuns?: number;
        inputChars?: number;
        outputChars?: number;
      }>;
    };
    adaptation?: {
      runs?: number;
      matchRuns?: number;
      successfulRuns?: number;
      failedRuns?: number;
      fallbackRuns?: number;
      structuredRuns?: number;
      inputChars?: number;
      outputChars?: number;
      recent?: Array<{
        timestamp?: string;
        provider?: string;
        event?: string;
        matchRuns?: number;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        structuredRuns?: number;
        inputChars?: number;
        outputChars?: number;
        source?: string;
      }>;
      byProvider?: Record<string, {
        runs?: number;
        matchRuns?: number;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        structuredRuns?: number;
        inputChars?: number;
        outputChars?: number;
      }>;
    };
    profileMatching?: {
      searches?: number;
      batchesStarted?: number;
      batchesRetried?: number;
      batchesFailed?: number;
      normalizationEvents?: number;
      profilesRequested?: number;
      profilesScored?: number;
      profilesExplained?: number;
      profilesReturned?: number;
      recent?: Array<{
        timestamp?: string;
        provider?: string;
        event?: string;
        profilesRequested?: number;
        profilesScored?: number;
        profilesExplained?: number;
        profilesReturned?: number;
        batchesStarted?: number;
        batchesRetried?: number;
        batchesFailed?: number;
        normalizationEvents?: number;
        field?: string;
        source?: string;
        inputType?: string;
      }>;
      byProvider?: Record<string, {
        searches?: number;
        batchesStarted?: number;
        batchesRetried?: number;
        batchesFailed?: number;
        normalizationEvents?: number;
        profilesRequested?: number;
        profilesScored?: number;
      }>;
    };
  };
  binaryStorage?: {
    resumesWithBinary?: number;
    resumeBinaryBytes?: number;
    avgResumeBinaryBytes?: number;
    maxResumeBinaryBytes?: number;
    batchItemsWithFileData?: number;
    batchFileDataBytes?: number;
  };
  storage?: {
    tempDirectorySize?: number;
    tempFileCount?: number;
    batchExportDirectorySize?: number;
    batchExportFileCount?: number;
  };
  cleanup?: {
    filesDeleted?: number;
    dirsDeleted?: number;
    lastCleanupTime?: string;
  };
  timestamp?: string;
}

export interface APMMetrics {
  config?: {
    slowThreshold?: number;
    verySlowThreshold?: number;
    criticalThreshold?: number;
  };
  summary?: {
    totalTracked?: number;
    last5min?: number;
    last1h?: number;
    avgDuration?: number;
    severityCounts?: {
      slow?: number;
      very_slow?: number;
      critical?: number;
    };
  };
  topSlowEndpoints?: Array<{
    endpoint: string;
    count: number;
    avgDuration: number;
    maxDuration: number;
  }>;
  timestamp?: string;
}
