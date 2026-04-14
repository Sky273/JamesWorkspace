/**
 * Compare Tab Component
 * TypeScript version
 */

import { useTranslation } from 'react-i18next';
import { createSafeHtml } from '../../utils/sanitizer.frontend';
import OriginalSourcePreview from './OriginalSourcePreview';

interface Resume {
  id: string;
  'Global Rating'?: string | number;
  'Improved Global Rating'?: string | number;
  'Original Text'?: string;
  'Improved Text'?: string;
  'File Name'?: string;
  'Resume File'?: Array<{
    filename?: string;
    type?: string;
    url?: string;
  }>;
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

interface CompareTabProps {
  resume: Resume;
}

const CompareTab = ({ resume }: CompareTabProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('resume.analysis.originalResume')}
            </h3>
            <span className="px-2 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-full dark:text-blue-400 dark:bg-blue-900/30">
              Score : {parseScoreValue(resume['Global Rating'])}%
            </span>
          </div>
          <OriginalSourcePreview
            resume={resume}
            title=""
            description="Comparaison visuelle avec le fichier source original importé."
            frameHeightClassName="h-[600px]"
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('resume.analysis.improvedResume')}
            </h3>
            <span className="px-2 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full dark:text-green-400 dark:bg-green-900/30">
              Score : {parseScoreValue(resume['Improved Global Rating'])}%
            </span>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert max-h-[600px] overflow-y-auto">
            <div 
              dangerouslySetInnerHTML={createSafeHtml(
                resume['Improved Text'] || ''
              )} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareTab;
