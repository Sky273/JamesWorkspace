/**
 * Export Tab Component
 * TypeScript version
 */

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createSafeHtml } from '../../utils/sanitizer.frontend';

interface Resume {
  'Improved Text'?: string;
  'Original Text'?: string;
  [key: string]: unknown;
}

interface Template {
  id: string;
  Name: string;
}

export type ExportFormat = 'pdf' | 'docx' | 'doc';

interface ExportTabProps {
  resume: Resume;
  templates: Template[];
  selectedTemplate: string;
  onTemplateChange: (templateId: string) => void;
  loadingTemplates: boolean;
  exportLoading: boolean;
  onExport: () => void;
  onSendEmail?: () => void;
  selectedFormat?: ExportFormat;
  onFormatChange?: (format: ExportFormat) => void;
}

const ExportTab = ({ resume, templates, selectedTemplate, onTemplateChange, loadingTemplates, exportLoading, onExport, onSendEmail, selectedFormat = 'pdf', onFormatChange }: ExportTabProps): JSX.Element => {
  const { t } = useTranslation();

  const formatOptions: { value: ExportFormat; label: string }[] = [
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'DOCX (Word)' },
    { value: 'doc', label: 'DOC (Word 97-2003)' }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="">{t('resume.analysis.exportOptions.selectTemplate')}</option>
                {loadingTemplates ? (
                  <option disabled>{t('resume.analysis.exportOptions.loadingTemplates')}</option>
                ) : templates.length === 0 ? (
                  <option disabled>{t('resume.analysis.exportOptions.noTemplates')}</option>
                ) : (
                  templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.Name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('resume.analysis.exportOptions.format', 'Format')}
              </label>
              <select
                id="format"
                value={selectedFormat}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onFormatChange?.(e.target.value as ExportFormat)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                {formatOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={onExport}
              disabled={!selectedTemplate || exportLoading}
              className={`btn btn-primary w-full inline-flex justify-center items-center px-4 py-2 text-sm ${!selectedTemplate || exportLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                t('resume.analysis.exportOptions.export', 'Exporter')
              )}
            </button>
            
            {onSendEmail && (
              <button
                onClick={onSendEmail}
                disabled={!selectedTemplate}
                className={`btn btn-secondary w-full inline-flex justify-center items-center px-4 py-2 text-sm ${!selectedTemplate ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {t('resume.analysis.exportOptions.sendEmail')}
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('resume.analysis.exportOptions.preview')}
          </h3>
          <div className="prose prose-sm max-w-none dark:prose-invert max-h-96 overflow-y-auto">
            <div 
              dangerouslySetInnerHTML={createSafeHtml(
                resume['Improved Text'] || resume['Original Text'] || ''
              )} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportTab;
