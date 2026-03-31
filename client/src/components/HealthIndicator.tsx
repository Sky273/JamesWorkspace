import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateFormatter';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import { SignalIcon } from '@heroicons/react/24/outline';

interface HealthCheck {
  status: string;
  message?: string;
  error?: string;
  latency?: string;
  uptime?: string;
  heapUsed?: string;
  heapTotal?: string;
  heapPercent?: string;
  backend?: string;
  connected?: boolean | null;
  fallbackReason?: string | null;
  settings?: number;
  templates?: number;
  firms?: number;
}

interface ProviderCheck {
  status: string;
  message?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime?: string;
  timestamp?: string;
  checks?: {
    server?: HealthCheck;
    database?: HealthCheck;
    memory?: HealthCheck;
    cache?: HealthCheck;
    openai?: ProviderCheck;
    anthropic?: ProviderCheck;
    deepseek?: ProviderCheck;
    glm?: ProviderCheck;
    minimax?: ProviderCheck;
    ollama?: ProviderCheck;
  };
  issues?: string[];
}

interface CacheBackendDiagnostics {
  backend: string;
  connected: boolean | null;
  fallbackReason: string | null;
}

interface CacheAdminMetrics {
  cacheBackend?: CacheBackendDiagnostics;
}

interface CircuitBreakerState {
  provider: string;
  supported: boolean;
  state: string;
  failures: number;
  lastFailureTime: string | null;
  configured?: boolean;
}

interface CircuitBreakerMap {
  [provider: string]: CircuitBreakerState;
}

interface HealthIndicatorProps {
  showAlways?: boolean;
  variant?: 'default' | 'header';
}

const PROVIDERS = ['openai', 'anthropic', 'deepseek', 'glm', 'minimax', 'ollama'] as const;

type StatusLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
const MEMORY_WARNING_MB = 300;
const MEMORY_ERROR_MB = 1024;

function tr(t: ((key: string, options?: Record<string, unknown>) => string) | undefined, key: string, fallback: string, options?: Record<string, unknown>): string {
  if (!t) return fallback;
  const translated = t(key, options);
  return translated === key ? fallback : translated;
}

function buildIssues(t: (key: string, options?: Record<string, unknown>) => string, health: HealthStatus, cacheBackend: CacheBackendDiagnostics | null): string[] {
  const issues: string[] = [];

  if (health.checks?.database?.status === 'error') {
    issues.push(`Base de données: ${health.checks.database.error || 'connexion indisponible'}`);
  }

  const memoryStatus = getMemoryStatus(health.checks?.memory);
  if (memoryStatus && memoryStatus !== 'ok') {
    const memoryLabel = health.checks?.memory?.heapPercent || health.checks?.memory?.heapUsed || memoryStatus;
    issues.push(`Mémoire: ${memoryLabel}`);
  }

  if (cacheBackend?.backend === 'memory-fallback') {
    issues.push(`Cache: fallback mémoire${cacheBackend.fallbackReason ? ` (${cacheBackend.fallbackReason})` : ''}`);
  }

  for (const provider of PROVIDERS) {
    const check = health.checks?.[provider];
    if (check?.status === 'error') {
      issues.push(tr(t, 'health.issueProvider', `${provider}: ${check.message || 'erreur provider'}`, { provider, message: check.message || 'erreur provider' }));
    }
  }

  return issues;
}

function parseMemoryValueToMb(value?: string): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(',', '.');
  const match = normalized.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (Number.isNaN(amount)) return null;

  switch (unit) {
    case 'B':
      return amount / (1024 * 1024);
    case 'KB':
      return amount / 1024;
    case 'MB':
      return amount;
    case 'GB':
      return amount * 1024;
    case 'TB':
      return amount * 1024 * 1024;
    default:
      return null;
  }
}

function getMemoryStatus(memory?: HealthCheck): 'ok' | 'warning' | 'error' | undefined {
  if (!memory) return undefined;
  const heapUsedMb = parseMemoryValueToMb(memory.heapUsed);
  if (heapUsedMb === null) {
    return memory.status as 'ok' | 'warning' | 'error' | undefined;
  }
  if (heapUsedMb > MEMORY_ERROR_MB) return 'error';
  if (heapUsedMb > MEMORY_WARNING_MB) return 'warning';
  return 'ok';
}

function normalizeStatusLevel(status?: string): StatusLevel {
  switch (status) {
    case 'ok':
    case 'healthy':
    case 'configured':
    case 'closed':
    case 'not_applicable':
      return 'healthy';
    case 'warning':
    case 'degraded':
    case 'slow':
    case 'half_open':
      return 'degraded';
    case 'error':
    case 'unhealthy':
    case 'open':
    case 'not_configured':
      return 'unhealthy';
    default:
      return 'unknown';
  }
}

function getWorstStatus(current: StatusLevel, next: StatusLevel): StatusLevel {
  const rank: Record<StatusLevel, number> = {
    healthy: 0,
    unknown: 1,
    degraded: 2,
    unhealthy: 3
  };

  return rank[next] > rank[current] ? next : current;
}

function hasAtLeastOneConfiguredLlm(health: HealthStatus, circuitBreakers: CircuitBreakerMap): boolean {
  return PROVIDERS.some((provider) => {
    const providerStatus = health.checks?.[provider]?.status;
    const breakerState = circuitBreakers[provider]?.state?.toLowerCase();

    const providerConfigured = providerStatus === 'configured' || providerStatus === 'ok' || providerStatus === 'healthy';
    const breakerUsable = !breakerState || breakerState === 'closed' || breakerState === 'half_open' || breakerState === 'not_applicable';

    return providerConfigured && breakerUsable;
  });
}

function getOverallHealthStatus(health: HealthStatus, cacheBackend: CacheBackendDiagnostics | null, circuitBreakers: CircuitBreakerMap): StatusLevel {
  let overall = health.checks?.server?.status
    ? normalizeStatusLevel(health.checks.server.status)
    : normalizeStatusLevel(health.status);

  overall = getWorstStatus(overall, normalizeStatusLevel(health.checks?.database?.status));
  overall = getWorstStatus(overall, normalizeStatusLevel(getMemoryStatus(health.checks?.memory)));
  overall = getWorstStatus(overall, normalizeStatusLevel(health.checks?.cache?.status));

  if (cacheBackend?.backend === 'memory-fallback' || cacheBackend?.connected === false) {
    overall = getWorstStatus(overall, 'degraded');
  }

  const hasConfiguredLlm = hasAtLeastOneConfiguredLlm(health, circuitBreakers);

  if (!hasConfiguredLlm) {
    for (const provider of PROVIDERS) {
      overall = getWorstStatus(overall, normalizeStatusLevel(health.checks?.[provider]?.status));
      overall = getWorstStatus(overall, normalizeStatusLevel(circuitBreakers[provider]?.state?.toLowerCase()));
    }
  }

  return overall;
}

function getMemorySummary(memory?: HealthCheck): string | null {
  if (!memory) return null;
  if (memory.heapUsed && memory.heapTotal) {
    return `${memory.heapUsed} / ${memory.heapTotal}`;
  }
  if (memory.heapPercent && memory.heapUsed) {
    return `${memory.heapUsed} (${memory.heapPercent})`;
  }
  return memory.heapPercent || memory.heapUsed || memory.heapTotal || null;
}

function getStatusTone(status?: string): string {
  switch (status) {
    case 'ok':
    case 'healthy':
    case 'configured':
    case 'closed':
    case 'not_applicable':
      return 'bg-green-500';
    case 'warning':
    case 'degraded':
    case 'slow':
    case 'half_open':
      return 'bg-yellow-500';
    case 'error':
    case 'unhealthy':
    case 'open':
    case 'not_configured':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

function getStatusLabel(t?: (key: string) => string, status?: string): string {
  const translate = t || ((key: string) => key);
  switch (status) {
    case 'ok':
    case 'healthy':
      return tr(translate, 'health.status.ok', 'OK');
    case 'configured':
      return tr(translate, 'health.status.configured', 'Config');
    case 'slow':
      return tr(translate, 'health.status.slow', 'Lent');
    case 'warning':
    case 'degraded':
    case 'half_open':
      return tr(translate, 'health.status.warning', 'Alerte');
    case 'error':
    case 'unhealthy':
      return tr(translate, 'health.status.error', 'Erreur');
    case 'open':
      return tr(translate, 'health.status.open', 'Ouvert');
    case 'closed':
      return 'Fermé';
    case 'not_configured':
      return tr(translate, 'health.status.notConfigured', 'Absent');
    case 'not_applicable':
      return tr(translate, 'health.status.notApplicable', 'N/A');
    default:
      return tr(translate, 'health.status.unknown', 'Inconnu');
  }
}

function statusBadge(t: ((key: string) => string) | undefined, status?: string): JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${getStatusTone(status)}`}>
      {getStatusLabel(t, status)}
    </span>
  );
}

function IndicatorRow({ label, meta, status, t }: { label: string; meta?: string | null; status?: string; t?: (key: string) => string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {meta ? <span className="font-mono text-[10px] text-gray-400">{meta}</span> : null}
        {statusBadge(t, status)}
      </div>
    </div>
  );
}

const HealthIndicator = ({ showAlways = false, variant = 'default' }: HealthIndicatorProps): JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus>({ status: 'unknown' });
  const [cacheMetrics, setCacheMetrics] = useState<CacheAdminMetrics | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerMap>({});
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isHeader = variant === 'header';
  const isAdmin = user?.role === 'admin';

  const tf = (key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const refreshStatus = async (): Promise<void> => {
    const [healthResult, cacheResult, breakerResult] = await Promise.allSettled([
      fetchWithAuth('/health', createAuthOptions({ method: 'GET' })),
      fetchWithAuth('/api/admin/cache-stats', createAuthOptions({ method: 'GET' })),
      fetchWithAuth('/api/llm/circuit-breakers', createAuthOptions({ method: 'GET' }))
    ]);

    let nextHealth: HealthStatus = { status: 'unknown' };
    let nextCache: CacheAdminMetrics | null = null;
    let nextBreakers: CircuitBreakerMap = {};

    if (healthResult.status === 'fulfilled') {
      if (healthResult.value.ok) {
        const data = await healthResult.value.json();
        nextHealth = {
          status: data.status || 'unknown',
          responseTime: data.responseTime,
          timestamp: data.timestamp,
          checks: data.checks
        };
      } else {
        const errorText = await healthResult.value.text().catch(() => 'Erreur inconnue');
        nextHealth = {
          status: 'unhealthy',
          issues: [tr(t, 'health.serverUnavailable', `Serveur inaccessible (${healthResult.value.status}): ${errorText.substring(0, 100)}`, { status: healthResult.value.status, message: errorText.substring(0, 100) })]
        };
      }
    } else {
      nextHealth = {
        status: 'unhealthy',
        issues: [`Impossible de contacter le serveur: ${healthResult.reason instanceof Error ? healthResult.reason.message : 'erreur réseau'}`]
      };
    }

    if (cacheResult.status === 'fulfilled' && cacheResult.value.ok) {
      nextCache = await cacheResult.value.json();
    }

    if (breakerResult.status === 'fulfilled' && breakerResult.value.ok) {
      nextBreakers = await breakerResult.value.json();
    }

    nextHealth.issues = nextHealth.issues?.length ? nextHealth.issues : buildIssues(t, nextHealth, nextCache?.cacheBackend || null);
    setHealth(nextHealth);
    setCacheMetrics(nextCache);
    setCircuitBreakers(nextBreakers);
  };

  useEffect(() => {
    if (isAdmin || showAlways) {
      void refreshStatus();
      const interval = setInterval(() => {
        void refreshStatus();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, showAlways]);

  useEffect(() => {
    if (isHovered || isExpanded) {
      void refreshStatus();
    }
  }, [isHovered, isExpanded]);

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
        className={isHeader
          ? 'group flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3.5 py-2 text-slate-600 shadow-sm shadow-slate-200/50 transition-all hover:-translate-y-px hover:border-slate-300 dark:border-white/8 dark:bg-white/[0.045] dark:text-slate-300 dark:shadow-none dark:hover:border-white/12 dark:hover:bg-white/[0.08]'
          : 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700'}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <SignalIcon
          className={isHeader
            ? 'h-[18px] w-[18px] stroke-2 text-slate-400 transition-colors duration-200 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
            : 'h-4 w-4 text-gray-400 dark:text-gray-500'}
          aria-hidden="true"
        />
        <span className={`h-2.5 w-2.5 rounded-full ${getStatusTone(overallStatus)} ${overallStatus !== 'healthy' ? 'animate-pulse' : ''}`} />
        <span className={isHeader ? 'hidden text-xs text-slate-600 dark:text-slate-300 sm:inline' : 'hidden text-xs text-gray-500 dark:text-gray-400 sm:inline'}>
          {overallStatus === 'healthy'
            ? tf('health.healthy', 'Système OK')
            : overallStatus === 'degraded'
              ? tf('health.degraded', 'Dégradé')
              : overallStatus === 'unhealthy'
                ? tf('health.unhealthy', 'Problème')
                : tf('health.unknown', 'Vérification...')}
        </span>
        {memorySummary ? (
          <span className={isHeader ? 'hidden text-[11px] text-slate-500 dark:text-slate-400 sm:inline' : 'hidden text-[11px] text-gray-500 dark:text-gray-400 sm:inline'}>
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
              {statusBadge(t, overallStatus)}
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
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {tf('health.platform', 'Plateforme')}
              </div>
              <IndicatorRow label={tf('health.server', 'Serveur')} meta={health.checks?.server?.uptime || null} status={health.checks?.server?.status} t={t} />
              <IndicatorRow label={tf('health.database', 'Base de données')} meta={health.checks?.database?.latency || null} status={health.checks?.database?.status} />
              <IndicatorRow label={tf('health.memory', 'Mémoire')} meta={memorySummary} status={getMemoryStatus(health.checks?.memory)} />
              <IndicatorRow label={tf('health.responseTime', 'Latence')} meta={health.responseTime || null} status={overallStatus === 'healthy' ? 'ok' : overallStatus} t={t} />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {tf('health.cacheSection', 'Cache')}
              </div>
              <IndicatorRow label={tf('health.backend', 'Backend')} meta={cacheBackend?.backend || health.checks?.cache?.backend || 'unknown'} status={health.checks?.cache?.status || 'ok'} t={t} />
              <IndicatorRow label={tf('health.redisConnection', 'Connexion Redis')} meta={cacheBackend?.connected === null ? tf('health.notApplicable', 'n/a') : cacheBackend?.connected ? tf('health.yes', 'oui') : tf('health.no', 'non')} status={cacheBackend?.connected === false ? 'warning' : 'ok'} t={t} />
              <IndicatorRow label={tf('health.namespaces', 'Namespaces')} meta={health.checks?.cache ? `${health.checks.cache.settings || 0}/${health.checks.cache.templates || 0}/${health.checks.cache.firms || 0}` : null} status='ok' t={t} />
              {cacheBackend?.fallbackReason ? (
                <div className="text-xs text-amber-600 dark:text-amber-300">
                  {tf('health.fallback', 'Fallback')}: {cacheBackend.fallbackReason}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {tf('health.llmFamilies', 'Familles LLM')}
              </div>
              {PROVIDERS.map((provider) => {
                const providerCheck = health.checks?.[provider];
                const breaker = circuitBreakers[provider];
                const meta = breaker?.supported === false
                  ? providerCheck?.message || tf('health.withoutCircuitBreaker', 'sans circuit breaker')
                  : tr(t, 'health.providerMeta', `${providerCheck?.status || 'unknown'} / CB ${breaker?.state || 'UNKNOWN'}`, { status: providerCheck?.status || 'unknown', state: breaker?.state || 'UNKNOWN' });

                const status = breaker?.state?.toLowerCase() === 'open'
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
