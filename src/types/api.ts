/**
 * API Types for ResumeConverter
 */

// ============================================
// PAGINATION TYPES
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total?: number;
    hasMore: boolean;
    nextOffset?: string | null;
  };
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// ============================================
// LLM TYPES
// ============================================

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  id: string;
  choices: {
    message: LLMMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AnalysisResult {
  name?: string;
  title?: string;
  globalRating: number;
  executiveSummaryRating: number;
  skillsRating: number;
  experiencesRating: number;
  educationRating: number;
  atsOptimizationRating: number;
  hobbiesLanguagesRating?: number;
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
}

export interface ImprovementResult {
  text: string;
  analysis: AnalysisResult;
}

// ============================================
// FILE UPLOAD TYPES
// ============================================

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

export interface FileUploadResponse {
  message: string;
  file: UploadedFile;
}

// ============================================
// METRICS TYPES
// ============================================

export interface MetricsData {
  totalResumes: number;
  totalMissions: number;
  totalAdaptations: number;
  totalUsers: number;
  averageMatchScore: number;
  processingTimes: {
    analysis: number;
    improvement: number;
    adaptation: number;
  };
}

export interface SecurityLog {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}
