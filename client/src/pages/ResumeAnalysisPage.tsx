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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {fromDealsView && (
          <button
            onClick={handleBackToDealsView}
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
        candidateName={(currentResume['Name'] as string) || 'CV'}
        isLoading={shareLoading}
        warning={hasImprovedText ? undefined : t('share.originalWarning')}
      />
    </div>
  );
};

export default ResumeAnalysisPage;
