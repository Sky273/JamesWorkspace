import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import type { SectionData } from './OverviewTab.utils';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface RatingBarProps {
  label: string;
  percentage: number;
  improved?: number | null;
}

interface AnalysisPanelProps {
  globalScore: number;
  sections: Record<string, SectionData>;
  t: (key: string) => string;
  showComparison?: boolean;
  comparisonScore?: number | null;
}

interface CategoryConfig {
  title: string;
  icon: HeroIcon;
  textColor: string;
  iconColor: string;
}

export const RatingBar = ({ label, percentage, improved }: RatingBarProps): JSX.Element => {
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
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{displayPercentage}%</span>
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

export const AnalysisPanel = ({ globalScore, sections, t, showComparison = false, comparisonScore = null }: AnalysisPanelProps): JSX.Element => {
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
                    <RatingBar label={section} percentage={score} improved={improved} />
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
