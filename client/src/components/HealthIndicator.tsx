/**
 * Health Indicator Component
 * Shows system health status in the header (admin only)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateFormatter';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';

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
}

const HealthIndicator = ({ showAlways = false }: HealthIndicatorProps): JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus>({ status: 'unknown' });
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if user is admin
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
        
        // Collect issues from checks
        const issues: string[] = [];
        
        if (data.checks?.database?.status === 'error') {
          issues.push(`Base de données: ${data.checks.database.error || 'Connexion échouée'}`);
        }
        if (data.checks?.memory?.percentage && data.checks.memory.percentage > 90) {
          issues.push(`Mémoire critique: ${data.checks.memory.percentage.toFixed(0)}% utilisée`);
        }
        if (data.checks?.cache?.status === 'error') {
          issues.push(`Cache: ${data.checks.cache.error || 'Erreur'}`);
        }
        if (data.checks?.apiKeys?.status === 'warning') {
          const missing = [];
          if (!data.checks.apiKeys.openai) missing.push('OpenAI');
          if (!data.checks.apiKeys.anthropic) missing.push('Anthropic');
          if (missing.length > 0) {
            issues.push(`Clés API manquantes: ${missing.join(', ')}`);
          }
        }
        
        setHealth({
          status: data.status || 'unknown',
          responseTime: data.responseTime,
          timestamp: data.timestamp,
          checks: data.checks,
          issues
        });
      } else {
        const errorText = await response.text().catch(() => 'Erreur inconnue');
        setHealth({ 
          status: 'unhealthy',
          issues: [`Serveur inaccessible (${response.status}): ${errorText.substring(0, 100)}`]
        });
      }
    } catch (error) {
      setHealth({ 
        status: 'unhealthy',
        issues: [`Impossible de contacter le serveur: ${error instanceof Error ? error.message : 'Erreur réseau'}`]
      });
    }
  };

  useEffect(() => {
    // Only fetch health if admin or showAlways
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

  // Refresh data when tooltip becomes visible (hover or expand)
  useEffect(() => {
    if (isHovered || isExpanded) {
      fetchHealth();
      fetchMemoryStats();
    }
  }, [isHovered, isExpanded]);

  // Don't render if not admin (unless showAlways is true)
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
    if (status === 'error' || status === 'unhealthy') return '✗';
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
      onMouseLeave={() => { setIsHovered(false); setIsExpanded(false); }}
    >
      <div 
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} ${health.status !== 'healthy' ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          {getStatusText()}
        </span>
        {health.issues && health.issues.length > 0 && (
          <span className="text-xs text-red-500 font-medium">
            ({health.issues.length})
          </span>
        )}
      </div>

      {/* Detailed tooltip on hover or click */}
      {(isHovered || isExpanded) && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
          <div className="text-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {t('health.systemHealth', 'État du système')}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                health.status === 'healthy' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                health.status === 'degraded' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              }`}>
                {getStatusText()}
              </span>
            </div>

            {/* Issues section - show prominently if there are problems */}
            {health.issues && health.issues.length > 0 && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                  {t('health.issues', 'Problèmes détectés')}:
                </div>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                  {health.issues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Response time */}
            {health.responseTime && (
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span>{t('health.responseTime', 'Latence')}</span>
                <span className="font-mono">{health.responseTime}</span>
              </div>
            )}

            {/* Checks grid */}
            <div className="space-y-2">
              {/* Server */}
              {health.checks?.server && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('health.server', 'Serveur')}
                  </span>
                  <div className="flex items-center gap-2">
                    {health.checks.server.uptime && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        {health.checks.server.uptime}
                      </span>
                    )}
                    <span className={getCheckColor(health.checks.server.status)}>
                      {getCheckIcon(health.checks.server.status)}
                    </span>
                  </div>
                </div>
              )}

              {/* Database */}
              {health.checks?.database && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('health.database', 'Base de données')}
                  </span>
                  <div className="flex items-center gap-2">
                    {health.checks.database.latency && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        {health.checks.database.latency}
                      </span>
                    )}
                    {health.checks.database.size && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        {health.checks.database.size}
                      </span>
                    )}
                    <span className={getCheckColor(health.checks.database.status)}>
                      {getCheckIcon(health.checks.database.status)}
                    </span>
                  </div>
                </div>
              )}

              {/* Memory */}
              {health.checks?.memory && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('health.memory', 'Mémoire')}
                  </span>
                  <div className="flex items-center gap-2">
                    {health.checks.memory.heapUsed && health.checks.memory.heapTotal && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        {health.checks.memory.heapUsed}/{health.checks.memory.heapTotal}
                      </span>
                    )}
                    <span className={getCheckColor(health.checks.memory.status)}>
                      {getCheckIcon(health.checks.memory.status)}
                    </span>
                  </div>
                </div>
              )}

              {/* Cache - always visible details */}
              <div className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('health.cache', 'Cache')}
                  </span>
                  <div className="flex items-center gap-2">
                    {memoryStats && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        {memoryStats.summary.totalCacheEntries} entrées
                      </span>
                    )}
                    <span className={getCheckColor(health.checks?.cache?.status || 'ok')}>
                      {getCheckIcon(health.checks?.cache?.status || 'ok')}
                    </span>
                  </div>
                </div>
                
                {/* Cache details - always visible */}
                {memoryStats && (
                  <div className="mt-2 ml-2 space-y-1.5 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                    {/* Process Memory */}
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-100 dark:border-gray-700">
                      <span className="font-medium">Processus:</span> {memoryStats.process.heapUsed} / {memoryStats.process.heapTotal}
                    </div>
                    
                    {/* SimpleCache */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Settings/Templates/Firms</span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {memoryStats.caches.simpleCache.details.settings}/{memoryStats.caches.simpleCache.details.templates}/{memoryStats.caches.simpleCache.details.firms}
                      </span>
                    </div>
                    
                    {/* Trends Cache */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Tendances</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">
                          {memoryStats.caches.trends.details.size || 0}
                        </span>
                        <span className="text-gray-400">/ {memoryStats.caches.trends.details.maxSize}</span>
                      </div>
                    </div>
                    
                    {/* Facts Cache */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Faits marché</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">
                          {memoryStats.caches.facts.details.size || 0}
                        </span>
                        <span className="text-gray-400">/ {memoryStats.caches.facts.details.maxSize}</span>
                      </div>
                    </div>
                    
                    {/* Métiers Cache */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Métiers ROME</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">
                          {memoryStats.caches.metiers.details.size || 0}
                        </span>
                        <span className="text-gray-400">/ {memoryStats.caches.metiers.details.maxSize}</span>
                      </div>
                    </div>
                    
                    {/* ESCO Cache */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">ESCO</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-gray-600 dark:text-gray-300">
                          {memoryStats.caches.esco.details.size || 0}
                        </span>
                        <span className="text-gray-400">/ {memoryStats.caches.esco.details.maxSize}</span>
                      </div>
                    </div>
                    
                    {/* Tags Cache */}
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
                    
                    {/* Security */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Sécurité (blacklist)</span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {memoryStats.caches.security.details.blacklistedTokens} tokens, {memoryStats.caches.security.details.blacklistedUsers} users
                      </span>
                    </div>
                    
                    {/* GC Status */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-gray-500 dark:text-gray-400">Garbage Collector</span>
                      <span className={memoryStats.summary.gcAvailable ? 'text-green-500' : 'text-gray-400'}>
                        {memoryStats.summary.gcAvailable ? 'Disponible' : 'Non exposé'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* API Keys */}
              {health.checks?.apiKeys && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('health.apiKeys', 'Clés API')}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={health.checks.apiKeys.openai ? 'text-green-500' : 'text-red-500'} title="OpenAI">
                      O{health.checks.apiKeys.openai ? '✓' : '✗'}
                    </span>
                    <span className={health.checks.apiKeys.anthropic ? 'text-green-500' : 'text-red-500'} title="Anthropic">
                      A{health.checks.apiKeys.anthropic ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Last check timestamp */}
            {health.timestamp && (
              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400">
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
