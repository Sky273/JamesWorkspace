/**
 * Export Modal Component for Adaptations Page
 * TypeScript version
 */

import { ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';

interface Template {
  id: string;
  Name: string;
}

interface ExportModalProps {
  show: boolean;
  onClose: () => void;
  templates: Template[];
  selectedTemplate: string;
  setSelectedTemplate: (templateId: string) => void;
  selectedFormat: ExportFormat;
  setSelectedFormat: (format: ExportFormat) => void;
  onConfirm: () => void;
  loading: boolean;
  loadingTemplates: boolean;
}

const ExportModal = ({ show, onClose, templates, selectedTemplate, setSelectedTemplate, selectedFormat, setSelectedFormat, onConfirm, loading, loadingTemplates }: ExportModalProps): JSX.Element | null => {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('common.export')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('resume.analysis.exportOptions.selectTemplate')}</label>
          <select value={selectedTemplate} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTemplate(e.target.value)} disabled={loadingTemplates} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500">
            {templates.map(template => (<option key={template.id} value={template.id}>{template.Name}</option>))}
          </select>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('adaptations.exportModal.description')}</p>
          <label className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('resume.analysis.exportOptions.format', 'Format')}</label>
          <select value={selectedFormat} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedFormat(e.target.value as ExportFormat)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500">
            <option value="pdf">PDF</option>
            <option value="docx">DOCX (Word)</option>
            <option value="doc">DOC (Word 97-2003)</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} disabled={loading} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50">{t('common.cancel')}</button>
          <button onClick={onConfirm} disabled={loading || loadingTemplates || !selectedTemplate} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
            <ArrowDownTrayIcon className="w-5 h-5" />
            {loading ? t('resume.actions.exporting') : t('common.export')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ExportModal;
