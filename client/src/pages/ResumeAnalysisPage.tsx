import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ShareQRCodeModal from '../components/ShareQRCodeModal';
import { SkeletonCard } from '../components/ui/Skeleton';
import ImprovementAnimation from '../components/ImprovementAnimation';
import OverviewTab from '../components/ResumeAnalysis/OverviewTab';
import SkillsTagsTab from '../components/ResumeAnalysis/SkillsTagsTab';
import OriginalTextTab from '../components/ResumeAnalysis/OriginalTextTab';
import PipelineTab from '../components/ResumeAnalysis/PipelineTab';
import ResumeComments from '../components/ResumeComments';
import ResumeAnalysisHeader from '../components/ResumeAnalysisPage/ResumeAnalysisHeader';
import ResumeAnalysisStepIndicator from '../components/ResumeAnalysisPage/ResumeAnalysisStepIndicator';
import { useResumeAnalysisPage } from './ResumeAnalysisPage.hooks';

const ANALYSIS_TABS = ['overview', 'skills', 'original', 'pipeline'] as const;
type AnalysisTabKey = (typeof ANALYSIS_TABS)[number];

const ResumeAnalysisPage = (): JSX.Element => {
  const {
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
  } = useResumeAnalysisPage();

  if (loading) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <SkeletonCard className="h-96 rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (error || !currentResume) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <div className="cv-panel rounded-[2rem] p-10 text-center sm:p-12">
            <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{error || t('errors.resumeNotFound')}</p>
            <Link to="/resumes" className="cv-ghost-button mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold">
              {t('common.backToList')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isImproving) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <ImprovementAnimation currentStep={processingStep || 'improving'} fullscreen={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
        {fromDealsView && (
          <button
            onClick={handleBackToDealsView}
            className="cv-ghost-button mb-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
          >
            <ArrowLeftIcon className="h-4 w-4" />
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

        <section className="cv-panel overflow-hidden rounded-[2rem]">
          <div className="border-b border-slate-200/70 px-4 py-4 dark:border-white/10 sm:px-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="cv-kicker">{t('resume.analysis.title')}</span>
              <span className="text-xs font-medium text-slate-500 dark:text-[var(--cv-muted)]">
                {t(`resume.analysis.tabs.${activeTab}`)}
              </span>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label={t('resume.analysis.title')}>
              {ANALYSIS_TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as AnalysisTabKey)}
                    className={`inline-flex min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-primary)_16%,transparent)]'
                        : 'bg-white/70 text-slate-500 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 dark:bg-white/[0.03] dark:text-[var(--cv-muted)] dark:ring-white/10 dark:hover:bg-white/[0.06] dark:hover:text-[var(--cv-text)]'
                    }`}
                  >
                    {t(`resume.analysis.tabs.${tab}`)}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-5 sm:p-6">
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
        </section>

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
        candidateName={(currentResume['Name'] as string) || 'CV'}
        isLoading={shareLoading}
        warning={hasImprovedText ? undefined : t('share.originalWarning')}
      />
    </div>
  );
};

export default ResumeAnalysisPage;
