import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useResume } from '../context/ResumeContext';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import type { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import { templateService } from '../utils/templateService';
import logger from '../utils/logger.frontend';
import { buildSharePayload } from './resumeDocumentPayload';
import { resolveResumeForPage } from './resumeLoader';

type AnalysisTab = 'overview' | 'skills' | 'original' | 'pipeline';

export function useResumeAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    currentResume,
    setCurrentResume,
    resumes,
    improveCurrentResume,
    processingStep
  } = useResume();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [isImproving, setIsImproving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  const fromDealsView = (location.state as { from?: string } | null)?.from === 'dealsGroupedView'
    || sessionStorage.getItem('dealsGroupedViewState') !== null;
  const hasImprovedText = !!currentResume?.['Improved Text'];
  const resumeName = currentResume?.['Name'] || currentResume?.['File Name'] || 'CV';

  useEffect(() => {
    const loadResume = async () => {
      try {
        const resolvedResume = await resolveResumeForPage({
          id,
          currentResume: currentResume as Resume | null,
          resumes: resumes as Resume[],
          fetchResume: async (resumeId) => {
            logger.info('[ResumeAnalysisPage] Fetching resume from API');
            return await resumeService.getResume(resumeId) as Resume | null;
          },
        });

        if (resolvedResume.kind === 'missing-id') {
          setError(t('errors.resumeNotFound'));
          return;
        }

        logger.info('[ResumeAnalysisPage] Loading resume:', id);

        if (resolvedResume.kind === 'current') {
          logger.info('[ResumeAnalysisPage] Resume already loaded in context');
          return;
        }

        if (resolvedResume.kind === 'cached') {
          logger.info('[ResumeAnalysisPage] Found resume in resumes list');
          setCurrentResume(resolvedResume.resume);
          return;
        }

        if (resolvedResume.kind === 'fetched') {
          logger.info('[ResumeAnalysisPage] Resume fetched successfully');
          setCurrentResume(resolvedResume.resume);
        } else {
          setError(t('errors.resumeNotFound'));
        }
      } catch (err) {
        logger.error('[ResumeAnalysisPage] Error fetching resume:', err);
        setError(t('errors.loadResume'));
        toast.error(t('errors.loadResume'));
      } finally {
        setLoading(false);
      }
    };

    void loadResume();
  }, [currentResume?.id, id, resumes, setCurrentResume, t]);

  const handleImprove = useCallback(async () => {
    logger.info('[ResumeAnalysisPage] handleImprove called', {
      hasCurrentResume: !!currentResume,
      isImproving,
      resumeId: currentResume?.id
    });

    if (!currentResume) {
      logger.error('[ResumeAnalysisPage] No currentResume available for improvement');
      toast.error('CV non charge. Veuillez rafraichir la page.');
      return;
    }

    if (isImproving) {
      logger.warn('[ResumeAnalysisPage] Already improving, ignoring click');
      return;
    }

    setIsImproving(true);

    try {
      logger.info('[ResumeAnalysisPage] Starting improvement for resume:', currentResume.id);
      await improveCurrentResume();
      toast.success(t('resume.improveSuccess'));
      navigate(`/resumes/${id}/improve`);
    } catch (err) {
      logger.error('[ResumeAnalysisPage] Error improving resume:', err);
      toast.error(t('resume.improveError'));
    } finally {
      setIsImproving(false);
    }
  }, [currentResume, id, improveCurrentResume, isImproving, navigate, t]);

  const handleShare = useCallback(async () => {
    if (!id || !currentResume) {
      return;
    }

    setShareLoading(true);
    setShowShareModal(true);

    try {
      if (hasImprovedText) {
        const templates = await templateService.getAllTemplates();
        if (!templates || templates.length === 0) {
          throw new Error('No templates available');
        }

        const options = await createAuthOptionsWithCsrf({
          headers: { 'Content-Type': 'application/json' }
        });
        const payload = buildSharePayload(currentResume as Resume, templates[0]);

        const response = await fetchWithAuth(`/api/share/resume/${id}/generate`, {
          ...options,
          method: 'POST',
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success && data.token) {
          setShareUrl(`${window.location.origin}/share/pdf/${data.token}`);
          return;
        }

        toast.error(t('share.error'));
        setShowShareModal(false);
        return;
      }

      const response = await fetchWithAuth(`/api/share/resume/${id}/original`);
      const data = await response.json();

      if (data.success && data.token) {
        setShareUrl(`${window.location.origin}/share/file/${data.token}`);
      } else {
        toast.error(t('share.error'));
        setShowShareModal(false);
      }
    } catch (err) {
      logger.error('Failed to get share URL:', err);
      toast.error(t('share.error'));
      setShowShareModal(false);
    } finally {
      setShareLoading(false);
    }
  }, [currentResume, hasImprovedText, id, t]);

  const handleBackToDealsView = useCallback(() => {
    navigate('/resumes', { state: { viewMode: 'byDeal' } });
  }, [navigate]);

  return {
    id,
    currentResume,
    loading,
    error,
    activeTab,
    setActiveTab,
    isImproving,
    processingStep,
    fromDealsView,
    hasImprovedText,
    resumeName,
    showShareModal,
    setShowShareModal,
    shareUrl,
    shareLoading,
    handleImprove,
    handleShare,
    handleBackToDealsView,
    t,
  };
}
