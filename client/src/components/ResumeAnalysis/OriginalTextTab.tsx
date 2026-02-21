/**
 * Original Text Tab Component
 * TypeScript version
 */

import { SparklesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface Resume {
  'Original Text'?: string;
  'Improved Text'?: string;
  [key: string]: unknown;
}

interface OriginalTextTabProps {
  resume: Resume;
  isImproving: boolean;
  onImprove: () => void;
}

const OriginalTextTab = ({ resume, isImproving, onImprove }: OriginalTextTabProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Header bar with title and action button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('resume.analysis.originalText')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('resume.analysis.originalTextDescription')}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {!resume['Improved Text'] && (
            <button
              onClick={onImprove}
              disabled={isImproving}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                isImproving 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isImproving ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <SparklesIcon className="h-4 w-4" />
              )}
              {isImproving ? t('resume.actions.improving') : t('resume.actions.improveWithAI')}
            </button>
          )}
        </div>
      </div>

      {/* Original text content */}
      <div className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {resume['Original Text']}
      </div>
    </div>
  );
};

export default OriginalTextTab;
