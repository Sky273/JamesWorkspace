/**
 * GlobalRatingDisplay Component
 * TypeScript version
 */

import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { ArrowUpIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

interface Resume {
  'Global Rating'?: string;
  'Improved Global Rating'?: string;
}

interface GlobalRatingDisplayProps {
  resume?: Resume;
  rating?: string;
  improvedRating?: string;
}

const GlobalRatingDisplay = ({ resume, rating, improvedRating }: GlobalRatingDisplayProps): JSX.Element => {
  const { t } = useTranslation();
  const actualRating = resume ? resume['Global Rating'] : rating;
  const actualImprovedRating = resume ? resume['Improved Global Rating'] : improvedRating;
  
  const numericRating = parseInt(actualRating || '0');
  const numericImprovedRating = actualImprovedRating ? parseInt(actualImprovedRating) : null;
  const improvement = numericImprovedRating ? numericImprovedRating - numericRating : 0;
  const hasImprovement = numericImprovedRating !== null && improvement !== 0;
  const isNegativeImprovement = improvement < 0;

  return (
    <div className="flex items-center justify-center space-x-8">
      <div className="w-32 h-32">
        <CircularProgressbar
          value={numericRating}
          text={`${numericRating}%`}
          styles={buildStyles({
            textSize: '16px',
            pathColor: '#4f46e5',
            textColor: '#4f46e5',
            trailColor: '#e5e7eb',
          })}
        />
      </div>

      {hasImprovement && (
        <>
          <div className="flex flex-col items-center justify-center">
            <ArrowUpIcon className={`h-8 w-8 ${isNegativeImprovement ? 'text-red-500 rotate-180' : 'text-green-500'}`} />
            <span className={`text-lg font-semibold ${isNegativeImprovement ? 'text-red-500' : 'text-green-500'}`}>
              {isNegativeImprovement ? '' : '+'}{improvement}%
            </span>
          </div>

          <div className="w-32 h-32">
            <CircularProgressbar
              value={numericImprovedRating}
              text={`${numericImprovedRating}%`}
              styles={buildStyles({
                textSize: '16px',
                pathColor: isNegativeImprovement ? '#ef4444' : '#22c55e',
                textColor: isNegativeImprovement ? '#ef4444' : '#22c55e',
                trailColor: '#e5e7eb',
              })}
            />
          </div>
        </>
      )}

      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('resume.analysis.globalRating')}
        </h3>
        {hasImprovement ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {isNegativeImprovement 
              ? t('resume.analysis.scoreDegradedBy') 
              : t('resume.analysis.scoreImprovedBy')} {Math.abs(improvement)}%
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('resume.analysis.clickImproveHint')}
          </p>
        )}
      </div>
    </div>
  );
};

export default GlobalRatingDisplay;
