import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  CircleStackIcon,
  DocumentMagnifyingGlassIcon,
  FunnelIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import ShareQRCodeModal from '../components/ShareQRCodeModal';
import { SkeletonCard } from '../components/ui/Skeleton';
import ImprovementAnimation from '../components/ImprovementAnimation';
import ResponsivePageTabs, { type ResponsivePageTabOption } from '../components/page/ResponsivePageTabs';
import ConfirmDialog from '../components/page/ConfirmDialog';
import OverviewTab from '../components/ResumeAnalysis/OverviewTab';
import SkillsTagsTab from '../components/ResumeAnalysis/SkillsTagsTab';
import OriginalTextTab from '../components/ResumeAnalysis/OriginalTextTab';
import OriginalSourcePreview from '../components/ResumeAnalysis/OriginalSourcePreview';
import PipelineTab from '../components/ResumeAnalysis/PipelineTab';
import ResumeComments from '../components/ResumeComments';
import ResumeAnalysisHeader from '../components/ResumeAnalysisPage/ResumeAnalysisHeader';
import ResumeAnalysisStepIndicator from '../components/ResumeAnalysisPage/ResumeAnalysisStepIndicator';
import { useResumeAnalysisPage } from './ResumeAnalysisPage.hooks';

type AnalysisTabKey = 'overview' | 'skills' | 'original' | 'extracted' | 'pipeline';

const getAnalysisTabLabel = (tab: AnalysisTabKey, t: TFunction): string => {
  switch (tab) {
    case 'original':
      return t('resume.analysis.tabs.original', { defaultValue: 'Original' });
    case 'extracted':
      return t('resume.analysis.tabs.extracted', { defaultValue: 'Contenu extrait' });
    default:
      return t(`resume.analysis.tabs.${tab}`);
  }
};

const getAnalysisTabOptions = (t: TFunction): ResponsivePageTabOption<AnalysisTabKey>[] => ([
  { value: 'overview', label: getAnalysisTabLabel('overview', t), icon: ChartBarIcon },
  { value: 'skills', label: getAnalysisTabLabel('skills', t), icon: FunnelIcon },
  { value: 'original', label: getAnalysisTabLabel('original', t), icon: DocumentMagnifyingGlassIcon },
  { value: 'extracted', label: getAnalysisTabLabel('extracted', t), icon: CircleStackIcon },
  { value: 'pipeline', label: getAnalysisTabLabel('pipeline', t), icon: QueueListIcon },
]);

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
    fromDealDetailView,
    hasImprovedText,
    resumeName,
    showShareModal,
    setShowShareModal,
    shareUrl,
    shareLoading,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleting,
    handleImprove,
    handleShare,
    handleDelete,
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
        {(fromDealsView || fromDealDetailView) && (
          <button
            onClick={handleBackToDealsView}
            className="cv-ghost-button mb-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {t('common.back')}
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
            onDelete={() => setShowDeleteConfirm(true)}
            deleting={deleting}
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
              <span className="text-xs font-medium text-slate-500 dark:text-[var(--cv-muted)]">
                {getAnalysisTabLabel(activeTab, t)}
              </span>
            </div>
            <ResponsivePageTabs
              label={t('resume.analysis.title')}
              minItemWidthRem={10}
              value={activeTab}
              onChange={(value) => setActiveTab(value)}
              options={getAnalysisTabOptions(t)}
            />
          </div>

          <div className="p-5 sm:p-6">
            {activeTab === 'overview' && <OverviewTab resume={currentResume} t={t} />}
            {activeTab === 'skills' && <SkillsTagsTab resume={currentResume} />}
            {activeTab === 'original' && (
              <OriginalSourcePreview
                resume={currentResume}
                title={t('resume.analysis.tabs.original', { defaultValue: 'Original' })}
                description="Prévisualisation visuelle du CV source importé."
              />
            )}
            {activeTab === 'extracted' && <OriginalTextTab resume={currentResume} />}
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
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          void handleDelete();
        }}
        disabled={deleting}
        title={t('resumes.confirmDeleteTitle')}
        cancelLabel={t('common.cancel')}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        content={
          <p>
            {t('resumes.confirmDeleteMessage', {
              filename: currentResume['Resume File']?.[0]?.filename || currentResume.Name || resumeName
            })}
          </p>
        }
      />
    </div>
  );
};

export default ResumeAnalysisPage;
