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
