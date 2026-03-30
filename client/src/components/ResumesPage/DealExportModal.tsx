/**
 * DealExportModal - Modal for batch exporting a deal's CVs and adaptations
 * Allows selecting a template and export formats (PDF, DOC, DOCX)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  XMarkIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  BriefcaseIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { templateService, Template } from '../../utils/templateService';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';

interface DealExportModalProps {
  dealId: string;
  dealTitle: string;
  resumeCount: number;
  adaptationCount: number;
  onClose: () => void;
}

const EXPORT_FORMATS = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'DOCX' },
  { id: 'doc', label: 'DOC' }
] as const;

type ExportFormat = typeof EXPORT_FORMATS[number]['id'];

const DealExportModal = ({ dealId, dealTitle, resumeCount, adaptationCount, onClose }: DealExportModalProps): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authPost } = useAuthFetch();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(new Set(['pdf']));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const allTemplates = await templateService.getAllTemplates();
        setTemplates(allTemplates);
        if (allTemplates.length > 0) {
          setSelectedTemplateId(allTemplates[0].id);
        }
      } catch (err) {
        logger.error('Failed to load templates:', err);
        toast.error(t('dealExport.errorLoadingTemplates'));
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [t]);

  const toggleFormat = (format: ExportFormat) => {
    setSelectedFormats(prev => {
      const next = new Set(prev);
      if (next.has(format)) {
        if (next.size > 1) next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedTemplateId || selectedFormats.size === 0) return;

    setSubmitting(true);
    try {
      const response = await authPost('/api/batch-jobs/deal-export', {
        dealId,
        templateId: selectedTemplateId,
        exportFormats: Array.from(selectedFormats)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du job');
      }

      const job = await response.json();
      toast.success(
        t('dealExport.jobCreated', { total: job.total_items }),
        { duration: 5000 }
      );
      onClose();
      navigate('/batch-jobs');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      logger.error('Failed to create deal export job:', err);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = resumeCount + adaptationCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ArrowDownTrayIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('dealExport.title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[300px]">{dealTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Summary */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
            <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <DocumentTextIcon className="w-4 h-4 text-blue-500" />
              <span><strong>{resumeCount}</strong> CV{resumeCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <BriefcaseIcon className="w-4 h-4 text-indigo-500" />
              <span><strong>{adaptationCount}</strong> {t('dealExport.adaptations')}{adaptationCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Template selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dealExport.template')}
            </label>
            {loadingTemplates ? (
              <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : templates.length === 0 ? (
              <p className="text-sm text-red-500">{t('dealExport.noTemplates')}</p>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.Name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dealExport.formats')}
            </label>
            <div className="flex gap-2">
              {EXPORT_FORMATS.map(({ id, label }) => {
                const isSelected = selectedFormats.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleFormat(id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {isSelected && <CheckIcon className="w-4 h-4" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('dealExport.summary', {
              total: totalItems,
              formats: selectedFormats.size
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedTemplateId || selectedFormats.size === 0 || totalItems === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('dealExport.creating')}
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  {t('dealExport.launch')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealExportModal;
