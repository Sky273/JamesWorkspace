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
  stats: {
    total: number;
    improved: number;
    processing: number;
    avgScore: number;
  };
}

export const STATUS_COLORS: Record<string, string> = {
  open: 'cv-status-pill cv-status-primary',
  won: 'cv-status-pill cv-status-success',
  lost: 'cv-status-pill cv-status-danger',
  on_hold: 'cv-status-pill cv-status-warning'
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnee',
  lost: 'Perdue',
  on_hold: 'En attente'
};

export const PRIORITY_ICONS: Record<string, { icon: string; color: string }> = {
  low: { icon: 'o', color: 'text-gray-400' },
  medium: { icon: 'oo', color: 'text-blue-500' },
  high: { icon: 'ooo', color: 'text-orange-500' },
  urgent: { icon: '!!!!', color: 'text-red-500' }
};

export const TAG_COLOR_MAP: Record<string, string> = {
  skills: 'cv-chip-skills',
  industries: 'cv-chip-industries',
  tools: 'cv-chip-tools',
  soft_skills: 'cv-chip-soft'
};

export const CATEGORY_HEADER_COLORS: Record<string, { dot: string; text: string; accent: string }> = {
  Skills: { dot: 'bg-[var(--cv-tertiary)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-tertiary)]' },
  Industries: { dot: 'bg-[var(--cv-primary)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-primary)]' },
  Tools: { dot: 'bg-[var(--cv-cyan)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-cyan)]' },
  'Soft Skills': { dot: 'bg-[var(--cv-secondary)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-secondary)]' }
};

export const TAG_FILTER_COLORS: Record<string, { selected: string; unselected: string }> = {
  Skills: {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-skills',
    unselected: 'cv-filter-chip cv-filter-chip-skills'
  },
  Industries: {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-industries',
    unselected: 'cv-filter-chip cv-filter-chip-industries'
  },
  Tools: {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-tools',
    unselected: 'cv-filter-chip cv-filter-chip-tools'
  },
  'Soft Skills': {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-soft',
    unselected: 'cv-filter-chip cv-filter-chip-soft'
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
