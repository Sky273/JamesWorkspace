import { motion } from 'framer-motion';
import { CircleStackIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

interface ServerHealthCardsProps {
  metrics: {
    memory?: { heapUsed?: number; heapTotal?: number; rss?: number; external?: number };
    cache?: { hitRate?: number; hits?: number; misses?: number };
  } | null;
  cacheSummary?: {
    hitRate?: number;
    hits?: number;
    misses?: number;
    sets?: number;
    invalidations?: number;
    size?: number;
    totalLookups?: number;
  } | null;
  configuredCacheBackend: string;
  cacheBackend: string;
  cacheConnected: boolean | null | undefined;
  cacheFallbackReason: string | null | undefined;
  t: TFunction;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatBytes: (value?: number) => string;
  formatNumber: (value?: number) => string;
}

export default function ServerHealthCards({
  metrics,
  cacheSummary,
  configuredCacheBackend,
  cacheBackend,
  cacheConnected,
  cacheFallbackReason,
  t,
  safeNumber,
  formatBytes,
  formatNumber
}: ServerHealthCardsProps): JSX.Element {
  const actualCacheHitRate = safeNumber(cacheSummary?.hitRate, safeNumber(metrics?.cache?.hitRate));
  const actualCacheHits = safeNumber(cacheSummary?.hits, safeNumber(metrics?.cache?.hits));
  const actualCacheMisses = safeNumber(cacheSummary?.misses, safeNumber(metrics?.cache?.misses));
  const actualCacheSize = safeNumber(cacheSummary?.size);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-gray-800 dark:text-indigo-400 dark:border-indigo-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.serverMemory')}</p>
            <p className="text-2xl font-bold mt-1">{formatBytes(safeNumber(metrics?.memory?.heapUsed))}</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.heapUsed', { total: formatBytes(safeNumber(metrics?.memory?.heapTotal)) })}</p>
          </div>
          <CpuChipIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="w-full bg-indigo-200 dark:bg-indigo-900/50 rounded-full h-2 mb-4">
          <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${safeNumber(metrics?.memory?.heapTotal) > 0 ? (safeNumber(metrics?.memory?.heapUsed) / safeNumber(metrics?.memory?.heapTotal)) * 100 : 0}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.rss')}</p><p className="font-semibold">{formatBytes(safeNumber(metrics?.memory?.rss))}</p></div>
          <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.external')}</p><p className="font-semibold">{formatBytes(safeNumber(metrics?.memory?.external))}</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-green-50 text-green-600 border-green-200 dark:bg-gray-800 dark:text-green-400 dark:border-green-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.cachePerformance')}</p>
            <p className="text-2xl font-bold mt-1">{(actualCacheHitRate * 100).toFixed(1)}%</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.cacheHitRate')}</p>
          </div>
          <CircleStackIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheHits')}</p><p className="font-semibold">{formatNumber(actualCacheHits)}</p></div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheMisses')}</p><p className="font-semibold">{formatNumber(actualCacheMisses)}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mt-4 xl:grid-cols-4">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.configuredCacheBackend')}</p>
            <p className="font-semibold uppercase">{configuredCacheBackend}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.effectiveCacheBackend')}</p>
            <p className="font-semibold uppercase">{cacheBackend}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheConnected')}</p>
            <p className="font-semibold">
              {cacheConnected === null || cacheConnected === undefined
                ? t('metrics.notApplicable')
                : cacheConnected
                  ? t('common.yes', 'Oui')
                  : t('common.no', 'Non')}
            </p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheFallbackReason')}</p>
            <p className="font-semibold break-words">{cacheFallbackReason || t('metrics.none')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm mt-4">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheEntries')}</p>
            <p className="font-semibold">{formatNumber(actualCacheSize)}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheSets')}</p>
            <p className="font-semibold">{formatNumber(safeNumber(cacheSummary?.sets))}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheInvalidations')}</p>
            <p className="font-semibold">{formatNumber(safeNumber(cacheSummary?.invalidations))}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
