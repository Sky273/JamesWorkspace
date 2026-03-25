/**
 * Health Indicator Component
 * Shows system health status in the header (admin only)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateFormatter';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import { SignalIcon } from '@heroicons/react/24/outline';

interface HealthCheck {
  status: string;
  error?: string;
  latency?: string;
  size?: string;
  tables?: Record<string, number>;
}

interface CacheDetails {
  size?: number;
  maxSize?: number;
  ttlMinutes?: number;
  ttlHours?: number;
  ageMs?: number | null;
  hasData?: boolean;
  hasFilterOptions?: boolean;
  hasSummary?: boolean;
}

interface MemoryStats {
  timestamp: string;
  process: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
    external: string;
    arrayBuffers: string;
  };
  caches: {
    simpleCache: { estimated: string; details: { settings: number; templates: number; firms: number } };
    trends: { estimated: string; details: CacheDetails };
    facts: { estimated: string; details: CacheDetails };
    metiers: { estimated: string; details: CacheDetails };
    esco: { estimated: string; details: CacheDetails };
    tags: { estimated: string; details: { cleanedTags: { hasData: boolean; ageMs: number | null }; escoTags: { hasData: boolean; ageMs: number | null }; ttlMinutes: number } };
    security: { estimated: string; details: { blacklistedTokens: number; blacklistedUsers: number } };
  };
  summary: {
    totalCacheEntries: number;
    gcAvailable: boolean;
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime?: string;
  timestamp?: string;
  checks?: {
    server?: { status: string; uptime?: string };
    database?: HealthCheck;
    memory?: { status: string; heapUsed?: string; heapTotal?: string; percentage?: number };
    cache?: HealthCheck;
    apiKeys?: { status: string; openai?: boolean; anthropic?: boolean };
  };
  issues?: string[];
}

interface HealthIndicatorProps {
  showAlways?: boolean;
  variant?: 'default' | 'header';
}

const HealthIndicator = ({ showAlways = false, variant = 'default' }: HealthIndicatorProps): JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus>({ status: 'unknown' });
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isHeader = variant === 'header';

  const isAdmin = user?.role === 'admin';

  const fetchMemoryStats = async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/health/memory', createAuthOptions({ method: 'GET' }));
      if (response.ok) {
        const data = await response.json();
        setMemoryStats(data);
      }
    } catch {
      // Silently fail - memory stats are optional
    }
  };

  const fetchHealth = async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/health', createAuthOptions({ method: 'GET' }));
      if (response.ok) {
        const data = await response.json();

        const issues: string[] = [];

        if (data.checks?.database?.status === 'error') {
          issues.push(`Base de données : ${data.checks.database.error || 'Connexion échouée'}`);
        }
        if (data.checks?.memory?.percentage && data.checks.memory.percentage > 90) {
          issues.push(`Mémoire critique : ${data.checks.memory.percentage.toFixed(0)}% utilisée`);
        }
        if (data.checks?.cache?.status === 'error') {
          issues.push(`Cache : ${data.checks.cache.error || 'Erreur'}`);
        }
        if (data.checks?.apiKeys?.status === 'warning') {
          const missing = [];
          if (!data.checks.apiKeys.openai) missing.push('OpenAI');
          if (!data.checks.apiKeys.anthropic) missing.push('Anthropic');
          if (missing.length > 0) {
            issues.push(`Clés API manquantes : ${missing.join(', ')}`);
          }
        }

        setHealth({
          status: data.status || 'unknown',
          responseTime: data.responseTime,
          timestamp: data.timestamp,
          checks: data.checks,
          issues,
        });
      } else {
        const errorText = await response.text().catch(() => 'Erreur inconnue');
        setHealth({
          status: 'unhealthy',
          issues: [`Serveur inaccessible (${response.status}) : ${errorText.substring(0, 100)}`],
        });
      }
    } catch (error) {
      setHealth({
        status: 'unhealthy',
        issues: [`Impossible de contacter le serveur : ${error instanceof Error ? error.message : 'Erreur réseau'}`],
      });
    }
  };

  useEffect(() => {
    if (isAdmin || showAlways) {
      fetchHealth();
      fetchMemoryStats();
      const interval = setInterval(() => {
        fetchHealth();
        fetchMemoryStats();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, showAlways]);

  useEffect(() => {
    if (isHovered || isExpanded) {
      fetchHealth();
      fetchMemoryStats();
    }
  }, [isHovered, isExpanded]);

  if (!isAdmin && !showAlways) {
    return null;
  }

  const getStatusColor = (): string => {
    switch (health.status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (): string => {
    switch (health.status) {
      case 'healthy':
        return t('health.healthy', 'Système OK');
      case 'degraded':
        return t('health.degraded', 'Dégradé');
      case 'unhealthy':
        return t('health.unhealthy', 'Problème');
      default:
        return t('health.unknown', 'Vérification...');
    }
  };

  const getCheckIcon = (status?: string): string => {
    if (status === 'ok' || status === 'healthy') return '✓';
    if (status === 'warning' || status === 'degraded') return '⚠';
    if (status === 'error' || status === 'unhealthy') return '✕';
    return '?';
  };

  const getCheckColor = (status?: string): string => {
    if (status === 'ok' || status === 'healthy') return 'text-green-500';
    if (status === 'warning' || status === 'degraded') return 'text-yellow-500';
    if (status === 'error' || status === 'unhealthy') return 'text-red-500';
    return 'text-gray-400';
  };

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
        <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor()} ${health.status !== 'healthy' ? 'animate-pulse' : ''}`} />
        <span className={isHeader ? 'hidden text-xs text-slate-600 dark:text-slate-300 sm:inline' : 'hidden text-xs text-gray-500 dark:text-gray-400 sm:inline'}>
          {getStatusText()}
        </span>
        {health.issues && health.issues.length > 0 && (
          <span className="text-xs font-medium text-red-500">({health.issues.length})</span>
        )}
      </div>

      {(isHovered || isExpanded) && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm">
            <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {t('health.systemHealth', 'État du système')}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  health.status === 'healthy'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : health.status === 'degraded'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                }`}
              >
                {getStatusText()}
              </span>
            </div>

            {health.issues && health.issues.length > 0 && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-900/20">
                <div className="mb-1 text-xs font-medium text-red-700 dark:text-red-300">
                  {t('health.issues', 'Problèmes détectés')}:
                </div>
                <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
                  {health.issues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="mt-0.5 text-red-500">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {health.responseTime && (
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{t('health.responseTime', 'Latence')}</span>
                <span className="font-mono">{health.responseTime}</span>
              </div>
            )}

            <div className="space-y-2">
              {health.checks?.server && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{t('health.server', 'Serveur')}</span>
                  <div className="flex items-center gap-2">
                    {health.checks.server.uptime && (
                      <span className="font-mono text-[10px] text-gray-400">{health.checks.server.uptime}</span>
                    )}
                    <span className={getCheckColor(health.checks.server.status)}>{getCheckIcon(health.checks.server.status)}</span>
                  </div>
                </div>
              )}

              {health.checks?.database && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{t('health.database', 'Base de données')}</span>
                  <div className="flex items-center gap-2">
                    {health.checks.database.latency && (
                      <span className="font-mono text-[10px] text-gray-400">{health.checks.database.latency}</span>
                    )}
                    {health.checks.database.size && (
                      <span className="font-mono text-[10px] text-gray-400">{health.checks.database.size}</span>
                    )}
                    <span className={getCheckColor(health.checks.database.status)}>{getCheckIcon(health.checks.database.status)}</span>
                  </div>
                </div>
              )}

              {health.checks?.memory && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{t('health.memory', 'Mémoire')}</span>
                  <div className="flex items-center gap-2">
                    {health.checks.memory.heapUsed && health.checks.memory.heapTotal && (
                      <span className="font-mono text-[10px] text-gray-400">
                        {health.checks.memory.heapUsed}/{health.checks.memory.heapTotal}
                      </span>
                    )}
                    <span className={getCheckColor(health.checks.memory.status)}>{getCheckIcon(health.checks.memory.status)}</span>
                  </div>
                </div>
              )}

              <div className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('health.cache', 'Cache')}</span>
                  <div className="flex items-center gap-2">
                    {memoryStats && (
                      <span className="font-mono text-[10px] text-gray-400">
                        {memoryStats.summary.totalCacheEntries} entrées
                      </span>
                    )}
                    <span className={getCheckColor(health.checks?.cache?.status || 'ok')}>
                      {getCheckIcon(health.checks?.cache?.status || 'ok')}
                    </span>
                  </div>
                </div>

                {memoryStats && (
                  <div className="mt-2 ml-2 space-y-1.5 border-l-2 border-gray-200 pl-2 dark:border-gray-600">
                    <div className="border-b border-gray-100 pb-1 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <span className="font-medium">Processus:</span> {memoryStats.process.heapUsed} / {memoryStats.process.heapTotal}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Settings/Templates/Firms</span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {memoryStats.caches.simpleCache.details.settings}/{memoryStats.caches.simpleCache.details.templates}/{memoryStats.caches.simpleCache.details.firms}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Tendances</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">{memoryStats.caches.trends.details.size || 0}</span>
                        <span className="text-gray-400">/ {memoryStats.caches.trends.details.maxSize}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Faits marché</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">{memoryStats.caches.facts.details.size || 0}</span>
                        <span className="text-gray-400">/ {memoryStats.caches.facts.details.maxSize}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Métiers ROME</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">{memoryStats.caches.metiers.details.size || 0}</span>
                        <span className="text-gray-400">/ {memoryStats.caches.metiers.details.maxSize}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">ESCO</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">{memoryStats.caches.esco.details.size || 0}</span>
                        <span className="text-gray-400">/ {memoryStats.caches.esco.details.maxSize}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Tags</span>
                      <div className="flex items-center gap-1">
                        <span className={memoryStats.caches.tags.details.cleanedTags.hasData ? 'text-green-500' : 'text-gray-400'}>
                          C{memoryStats.caches.tags.details.cleanedTags.hasData ? '✓' : '○'}
                        </span>
                        <span className={memoryStats.caches.tags.details.escoTags.hasData ? 'text-green-500' : 'text-gray-400'}>
                          E{memoryStats.caches.tags.details.escoTags.hasData ? '✓' : '○'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Sécurité (blacklist)</span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {memoryStats.caches.security.details.blacklistedTokens} tokens, {memoryStats.caches.security.details.blacklistedUsers} users
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-1 dark:border-gray-700">
                      <span className="text-gray-500 dark:text-gray-400">Garbage Collector</span>
                      <span className={memoryStats.summary.gcAvailable ? 'text-green-500' : 'text-gray-400'}>
                        {memoryStats.summary.gcAvailable ? 'Disponible' : 'Non exposé'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {health.checks?.apiKeys && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{t('health.apiKeys', 'Clés API')}</span>
                  <div className="flex items-center gap-1">
                    <span className={health.checks.apiKeys.openai ? 'text-green-500' : 'text-red-500'} title="OpenAI">
                      O{health.checks.apiKeys.openai ? '✓' : '✕'}
                    </span>
                    <span className={health.checks.apiKeys.anthropic ? 'text-green-500' : 'text-red-500'} title="Anthropic">
                      A{health.checks.apiKeys.anthropic ? '✓' : '✕'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {health.timestamp && (
              <div className="mt-3 border-t border-gray-200 pt-2 text-[10px] text-gray-400 dark:border-gray-700">
                {t('health.lastCheck', 'Dernière vérification')}: {formatDateTime(health.timestamp)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthIndicator;
