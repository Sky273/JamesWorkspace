import type { OperationsMetrics } from './MetricsPage.types';

export interface SecurityLogEntry {
  timestamp: string;
  source?: string;
  level?: string;
  event?: string;
  email?: string;
  role?: string;
  customer?: string;
  ip?: string;
  action?: string;
  method?: string;
  endpoint?: string;
  resourceType?: string;
  resourceId?: string;
  statusCode?: number;
  message?: string;
  duration?: number;
}

export interface SecurityLogStats {
  total: number;
  recent: { lastHour: number; last24h: number };
  byLevel: Record<string, number>;
}

export interface SecurityLogFilters {
  level: string;
  event: string;
  source: string;
}

export interface SecurityLogFilterOptions {
  levels: string[];
  events: string[];
  sources: string[];
}

export type SecurityLogsTab = 'logs' | 'observability';

export interface ObservabilityCheckSummary {
  status?: string;
  message?: string;
  timestamp?: string;
  operation?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export interface ObservabilityHealthResponse {
  status: string;
  responseTime?: string;
  timestamp?: string;
  checks?: Record<string, unknown> & {
    database?: ObservabilityCheckSummary;
    cache?: ObservabilityCheckSummary;
    ocr?: ObservabilityCheckSummary;
    batchWorker?: ObservabilityCheckSummary;
    recentBatchActivity?: {
      status?: string;
      export?: ObservabilityCheckSummary | null;
      textExtraction?: ObservabilityCheckSummary | null;
    };
    recentConsentActivity?: {
      status?: string;
      scheduler?: ObservabilityCheckSummary | null;
    };
    recentPipelineActivity?: {
      status?: string;
      pipeline?: ObservabilityCheckSummary | null;
    };
  };
}

export type ObservabilityOperationsMetrics = OperationsMetrics;
