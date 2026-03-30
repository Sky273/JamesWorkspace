export interface JobItem {
  id: string;
  file_name: string;
  relative_path?: string;
  status: 'pending' | 'processing' | 'pending_name' | 'success' | 'error' | 'skipped';
  progress: number;
  error_message?: string;
  resume_id?: string;
  adaptation_id?: string;
  original_name?: string;
  display_name?: string;
  pending_data?: {
    analysis?: Record<string, unknown>;
    text?: string;
    improve?: boolean;
    progressDetails?: {
      progress?: number;
      stage?: string;
      stageLabel?: string;
      totalResumes?: number;
      profilesSentToLlm?: number;
      profileCount?: number;
      overallScore?: number | null;
    };
  };
}

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  job_type: 'import' | 'improve' | 'adapt' | 'match' | 'profile-search' | 'profile-analysis' | 'deal-export' | 'collect-trends' | 'collect-facts' | 'collect-metiers';
  options: {
    improve?: boolean;
    export?: boolean;
    exportFormat?: string;
    exportFormats?: string[];
    templateId?: string;
    dealId?: string;
    dealTitle?: string;
    source?: string;
  };
  total_items: number;
  processed_items: number;
  success_count: number;
  error_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  user_name?: string;
  firm_name?: string;
  items?: JobItem[];
  export_file_path?: string;
  export_file_name?: string;
  export_file_available?: boolean;
}

export type TranslateFn = (key: string, options?: unknown) => string;
