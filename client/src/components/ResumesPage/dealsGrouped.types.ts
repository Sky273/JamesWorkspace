/**
 * Types and constants for DealsGroupedView
 * Extracted from DealsGroupedView.tsx
 */

export interface ResumeBasic {
  id: string;
  name: string;
  title?: string;
  status: string;
  global_rating?: number;
  improved_global_rating?: number;
  created_at: string;
  file_name?: string;
  original_name?: string;
  relative_path?: string;
  firm_name?: string;
  candidate_name?: string;
  candidate_email?: string;
  consent_status?: string;
  consent_token_expires_at?: string;
  retention_until?: string;
  skills_cleaned?: string;
  industries_cleaned?: string;
  tools_cleaned?: string;
  soft_skills_cleaned?: string;
  skills?: string;
  industries?: string;
  tools?: string;
  soft_skills?: string;
  deal_added_at?: string;
  deal_resume_status?: string;
}

export interface MissionAdaptation {
  id: string;
  resume_id: string;
  resume_name: string;
  candidate_name?: string;
  adapted_title?: string;
  match_score?: number;
  status: string;
  created_at: string;
}

export interface DealMission {
  id: string;
  title: string;
  status: string;
  created_at: string;
  adaptations_count: number;
  adaptations: MissionAdaptation[];
}

export interface DealGroup {
  id: string;
  title: string;
  status: string;
  priority: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  resumes_count: number;
  resumes: ResumeBasic[];
  missions: DealMission[];
}

export interface GroupedData {
  deals: DealGroup[];
  unassigned: ResumeBasic[];
  totalDeals: number;
  totalAssigned: number;
  totalUnassigned: number;
}

export interface TagsByCategory {
  Skills: string[];
  Industries: string[];
  Tools: string[];
  'Soft Skills': string[];
  [key: string]: string[];
}

export interface DealsGroupedViewProps {
  allTags: TagsByCategory;
}

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  won: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnée',
  lost: 'Perdue',
  on_hold: 'En attente'
};

export const PRIORITY_ICONS: Record<string, { icon: string; color: string }> = {
  low: { icon: '○', color: 'text-gray-400' },
  medium: { icon: '●', color: 'text-blue-500' },
  high: { icon: '●●', color: 'text-orange-500' },
  urgent: { icon: '●●●', color: 'text-red-500' }
};

export const TAG_COLOR_MAP: Record<string, string> = {
  skills: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  industries: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  tools: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  soft_skills: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
};

export const TAG_FILTER_COLORS: Record<string, { selected: string; unselected: string }> = {
  Skills: {
    selected: 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700',
    unselected: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
  },
  Industries: {
    selected: 'bg-purple-500 text-white ring-2 ring-purple-300 dark:ring-purple-700',
    unselected: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
  },
  Tools: {
    selected: 'bg-green-500 text-white ring-2 ring-green-300 dark:ring-green-700',
    unselected: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'
  },
  'Soft Skills': {
    selected: 'bg-yellow-500 text-white ring-2 ring-yellow-300 dark:ring-yellow-700',
    unselected: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
  }
};

export const FILTER_CONTENT_VARIANTS = {
  expanded: {
    height: 'auto',
    opacity: 1,
    marginBottom: '1rem',
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 }
    }
  },
  collapsed: {
    height: 0,
    opacity: 0,
    marginBottom: 0,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 }
    }
  }
};

// Maximum CVs to show per section before "Show more"
export const INITIAL_RESUMES_LIMIT = 10;
