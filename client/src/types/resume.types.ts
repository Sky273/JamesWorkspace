export interface ResumeFile {
  id: string;
  filename: string;
  size: number;
  type: string;
  url?: string;
}

export interface ResumeAnalysis {
  globalRating: string;
  executiveSummaryRating: string;
  skillsRating: string;
  experiencesRating: string;
  educationRating: string;
  atsOptimizationRating: string;
  hobbiesLanguagesRating: string;
  improvedGlobalRating?: string | null;
  improvedExecutiveSummaryRating?: string | null;
  improvedSkillsRating?: string | null;
  improvedExperiencesRating?: string | null;
  improvedEducationRating?: string | null;
  improvedAtsOptimizationRating?: string | null;
  improvedHobbiesLanguagesRating?: string | null;
  tags: ResumeTags;
  suggestions: ResumeSuggestions;
  originalText: string;
  improvedText: string;
}

export interface ResumeTags {
  skills: string[];
  industries: string[];
  tools: string[];
  softSkills: string[];
}

export interface ResumeSuggestions {
  executiveSummary: string[];
  skills: string[];
  experiences: string[];
  education: string[];
  hobbiesLanguages: string[];
  atsOptimization: string[];
}

export type ResumeStatus = 'New' | 'Pending' | 'Processing' | 'Analyzed' | 'Improved' | 'Error' | 'Failed';

export interface Resume {
  id: string;
  Name?: string;
  Title?: string;
  name?: string;
  originalName?: string;
  title?: string;
  fileName?: string;
  file_name?: string;
  originalText?: string;
  original_text?: string;
  improvedText?: string;
  improved_text?: string;
  currentVersion?: number;
  adapted_title?: string;
  'File Name'?: string;
  'Original Name'?: string;
  'Original Text'?: string;
  'Improved Text'?: string;
  'Resume File'?: ResumeFile[];
  'Global Rating'?: string;
  'Executive Summary Score'?: string;
  'Skills Score'?: string;
  'Experience Score'?: string;
  'Education Score'?: string;
  'ATS Score'?: string;
  'Hobbies Languages Score'?: string;
  'Improved Global Rating'?: string;
  'Improved Executive Summary Score'?: string;
  'Improved Skills Score'?: string;
  'Improved Experience Score'?: string;
  'Improved Education Score'?: string;
  'Improved ATS Score'?: string;
  'Improved Hobbies Languages Score'?: string;
  'Skills'?: string;
  'Industries'?: string;
  'Tools'?: string;
  'Soft Skills'?: string;
  'Key Improvements'?: string;
  'Improved Key Improvements'?: string;
  'Status'?: ResumeStatus;
  'FirmName'?: string;
  'Created At'?: string;
  'Updated At'?: string;
  'Analysis Date'?: string;
  'Last Improved'?: string;
  'Current Version'?: number;
  profile_type?: 'employee' | 'external';
  candidate_name?: string;
  candidate_email?: string;
  consent_status?: 'not_required' | 'pending_consent' | 'active' | 'refused' | 'expired' | 'purged' | 'error';
  consent_requested_at?: string | null;
  consent_responded_at?: string | null;
  retention_until?: string | null;
  consent_token?: string | null;
  consent_token_expires_at?: string | null;
  consent_reminder_sent_at?: string | null;
  consent_reminder_count?: number;
  [key: string]: unknown;
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  versionNumber: number;
  improvedText: string;
  improvedGlobalRating?: number | null;
  improvedSkillsScore?: number | null;
  improvedExperienceScore?: number | null;
  improvedEducationScore?: number | null;
  improvedAtsScore?: number | null;
  improvedExecutiveSummaryScore?: number | null;
  improvedHobbiesLanguagesScore?: number | null;
  improvedSkills?: string[] | null;
  improvedIndustries?: string[] | null;
  improvedTools?: string[] | null;
  improvedSoftSkills?: string[] | null;
  improvedKeyImprovements?: string | null;
  createdAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  changeReason?: string | null;
}

export interface ResumeVersionsResponse {
  versions: ResumeVersion[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Mission {
  id: string;
  'Title': string;
  'Content'?: string;
  'Firm'?: string;
  'Status'?: MissionStatus;
  'Keywords'?: string;
  'Created At'?: string;
  'Updated At'?: string;
  'Deal ID'?: string | null;
  'Deal Title'?: string | null;
}

export type MissionStatus = 'Active' | 'Completed' | 'Archived';

export interface MatchAnalysis {
  matchScore: number;
  strengths: string[];
  gaps: string[];
  keywordMatches: string[];
  missingKeywords: string[];
  recommendations?: Record<string, string[]>;
}

export interface Adaptation {
  id: string;
  'Resume'?: string[];
  'Mission'?: string[];
  'Mission Title'?: string;
  'Mission Content'?: string;
  'Adapted Text'?: string;
  'Match Analysis'?: string;
  'Match Score'?: number;
  'Key Adaptations'?: string;
  'Strengths'?: string;
  'Gaps'?: string;
  'Keyword Matches'?: string;
  'Missing Keywords'?: string;
  'Status'?: AdaptationStatus;
  'Firm'?: string;
  'Created By'?: string;
  'Created At'?: string;
  'Updated At'?: string;
}

export type AdaptationStatus = 'Processing' | 'Completed' | 'Failed';

export interface Template {
  id: string;
  Name: string;
  Description?: string;
  HeaderContent?: string;
  TemplateContent: string;
  FooterContent?: string;
  FooterHeight?: number;
  Status: string;
  Tags?: string[];
  Popular?: boolean;
  Stylesheet?: string;
  createdAt?: string;
  updatedAt?: string;
  name?: string;
  description?: string;
  headerContent?: string;
  templateContent?: string;
  footerContent?: string;
  footerHeight?: number;
  status?: string;
  tags?: string[];
  popular?: boolean;
  stylesheet?: string;
}

export interface Firm {
  id: string;
  'Name': string;
  'Status'?: FirmStatus;
  'Created At'?: string;
}

export type FirmStatus = 'Active' | 'Inactive';

export interface UserAccount {
  id: string;
  name?: string;
  email?: string;
  jobTitle?: string;
  phone?: string;
  firmId?: string;
  firmName?: string;
  firm?: string;
  customerId?: string;
  customerName?: string;
  customer?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  lastLogin?: string;
}
