/**
 * Original Text Tab Component
 * TypeScript version
 */

import { useTranslation } from 'react-i18next';

interface Resume {
  'Original Text'?: string;
  'Improved Text'?: string;
  [key: string]: unknown;
}

interface OriginalTextTabProps {
  resume: Resume;
}

const OriginalTextTab = ({ resume }: OriginalTextTabProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Header bar with title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('resume.analysis.originalText')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('resume.analysis.originalTextDescription')}
          </p>
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
