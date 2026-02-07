/**
 * Rating Components for Resume Analysis
 * TypeScript version
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import classNames from 'classnames';
import { ArrowRightIcon, ArrowsUpDownIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import logger from '../../utils/logger.frontend';

interface Resume {
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
  percentage: string | number;
  delay?: number;
  improved?: string | number | null;
}

interface RatingSectionProps {
  title: string;
  rating: string | number;
  improvedRating?: string | number | null;
  suggestions?: string[];
  delay?: number;
}

interface RatingWithSuggestionsProps {
  label: string;
  percentage: string | number;
  suggestions?: string[];
  delay?: number;
}

interface CircularProgressProps {
  percentage: number;
  size?: number;
  improved?: boolean;
  negative?: boolean;
}

interface ScoreCardProps {
  title: string;
  originalScore: string | number;
  improvedScore?: string | number | null;
  suggestions?: string[];
  delay?: number;
}

interface SectionScoresProps {
  resume: Resume;
}

interface DiffViewerProps {
  original: string;
  improved: string;
}

interface Difference {
  type: 'modification' | 'addition' | 'deletion';
  content?: string;
  original?: string;
  improved?: string;
  line: number;
}

export const RatingBar = ({ label, percentage, delay = 0, improved = null }: RatingBarProps): JSX.Element => {
  const numericPercentage = parseScoreValue(percentage);
  const numericImproved = improved !== null && improved !== undefined && improved !== '' ? parseScoreValue(improved) : null;
  const improvementDiff = numericImproved !== null ? numericImproved - numericPercentage : 0;
  const hasImprovement = numericImproved !== null && improvementDiff !== 0;
  const isNegativeImprovement = improvementDiff < 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <div className="flex items-center space-x-2">
          {hasImprovement && (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {percentage}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">→</span>
              <span className={classNames(
                "text-sm font-medium",
                isNegativeImprovement ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )}>
                {improved}
              </span>
              <span className={classNames(
                "text-xs font-medium",
                isNegativeImprovement ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )}>
                ({isNegativeImprovement ? '' : '+'}{improvementDiff}%)
              </span>
            </>
          )}
          {!hasImprovement && (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {percentage}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {hasImprovement && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${numericPercentage}%` }}
            transition={{ duration: 0.8, delay }}
            className="absolute h-full rounded-full bg-blue-300 dark:bg-blue-700 opacity-50"
          />
        )}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${numericImproved || numericPercentage}%` }}
          transition={{ duration: 1, delay: hasImprovement ? delay + 0.3 : delay }}
          className={classNames(
            "absolute h-full rounded-full",
            hasImprovement 
              ? (isNegativeImprovement ? "bg-red-500 dark:bg-red-600" : "bg-green-500 dark:bg-green-600") 
              : "bg-blue-500 dark:bg-blue-600"
          )}
        />
      </div>
    </div>
  );
};

export const RatingSection = ({ title, rating, improvedRating, suggestions = [], delay = 0 }: RatingSectionProps): JSX.Element => {
  return (
    <div className="space-y-4">
      <RatingBar
        label={title}
        percentage={rating}
        delay={delay}
        improved={improvedRating}
      />
      {suggestions.length > 0 && (
        <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          <ul className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const RatingWithSuggestions = ({ label, percentage, suggestions = [], delay = 0 }: RatingWithSuggestionsProps): JSX.Element => {
  const numericPercentage = parseScoreValue(percentage);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {percentage}
        </span>
      </div>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${numericPercentage}%` }}
        transition={{ duration: 0.5, delay }}
        className="h-2 bg-blue-600 rounded-full"
      />
      {suggestions && suggestions.length > 0 && (
        <div className="mt-2">
          <ul className="list-disc list-inside space-y-1">
            {suggestions.map((suggestion, index) => (
              <li 
                key={index}
                className="text-sm text-gray-600 dark:text-gray-400 ml-2"
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const CircularProgress = ({ percentage, size = 80, improved = false, negative = false }: CircularProgressProps): JSX.Element => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  const getColorClass = () => {
    if (negative) return 'text-red-500';
    if (improved) return 'text-green-500';
    return 'text-indigo-600';
  };
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="absolute transform -rotate-90" width={size} height={size}>
        <circle
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${getColorClass()} transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-semibold ${getColorClass()}`}>
          {percentage}%
        </span>
      </div>
    </div>
  );
};

export const ScoreCard = ({ title, originalScore, improvedScore, suggestions = [], delay = 0 }: ScoreCardProps): JSX.Element => {
  const { t } = useTranslation();
  const numericOriginal = parseScoreValue(originalScore);
  const numericImproved = improvedScore !== null && improvedScore !== undefined && improvedScore !== '' 
    ? parseScoreValue(improvedScore) 
    : null;
  const improvementDiff = numericImproved !== null ? numericImproved - numericOriginal : 0;
  const hasImprovement = numericImproved !== null && improvementDiff !== 0;
  const isNegativeImprovement = improvementDiff < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
    >
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
      <div className="flex items-center space-x-6 mb-4">
        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('resume.analysis.original')}</span>
          <CircularProgress percentage={numericOriginal} />
        </div>
        {hasImprovement && (
          <>
            <div className={isNegativeImprovement ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}>
              <ArrowRightIcon className={`h-6 w-6 ${isNegativeImprovement ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('resume.analysis.improved')}</span>
              <CircularProgress percentage={numericImproved} improved={!isNegativeImprovement} negative={isNegativeImprovement} />
            </div>
          </>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('resume.analysis.suggestions')}</h4>
          <ul className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: delay + 0.1 * index }}
                className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <LightBulbIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>{suggestion}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
};

export const SectionScores = ({ resume }: SectionScoresProps): JSX.Element => {
  const { t } = useTranslation();
  
  // Parse Key Improvements - can be either a simple array or an object by section
  const { keyImprovementsBySection, globalSuggestions } = useMemo(() => {
    let bySection: Record<string, string[]> = {};
    let global: string[] = [];
    
    try {
      const rawImprovements = resume['Key Improvements'];
      
      if (rawImprovements) {
        let parsed: unknown;
        if (typeof rawImprovements === 'string') {
          parsed = JSON.parse(rawImprovements);
        } else {
          parsed = rawImprovements;
        }
        
        // Check if it's a simple array (global suggestions)
        if (Array.isArray(parsed)) {
          global = parsed as string[];
        } 
        // Check if it's an object with section keys
        else if (typeof parsed === 'object' && parsed !== null) {
          const obj = parsed as Record<string, unknown>;
          // Check if it has section keys like executiveSummary, skills, etc.
          if (obj.executiveSummary || obj.skills || obj.experiences || obj.education) {
            bySection = obj as Record<string, string[]>;
          }
          // Check if it has a suggestions property that contains the sections
          else if (obj.suggestions && typeof obj.suggestions === 'object') {
            bySection = obj.suggestions as Record<string, string[]>;
          }
        }
      }
    } catch (e) {
      logger.error('Error parsing Key Improvements:', e);
    }
    
    return { keyImprovementsBySection: bySection, globalSuggestions: global };
  }, [resume]);

  const scores = useMemo(() => ({
    executiveSummary: {
      title: t('resume.analysis.sections.executiveBrief'),
      score: resume['Executive Summary Score'] || '0',
      improvedScore: resume['Improved Executive Summary Score'],
      suggestions: keyImprovementsBySection.executiveSummary || []
    },
    skills: {
      title: t('resume.analysis.sections.skillsKeywords'),
      score: resume['Skills Score'] || '0',
      improvedScore: resume['Improved Skills Score'],
      suggestions: keyImprovementsBySection.skills || []
    },
    experience: {
      title: t('resume.analysis.sections.experience'),
      score: resume['Experience Score'] || '0',
      improvedScore: resume['Improved Experience Score'],
      suggestions: keyImprovementsBySection.experiences || []
    },
    education: {
      title: t('resume.analysis.sections.education'),
      score: resume['Education Score'] || '0',
      improvedScore: resume['Improved Education Score'],
      suggestions: keyImprovementsBySection.education || []
    },
    ats: {
      title: t('resume.analysis.sections.atsOptimization'),
      score: resume['ATS Score'] || '0',
      improvedScore: resume['Improved ATS Score'],
      suggestions: keyImprovementsBySection.atsOptimization || []
    },
    hobbiesLanguages: {
      title: t('resume.analysis.sections.hobbiesLanguages'),
      score: resume['Hobbies Languages Score'] || '0',
      improvedScore: resume['Improved Hobbies Languages Score'],
      suggestions: keyImprovementsBySection.hobbiesLanguages || []
    }
  }), [resume, t, keyImprovementsBySection]);

  const isImproved = resume['Status'] === 'Improved';
  const hasSuggestions = globalSuggestions.length > 0 || Object.values(scores).some(s => s.suggestions.length > 0);

  return (
    <div className="space-y-6">
      {/* Notice for improved CVs */}
      {isImproved && hasSuggestions && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
        >
          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center">
            <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {t('resume.analysis.suggestionsFromOriginal')}
          </p>
        </motion.div>
      )}

      {/* Global suggestions (when Key Improvements is a simple array) */}
      {globalSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('resume.analysis.suggestions')}
          </h3>
          <ul className="space-y-2">
            {globalSuggestions.map((suggestion, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
                className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <LightBulbIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>{suggestion}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
      
      {/* Section scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(scores).map(([key, data], index) => (
          <ScoreCard
            key={key}
            title={data.title}
            originalScore={data.score}
            improvedScore={data.improvedScore}
            suggestions={data.suggestions}
            delay={index * 0.2}
          />
        ))}
      </div>
    </div>
  );
};

const findDifferences = (original: string, improved: string): Difference[] => {
  if (!original || !improved) return [];
  
  const originalLines = original.split('\n');
  const improvedLines = improved.split('\n');
  const differences: Difference[] = [];
  
  let i = 0;
  let j = 0;
  
  while (i < originalLines.length || j < improvedLines.length) {
    if (i >= originalLines.length) {
      differences.push({
        type: 'addition',
        content: improvedLines[j],
        line: j + 1
      });
      j++;
    } else if (j >= improvedLines.length) {
      differences.push({
        type: 'deletion',
        content: originalLines[i],
        line: i + 1
      });
      i++;
    } else if (originalLines[i] !== improvedLines[j]) {
      differences.push({
        type: 'modification',
        original: originalLines[i],
        improved: improvedLines[j],
        line: i + 1
      });
      i++;
      j++;
    } else {
      i++;
      j++;
    }
  }
  
  return differences;
};

export const DiffViewer = ({ original, improved }: DiffViewerProps): JSX.Element => {
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const differences = findDifferences(original, improved);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowDiff(!showDiff)}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <ArrowsUpDownIcon className="w-4 h-4 mr-1" />
          {showDiff ? 'Hide Changes' : 'Show Changes'}
        </button>
      </div>
      
      {showDiff && differences.length > 0 && (
        <div className="space-y-2 text-sm font-mono">
          {differences.map((diff, index) => (
            <div key={index} className="p-2 rounded">
              {diff.type === 'modification' ? (
                <>
                  <div className="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-1 rounded">
                    - {diff.original}
                  </div>
                  <div className="text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/10 p-1 rounded mt-1">
                    + {diff.improved}
                  </div>
                </>
              ) : diff.type === 'addition' ? (
                <div className="text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/10 p-1 rounded">
                  + {diff.content}
                </div>
              ) : (
                <div className="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-1 rounded">
                  - {diff.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
