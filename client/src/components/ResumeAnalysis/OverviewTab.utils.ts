export interface ResumeAnalysisOverviewResume {
  'Global Rating'?: string | number;
  'Improved Global Rating'?: string | number;
  'Executive Summary Score'?: string | number;
  'Improved Executive Summary Score'?: string | number;
  'Skills Score'?: string | number;
  'Improved Skills Score'?: string | number;
  'Experience Score'?: string | number;
  'Improved Experience Score'?: string | number;
  'Education Score'?: string | number;
  'Improved Education Score'?: string | number;
  'ATS Score'?: string | number;
  'Improved ATS Score'?: string | number;
  'Hobbies Languages Score'?: string | number;
  'Improved Hobbies Languages Score'?: string | number;
  'Key Improvements'?: string;
  'Improved Key Improvements'?: string;
  'Status'?: string;
  [key: string]: unknown;
}

export interface SectionData {
  score: number;
  suggestions: string[];
  improved: number | null;
}

export interface OverviewScoreSet {
  global: number;
  executiveSummary: number;
  skills: number;
  experience: number;
  education: number;
  ats: number;
  hobbiesLanguages: number;
}

export const parseScoreValue = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const parsed = parseInt(cleaned, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const normalizeSuggestionStrings = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => normalizeSuggestionStrings(item)).filter(Boolean))];
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directText = [
      record.text,
      record.suggestion,
      record.content,
      record.message,
      record.label,
      record.title,
      record.value,
      record.description,
    ].find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);

    if (directText) {
      return [directText.trim()];
    }

    return [...new Set(Object.values(record).flatMap((item) => normalizeSuggestionStrings(item)).filter(Boolean))];
  }
  return [];
};

const normalizeSuggestionSections = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, items]) => [key, normalizeSuggestionStrings(items)])
      .filter(([, items]) => items.length > 0),
  );
};

export const parseImprovements = (rawImprovements: string | undefined): { bySection: Record<string, string[]>; global: string[] } => {
  let bySection: Record<string, string[]> = {};
  let global: string[] = [];

  try {
    if (rawImprovements) {
      const parsed: unknown = typeof rawImprovements === 'string' ? JSON.parse(rawImprovements) : rawImprovements;

      if (Array.isArray(parsed)) {
        global = normalizeSuggestionStrings(parsed);
      } else if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        if (obj.executiveSummary || obj.skills || obj.experiences || obj.education || obj.atsOptimization || obj.hobbiesLanguages) {
          bySection = normalizeSuggestionSections(obj);
        } else if (obj.suggestions && typeof obj.suggestions === 'object') {
          bySection = normalizeSuggestionSections(obj.suggestions);
        }
      }
    }
  } catch {
    // Ignore parsing errors and fallback to empty suggestions.
  }

  return { bySection, global };
};

export const buildScoreSet = (resume: ResumeAnalysisOverviewResume, improved = false): OverviewScoreSet => ({
  global: parseScoreValue(resume[improved ? 'Improved Global Rating' : 'Global Rating']),
  executiveSummary: parseScoreValue(resume[improved ? 'Improved Executive Summary Score' : 'Executive Summary Score']),
  skills: parseScoreValue(resume[improved ? 'Improved Skills Score' : 'Skills Score']),
  experience: parseScoreValue(resume[improved ? 'Improved Experience Score' : 'Experience Score']),
  education: parseScoreValue(resume[improved ? 'Improved Education Score' : 'Education Score']),
  ats: parseScoreValue(resume[improved ? 'Improved ATS Score' : 'ATS Score']),
  hobbiesLanguages: parseScoreValue(resume[improved ? 'Improved Hobbies Languages Score' : 'Hobbies Languages Score']),
});

export const buildInitialSections = (
  initialScores: OverviewScoreSet,
  initialSuggestions: Record<string, string[]>,
  t: (key: string) => string,
): Record<string, SectionData> => ({
  [t('resume.analysis.sections.executiveBrief')]: {
    score: initialScores.executiveSummary,
    suggestions: initialSuggestions.executiveSummary || [],
    improved: null,
  },
  [t('resume.analysis.sections.skillsKeywords')]: {
    score: initialScores.skills,
    suggestions: initialSuggestions.skills || [],
    improved: null,
  },
  [t('resume.analysis.sections.experience')]: {
    score: initialScores.experience,
    suggestions: initialSuggestions.experiences || [],
    improved: null,
  },
  [t('resume.analysis.sections.education')]: {
    score: initialScores.education,
    suggestions: initialSuggestions.education || [],
    improved: null,
  },
  [t('resume.analysis.sections.atsOptimization')]: {
    score: initialScores.ats,
    suggestions: initialSuggestions.atsOptimization || [],
    improved: null,
  },
  [t('resume.analysis.sections.hobbiesLanguages')]: {
    score: initialScores.hobbiesLanguages,
    suggestions: initialSuggestions.hobbiesLanguages || [],
    improved: null,
  },
});

export const buildPostImprovementSections = (
  initialScores: OverviewScoreSet,
  improvedScores: OverviewScoreSet,
  improvedSuggestions: Record<string, string[]>,
  t: (key: string) => string,
): Record<string, SectionData> => ({
  [t('resume.analysis.sections.executiveBrief')]: {
    score: initialScores.executiveSummary,
    suggestions: improvedSuggestions.executiveSummary || [],
    improved: improvedScores.executiveSummary || null,
  },
  [t('resume.analysis.sections.skillsKeywords')]: {
    score: initialScores.skills,
    suggestions: improvedSuggestions.skills || [],
    improved: improvedScores.skills || null,
  },
  [t('resume.analysis.sections.experience')]: {
    score: initialScores.experience,
    suggestions: improvedSuggestions.experiences || [],
    improved: improvedScores.experience || null,
  },
  [t('resume.analysis.sections.education')]: {
    score: initialScores.education,
    suggestions: improvedSuggestions.education || [],
    improved: improvedScores.education || null,
  },
  [t('resume.analysis.sections.atsOptimization')]: {
    score: initialScores.ats,
    suggestions: improvedSuggestions.atsOptimization || [],
    improved: improvedScores.ats || null,
  },
  [t('resume.analysis.sections.hobbiesLanguages')]: {
    score: initialScores.hobbiesLanguages,
    suggestions: improvedSuggestions.hobbiesLanguages || [],
    improved: improvedScores.hobbiesLanguages || null,
  },
});

export const hasResumeImprovement = (resume: ResumeAnalysisOverviewResume): boolean => {
  const hasImprovedScores = !!(resume['Improved Global Rating'] && parseScoreValue(resume['Improved Global Rating']) > 0);
  return resume['Status'] === 'Improved' || resume['Status'] === 'improved' || hasImprovedScores;
};
