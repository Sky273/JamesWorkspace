import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useResume } from '../context/ResumeContext';
import type { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import { templateService } from '../utils/templateService';
import logger from '../utils/logger.frontend';
import { createAuthOptionsWithCsrf, fetchWithCsrfRetry } from '../utils/apiInterceptor';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';
import { buildExportPayload } from './resumeDocumentPayload';
import { resolveResumeForPage } from './resumeLoader';

interface Template {
  id: string;
  Name: string;
  TemplateContent?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
  Stylesheet?: string;
}

async function generateAttachmentBlob(resume: Resume, template: Template, format: ExportFormat): Promise<Blob> {
  const endpoint = format === 'pdf' ? '/generate-pdf' : '/generate-docx';
  const exportOptions = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(buildExportPayload(resume, template, format))
  });

  const response = await fetchWithCsrfRetry(endpoint, exportOptions, 300000);
  if (!response.ok) {
    throw new Error(`Failed to generate ${format.toUpperCase()}`);
  }

  return response.blob();
}

export function useResumeExportPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, resumes } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const currentResumeForPage = currentResume?.id === id ? currentResume as Resume : null;

  useEffect(() => {
    const loadResume = async () => {
      try {
        const resolvedResume = await resolveResumeForPage({
          id,
          currentResume: currentResumeForPage,
          resumes: resumes as Resume[],
          preferFresh: true,
          fetchResume: async (resumeId) => await resumeService.getResume(resumeId, { forceRefresh: true }) as Resume | null,
        });

        if (resolvedResume.kind === 'missing-id') {
          setError('No resume ID provided');
          return;
        }

        if (resolvedResume.kind === 'current') {
          return;
        }

        if (resolvedResume.kind === 'cached') {
          setCurrentResume(resolvedResume.resume);
          return;
        }

        if (resolvedResume.kind === 'fetched') {
          setCurrentResume(resolvedResume.resume);
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

    void loadResume();
  }, [currentResumeForPage, id, resumes, setCurrentResume, t]);

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

    void fetchTemplates();
  }, [t]);

  const handleExport = useCallback(async () => {
    if (!currentResume || !selectedTemplate) {
      return;
    }

    try {
      setExportLoading(true);
      const template = await templateService.getTemplateById(selectedTemplate) as Template | null;
      if (!template) {
        throw new Error('Template not found');
      }

      const blob = await generateAttachmentBlob(currentResume as Resume, template, selectedFormat);
      const url = window.URL.createObjectURL(blob);
      const fileExtension = selectedFormat === 'pdf' ? 'pdf' : selectedFormat;
      const candidateName = (currentResume['Name'] as string) || 'Candidat';
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${candidateName.replace(/\s+/g, '_')}_${template.Name}.${fileExtension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('resume.exportSuccess'));
    } catch (err) {
      logger.error('Error exporting:', err);
      toast.error(t('resume.exportError'));
    } finally {
      setExportLoading(false);
    }
  }, [currentResume, selectedFormat, selectedTemplate, t]);

  const generateEmailAttachment = useCallback(async (format: ExportFormat) => {
    if (!currentResume || !selectedTemplate) {
      throw new Error('Template not found');
    }

    const template = await templateService.getTemplateById(selectedTemplate) as Template | null;
    if (!template) {
      throw new Error('Template not found');
    }

    return generateAttachmentBlob(currentResume as Resume, template, format);
  }, [currentResume, selectedTemplate]);

  const resumeName = currentResume?.['Name'] || currentResume?.['File Name'] || 'CV';
  const hasImprovedText = !!currentResume?.['Improved Text'];
  const exportSource = hasImprovedText ? 'improved' : 'original';

  return {
    id,
    currentResume,
    loading,
    error,
    templates,
    selectedTemplate,
    setSelectedTemplate,
    loadingTemplates,
    exportLoading,
    showEmailModal,
    setShowEmailModal,
    selectedFormat,
    setSelectedFormat,
    resumeName,
    hasImprovedText,
    exportSource,
    handleExport,
    generateEmailAttachment,
    t,
  };
}
