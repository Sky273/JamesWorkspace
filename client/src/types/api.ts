/**
 * API Response Types
 * Standardized types for API responses
 */

// ============================================
// GENERIC API RESPONSES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
  statusCode?: number;
}

// ============================================
// AUTH RESPONSES
// ============================================

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    firm?: string;
    firm_id?: string;
    totp_enabled?: boolean;
  };
  requires2FA?: boolean;
  tempToken?: string;
}

export interface AuthMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    firm?: string;
    firm_id?: string;
    jobTitle?: string;
    phone?: string;
    totp_enabled?: boolean;
  };
}

// ============================================
// RESUME RESPONSES
// ============================================

export interface ResumeListResponse {
  resumes: import('./entities').Resume[];
  total?: number;
}

export interface ResumeResponse {
  resume: import('./entities').Resume;
}

export interface ResumeAnalysisResponse {
  success: boolean;
  analysis: {
    name: string;
    title: string;
    globalRating: string;
    executiveSummaryRating: string;
    skillsRating: string;
    experiencesRating: string;
    educationRating: string;
    hobbiesLanguagesRating: string;
    atsOptimizationRating: string;
    tags: {
      skills: string[];
      industries: string[];
      tools: string[];
      softSkills: string[];
    };
    suggestions: {
      executiveSummary: string[];
      skills: string[];
      experiences: string[];
      education: string[];
      hobbiesLanguages: string[];
      atsOptimization: string[];
    };
  };
}

// ============================================
// TEMPLATE RESPONSES
// ============================================

export interface TemplateListResponse {
  templates: import('./entities').Template[];
}

export interface TemplateResponse {
  template: import('./entities').Template;
}

// ============================================
// MISSION RESPONSES
// ============================================

export interface MissionListResponse {
  missions: import('./entities').Mission[];
  total?: number;
}

export interface MissionResponse {
  mission: import('./entities').Mission;
}

// ============================================
// CLIENT RESPONSES
// ============================================

export interface ClientListResponse {
  clients: import('./entities').Client[];
  total?: number;
}

export interface ClientResponse {
  client: import('./entities').Client;
}

// ============================================
// CIRCUIT BREAKER RESPONSES
// ============================================

export interface CircuitBreakerState {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number | null;
}

export interface CircuitBreakerStatesResponse {
  openai: CircuitBreakerState;
  anthropic: CircuitBreakerState;
  airtable?: CircuitBreakerState;
}

// ============================================
// BATCH EXPORT
// ============================================

export interface BatchExportRequest {
  resumeIds: string[];
  templateId: string;
  format?: 'pdf' | 'docx' | 'doc';
}

// ============================================
// HEALTH CHECK
// ============================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
  uptime?: number;
  services?: {
    database: 'up' | 'down';
    pdfServer: 'up' | 'down';
    cache: 'up' | 'down';
  };
}

// ============================================
// SETTINGS
// ============================================

export interface LLMSettingsResponse {
  llmModel: string;
  analysisPrompt?: string;
  improvementPrompt?: string;
  cvMode?: string;
  weights?: {
    executiveSummary: number;
    skills: number;
    experience: number;
    education: number;
    ats: number;
    hobbiesLanguages: number;
  };
}

// ============================================
// GDPR AUDIT
// ============================================

export interface GdprAuditLogEntry {
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
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface GdprAuditResponse {
  logs: GdprAuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
