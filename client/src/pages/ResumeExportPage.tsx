/**
 * ResumeExportPage Component
 * Dedicated page for resume export step
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import { templateService } from '../utils/templateService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { SkeletonCard } from '../components/ui/Skeleton';
import ExportTab, { ExportFormat } from '../components/ResumeAnalysis/ExportTab';
import ConsentBadge, { ConsentStatus } from '../components/ConsentBadge';
import SendEmailModal from '../components/ResumeAnalysis/SendEmailModal';
import { fetchWithAuth } from '../utils/apiInterceptor';
import { removeSuggestionMarkers } from '../utils/tinymceSuggestionsPlugin';

interface Template {
  id: string;
  Name: string;
  TemplateContent?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
  Stylesheet?: string;
}

const ResumeExportPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const _navigate = useNavigate();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, resumes } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');

  useEffect(() => {
    const loadResume = async () => {
      if (!id) {
        setError('No resume ID provided');
        setLoading(false);
        return;
      }

      const existingResume = resumes.find(r => r.id === id);
      if (existingResume) {
        setCurrentResume(existingResume);
        setLoading(false);
        return;
      }

      try {
        const resume = await resumeService.getResume(id);
        if (resume) {
          setCurrentResume(resume as Resume);
        } else {
          setError('Resume not found');
        }
      } catch (err) {
        logger.error('[ResumeExportPage] Error fetching resume:', err);
        setError('Failed to load resume');
        toast.error(t('errors.loadResume'));
      } finally {
        setLoading(false);
      }
    };

    loadResume();
  }, [id, resumes, setCurrentResume, t]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const fetchedTemplates = await templateService.getAllTemplates();
        setTemplates(fetchedTemplates);
        if (fetchedTemplates.length > 0) {
          setSelectedTemplate(fetchedTemplates[0].id);
        }
      } catch (err) {
        logger.error('Error fetching templates:', err);
        toast.error(t('errors.loadTemplates'));
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [t]);

  const handleExport = useCallback(async () => {
    if (!currentResume || !selectedTemplate) return;

    try {
      setExportLoading(true);
      const template = await templateService.getTemplateById(selectedTemplate);
      if (!template) throw new Error('Template not found');

      // Clean suggestion markers from content before export
      const rawContent = currentResume['Improved Text'] || currentResume['Original Text'] || '';
      const content = removeSuggestionMarkers(rawContent);
      const candidateName = currentResume['Name'] || 'Candidat';
      const candidateTitle = currentResume['Title'] || '';

      let processedBody = template.TemplateContent || '';
      processedBody = processedBody.replace(/-name-/g, candidateName);
      processedBody = processedBody.replace(/-title-/g, candidateTitle);
      processedBody = processedBody.replace(/-content-/g, content);

      let processedHeader = template.HeaderContent || '';
      if (processedHeader) {
        processedHeader = processedHeader.replace(/-name-/g, candidateName);
        processedHeader = processedHeader.replace(/-title-/g, candidateTitle);
      }

      let processedFooter = template.FooterContent || '';
      if (processedFooter) {
        processedFooter = processedFooter.replace(/-name-/g, candidateName);
        processedFooter = processedFooter.replace(/-title-/g, candidateTitle);
      }

      // Determine endpoint and file extension based on format
      const endpoint = selectedFormat === 'pdf' ? '/generate-pdf' : '/generate-docx';
      const fileExtension = selectedFormat === 'pdf' ? 'pdf' : selectedFormat;
      const _mimeType = selectedFormat === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          htmlContent: processedBody,
          filename: `${candidateName.replace(/\s+/g, '_')}.${fileExtension}`,
          stylesheet: template.Stylesheet || '',
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25,
          format: selectedFormat
        })
      });

      if (!response.ok) throw new Error(`Failed to generate ${selectedFormat.toUpperCase()}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidateName.replace(/\s+/g, '_')}_${template.Name}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('resume.exportSuccess'));
    } catch (err) {
      logger.error('Error exporting:', err);
      toast.error(t('resume.exportError'));
    } finally {
      setExportLoading(false);
    }
  }, [currentResume, selectedTemplate, selectedFormat, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <SkeletonCard className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !currentResume) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-red-500 dark:text-red-400">{error || 'Resume not found'}</p>
          <Link to="/resumes" className="text-blue-500 hover:underline mt-4 inline-block">
            {t('common.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  const resumeName = currentResume['Name'] || currentResume['File Name'] || 'CV';
  const hasImprovedText = !!currentResume['Improved Text'];
  const exportSource = hasImprovedText ? 'improved' : 'original';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Breadcrumbs */}
        <Breadcrumbs className="mb-4" />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resumeName}
                </h1>
                {currentResume?.consent_status && (
                  <ConsentBadge
                    status={currentResume.consent_status as ConsentStatus}
                    candidateName={currentResume?.candidate_name as string | undefined}
                    candidateEmail={currentResume?.candidate_email as string | undefined}
                    consentTokenExpiresAt={currentResume?.consent_token_expires_at as string | null | undefined}
                    retentionUntil={currentResume?.retention_until as string | null | undefined}
                    compact={true}
                  />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('resume.export.title')}
              </p>
            </div>
        </motion.div>

        {/* Export source indicator */}
        <div className="mb-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
            exportSource === 'improved' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}>
            <DocumentArrowDownIcon className="w-5 h-5" />
            <span className="font-medium">
              {exportSource === 'improved' 
                ? t('resume.export.exportingImproved', 'Exporting improved CV')
                : t('resume.export.exportingOriginal', 'Exporting original CV')}
            </span>
            {exportSource === 'original' && (
              <Link
                to={`/resumes/${id}/analysis`}
                className="ml-2 text-sm underline hover:no-underline"
              >
                {t('resume.export.improveFirst', 'Improve first?')}
              </Link>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Link
              to={`/resumes/${id}/analysis`}
              className="px-3 py-1 text-green-600 dark:text-green-400 hover:underline"
            >
              {t('resume.steps.analysis')} ✓
            </Link>
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            {hasImprovedText ? (
              <Link
                to={`/resumes/${id}/improve`}
                className="px-3 py-1 text-green-600 dark:text-green-400 hover:underline"
              >
                {t('resume.steps.improve')} ✓
              </Link>
            ) : (
              <Link
                to={`/resumes/${id}/analysis`}
                className="px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                {t('resume.steps.improve')}
              </Link>
            )}
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
              {t('resume.steps.export')}
            </span>
          </div>
        </div>

        {/* Export options */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ExportTab
            resume={currentResume}
            templates={templates}
            selectedTemplate={selectedTemplate}
            onTemplateChange={setSelectedTemplate}
            loadingTemplates={loadingTemplates}
            exportLoading={exportLoading}
            onExport={handleExport}
            onSendEmail={() => setShowEmailModal(true)}
            selectedFormat={selectedFormat}
            onFormatChange={setSelectedFormat}
          />
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <SendEmailModal
          isOpen={showEmailModal}
          resumeId={currentResume.id}
          resumeName={currentResume['Name'] || ''}
          resumeTitle={currentResume['Title'] || ''}
          onClose={() => setShowEmailModal(false)}
          attachmentFormat={selectedFormat}
          onGenerateAttachment={async (format) => {
            const template = await templateService.getTemplateById(selectedTemplate);
            if (!template) throw new Error('Template not found');
            
            // Clean suggestion markers from content before export
            const rawContent = currentResume['Improved Text'] || currentResume['Original Text'] || '';
            const content = removeSuggestionMarkers(rawContent);
            const candidateName = currentResume['Name'] || 'Candidat';
            const candidateTitle = currentResume['Title'] || '';
            
            // Process body with keyword replacements
            let processedBody = template.TemplateContent || '';
            processedBody = processedBody.replace(/-name-/g, candidateName);
            processedBody = processedBody.replace(/-title-/g, candidateTitle);
            processedBody = processedBody.replace(/-content-/g, content);
            
            // Process header with keyword replacements
            let processedHeader = template.HeaderContent || '';
            if (processedHeader) {
              processedHeader = processedHeader.replace(/-name-/g, candidateName);
              processedHeader = processedHeader.replace(/-title-/g, candidateTitle);
            }
            
            // Process footer with keyword replacements
            let processedFooter = template.FooterContent || '';
            if (processedFooter) {
              processedFooter = processedFooter.replace(/-name-/g, candidateName);
              processedFooter = processedFooter.replace(/-title-/g, candidateTitle);
            }
            
            // Determine endpoint based on format
            const endpoint = format === 'pdf' ? '/generate-pdf' : '/generate-docx';
            const fileExtension = format === 'pdf' ? 'pdf' : format;
            
            const response = await fetchWithAuth(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                htmlContent: processedBody,
                filename: `${candidateName.replace(/\s+/g, '_')}.${fileExtension}`,
                stylesheet: template.Stylesheet || '',
                headerContent: processedHeader || undefined,
                footerContent: processedFooter || undefined,
                footerHeight: template.FooterHeight || 25,
                format: format
              })
            });
            
            if (!response.ok) throw new Error(`Failed to generate ${format.toUpperCase()}`);
            return await response.blob();
          }}
        />
      )}
    </div>
  );
};

export default ResumeExportPage;
