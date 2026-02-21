/**
 * Core Entity Types for ResumeConverter
 */

// ============================================
// RESUME TYPES
// ============================================

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

export interface Resume {
  id: string;
  'File Name'?: string;
  'Name'?: string;
  'Original Name'?: string;
  'Title'?: string;
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
  // Index signature for dynamic field access
  [key: string]: unknown;
}

// ============================================
// RESUME VERSION TYPES
// ============================================

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
  improvedSkills?: string[];
  improvedIndustries?: string[];
  improvedTools?: string[];
  improvedSoftSkills?: string[];
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

export type ResumeStatus = 'New' | 'Pending' | 'Processing' | 'Analyzed' | 'Improved' | 'Error' | 'Failed';

// ============================================
// MISSION TYPES
// ============================================

export interface Mission {
  id: string;
  'Title': string;
  'Content'?: string;
  'Firm'?: string;
  'Status'?: MissionStatus;
  'Keywords'?: string;
  'Created At'?: string;
  'Updated At'?: string;
}

export type MissionStatus = 'Active' | 'Completed' | 'Archived';

// ============================================
// PROFILE MATCHING TYPES
// ============================================

export interface MissionKeywords {
  skills: string[];
  tools: string[];
  industries: string[];
  softSkills: string[];
  experienceLevel?: 'junior' | 'mid' | 'senior' | 'expert';
  contractType?: 'CDI' | 'CDD' | 'Freelance' | 'Stage' | null;
  keywords?: string[];
}

export interface ProfileMatchWeights {
  skills: number;
  tools: number;
  industries: number;
  softSkills: number;
}

export interface ProfileMatchResult {
  resumeId: string;
  name: string;
  title: string;
  status: string;
  globalRating: string;
  firmName?: string;
  createdAt?: string;
  matchScore: number;
  baseScore?: number; // Original score before title adjustment
  titleAdjustment?: number; // Score adjustment from title analysis (-15 to +15)
  titleReason?: string | null; // Reason for title adjustment
  categoryScores: {
    skills: number;
    tools: number;
    industries: number;
    softSkills: number;
  };
  matchedTags: {
    skills: string[];
    tools: string[];
    industries: string[];
    softSkills: string[];
  };
  missingTags: {
    skills: string[];
    tools: string[];
    industries: string[];
    softSkills: string[];
  };
  resumeTags?: {
    skills: string[];
    tools: string[];
    industries: string[];
    softSkills: string[];
  };
}

export interface ProfileMatchingResponse {
  missionId: string;
  missionTitle: string;
  missionKeywords: MissionKeywords;
  totalResumesScanned: number;
  profiles: ProfileMatchResult[];
  weights: ProfileMatchWeights;
  titleRefinementApplied?: boolean;
}

// ============================================
// DETAILED PROFILE ANALYSIS TYPES
// ============================================

export interface AnalysisStrength {
  category: 'skills' | 'tools' | 'industries' | 'softSkills' | 'experience';
  item: string;
  explanation: string;
}

export interface AnalysisGap {
  category: 'skills' | 'tools' | 'industries' | 'softSkills' | 'experience';
  item: string;
  severity: 'critical' | 'important' | 'minor';
  explanation: string;
}

export interface AnalysisRecommendation {
  type: 'highlight' | 'develop' | 'acquire';
  suggestion: string;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface DetailedAnalysis {
  overallScore: number;
  verdict: string;
  summary: string;
  strengths: AnalysisStrength[];
  gaps: AnalysisGap[];
  recommendations: AnalysisRecommendation[];
  interviewQuestions: string[];
  riskAssessment: RiskAssessment;
}

export interface DetailedProfileAnalysisResponse {
  resumeId: string;
  missionId: string;
  candidateName: string;
  candidateTitle: string;
  missionTitle: string;
  analysis: DetailedAnalysis;
}

// ============================================
// ADAPTATION TYPES
// ============================================

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

// ============================================
// TEMPLATE TYPES
// ============================================

export interface Template {
  id: string;
  'Name': string;
  'Content'?: string;
  'Description'?: string;
  'Category'?: string;
  'Is Default'?: boolean;
  'Firm'?: string;
  'Created At'?: string;
  'Updated At'?: string;
}

// ============================================
// FIRM TYPES (formerly Customer)
// ============================================

export interface Firm {
  id: string;
  'Name': string;
  'Status'?: FirmStatus;
  'Created At'?: string;
}

export type FirmStatus = 'Active' | 'Inactive';


// ============================================
// CLIENT TYPES
// ============================================

export type ClientType = 'client' | 'prospect';
export type ClientStatus = 'active' | 'inactive';
export type SubmissionStatus = 'sent' | 'viewed' | 'rejected' | 'accepted' | 'pending';

export interface Client {
  id: string;
  firm_id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  address?: string;
  website?: string;
  industry?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  firm_name?: string;
  contacts_count?: number;
  submissions_count?: number;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ResumeSubmission {
  id: string;
  resume_id: string;
  client_id: string;
  contact_id: string;
  mission_id?: string;
  firm_id: string;
  sent_at: string;
  sent_by?: string;
  notes?: string;
  status: SubmissionStatus;
  version_number?: number;
  created_at?: string;
  resume_name?: string;
  resume_title?: string;
  client_name?: string;
  client_type?: ClientType;
  contact_name?: string;
  contact_email?: string;
  mission_title?: string;
  sent_by_name?: string;
  firm_name?: string;
}

export interface ClientFormData {
  name: string;
  type: ClientType;
  status: ClientStatus;
  address?: string;
  website?: string;
  industry?: string;
  notes?: string;
}

export interface ContactFormData {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
}

export interface SubmissionFormData {
  resume_id: string;
  client_id: string;
  contact_id: string;
  mission_id?: string;
  notes?: string;
  sent_at?: string;
  status?: SubmissionStatus;
}

// ============================================
// EMAIL TEMPLATE TYPES
// ============================================

export type EmailTemplateStatus = 'active' | 'inactive';

export interface EmailTemplate {
  id: string;
  firm_id?: string;
  name: string;
  description?: string;
  subject_template: string;
  mjml_content: string;
  html_content?: string;
  is_system: boolean;
  is_default: boolean;
  status: EmailTemplateStatus;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmailTemplateFormData {
  name: string;
  description?: string;
  subjectTemplate: string;
  mjmlContent: string;
  isDefault?: boolean;
}

export interface EmailTemplateContext {
  client?: {
    name?: string;
    type?: string;
    industry?: string;
  };
  contact?: {
    name?: string;
    role?: string;
  };
  resume?: {
    name?: string;
    title?: string;
    version?: number;
  };
  firm?: {
    name?: string;
    logo?: string;
  };
  user?: {
    name?: string;
    email?: string;
    jobTitle?: string;
    phone?: string;
  };
}

export interface EmailTemplateKeywords {
  client: string[];
  contact: string[];
  resume: string[];
  firm: string[];
  user: string[];
  date: string[];
}

// ============================================
// SETTINGS TYPES
// ============================================

export interface Settings {
  id?: string;
  llmModel?: string;
  'Analysis Prompt'?: string;
  'Improvement Prompt'?: string;
  'Match Analysis Prompt'?: string;
  'Adaptation Prompt'?: string;
  'Executive Summary Weight'?: number;
  'Skills Weight'?: number;
  'Experience Weight'?: number;
  'Education Weight'?: number;
  'ATS Weight'?: number;
  'Hobbies Languages Weight'?: number;
}
