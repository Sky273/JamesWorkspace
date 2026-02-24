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
import ExportTab from '../components/ResumeAnalysis/ExportTab';
import ConsentBadge, { ConsentStatus } from '../components/ConsentBadge';
import SendEmailModal from '../components/ResumeAnalysis/SendEmailModal';
import { fetchWithAuth } from '../utils/apiInterceptor';

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, resumes } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

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

  const handleExportToPDF = useCallback(async () => {
    if (!currentResume || !selectedTemplate) return;

    try {
      setExportLoading(true);
      const template = await templateService.getTemplateById(selectedTemplate);
      if (!template) throw new Error('Template not found');

      const content = currentResume['Improved Text'] || currentResume['Original Text'] || '';
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

      const response = await fetchWithAuth('/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          htmlContent: processedBody,
          filename: `${candidateName.replace(/\s+/g, '_')}.pdf`,
          stylesheet: template.Stylesheet || '',
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25
        })
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidateName.replace(/\s+/g, '_')}_${template.Name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('resume.exportSuccess'));
    } catch (err) {
      logger.error('Error exporting PDF:', err);
      toast.error(t('resume.exportError'));
    } finally {
      setExportLoading(false);
    }
  }, [currentResume, selectedTemplate, t]);

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

  if (!hasImprovedText) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <DocumentArrowDownIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('resume.export.needsImprovement')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('resume.export.needsImprovementDescription')}
          </p>
          <Link
            to={`/resumes/${id}/improve`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('resume.actions.improve')}
          </Link>
        </div>
      </div>
    );
  }

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

        {/* Step indicator - removed since breadcrumbs handle navigation */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Link
              to={`/resumes/${id}/analysis`}
              className="px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t('resume.steps.analysis')}
            </Link>
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            <Link
              to={`/resumes/${id}/improve`}
              className="px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t('resume.steps.improve')}
            </Link>
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
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
            onExport={handleExportToPDF}
            onSendEmail={() => setShowEmailModal(true)}
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
          onGeneratePdf={async () => {
            const template = await templateService.getTemplateById(selectedTemplate);
            if (!template) throw new Error('Template not found');
            
            const content = currentResume['Improved Text'] || '';
            const candidateName = currentResume['Name'] || 'Candidat';
            const candidateTitle = currentResume['Title'] || '';
            
            let processedBody = template.TemplateContent || '';
            processedBody = processedBody.replace(/-name-/g, candidateName);
            processedBody = processedBody.replace(/-title-/g, candidateTitle);
            processedBody = processedBody.replace(/-content-/g, content);
            
            const response = await fetchWithAuth('/generate-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                htmlContent: processedBody,
                filename: `${candidateName.replace(/\s+/g, '_')}.pdf`,
                stylesheet: template.Stylesheet || '',
                headerContent: template.HeaderContent || undefined,
                footerContent: template.FooterContent || undefined,
                footerHeight: template.FooterHeight || 25
              })
            });
            
            if (!response.ok) throw new Error('Failed to generate PDF');
            return await response.blob();
          }}
        />
      )}
    </div>
  );
};

export default ResumeExportPage;
