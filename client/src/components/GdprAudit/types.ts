export interface GdprAuditLog {
  id: string;
  action: string;
  category: string;
  firm_id: string | null;
  firm_name: string | null;
  user_id: string | null;
  user_name: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  target_email: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  is_automated: boolean;
  created_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Firm {
  firm_id: string;
  firm_name: string;
  action_count: number;
}

export interface ActionType {
  key: string;
  value: string;
  label: string;
}

export interface Stats {
  period: string;
  total: number;
  byCategory: Record<string, number>;
  byAction: { action: string; count: number }[];
  automated: { automated: number; manual: number };
  dailyActivity: { date: string; count: number }[];
}

export interface GdprAuditFilters {
  firmId: string;
  action: string;
  category: string;
  isAutomated: string;
  targetEmail: string;
  startDate: string;
  endDate: string;
}
