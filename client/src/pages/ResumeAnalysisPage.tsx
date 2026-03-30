import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ShareQRCodeModal from '../components/ShareQRCodeModal';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import type { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import { templateService } from '../utils/templateService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { SkeletonCard } from '../components/ui/Skeleton';
import ImprovementAnimation from '../components/ImprovementAnimation';
import { removeSuggestionMarkers } from '../utils/tinymceSuggestionsPlugin';
import OverviewTab from '../components/ResumeAnalysis/OverviewTab';
import SkillsTagsTab from '../components/ResumeAnalysis/SkillsTagsTab';
import OriginalTextTab from '../components/ResumeAnalysis/OriginalTextTab';
import PipelineTab from '../components/ResumeAnalysis/PipelineTab';
import ResumeComments from '../components/ResumeComments';
import ResumeAnalysisHeader from '../components/ResumeAnalysisPage/ResumeAnalysisHeader';
import ResumeAnalysisStepIndicator from '../components/ResumeAnalysisPage/ResumeAnalysisStepIndicator';

const ResumeAnalysisPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromDealsView = (location.state as { from?: string } | null)?.from === 'dealsGroupedView'
    || sessionStorage.getItem('dealsGroupedViewState') !== null;
  const { t } = useTranslation();
  const {
    currentResume,
    setCurrentResume,
    resumes,
    improveCurrentResume,
    loading: _contextLoading,
    processingStep
  } = useResume();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'original' | 'pipeline'>('overview');
  const [isImproving, setIsImproving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareLoading, setShareLoading] = useState(false);

  const hasImprovedText = !!currentResume?.['Improved Text'];

  useEffect(() => {
    const loadResume = async () => {
      if (!id) {
        setError(t('errors.resumeNotFound'));
        setLoading(false);
        return;
      }

      logger.info('[ResumeAnalysisPage] Loading resume:', id);

      if (currentResume?.id === id) {
        logger.info('[ResumeAnalysisPage] Resume already loaded in context');
        setLoading(false);
        return;
      }

      const existingResume = resumes.find((resume) => resume.id === id);
      if (existingResume) {
        logger.info('[ResumeAnalysisPage] Found resume in resumes list');
        setCurrentResume(existingResume);
        setLoading(false);
        return;
      }

      try {
        logger.info('[ResumeAnalysisPage] Fetching resume from API');
        const resume = await resumeService.getResume(id);
        if (resume) {
          logger.info('[ResumeAnalysisPage] Resume fetched successfully');
          setCurrentResume(resume as Resume);
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

    loadResume();
  }, [currentResume?.id, id, resumes, setCurrentResume, t]);

  const handleImprove = useCallback(async () => {
    logger.info('[ResumeAnalysisPage] handleImprove called', {
      hasCurrentResume: !!currentResume,
      isImproving,
      resumeId: currentResume?.id
    });

    if (!currentResume) {
      logger.error('[ResumeAnalysisPage] No currentResume available for improvement');
      toast.error('CV non chargé. Veuillez rafraîchir la page.');
      return;
    }

    if (isImproving) {
      logger.warn('[ResumeAnalysisPage] Already improving, ignoring click');
      return;
    }

    setIsImproving(true);
    logger.info('[ResumeAnalysisPage] isImproving set to true');

    setTimeout(async () => {
      try {
        logger.info('[ResumeAnalysisPage] Starting improvement for resume:', currentResume.id);
        await improveCurrentResume();
        logger.info('[ResumeAnalysisPage] Improvement completed successfully');
        toast.success(t('resume.improveSuccess'));
        navigate(`/resumes/${id}/improve`);
      } catch (err) {
        logger.error('[ResumeAnalysisPage] Error improving resume:', err);
        toast.error(t('resume.improveError'));
      } finally {
        setIsImproving(false);
      }
    }, 100);
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

        const template = templates[0];
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

        const options = await createAuthOptionsWithCsrf({
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await fetchWithAuth(`/api/share/resume/${id}/generate`, {
          ...options,
          method: 'POST',
          body: JSON.stringify({
            htmlContent: processedBody,
            filename: candidateName.replace(/\s+/g, '_'),
            stylesheet: template.Stylesheet || '',
            headerContent: processedHeader || undefined,
            footerContent: processedFooter || undefined,
            footerHeight: template.FooterHeight || 25
          })
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
          <p className="text-red-500 dark:text-red-400">{error || t('errors.resumeNotFound')}</p>
          <Link to="/resumes" className="text-blue-500 hover:underline mt-4 inline-block">
            {t('common.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  if (isImproving) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <ImprovementAnimation currentStep={processingStep || 'improving'} fullscreen={true} />
        </div>
      </div>
    );
  }

  const resumeName = currentResume['Name'] || currentResume['File Name'] || 'CV';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {fromDealsView && (
          <button
            onClick={() => navigate('/resumes', { state: { viewMode: 'byDeal' } })}
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {t('resumes.backToDealsView')}
          </button>
        )}

        {id && (
          <ResumeAnalysisHeader
            resume={currentResume}
            resumeName={resumeName}
            resumeId={id}
            hasImprovedText={hasImprovedText}
            onShare={handleShare}
            onImprove={handleImprove}
            t={t}
          />
        )}

        {id && (
          <ResumeAnalysisStepIndicator
            resumeId={id}
            hasImprovedText={hasImprovedText}
            onImprove={handleImprove}
            t={t}
          />
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('resume.analysis.tabs.overview')}
              </button>
              <button
                onClick={() => setActiveTab('skills')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'skills'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('resume.analysis.tabs.skills')}
              </button>
              <button
                onClick={() => setActiveTab('original')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'original'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('resume.analysis.tabs.original')}
              </button>
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'pipeline'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('resume.analysis.tabs.pipeline')}
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && <OverviewTab resume={currentResume} t={t} />}
            {activeTab === 'skills' && <SkillsTagsTab resume={currentResume} />}
            {activeTab === 'original' && <OriginalTextTab resume={currentResume} />}
            {activeTab === 'pipeline' && id && (
              <PipelineTab
                resumeId={id}
                resumeName={(currentResume?.['Name'] as string) || (currentResume?.name as string) || 'CV'}
              />
            )}
          </div>
        </div>

        {id && (
          <div className="mt-6">
            <ResumeComments resumeId={id} />
          </div>
        )}
      </div>

      <ShareQRCodeModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={shareUrl}
        title={hasImprovedText ? t('share.improvedCV') : t('share.originalFile')}
        candidateName={currentResume['Name'] || 'CV'}
        isLoading={shareLoading}
        warning={hasImprovedText ? undefined : t('share.originalWarning')}
      />
    </div>
  );
};

export default ResumeAnalysisPage;
