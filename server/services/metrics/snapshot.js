export function buildPersistedMetricsData(collector) {
    return {
        savedAt: new Date().toISOString(),
        startTime: collector.startTime,
        requests: {
            total: collector.requests.total,
            byMethod: collector.requests.byMethod,
            byEndpoint: collector.requests.byEndpoint,
            byStatus: collector.requests.byStatus
        },
        errors: {
            total: collector.errors.total,
            byType: collector.errors.byType,
            byEndpoint: collector.errors.byEndpoint
        },
        cache: collector.cache,
        llm: {
            requests: collector.llm.requests,
            byProvider: collector.llm.byProvider,
            totalTokens: collector.llm.totalTokens,
            errors: collector.llm.errors
        },
        operations: {
            uploads: {
                total: collector.operations.uploads.total,
                successful: collector.operations.uploads.successful,
                failed: collector.operations.uploads.failed,
                bytesReceived: collector.operations.uploads.bytesReceived,
                bytesStoredInDb: collector.operations.uploads.bytesStoredInDb,
                byEndpoint: collector.operations.uploads.byEndpoint,
                byMimeType: collector.operations.uploads.byMimeType
            },
            ocr: {
                runs: collector.operations.ocr.runs,
                successfulRuns: collector.operations.ocr.successfulRuns,
                failedRuns: collector.operations.ocr.failedRuns,
                pagesProcessed: collector.operations.ocr.pagesProcessed,
                scannedPagesDetected: collector.operations.ocr.scannedPagesDetected,
                failedPages: collector.operations.ocr.failedPages,
                totalConfidence: collector.operations.ocr.totalConfidence,
                confidenceSamples: collector.operations.ocr.confidenceSamples,
                totalExtractionTimeMs: collector.operations.ocr.totalExtractionTimeMs
            },
            cleanup: {
                runs: collector.operations.cleanup.runs,
                filesDeleted: collector.operations.cleanup.filesDeleted,
                directoriesDeleted: collector.operations.cleanup.directoriesDeleted,
                orphanExportFilesDeleted: collector.operations.cleanup.orphanExportFilesDeleted,
                staleExportRefsCleared: collector.operations.cleanup.staleExportRefsCleared
            },
            batchImports: {
                runs: collector.operations.batchImports.runs,
                successfulRuns: collector.operations.batchImports.successfulRuns,
                failedRuns: collector.operations.batchImports.failedRuns,
                pendingNameRuns: collector.operations.batchImports.pendingNameRuns,
                improvementRequestedRuns: collector.operations.batchImports.improvementRequestedRuns,
                resumeRecordsCreated: collector.operations.batchImports.resumeRecordsCreated,
                textExtractionRuns: collector.operations.batchImports.textExtractionRuns,
                textExtractionFailures: collector.operations.batchImports.textExtractionFailures,
                analysisRuns: collector.operations.batchImports.analysisRuns,
                totalInputBytes: collector.operations.batchImports.totalInputBytes,
                totalExtractedChars: collector.operations.batchImports.totalExtractedChars,
                totalDurationMs: collector.operations.batchImports.totalDurationMs,
                byMimeType: collector.operations.batchImports.byMimeType,
                stageFailures: collector.operations.batchImports.stageFailures
            },
            batchExports: {
                runs: collector.operations.batchExports.runs,
                successfulRuns: collector.operations.batchExports.successfulRuns,
                failedRuns: collector.operations.batchExports.failedRuns,
                requestedResumes: collector.operations.batchExports.requestedResumes,
                resolvedResumes: collector.operations.batchExports.resolvedResumes,
                inaccessibleResumes: collector.operations.batchExports.inaccessibleResumes,
                generatedFiles: collector.operations.batchExports.generatedFiles,
                failedFiles: collector.operations.batchExports.failedFiles,
                totalDurationMs: collector.operations.batchExports.totalDurationMs,
                totalArchiveBytes: collector.operations.batchExports.totalArchiveBytes,
                truncatedErrors: collector.operations.batchExports.truncatedErrors,
                byFormat: collector.operations.batchExports.byFormat,
                bySource: collector.operations.batchExports.bySource
            },
            aiModify: {
                runs: collector.operations.aiModify.runs,
                successfulRuns: collector.operations.aiModify.successfulRuns,
                failedRuns: collector.operations.aiModify.failedRuns,
                fallbackRuns: collector.operations.aiModify.fallbackRuns,
                selectionRuns: collector.operations.aiModify.selectionRuns,
                inputChars: collector.operations.aiModify.inputChars,
                outputChars: collector.operations.aiModify.outputChars,
                byProvider: collector.operations.aiModify.byProvider
            },
            improvement: {
                runs: collector.operations.improvement.runs,
                successfulRuns: collector.operations.improvement.successfulRuns,
                failedRuns: collector.operations.improvement.failedRuns,
                fallbackRuns: collector.operations.improvement.fallbackRuns,
                structuredRuns: collector.operations.improvement.structuredRuns,
                inputChars: collector.operations.improvement.inputChars,
                outputChars: collector.operations.improvement.outputChars,
                byProvider: collector.operations.improvement.byProvider
            },
            adaptation: {
                runs: collector.operations.adaptation.runs,
                matchRuns: collector.operations.adaptation.matchRuns,
                successfulRuns: collector.operations.adaptation.successfulRuns,
                failedRuns: collector.operations.adaptation.failedRuns,
                fallbackRuns: collector.operations.adaptation.fallbackRuns,
                structuredRuns: collector.operations.adaptation.structuredRuns,
                inputChars: collector.operations.adaptation.inputChars,
                outputChars: collector.operations.adaptation.outputChars,
                byProvider: collector.operations.adaptation.byProvider
            },
            profileMatching: {
                searches: collector.operations.profileMatching.searches,
                batchesStarted: collector.operations.profileMatching.batchesStarted,
                batchesRetried: collector.operations.profileMatching.batchesRetried,
                batchesFailed: collector.operations.profileMatching.batchesFailed,
                normalizationEvents: collector.operations.profileMatching.normalizationEvents,
                profilesRequested: collector.operations.profileMatching.profilesRequested,
                profilesScored: collector.operations.profileMatching.profilesScored,
                profilesExplained: collector.operations.profileMatching.profilesExplained,
                profilesReturned: collector.operations.profileMatching.profilesReturned,
                byProvider: collector.operations.profileMatching.byProvider
            }
        }
    };
}

export function buildHistorySnapshot(collector) {
    return {
        timestamp: new Date().toISOString(),
        uptime: collector.getUptime().seconds,
        requests: collector.requests.total,
        errors: collector.errors.total,
        cacheHitRate: collector.getCacheHitRate(),
        llmRequests: collector.llm.requests,
        llmTokens: collector.llm.totalTokens,
        llmCost: collector.calculateLLMCost(),
        avgResponseTime: collector.getAverageResponseTime(),
        memoryUsed: process.memoryUsage().heapUsed
    };
}

export function buildPublicMetrics(collector) {
    const uptime = collector.getUptime();
    const memoryUsage = process.memoryUsage();

    return {
        server: {
            uptime: uptime.formatted,
            uptimeSeconds: uptime.seconds,
            startTime: new Date(collector.startTime).toISOString()
        },
        requests: {
            total: collector.requests.total,
            last24h: collector.getRequestsInWindow(24 * 60 * 60 * 1000),
            lastHour: collector.getRequestsInWindow(60 * 60 * 1000),
            byMethod: collector.requests.byMethod,
            byStatus: collector.requests.byStatus,
            topEndpoints: collector.getTopEndpoints(10)
        },
        performance: {
            avgResponseTime: collector.getAverageResponseTime(),
            minResponseTime: collector.requests.responseTimes.length > 0 ? Math.min(...collector.requests.responseTimes) : 0,
            maxResponseTime: collector.requests.responseTimes.length > 0 ? Math.max(...collector.requests.responseTimes) : 0,
            p50: collector.calculatePercentile(50),
            p95: collector.calculatePercentile(95),
            p99: collector.calculatePercentile(99)
        },
        cache: {
            hits: collector.cache.hits,
            misses: collector.cache.misses,
            hitRate: collector.getCacheHitRate() / 100,
            total: collector.cache.hits + collector.cache.misses
        },
        errors: {
            total: collector.errors.total,
            rate: parseFloat(collector.getErrorRate()) / 100,
            byType: collector.errors.byType,
            topErrors: collector.getTopErrors(5),
            recent: collector.errors.recent.slice(-10)
        },
        llm: {
            requests: collector.llm.requests,
            byProvider: collector.llm.byProvider,
            totalTokens: collector.llm.totalTokens,
            errors: collector.llm.errors,
            estimatedCost: collector.calculateLLMCost(),
            costByProvider: collector.calculateCostByProvider(),
            successRate: collector.llm.requests > 0
                ? `${(((collector.llm.requests - collector.llm.errors) / collector.llm.requests) * 100).toFixed(2)}%`
                : '0%'
        },
        operations: {
            uploads: {
                total: collector.operations.uploads.total,
                successful: collector.operations.uploads.successful,
                failed: collector.operations.uploads.failed,
                bytesReceived: collector.operations.uploads.bytesReceived,
                bytesStoredInDb: collector.operations.uploads.bytesStoredInDb
            },
            ocr: {
                runs: collector.operations.ocr.runs,
                successfulRuns: collector.operations.ocr.successfulRuns,
                failedRuns: collector.operations.ocr.failedRuns,
                pagesProcessed: collector.operations.ocr.pagesProcessed,
                scannedPagesDetected: collector.operations.ocr.scannedPagesDetected,
                failedPages: collector.operations.ocr.failedPages
            },
            cleanup: {
                runs: collector.operations.cleanup.runs,
                filesDeleted: collector.operations.cleanup.filesDeleted,
                directoriesDeleted: collector.operations.cleanup.directoriesDeleted,
                orphanExportFilesDeleted: collector.operations.cleanup.orphanExportFilesDeleted,
                staleExportRefsCleared: collector.operations.cleanup.staleExportRefsCleared
            },
            batchImports: {
                runs: collector.operations.batchImports.runs,
                successfulRuns: collector.operations.batchImports.successfulRuns,
                failedRuns: collector.operations.batchImports.failedRuns,
                pendingNameRuns: collector.operations.batchImports.pendingNameRuns,
                improvementRequestedRuns: collector.operations.batchImports.improvementRequestedRuns,
                resumeRecordsCreated: collector.operations.batchImports.resumeRecordsCreated,
                textExtractionRuns: collector.operations.batchImports.textExtractionRuns,
                textExtractionFailures: collector.operations.batchImports.textExtractionFailures,
                analysisRuns: collector.operations.batchImports.analysisRuns,
                totalInputBytes: collector.operations.batchImports.totalInputBytes,
                totalExtractedChars: collector.operations.batchImports.totalExtractedChars,
                totalDurationMs: collector.operations.batchImports.totalDurationMs,
                byMimeType: collector.operations.batchImports.byMimeType,
                stageFailures: collector.operations.batchImports.stageFailures,
                recent: collector.operations.batchImports.recent.slice(-10)
            },
            batchExports: {
                runs: collector.operations.batchExports.runs,
                successfulRuns: collector.operations.batchExports.successfulRuns,
                failedRuns: collector.operations.batchExports.failedRuns,
                requestedResumes: collector.operations.batchExports.requestedResumes,
                resolvedResumes: collector.operations.batchExports.resolvedResumes,
                inaccessibleResumes: collector.operations.batchExports.inaccessibleResumes,
                generatedFiles: collector.operations.batchExports.generatedFiles,
                failedFiles: collector.operations.batchExports.failedFiles,
                totalDurationMs: collector.operations.batchExports.totalDurationMs,
                totalArchiveBytes: collector.operations.batchExports.totalArchiveBytes,
                truncatedErrors: collector.operations.batchExports.truncatedErrors,
                byFormat: collector.operations.batchExports.byFormat,
                bySource: collector.operations.batchExports.bySource,
                recent: collector.operations.batchExports.recent.slice(-10)
            },
            aiModify: {
                runs: collector.operations.aiModify.runs,
                successfulRuns: collector.operations.aiModify.successfulRuns,
                failedRuns: collector.operations.aiModify.failedRuns,
                fallbackRuns: collector.operations.aiModify.fallbackRuns,
                selectionRuns: collector.operations.aiModify.selectionRuns,
                inputChars: collector.operations.aiModify.inputChars,
                outputChars: collector.operations.aiModify.outputChars,
                byProvider: collector.operations.aiModify.byProvider,
                recent: collector.operations.aiModify.recent.slice(-10)
            },
            improvement: {
                runs: collector.operations.improvement.runs,
                successfulRuns: collector.operations.improvement.successfulRuns,
                failedRuns: collector.operations.improvement.failedRuns,
                fallbackRuns: collector.operations.improvement.fallbackRuns,
                structuredRuns: collector.operations.improvement.structuredRuns,
                inputChars: collector.operations.improvement.inputChars,
                outputChars: collector.operations.improvement.outputChars,
                byProvider: collector.operations.improvement.byProvider,
                recent: collector.operations.improvement.recent.slice(-10)
            },
            adaptation: {
                runs: collector.operations.adaptation.runs,
                matchRuns: collector.operations.adaptation.matchRuns,
                successfulRuns: collector.operations.adaptation.successfulRuns,
                failedRuns: collector.operations.adaptation.failedRuns,
                fallbackRuns: collector.operations.adaptation.fallbackRuns,
                structuredRuns: collector.operations.adaptation.structuredRuns,
                inputChars: collector.operations.adaptation.inputChars,
                outputChars: collector.operations.adaptation.outputChars,
                byProvider: collector.operations.adaptation.byProvider,
                recent: collector.operations.adaptation.recent.slice(-10)
            },
            profileMatching: {
                searches: collector.operations.profileMatching.searches,
                batchesStarted: collector.operations.profileMatching.batchesStarted,
                batchesRetried: collector.operations.profileMatching.batchesRetried,
                batchesFailed: collector.operations.profileMatching.batchesFailed,
                normalizationEvents: collector.operations.profileMatching.normalizationEvents,
                profilesRequested: collector.operations.profileMatching.profilesRequested,
                profilesScored: collector.operations.profileMatching.profilesScored,
                profilesExplained: collector.operations.profileMatching.profilesExplained,
                profilesReturned: collector.operations.profileMatching.profilesReturned,
                byProvider: collector.operations.profileMatching.byProvider,
                recent: collector.operations.profileMatching.recent.slice(-10)
            }
        },
        memory: {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            rss: memoryUsage.rss,
            external: memoryUsage.external
        }
    };
}
