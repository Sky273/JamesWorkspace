/**
 * Overview Tab Component for Resume Analysis
 * TypeScript version
 */

import { ForwardRefExoticComponent, RefAttributes, SVGProps, useState } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface Resume {
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

// Helper function to parse score values (handles number, "75%", "75")
const parseScoreValue = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

interface RatingBarProps {
  label: string;
  percentage: number;
  improved?: number | null;
}

interface OverviewTabProps {
  resume: Resume;
  t: (key: string) => string;
}

interface SectionData {
  score: number;
  suggestions: string[];
  improved: number | null;
}

interface CategoryConfig {
  title: string;
  icon: HeroIcon;
  textColor: string;
  iconColor: string;
}

const RatingBar = ({ label, percentage, improved }: RatingBarProps): JSX.Element => {
  const getColor = (pct: number): string => {
    if (pct >= 85) return 'bg-green-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const improvementDiff = improved !== null && improved !== undefined ? improved - percentage : 0;
  const hasImprovement = improved !== null && improved !== undefined && improvementDiff !== 0;
  const isNegativeImprovement = improvementDiff < 0;
  const displayPercentage = improved !== null && improved !== undefined ? improved : percentage;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[140px] truncate">{label}</span>
        <div className="flex-1 relative">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${hasImprovement ? (isNegativeImprovement ? 'bg-red-500' : 'bg-green-500') : getColor(percentage)}`}
              style={{ width: `${displayPercentage}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-[80px] justify-end">
          <span className="text-sm font-bold text-gray-900 dark:text-white">{displayPercentage}%</span>
          {hasImprovement && (
            <span className={`text-xs font-semibold ${isNegativeImprovement ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              ({isNegativeImprovement ? '' : '+'}{improvementDiff}%)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to parse improvements from JSON string
const parseImprovements = (rawImprovements: string | undefined): { bySection: Record<string, string[]>, global: string[] } => {
  let bySection: Record<string, string[]> = {};
  let global: string[] = [];
  
  try {
    if (rawImprovements) {
      let parsed: unknown;
      if (typeof rawImprovements === 'string') {
        parsed = JSON.parse(rawImprovements);
      } else {
        parsed = rawImprovements;
      }
      
      if (Array.isArray(parsed)) {
        global = parsed as string[];
      } else if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        if (obj.executiveSummary || obj.skills || obj.experiences || obj.education) {
          bySection = obj as Record<string, string[]>;
        } else if (obj.suggestions && typeof obj.suggestions === 'object') {
          bySection = obj.suggestions as Record<string, string[]>;
        }
      }
    }
  } catch {
    // Ignore parsing errors
  }
  
  return { bySection, global };
};

// Sub-component for analysis panel (used for both initial and post-improvement)
interface AnalysisPanelProps {
  globalScore: number;
  sections: Record<string, SectionData>;
  t: (key: string) => string;
  showComparison?: boolean;
  comparisonScore?: number | null;
}

const AnalysisPanel = ({ globalScore, sections, t, showComparison = false, comparisonScore = null }: AnalysisPanelProps): JSX.Element => {
  const getCategory = (score: number): 'critical' | 'recommended' | 'optional' => {
    if (score < 70) return 'critical';
    if (score < 85) return 'recommended';
    return 'optional';
  };

  const categoryConfig: Record<string, CategoryConfig> = {
    critical: {
      title: t('resume.analysis.criticalImprovements'),
      icon: ExclamationCircleIcon,
      textColor: 'text-red-600 dark:text-red-400',
      iconColor: 'text-red-500'
    },
    recommended: {
      title: t('resume.analysis.recommendedImprovements'),
      icon: ExclamationTriangleIcon,
      textColor: 'text-yellow-600 dark:text-yellow-400',
      iconColor: 'text-yellow-500'
    },
    optional: {
      title: t('resume.analysis.optionalEnhancements'),
      icon: CheckCircleIcon,
      textColor: 'text-green-600 dark:text-green-400',
      iconColor: 'text-green-500'
    }
  };

  const improvementDiff = comparisonScore !== null ? globalScore - comparisonScore : 0;
  const hasComparison = showComparison && comparisonScore !== null && improvementDiff !== 0;
  const isNegative = improvementDiff < 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700 w-full">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {t('resume.analysis.globalRating')}
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full">
            {hasComparison && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24">
                  <CircularProgressbar
                    value={comparisonScore}
                    text={`${comparisonScore}%`}
                    styles={buildStyles({
                      textSize: '24px',
                      pathColor: '#9CA3AF',
                      textColor: '#9CA3AF',
                      trailColor: '#E5E7EB',
                      pathTransitionDuration: 0.5,
                    })}
                  />
                </div>
                <span className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t('resume.analysis.originalScore')}
                </span>
              </div>
            )}

            {hasComparison && (
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center">
                  <span className={`text-xl font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {isNegative ? '' : '+'}{improvementDiff}%
                  </span>
                  <svg
                    className={`w-6 h-6 ml-1 ${isNegative ? 'text-red-600 dark:text-red-400 rotate-180' : 'text-green-600 dark:text-green-400'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center">
              <div className="w-32 h-32">
                <CircularProgressbar
                  value={globalScore}
                  text={`${globalScore}%`}
                  styles={buildStyles({
                    textSize: '24px',
                    pathColor: hasComparison ? (isNegative ? '#DC2626' : '#059669') : '#4F46E5',
                    textColor: hasComparison ? (isNegative ? '#DC2626' : '#059669') : '#4F46E5',
                    trailColor: '#E5E7EB',
                    pathTransitionDuration: 0.5,
                  })}
                />
              </div>
              <span className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                {hasComparison ? t('resume.analysis.improvedScore') : t('resume.analysis.globalRating')}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('resume.analysis.sectionScores')}
            </h3>
            <div className="space-y-4">
              {Object.entries(sections).map(([section, data]) => {
                const score = data.score;
                const sectionSuggestions = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 2) : [];
                const improved = data.improved;
                const effectiveScore = improved !== null ? improved : score;
                const category = getCategory(effectiveScore);
                const config = categoryConfig[category];
                const IconComponent = config.icon;

                return (
                  <div key={section} className="pb-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <RatingBar
                      label={section}
                      percentage={score}
                      improved={improved}
                    />
                    {sectionSuggestions.length > 0 && (
                      <div className="mt-2 ml-[143px] space-y-1">
                        {sectionSuggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <IconComponent className={`w-3 h-3 ${config.iconColor} mt-0.5 flex-shrink-0`} />
                            <p className="text-gray-500 dark:text-gray-400 leading-tight">{suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const OverviewTab = ({ resume, t }: OverviewTabProps): JSX.Element => {
  // Check if CV is improved - either by Status field or by presence of improved scores
  const hasImprovedScores = !!(resume['Improved Global Rating'] && parseScoreValue(resume['Improved Global Rating']) > 0);
  const isImproved = resume['Status'] === 'Improved' || resume['Status'] === 'improved' || hasImprovedScores;
  const [activeSubTab, setActiveSubTab] = useState<'initial' | 'postImprovement'>('postImprovement');

  // Parse initial suggestions
  const { bySection: initialSuggestions } = parseImprovements(resume['Key Improvements']);
  
  // Parse post-improvement suggestions
  const { bySection: improvedSuggestions } = parseImprovements(resume['Improved Key Improvements']);

  // Initial scores
  const initialScores = {
    global: parseScoreValue(resume['Global Rating']),
    executiveSummary: parseScoreValue(resume['Executive Summary Score']),
    skills: parseScoreValue(resume['Skills Score']),
    experience: parseScoreValue(resume['Experience Score']),
    education: parseScoreValue(resume['Education Score']),
    ats: parseScoreValue(resume['ATS Score']),
    hobbiesLanguages: parseScoreValue(resume['Hobbies Languages Score'])
  };

  // Improved scores
  const improvedScores = {
    global: parseScoreValue(resume['Improved Global Rating']),
    executiveSummary: parseScoreValue(resume['Improved Executive Summary Score']),
    skills: parseScoreValue(resume['Improved Skills Score']),
    experience: parseScoreValue(resume['Improved Experience Score']),
    education: parseScoreValue(resume['Improved Education Score']),
    ats: parseScoreValue(resume['Improved ATS Score']),
    hobbiesLanguages: parseScoreValue(resume['Improved Hobbies Languages Score'])
  };

  // Build sections for initial analysis (no comparison)
  const initialSections: Record<string, SectionData> = {
    [t('resume.analysis.sections.executiveBrief')]: {
      score: initialScores.executiveSummary,
      suggestions: initialSuggestions.executiveSummary || [],
      improved: null
    },
    [t('resume.analysis.sections.skillsKeywords')]: {
      score: initialScores.skills,
      suggestions: initialSuggestions.skills || [],
      improved: null
    },
    [t('resume.analysis.sections.experience')]: {
      score: initialScores.experience,
      suggestions: initialSuggestions.experiences || [],
      improved: null
    },
    [t('resume.analysis.sections.education')]: {
      score: initialScores.education,
      suggestions: initialSuggestions.education || [],
      improved: null
    },
    [t('resume.analysis.sections.atsOptimization')]: {
      score: initialScores.ats,
      suggestions: initialSuggestions.atsOptimization || [],
      improved: null
    },
    [t('resume.analysis.sections.hobbiesLanguages')]: {
      score: initialScores.hobbiesLanguages,
      suggestions: initialSuggestions.hobbiesLanguages || [],
      improved: null
    }
  };

  // Build sections for post-improvement analysis (with comparison to initial)
  const postImprovementSections: Record<string, SectionData> = {
    [t('resume.analysis.sections.executiveBrief')]: {
      score: initialScores.executiveSummary,
      suggestions: improvedSuggestions.executiveSummary || [],
      improved: improvedScores.executiveSummary || null
    },
    [t('resume.analysis.sections.skillsKeywords')]: {
      score: initialScores.skills,
      suggestions: improvedSuggestions.skills || [],
      improved: improvedScores.skills || null
    },
    [t('resume.analysis.sections.experience')]: {
      score: initialScores.experience,
      suggestions: improvedSuggestions.experiences || [],
      improved: improvedScores.experience || null
    },
    [t('resume.analysis.sections.education')]: {
      score: initialScores.education,
      suggestions: improvedSuggestions.education || [],
      improved: improvedScores.education || null
    },
    [t('resume.analysis.sections.atsOptimization')]: {
      score: initialScores.ats,
      suggestions: improvedSuggestions.atsOptimization || [],
      improved: improvedScores.ats || null
    },
    [t('resume.analysis.sections.hobbiesLanguages')]: {
      score: initialScores.hobbiesLanguages,
      suggestions: improvedSuggestions.hobbiesLanguages || [],
      improved: improvedScores.hobbiesLanguages || null
    }
  };

  // For non-improved CVs, show the original view
  if (!isImproved) {
    return (
      <AnalysisPanel
        globalScore={initialScores.global}
        sections={initialSections}
        t={t}
      />
    );
  }

  // For improved CVs, show sub-tabs
  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveSubTab('initial')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeSubTab === 'initial'
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {t('resume.analysis.tabs.initialAnalysis') || 'Analyse initiale'}
        </button>
        <button
          onClick={() => setActiveSubTab('postImprovement')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeSubTab === 'postImprovement'
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {t('resume.analysis.tabs.postImprovementAnalysis') || 'Analyse post-amélioration'}
        </button>
      </div>

      {/* Content based on active sub-tab */}
      {activeSubTab === 'initial' ? (
        <AnalysisPanel
          globalScore={initialScores.global}
          sections={initialSections}
          t={t}
        />
      ) : (
        <AnalysisPanel
          globalScore={improvedScores.global}
          sections={postImprovementSections}
          t={t}
          showComparison={true}
          comparisonScore={initialScores.global}
        />
      )}
    </div>
  );
};

export default OverviewTab;
