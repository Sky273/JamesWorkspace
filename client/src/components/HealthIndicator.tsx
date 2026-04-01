import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SignalIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateFormatter';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import { IndicatorRow, SectionTitle, StatusBadge } from './HealthIndicator.parts';
import {
  PROVIDERS,
  buildIssues,
  formatBooleanMeta,
  getAdvancedOcrMeta,
  getMemoryStatus,
  getMemorySummary,
  getOverallHealthStatus,
  getStatusTone,
  tr,
  type CacheAdminMetrics,
  type CircuitBreakerMap,
  type HealthStatus,
} from './HealthIndicator.utils';

interface HealthIndicatorProps {
  showAlways?: boolean;
  variant?: 'default' | 'header';
}

const HealthIndicator = ({
  showAlways = false,
  variant = 'default',
}: HealthIndicatorProps): JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus>({ status: 'unknown' });
  const [cacheMetrics, setCacheMetrics] = useState<CacheAdminMetrics | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerMap>({});
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isHeader = variant === 'header';
  const isAdmin = user?.role === 'admin';
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const tf = (key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const refreshStatus = useCallback(async (): Promise<void> => {
    const translate = tRef.current;
    const [healthResult, cacheResult, breakerResult] = await Promise.allSettled([
      fetchWithAuth('/health', createAuthOptions({ method: 'GET' })),
      fetchWithAuth('/api/admin/cache-stats', createAuthOptions({ method: 'GET' })),
      fetchWithAuth('/api/llm/circuit-breakers', createAuthOptions({ method: 'GET' })),
    ]);

    let nextHealth: HealthStatus = { status: 'unknown' };
    let nextCache: CacheAdminMetrics | null = null;
    let nextBreakers: CircuitBreakerMap = {};

    if (healthResult.status === 'fulfilled') {
      if (healthResult.value?.ok) {
        const data = await healthResult.value.json();
        nextHealth = {
          status: data.status || 'unknown',
          responseTime: data.responseTime,
          timestamp: data.timestamp,
          checks: data.checks,
        };
      } else {
        const errorText =
          (await healthResult.value?.text?.().catch(() => 'Erreur inconnue')) || 'Erreur inconnue';
        nextHealth = {
          status: 'unhealthy',
          issues: [
            tr(
              translate,
              'health.serverUnavailable',
              `Serveur inaccessible (${healthResult.value?.status || 'unknown'}): ${errorText.substring(0, 100)}`,
              {
                status: healthResult.value?.status || 'unknown',
                message: errorText.substring(0, 100),
              },
            ),
          ],
        };
      }
    } else {
      nextHealth = {
        status: 'unhealthy',
        issues: [
          `Impossible de contacter le serveur: ${healthResult.reason instanceof Error ? healthResult.reason.message : 'erreur réseau'}`,
        ],
      };
    }

    if (cacheResult.status === 'fulfilled' && cacheResult.value?.ok) {
      nextCache = await cacheResult.value.json();
    }

    if (breakerResult.status === 'fulfilled' && breakerResult.value?.ok) {
      nextBreakers = await breakerResult.value.json();
    }

    nextHealth.issues = nextHealth.issues?.length
      ? nextHealth.issues
      : buildIssues(translate, nextHealth, nextCache?.cacheBackend || null);

    setHealth(nextHealth);
    setCacheMetrics(nextCache);
    setCircuitBreakers(nextBreakers);
  }, []);

  useEffect(() => {
    if (isAdmin || showAlways) {
      void refreshStatus();
      const interval = setInterval(() => {
        void refreshStatus();
      }, 60000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isAdmin, refreshStatus, showAlways]);

  useEffect(() => {
    if (isHovered || isExpanded) {
      void refreshStatus();
    }
  }, [isExpanded, isHovered, refreshStatus]);

  if (!isAdmin && !showAlways) {
    return null;
  }

  const cacheBackend = cacheMetrics?.cacheBackend || null;
  const issueCount = health.issues?.length || 0;
  const overallStatus = getOverallHealthStatus(health, cacheBackend, circuitBreakers);
  const memorySummary = getMemorySummary(health.checks?.memory);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsExpanded(false);
      }}
    >
      <div
        className={
          isHeader
            ? 'group flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3.5 py-2 text-slate-600 shadow-sm shadow-slate-200/50 transition-all hover:-translate-y-px hover:border-slate-300 dark:border-white/8 dark:bg-white/[0.045] dark:text-slate-300 dark:shadow-none dark:hover:border-white/12 dark:hover:bg-white/[0.08]'
            : 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700'
        }
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <SignalIcon
          className={
            isHeader
              ? 'h-[18px] w-[18px] stroke-2 text-slate-400 transition-colors duration-200 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
              : 'h-4 w-4 text-gray-400 dark:text-gray-500'
          }
          aria-hidden="true"
        />
        <span
          className={`h-2.5 w-2.5 rounded-full ${getStatusTone(overallStatus)} ${overallStatus !== 'healthy' ? 'animate-pulse' : ''}`}
        />
        <span
          className={
            isHeader
              ? 'hidden text-xs text-slate-600 dark:text-slate-300 sm:inline'
              : 'hidden text-xs text-gray-500 dark:text-gray-400 sm:inline'
          }
        >
          {overallStatus === 'healthy'
            ? tf('health.healthy', 'Système OK')
            : overallStatus === 'degraded'
              ? tf('health.degraded', 'Dégradé')
              : overallStatus === 'unhealthy'
                ? tf('health.unhealthy', 'Problème')
                : tf('health.unknown', 'Vérification...')}
        </span>
        {memorySummary ? (
          <span
            className={
              isHeader
                ? 'hidden text-[11px] text-slate-500 dark:text-slate-400 sm:inline'
                : 'hidden text-[11px] text-gray-500 dark:text-gray-400 sm:inline'
            }
          >
            {tf('health.memoryShort', 'Mémoire')}: {memorySummary}
          </span>
        ) : null}
        {issueCount > 0 ? <span className="text-xs font-medium text-red-500">({issueCount})</span> : null}
      </div>

      {(isHovered || isExpanded) && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[28rem] rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {tf('health.systemHealth', 'État du système')}
              </span>
              <StatusBadge t={t} status={overallStatus} />
            </div>

            {issueCount > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="mb-1 text-xs font-medium text-red-700 dark:text-red-300">
                  {tf('health.issues', 'Problèmes détectés')}
                </div>
                <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
                  {health.issues?.map((issue, index) => (
                    <li key={`${issue}-${index}`}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <SectionTitle title={tf('health.platform', 'Plateforme')} />
              <IndicatorRow
                label={tf('health.server', 'Serveur')}
                meta={health.checks?.server?.uptime || null}
                status={health.checks?.server?.status}
                t={t}
              />
              <IndicatorRow
                label={tf('health.database', 'Base de données')}
                meta={health.checks?.database?.latency || null}
                status={health.checks?.database?.status}
              />
              <IndicatorRow
                label={tf('health.memory', 'Mémoire')}
                meta={memorySummary}
                status={getMemoryStatus(health.checks?.memory)}
              />
              <IndicatorRow
                label={tf('health.responseTime', 'Latence')}
                meta={health.responseTime || null}
                status={overallStatus === 'healthy' ? 'ok' : overallStatus}
                t={t}
              />
            </div>

            <div className="space-y-2">
              <SectionTitle title={tf('health.cacheSection', 'Cache')} />
              <IndicatorRow
                label={tf('health.backend', 'Backend')}
                meta={cacheBackend?.backend || health.checks?.cache?.backend || 'unknown'}
                status={health.checks?.cache?.status || 'ok'}
                t={t}
              />
              <IndicatorRow
                label={tf('health.redisConnection', 'Connexion Redis')}
                meta={
                  cacheBackend?.connected === null
                    ? tf('health.notApplicable', 'n/a')
                    : cacheBackend?.connected
                      ? tf('health.yes', 'oui')
                      : tf('health.no', 'non')
                }
                status={cacheBackend?.connected === false ? 'warning' : 'ok'}
                t={t}
              />
              <IndicatorRow
                label={tf('health.namespaces', 'Namespaces')}
                meta={
                  health.checks?.cache
                    ? `${health.checks.cache.settings || 0}/${health.checks.cache.templates || 0}/${health.checks.cache.firms || 0}`
                    : null
                }
                status="ok"
                t={t}
              />
              {cacheBackend?.fallbackReason ? (
                <div className="text-xs text-amber-600 dark:text-amber-300">
                  {tf('health.fallback', 'Fallback')}: {cacheBackend.fallbackReason}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <SectionTitle title={tf('health.ocrSection', 'OCR')} />
              <IndicatorRow
                label={tf('health.ocrPipeline', 'Pipeline')}
                meta={health.checks?.ocr?.preferredEngine || health.checks?.ocr?.message || null}
                status={health.checks?.ocr?.status}
                t={t}
              />
              <IndicatorRow
                label="tesseract"
                meta={formatBooleanMeta(health.checks?.ocr?.tesseractCliAvailable, tf('health.yes', 'oui'), tf('health.no', 'non'))}
                status={health.checks?.ocr?.tesseractCliAvailable ? 'ok' : 'warning'}
                t={t}
              />
              <IndicatorRow
                label="pdftoppm"
                meta={formatBooleanMeta(health.checks?.ocr?.pdftoppmAvailable, tf('health.yes', 'oui'), tf('health.no', 'non'))}
                status={health.checks?.ocr?.pdftoppmAvailable ? 'ok' : 'warning'}
                t={t}
              />
              <IndicatorRow
                label={tf('health.pythonRuntime', 'Python')}
                meta={health.checks?.ocr?.pythonCommand || tf('health.notApplicable', 'n/a')}
                status={health.checks?.ocr?.pythonCommand ? 'ok' : 'warning'}
                t={t}
              />
              <IndicatorRow
                label={tf('health.advancedOcr', 'OCR avancé')}
                meta={getAdvancedOcrMeta(t, health.checks?.ocr)}
                status={health.checks?.ocr?.advancedBackendStatus || 'not_applicable'}
                t={t}
              />
            </div>

            <div className="space-y-2">
              <SectionTitle title={tf('health.llmFamilies', 'Familles LLM')} />
              {PROVIDERS.map((provider) => {
                const providerCheck = health.checks?.[provider];
                const breaker = circuitBreakers[provider];
                const meta =
                  breaker?.supported === false
                    ? providerCheck?.message || tf('health.withoutCircuitBreaker', 'sans circuit breaker')
                    : tr(
                        t,
                        'health.providerMeta',
                        `${providerCheck?.status || 'unknown'} / CB ${breaker?.state || 'UNKNOWN'}`,
                        {
                          status: providerCheck?.status || 'unknown',
                          state: breaker?.state || 'UNKNOWN',
                        },
                      );
                const status =
                  breaker?.state?.toLowerCase() === 'open'
                    ? 'open'
                    : providerCheck?.status || breaker?.state?.toLowerCase() || 'unknown';

                return (
                  <IndicatorRow
                    key={provider}
                    label={provider}
                    meta={meta}
                    status={status}
                    t={t}
                  />
                );
              })}
            </div>

            {health.timestamp && (
              <div className="border-t border-gray-200 pt-2 text-[10px] text-gray-400 dark:border-gray-700">
                {tf('health.lastCheck', 'Dernière vérification')}: {formatDateTime(health.timestamp)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthIndicator;
