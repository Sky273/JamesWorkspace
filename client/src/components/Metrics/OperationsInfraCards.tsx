import { motion } from 'framer-motion';
import { ArrowDownTrayIcon, BoltIcon } from '@heroicons/react/24/outline';

interface OperationsInfraMetrics {
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
    };
    ocr?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      scannedPagesDetected?: number;
      failedPages?: number;
      totalConfidence?: number;
      confidenceSamples?: number;
      totalExtractionTimeMs?: number;
      recent?: Array<{
        timestamp?: string;
        source?: string;
        fileName?: string;
        success?: boolean;
        pages?: number;
        ocrPageCount?: number;
        failedPages?: number;
        avgConfidence?: number | null;
        extractionTimeMs?: number;
        engine?: string | null;
        variant?: string | null;
        psm?: string | null;
        textLength?: number;
      }>;
    };
    cleanup?: {
      runs?: number;
      filesDeleted?: number;
      directoriesDeleted?: number;
      orphanExportFilesDeleted?: number;
      staleExportRefsCleared?: number;
    };
  };
  binaryStorage?: {
    resumesWithBinary?: number;
    resumeBinaryBytes?: number;
    avgResumeBinaryBytes?: number;
    batchFileDataBytes?: number;
  };
  storage?: {
    tempDirectorySize?: number;
    tempFileCount?: number;
    batchExportDirectorySize?: number;
    batchExportFileCount?: number;
  };
}

interface OperationsInfraCardsProps {
  metrics: OperationsInfraMetrics | null | undefined;
  t: any;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatNumber: (value?: number) => string;
  formatBytes: (value?: number) => string;
}

export default function OperationsInfraCards({
  metrics,
  t,
  safeNumber,
  formatNumber,
  formatBytes
}: OperationsInfraCardsProps): JSX.Element | null {
  if (!metrics) return null;

  const ocrRuntime = metrics.ocrRuntime;
  const renderAvailability = (value: boolean | null | undefined): string => {
    if (value === null || value === undefined) return t('metrics.notApplicable');
    return value ? t('common.yes', 'Oui') : t('common.no', 'Non');
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.185 }} className="rounded-xl border bg-sky-50 text-sky-700 border-sky-200 dark:bg-gray-800 dark:text-sky-400 dark:border-sky-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.operationsUploadsTitle')}</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.operations?.uploads?.total))}</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.operationsUploadsSubtitle')}</p>
          </div>
          <ArrowDownTrayIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.successFailures')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.uploads?.successful)} / {safeNumber(metrics.operations?.uploads?.failed)}</p>
          </div>
          <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.receivedStoredDb')}</p>
            <p className="font-semibold">{formatBytes(safeNumber(metrics.operations?.uploads?.bytesReceived))} / {formatBytes(safeNumber(metrics.operations?.uploads?.bytesStoredInDb))}</p>
          </div>
          <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.binaryResumes')}</p>
            <p className="font-semibold">{safeNumber(metrics.binaryStorage?.resumesWithBinary)}</p>
          </div>
          <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.binaryStorage')}</p>
            <p className="font-semibold">{formatBytes(safeNumber(metrics.binaryStorage?.resumeBinaryBytes))}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.averagePerResume')}</p>
            <p className="font-semibold">{formatBytes(safeNumber(metrics.binaryStorage?.avgResumeBinaryBytes))}</p>
          </div>
          <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.batchFileData')}</p>
            <p className="font-semibold">{formatBytes(safeNumber(metrics.binaryStorage?.batchFileDataBytes))}</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="rounded-xl border bg-teal-50 text-teal-700 border-teal-200 dark:bg-gray-800 dark:text-teal-400 dark:border-teal-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.operationsOcrTitle')}</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.operations?.ocr?.runs))}</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.operationsOcrSubtitle')}</p>
          </div>
          <BoltIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.ocrSuccessFailures')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.ocr?.successfulRuns)} / {safeNumber(metrics.operations?.ocr?.failedRuns)}</p>
          </div>
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.ocrPagesFailures')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.ocr?.scannedPagesDetected)} / {safeNumber(metrics.operations?.ocr?.failedPages)}</p>
          </div>
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.averageConfidence')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.ocr?.confidenceSamples) > 0 ? ((safeNumber(metrics.operations?.ocr?.totalConfidence) / safeNumber(metrics.operations?.ocr?.confidenceSamples)).toFixed(1) + '%') : 'N/A'}</p>
          </div>
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cumulativeOcrTime')}</p>
            <p className="font-semibold">{Math.round(safeNumber(metrics.operations?.ocr?.totalExtractionTimeMs) / 1000) + 's'}</p>
          </div>
        </div>
        {ocrRuntime && (
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
              <p className="opacity-70">{t('metrics.ocrPipeline')}</p>
              <p className="font-semibold break-words">{ocrRuntime.preferredEngine || t('metrics.none')}</p>
            </div>
            <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
              <p className="opacity-70">{t('metrics.ocrAdvancedBackend')}</p>
              <p className="font-semibold break-words">
                {ocrRuntime.advancedBackendConfigured || t('metrics.none')}
                {ocrRuntime.advancedBackendConfigured && ` (${renderAvailability(ocrRuntime.advancedBackendAvailable)})`}
              </p>
            </div>
            <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
              <p className="opacity-70">{t('metrics.ocrTesseract')}</p>
              <p className="font-semibold">{renderAvailability(ocrRuntime.tesseractAvailable)}</p>
            </div>
            <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
              <p className="opacity-70">{t('metrics.ocrPdftoppm')}</p>
              <p className="font-semibold">{renderAvailability(ocrRuntime.pdftoppmAvailable)}</p>
            </div>
            <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3 col-span-2">
              <p className="opacity-70">{t('metrics.ocrPython')}</p>
              <p className="font-semibold break-words">{ocrRuntime.pythonCommand || t('metrics.notApplicable')}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cleanupRuns')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.cleanup?.runs)}</p>
          </div>
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.filesDirsDeleted')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.cleanup?.filesDeleted)} / {safeNumber(metrics.operations?.cleanup?.directoriesDeleted)}</p>
          </div>
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.orphanBatchExports')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.cleanup?.orphanExportFilesDeleted)}</p>
          </div>
          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.staleBatchRefs')}</p>
            <p className="font-semibold">{safeNumber(metrics.operations?.cleanup?.staleExportRefsCleared)}</p>
          </div>
        </div>
        <p className="text-xs opacity-60">
          {t('metrics.tempStorageSummary')}: {formatBytes(safeNumber(metrics.storage?.tempDirectorySize))} / {safeNumber(metrics.storage?.tempFileCount)} {t('metrics.filesUnit')}
          {' | '}
          {t('metrics.batchExportsSummary')}: {formatBytes(safeNumber(metrics.storage?.batchExportDirectorySize))} / {safeNumber(metrics.storage?.batchExportFileCount)} {t('metrics.filesUnit')}
        </p>
        {ocrRuntime?.notes && <p className="text-xs opacity-60 mt-2">{ocrRuntime.notes}</p>}
        {metrics.operations?.ocr?.recent && metrics.operations.ocr.recent.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium opacity-80 mb-3">{t('metrics.ocrRecentResults')}</p>
            <div className="space-y-2">
              {metrics.operations.ocr.recent.slice(-3).reverse().map((entry, index) => (
                <div key={`${entry.timestamp || 'ocr'}-${index}`} className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="font-semibold break-words">{entry.fileName || entry.source || t('metrics.ocrRecentUnknown')}</p>
                    <span className="opacity-70">{entry.success ? t('metrics.successes') : t('metrics.failures')}</span>
                  </div>
                  <p className="opacity-80 break-words">
                    {(entry.engine || t('metrics.none'))}
                    {entry.variant ? ` | ${entry.variant}` : ''}
                    {entry.psm ? ` | PSM ${entry.psm}` : ''}
                  </p>
                  <p className="opacity-70">
                    {t('metrics.ocrRecentStats', {
                      pages: safeNumber(entry.ocrPageCount ?? entry.pages),
                      textLength: safeNumber(entry.textLength),
                      duration: Math.round(safeNumber(entry.extractionTimeMs) / 1000)
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
