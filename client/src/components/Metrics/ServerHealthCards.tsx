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
  cacheBackendMessage?: string | null;
  cacheBackendBreakdown?: Record<string, {
    caches?: number;
    activityScore?: number;
    size?: number;
  }> | null;
  applicationCacheActive?: boolean;
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
  cacheBackendMessage,
  cacheBackendBreakdown,
  applicationCacheActive,
  t,
  safeNumber,
  formatBytes,
  formatNumber
}: ServerHealthCardsProps): JSX.Element {
  const actualCacheHitRate = safeNumber(cacheSummary?.hitRate, safeNumber(metrics?.cache?.hitRate));
  const actualCacheHits = safeNumber(cacheSummary?.hits, safeNumber(metrics?.cache?.hits));
  const actualCacheMisses = safeNumber(cacheSummary?.misses, safeNumber(metrics?.cache?.misses));
  const actualCacheSize = safeNumber(cacheSummary?.size);
  const effectiveCacheBackendLabel = cacheBackend === 'memory'
    ? t('metrics.cacheBackendMemory', 'Mémoire locale')
    : cacheBackend === 'redis'
      ? 'Redis'
      : cacheBackend === 'mixed'
        ? t('metrics.cacheBackendMixed', 'Mixte')
        : cacheBackend;
  const configuredCacheBackendLabel = configuredCacheBackend === 'memory'
    ? t('metrics.cacheBackendMemory', 'Mémoire locale')
    : configuredCacheBackend === 'redis'
      ? 'Redis'
      : configuredCacheBackend;
  const memoryBreakdown = cacheBackendBreakdown?.memory;
  const redisBreakdown = cacheBackendBreakdown?.redis;
  const cacheModeLabel = applicationCacheActive
    ? effectiveCacheBackendLabel
    : t('metrics.notApplicable');
  const cacheModeTone = cacheBackend === 'memory'
    ? 'text-amber-700 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/30'
    : cacheBackend === 'redis'
      ? 'text-green-700 bg-green-100 dark:text-green-200 dark:bg-green-900/30'
      : 'text-slate-700 bg-slate-100 dark:text-slate-200 dark:bg-slate-700/40';

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
        <div className="mb-4 rounded-xl border border-green-200/70 bg-white/70 p-4 text-sm text-slate-700 shadow-sm dark:border-green-900/40 dark:bg-slate-900/40 dark:text-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cacheModeTone}`}>
              {t('metrics.applicationCacheMode', 'Mode cache applicatif')}: {cacheModeLabel}
            </span>
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('metrics.configuredCacheBackend')}: {configuredCacheBackendLabel}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {cacheBackendMessage || t('metrics.cacheBackendMessageFallback', 'Aucun diagnostic détaillé disponible pour le cache applicatif.')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheHits')}</p><p className="font-semibold">{formatNumber(actualCacheHits)}</p></div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheMisses')}</p><p className="font-semibold">{formatNumber(actualCacheMisses)}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mt-4 xl:grid-cols-4">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.configuredCacheBackend')}</p>
            <p className="font-semibold">{configuredCacheBackendLabel}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.effectiveCacheBackend')}</p>
            <p className="font-semibold">{effectiveCacheBackendLabel}</p>
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
        <div className="grid grid-cols-2 gap-4 text-sm mt-4 xl:grid-cols-4">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheMemoryCaches', 'Caches mémoire actifs')}</p>
            <p className="font-semibold">{formatNumber(safeNumber(memoryBreakdown?.caches))}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheMemoryEntries', 'Entrées mémoire')}</p>
            <p className="font-semibold">{formatNumber(safeNumber(memoryBreakdown?.size))}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheRedisCaches', 'Caches Redis actifs')}</p>
            <p className="font-semibold">{formatNumber(safeNumber(redisBreakdown?.caches))}</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.cacheRedisEntries', 'Entrées Redis')}</p>
            <p className="font-semibold">{formatNumber(safeNumber(redisBreakdown?.size))}</p>
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
