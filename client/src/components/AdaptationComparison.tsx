/**
 * Adaptation Comparison Component
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowsRightLeftIcon, DocumentTextIcon, SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { templateService } from '../utils/templateService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { createSafeHtml } from '../utils/sanitizer.frontend';
import { useTranslation } from 'react-i18next';
import { createAuthOptionsWithCsrf, fetchWithCsrfRetry } from '../utils/apiInterceptor';
import { removeSuggestionMarkers } from './TiptapEditor/suggestionsHtml';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  summarizeTemplatePayload,
} from '../utils/templateFragments';
import type { ExportFormat } from './ResumeAnalysis/ExportTab';

interface Template {
  id: string;
  Name: string;
  Status?: string;
  TemplateContent?: string;
  Stylesheet?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
}

interface AdaptationComparisonProps {
  originalText: string;
  adaptedText: string;
  matchScore?: string | number;
  candidateName?: string;
  candidateTitle?: string;
  simplified?: boolean;
}

const AdaptationComparison = ({ originalText, adaptedText, matchScore, candidateName, candidateTitle, simplified = false }: AdaptationComparisonProps): JSX.Element => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'side-by-side' | 'adapted-only'>(simplified ? 'side-by-side' : 'side-by-side');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('pdf');

  const fetchTemplates = useCallback(async (): Promise<void> => {
    try {
      setLoadingTemplates(true);
      const fetchedTemplates = await templateService.getAllTemplates();
      setTemplates(fetchedTemplates.filter((t: Template) => t.Status === 'Active'));
      if (fetchedTemplates.length > 0) setSelectedTemplate(fetchedTemplates[0].id);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      toast.error(t('adaptations.messages.loadError'));
    } finally {
      setLoadingTemplates(false);
    }
  }, [t]);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  const handleExport = async (): Promise<void> => {
    try {
      setExportLoading(true);
      if (!selectedTemplate) { toast.error(t('templates.selectTemplate')); return; }

      const template = await templateService.getTemplateById(selectedTemplate);
      if (!template) throw new Error('Template not found');

      // Clean suggestion markers from content before export
      const content = removeSuggestionMarkers(adaptedText);
      const name = candidateName || 'Candidat';
      const title = candidateTitle || 'Titre Professionnel';
      const fileExtension = selectedExportFormat === 'pdf' ? 'pdf' : selectedExportFormat;
      const simplifiedFilename = `${name.replace(/[^a-zA-Z]/g, '_')}_adapted.${fileExtension}`;

      const stylesheet = normalizeTemplateStylesheet(template.Stylesheet);
      const processedBody = applyTemplatePlaceholders(template.TemplateContent, {
        name,
        title,
        content,
      });
      const processedHeader = applyTemplatePlaceholders(
        normalizeTemplateFragment(template.HeaderContent, 'header'),
        { name, title }
      );
      const processedFooter = applyTemplatePlaceholders(
        normalizeTemplateFragment(template.FooterContent, 'footer'),
        { name, title }
      );
      logger.warn('Adaptation export payload normalized', {
        templateId: template.id,
        filename: simplifiedFilename,
        htmlLength: processedBody.length,
        ...summarizeTemplatePayload(template),
      });

      const exportOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ 
          htmlContent: processedBody, 
          filename: simplifiedFilename,
          stylesheet: stylesheet,
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25,
          format: selectedExportFormat,
        })
      });

      const response = await fetchWithCsrfRetry(selectedExportFormat === 'pdf' ? '/generate-pdf' : '/generate-docx', exportOptions, 300000);

      if (!response.ok) throw new Error(`Failed to generate ${selectedExportFormat.toUpperCase()}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/\s+/g, '_')}_adapted_${template.Name}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('adaptations.messages.exportSuccess'));
    } catch (error) {
      logger.error('Error exporting adaptation:', error);
      toast.error(t('adaptations.messages.exportError'));
    } finally {
      setExportLoading(false);
    }
  };

  const renderHTML = (html: string): { __html: string } => createSafeHtml(html || '');

  return (
    <div className="space-y-4">
      {!simplified && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Résultat de l'Adaptation</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Template:</label>
              <select value={selectedTemplate} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTemplate(e.target.value)} disabled={loadingTemplates} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500">
                {templates.map(template => (<option key={template.id} value={template.id}>{template.Name}</option>))}
              </select>
              <button onClick={handleExport} disabled={exportLoading || loadingTemplates || !selectedTemplate} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                <ArrowDownTrayIcon className="w-4 h-4" />{exportLoading ? t('resume.actions.exporting') : t('common.export')}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode('side-by-side')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'side-by-side' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                <ArrowsRightLeftIcon className="w-4 h-4 inline mr-1" />Comparaison
              </button>
              <button onClick={() => setViewMode('adapted-only')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'adapted-only' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                <SparklesIcon className="w-4 h-4 inline mr-1" />CV Adapté
              </button>
            </div>
          </div>
        </div>
      )}

      {matchScore && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Score de correspondance:</span>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">{matchScore}</span>
        </div>
      )}

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2"><DocumentTextIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" /><h4 className="font-semibold text-gray-900 dark:text-gray-100">CV Original</h4></div>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto"><div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={renderHTML(originalText)} /></div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500 overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" /><h4 className="font-semibold text-gray-900 dark:text-gray-100">CV Adapté</h4><span className="ml-auto px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded">Nouveau</span></div>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto"><div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={renderHTML(adaptedText)} /></div>
          </motion.div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" /><h4 className="font-semibold text-gray-900 dark:text-gray-100">CV Adapté à la Mission</h4></div>
          </div>
          <div className="p-8 max-h-[800px] overflow-y-auto"><div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={renderHTML(adaptedText)} /></div>
        </motion.div>
      )}

      {simplified && (
        <div className="flex justify-end">
          <button 
            onClick={() => setShowExportModal(true)} 
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {t('common.export')}
          </button>
        </div>
      )}

      {!simplified && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="font-medium mb-1">À propos de cette adaptation</p>
              <p>Ce CV a été optimisé pour correspondre aux exigences de la mission. Les compétences pertinentes ont été mises en avant, le résumé exécutif a été reformulé, et les mots-clés importants ont été intégrés naturellement.</p>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
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
                {t('templates.selectTemplate')}
              </label>
              <select 
                value={selectedTemplate} 
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTemplate(e.target.value)} 
                disabled={loadingTemplates}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              >
                {templates.map(template => (
                  <option key={template.id} value={template.id}>{template.Name}</option>
                ))}
              </select>
              {loadingTemplates && (
                <p className="text-sm text-gray-500 mt-1">{t('common.loading')}...</p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('resume.analysis.exportOptions.format', 'Format')}
              </label>
              <select
                value={selectedExportFormat}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedExportFormat(e.target.value as ExportFormat)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              >
                <option value="pdf">PDF</option>
                <option value="docx">DOCX (Word)</option>
                <option value="doc">DOC (Word 97-2003)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={() => { void handleExport(); setShowExportModal(false); }}
                disabled={exportLoading || loadingTemplates || !selectedTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                {exportLoading ? t('resume.actions.exporting') : t('common.export')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdaptationComparison;



