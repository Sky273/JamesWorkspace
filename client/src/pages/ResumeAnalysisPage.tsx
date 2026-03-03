/**
 * ResumeAnalysisPage Component
 * Dedicated page for resume analysis step
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import ConsentBadge, { ConsentStatus } from '../components/ConsentBadge';
import { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { SkeletonCard } from '../components/ui/Skeleton';
import ImprovementAnimation from '../components/ImprovementAnimation';

import OverviewTab from '../components/ResumeAnalysis/OverviewTab';
import SkillsTagsTab from '../components/ResumeAnalysis/SkillsTagsTab';
import OriginalTextTab from '../components/ResumeAnalysis/OriginalTextTab';
import ResumeComments from '../components/ResumeComments';

const ResumeAnalysisPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, resumes, improveCurrentResume, loading: contextLoading, processingStep } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'original'>('overview');
  const [isImproving, setIsImproving] = useState(false);

  useEffect(() => {
    const loadResume = async () => {
      if (!id) {
        setError('No resume ID provided');
        setLoading(false);
        return;
      }

      logger.info('[ResumeAnalysisPage] Loading resume:', id);

      // Check if currentResume already matches the ID
      if (currentResume?.id === id) {
        logger.info('[ResumeAnalysisPage] Resume already loaded in context');
        setLoading(false);
        return;
      }

      // Check in resumes list
      const existingResume = resumes.find(r => r.id === id);
      if (existingResume) {
        logger.info('[ResumeAnalysisPage] Found resume in resumes list');
        setCurrentResume(existingResume);
        setLoading(false);
        return;
      }

      // Fetch from API
      try {
        logger.info('[ResumeAnalysisPage] Fetching resume from API');
        const resume = await resumeService.getResume(id);
        if (resume) {
          logger.info('[ResumeAnalysisPage] Resume fetched successfully');
          setCurrentResume(resume as Resume);
        } else {
          setError('Resume not found');
        }
      } catch (err) {
        logger.error('[ResumeAnalysisPage] Error fetching resume:', err);
        setError('Failed to load resume');
        toast.error(t('errors.loadResume'));
      } finally {
        setLoading(false);
      }
    };

    loadResume();
  }, [id, currentResume?.id, resumes, setCurrentResume, t]);

  // IMPORTANT: All hooks must be called before any conditional returns
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
    
    // Use setTimeout to ensure React renders the animation before starting the async operation
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
  }, [currentResume, isImproving, improveCurrentResume, t, navigate, id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <SkeletonCard className="h-96" />
        </div>
      </div>
    );
  }

  // Error state
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

  // Show improvement animation when actively improving
  if (isImproving) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <Breadcrumbs className="mb-4" />
          <ImprovementAnimation currentStep={processingStep || 'improving'} isVisible={true} />
        </div>
      </div>
    );
  }

  const resumeName = currentResume['Name'] || currentResume['File Name'] || 'CV';
  const hasImprovedText = !!currentResume['Improved Text'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Breadcrumbs */}
        <Breadcrumbs className="mb-4" />

        {/* Header with navigation */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate max-w-[250px] sm:max-w-none">
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
                {t('resume.analysis.title')}
              </p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {hasImprovedText ? (
                <>
                  <Link
                    to={`/resumes/${id}/improve`}
                    className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg font-medium transition-colors text-sm sm:text-base"
                  >
                    <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden xs:inline">{t('resume.actions.viewImproved')}</span>
                    <span className="xs:hidden">{t('resume.actions.view')}</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/resumes/${id}/export`}
                    className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg font-medium transition-colors text-sm sm:text-base"
                  >
                    {t('resume.actions.export')}
                    <ArrowRightIcon className="w-4 h-4" />
                  </Link>
                </>
              ) : (
                <button
                  onClick={handleImprove}
                  className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
                >
                  <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  {t('resume.actions.improve')}
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Step indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
              {t('resume.steps.analysis')}
            </span>
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            {hasImprovedText ? (
              <Link 
                to={`/resumes/${id}/improve`}
                className="px-3 py-1 text-green-600 dark:text-green-400 hover:underline"
              >
                {t('resume.steps.improve')} ✓
              </Link>
            ) : (
              <button
                onClick={handleImprove}
                className="px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                {t('resume.steps.improve')}
              </button>
            )}
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            <Link 
              to={`/resumes/${id}/export`}
              className={`px-3 py-1 ${hasImprovedText ? 'text-gray-700 dark:text-gray-300 hover:underline' : 'text-gray-400 dark:text-gray-500 pointer-events-none'}`}
            >
              {t('resume.steps.export')}
            </Link>
          </div>
        </div>

        {/* Tabs */}
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
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && <OverviewTab resume={currentResume} t={t} />}
            {activeTab === 'skills' && <SkillsTagsTab resume={currentResume} />}
            {activeTab === 'original' && (
              <OriginalTextTab resume={currentResume} />
            )}
          </div>
        </div>

        {/* Comments section */}
        {id && (
          <div className="mt-6">
            <ResumeComments resumeId={id} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeAnalysisPage;
