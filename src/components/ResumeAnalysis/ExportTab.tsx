/**
 * Export Tab Component
 * TypeScript version
 */

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface Resume {
  'Improved Text'?: string;
  'Original Text'?: string;
  [key: string]: unknown;
}

interface Template {
  id: string;
  name: string;
}

interface ExportTabProps {
  resume: Resume;
  templates: Template[];
  selectedTemplate: string;
  onTemplateChange: (templateId: string) => void;
  loadingTemplates: boolean;
  exportLoading: boolean;
  onExport: () => void;
}

const ExportTab = ({ resume, templates, selectedTemplate, onTemplateChange, loadingTemplates, exportLoading, onExport }: ExportTabProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('resume.analysis.exportOptions.title')}
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('resume.analysis.exportOptions.template')}
              </label>
              <select
                id="template"
                value={selectedTemplate}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onTemplateChange(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">{t('resume.analysis.exportOptions.selectTemplate')}</option>
                {loadingTemplates ? (
                  <option disabled>{t('resume.analysis.exportOptions.loadingTemplates')}</option>
                ) : templates.length === 0 ? (
                  <option disabled>{t('resume.analysis.exportOptions.noTemplates')}</option>
                ) : (
                  templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))
                )}
              </select>
            </div>
            <button
              onClick={onExport}
              disabled={!selectedTemplate || exportLoading}
              className={`w-full inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-lg text-white ${!selectedTemplate || exportLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} transition-colors duration-200`}
            >
              {exportLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('resume.analysis.exportOptions.exporting')}
                </>
              ) : (
                t('resume.analysis.exportOptions.exportPDF')
              )}
            </button>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('resume.analysis.exportOptions.preview')}
          </h3>
          <div className="prose prose-sm max-w-none dark:prose-invert max-h-96 overflow-y-auto">
            <div 
              dangerouslySetInnerHTML={{ 
                __html: resume['Improved Text'] || resume['Original Text'] || '' 
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportTab;
