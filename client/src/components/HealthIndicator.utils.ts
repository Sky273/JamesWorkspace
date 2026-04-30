export interface HealthCheck {
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
  preferredEngine?: string;
  tesseractCliAvailable?: boolean;
  pdftoppmAvailable?: boolean;
  pythonCommand?: string | null;
  advancedBackend?: string | null;
  advancedBackendAvailable?: boolean;
  advancedBackendStatus?: string;
}

export interface ProviderCheck {
  status: string;
  message?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime?: string;
  timestamp?: string;
  checks?: {
    server?: HealthCheck;
    database?: HealthCheck;
    memory?: HealthCheck;
    cache?: HealthCheck;
    ocr?: HealthCheck;
    openai?: ProviderCheck;
    anthropic?: ProviderCheck;
    gemma?: ProviderCheck;
    deepseek?: ProviderCheck;
    glm?: ProviderCheck;
    minimax?: ProviderCheck;
    ollama?: ProviderCheck;
  };
  issues?: string[];
}

export interface CacheBackendDiagnostics {
  backend: string;
  connected: boolean | null;
  fallbackReason: string | null;
}

export interface CacheAdminMetrics {
  cacheBackend?: CacheBackendDiagnostics;
}

export interface CircuitBreakerState {
  provider: string;
  supported: boolean;
  state: string;
  failures: number;
  lastFailureTime: string | null;
  configured?: boolean;
}

export interface CircuitBreakerMap {
  [provider: string]: CircuitBreakerState;
}

export type StatusLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const PROVIDERS = ['openai', 'anthropic', 'gemma', 'deepseek', 'glm', 'minimax', 'ollama'] as const;
const MEMORY_WARNING_MB = 300;
const MEMORY_ERROR_MB = 1024;

export function tr(
  t: TranslateFn | undefined,
  key: string,
  fallback: string,
  options?: Record<string, unknown>,
): string {
  if (!t) return fallback;
  const translated = t(key, options);
  return translated === key ? fallback : translated;
}

export function tfStatic(t: TranslateFn, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function parseMemoryValueToMb(value?: string): number | null {
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

export function getMemoryStatus(memory?: HealthCheck): 'ok' | 'warning' | 'error' | undefined {
  if (!memory) return undefined;
  const heapUsedMb = parseMemoryValueToMb(memory.heapUsed);
  if (heapUsedMb === null) {
    return memory.status as 'ok' | 'warning' | 'error' | undefined;
  }
  if (heapUsedMb > MEMORY_ERROR_MB) return 'error';
  if (heapUsedMb > MEMORY_WARNING_MB) return 'warning';
  return 'ok';
}

export function normalizeStatusLevel(status?: string): StatusLevel {
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

export function getWorstStatus(current: StatusLevel, next: StatusLevel): StatusLevel {
  const rank: Record<StatusLevel, number> = {
    healthy: 0,
    unknown: 1,
    degraded: 2,
    unhealthy: 3,
  };

  return rank[next] > rank[current] ? next : current;
}

export function hasAtLeastOneConfiguredLlm(
  health: HealthStatus,
  circuitBreakers: CircuitBreakerMap,
): boolean {
  return PROVIDERS.some((provider) => {
    const providerStatus = health.checks?.[provider]?.status;
    const breakerState = circuitBreakers[provider]?.state?.toLowerCase();

    const providerConfigured =
      providerStatus === 'configured' || providerStatus === 'ok' || providerStatus === 'healthy';
    const breakerUsable =
      !breakerState ||
      breakerState === 'closed' ||
      breakerState === 'half_open' ||
      breakerState === 'not_applicable';

    return providerConfigured && breakerUsable;
  });
}

export function getOverallHealthStatus(
  health: HealthStatus,
  cacheBackend: CacheBackendDiagnostics | null,
  circuitBreakers: CircuitBreakerMap,
): StatusLevel {
  let overall = health.checks?.server?.status
    ? normalizeStatusLevel(health.checks.server.status)
    : normalizeStatusLevel(health.status);

  overall = getWorstStatus(overall, normalizeStatusLevel(health.checks?.database?.status));
  overall = getWorstStatus(overall, normalizeStatusLevel(getMemoryStatus(health.checks?.memory)));
  overall = getWorstStatus(overall, normalizeStatusLevel(health.checks?.cache?.status));

  if (cacheBackend?.backend === 'memory-fallback' || cacheBackend?.connected === false) {
    overall = getWorstStatus(overall, 'degraded');
  }

  if (!hasAtLeastOneConfiguredLlm(health, circuitBreakers)) {
    for (const provider of PROVIDERS) {
      overall = getWorstStatus(overall, normalizeStatusLevel(health.checks?.[provider]?.status));
      overall = getWorstStatus(
        overall,
        normalizeStatusLevel(circuitBreakers[provider]?.state?.toLowerCase()),
      );
    }
  }

  return overall;
}

export function getMemorySummary(memory?: HealthCheck): string | null {
  if (!memory) return null;
  if (memory.heapUsed && memory.heapTotal) {
    return `${memory.heapUsed} sur ${memory.heapTotal}`;
  }
  if (memory.heapPercent && memory.heapUsed) {
    return `${memory.heapUsed} (${memory.heapPercent})`;
  }
  return memory.heapPercent || memory.heapUsed || memory.heapTotal || null;
}

export function getStatusTone(status?: string): string {
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

export function getStatusLabel(t?: (key: string) => string, status?: string): string {
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

export function formatBooleanMeta(value?: boolean | null, yes = 'oui', no = 'non'): string | null {
  if (typeof value !== 'boolean') return null;
  return value ? yes : no;
}

export function getAdvancedOcrMeta(t: TranslateFn, ocr?: HealthCheck): string | null {
  if (!ocr?.advancedBackend) {
    return tfStatic(t, 'health.notApplicable', 'n/a');
  }

  if (ocr.advancedBackendAvailable) {
    return ocr.advancedBackend;
  }

  if (ocr.preferredEngine === 'tesseract-cli') {
    return tr(t, 'health.optionalComponentUnavailable', '{{component}} (optionnel indisponible)', {
      component: ocr.advancedBackend,
    });
  }

  return ocr.advancedBackend;
}

export function buildIssues(
  t: TranslateFn,
  health: HealthStatus,
  cacheBackend: CacheBackendDiagnostics | null,
): string[] {
  const issues: string[] = [];

  if (health.checks?.database?.status === 'error') {
    issues.push(`Base de données: ${health.checks.database.error || 'connexion indisponible'}`);
  }

  const memoryStatus = getMemoryStatus(health.checks?.memory);
  if (memoryStatus && memoryStatus !== 'ok') {
    const memoryLabel =
      health.checks?.memory?.heapPercent || health.checks?.memory?.heapUsed || memoryStatus;
    issues.push(`Mémoire: ${memoryLabel}`);
  }

  if (cacheBackend?.backend === 'memory-fallback') {
    issues.push(
      `Cache: fallback mémoire${cacheBackend.fallbackReason ? ` (${cacheBackend.fallbackReason})` : ''}`,
    );
  }

  for (const provider of PROVIDERS) {
    const check = health.checks?.[provider];
    if (check?.status === 'error') {
      issues.push(
        tr(t, 'health.issueProvider', `${provider}: ${check.message || 'erreur provider'}`, {
          provider,
          message: check.message || 'erreur provider',
        }),
      );
    }
  }

  return issues;
}
