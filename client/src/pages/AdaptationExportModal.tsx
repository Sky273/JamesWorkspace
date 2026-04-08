/**
 * AdaptationExportModal - PDF export template selector modal
 * Extracted from AdaptationViewPage.tsx
 */

import { ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';

interface Template {
  id: string;
  Name: string;
  Status?: string;
}

interface AdaptationExportModalProps {
  templates: Template[];
  selectedTemplate: string;
  setSelectedTemplate: (id: string) => void;
  selectedFormat: ExportFormat;
  setSelectedFormat: (format: ExportFormat) => void;
  loadingTemplates: boolean;
  exportLoading: boolean;
  onExport: () => void;
  onClose: () => void;
}

export default function AdaptationExportModal({
  templates,
  selectedTemplate,
  setSelectedTemplate,
  selectedFormat,
  setSelectedFormat,
  loadingTemplates,
  exportLoading,
  onExport,
  onClose
}: AdaptationExportModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('common.export')}
        </h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('export.selectTemplate')}
          </label>
          {loadingTemplates ? (
            <p className="text-sm text-gray-500">{t('export.loadingTemplates')}</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-red-500">{t('export.noTemplates')}</p>
          ) : (
            <select 
              value={selectedTemplate} 
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTemplate(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              {templates.map(template => (
                <option key={template.id} value={template.id}>{template.Name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('resume.analysis.exportOptions.format', 'Format')}
          </label>
          <select
            value={selectedFormat}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedFormat(e.target.value as ExportFormat)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="pdf">PDF</option>
            <option value="docx">DOCX (Word)</option>
            <option value="doc">DOC (Word 97-2003)</option>
          </select>
        </div>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button 
            onClick={onExport}
            disabled={exportLoading || loadingTemplates || !selectedTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exportLoading ? t('resume.actions.exporting') : t('common.export')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
