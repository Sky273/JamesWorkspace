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
      <div className="prose max-w-none dark:prose-invert">
        <div className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          {resume['Original Text']}
        </div>
        {!resume['Improved Text'] && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onImprove}
              disabled={isImproving}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white ${isImproving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} transition-colors duration-200`}
            >
              {isImproving ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <SparklesIcon className="mr-2 h-5 w-5" />
              )}
              {isImproving ? t('resume.actions.improving') : t('resume.actions.improveWithAI')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OriginalTextTab;
