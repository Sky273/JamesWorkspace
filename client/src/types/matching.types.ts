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
  baseScore?: number;
  titleAdjustment?: number;
  titleReason?: string | null;
  llmScored?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  reason?: string;
  keyStrengths?: string[];
  keyGaps?: string[];
  categoryScores?: {
    skills: number;
    tools: number;
    industries: number;
    softSkills: number;
  };
  matchedTags?: {
    skills: string[];
    tools: string[];
    industries: string[];
    softSkills: string[];
  };
  missingTags?: {
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
  profilesSentToLlm?: number;
  profilesExplained?: number;
  profiles: ProfileMatchResult[];
  weights: ProfileMatchWeights;
  titleRefinementApplied?: boolean;
  llmScoringApplied?: boolean;
  llmScoringFailed?: boolean;
}

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

export interface ProfileMatchingProgressDetails {
  progress?: number;
  stage?: string;
  stageLabel?: string;
  totalResumes?: number;
  profilesSentToLlm?: number;
  profileCount?: number;
  overallScore?: number | null;
}
