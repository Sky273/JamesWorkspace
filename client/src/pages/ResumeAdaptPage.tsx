import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import MissionSelector from '../components/MissionSelector';
import MatchAnalysisDisplay from '../components/MatchAnalysisDisplay';
import AdaptProgressSteps from '../components/ResumeAdapt/AdaptProgressSteps';
import AdaptLoadingState from '../components/ResumeAdapt/AdaptLoadingState';
import AdaptResultPanel from '../components/ResumeAdapt/AdaptResultPanel';
import PageHeader from '../components/page/PageHeader';
import { useResumeAdaptPage } from './ResumeAdaptPage.hooks';

const ResumeAdaptPage = (): JSX.Element => {
  const {
    resume,
    step,
    selectedMission,
    matchAnalysis,
    adaptation,
    error,
    activeTab,
    setActiveTab,
    cycleIndex,
    cycleMessages,
    handleMissionSelect,
    handleGenerateAdaptation,
    handleViewAdaptation,
    handleBack,
    handleCancelAnalysis,
    handleStartNewAdaptation,
    handleCloseMissionSelector,
    navigate,
    t,
  } = useResumeAdaptPage();

  if (step === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8"
      >
        <div className="cv-surface mx-auto max-w-6xl rounded-[2.5rem] p-6 sm:p-8">
          <div className="section-shell rounded-[2rem] p-8">
            <div className="flex items-start gap-4">
              <ArrowPathIcon className="mt-1 h-6 w-6 animate-spin text-[var(--cv-primary)]" />
              <div className="flex-1 space-y-4">
                <div>
                  <div className="h-8 w-64 max-w-full rounded-full bg-gray-200/80 animate-pulse dark:bg-gray-700/70" />
                  <div className="mt-3 h-4 w-[30rem] max-w-full rounded-full bg-gray-200/70 animate-pulse dark:bg-gray-700/60" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="h-20 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                  <div className="h-20 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                  <div className="h-20 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (step === 'error' || !resume) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-6xl rounded-[2.5rem] p-6 sm:p-8">
          <div className="section-shell rounded-[2rem] p-10 text-center">
            <DocumentTextIcon className="mx-auto mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
            <h2 className="text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)] mb-4">
              {t('errors.resumeNotFound')}
            </h2>
            <p className="mb-6 text-slate-600 dark:text-[var(--cv-muted)]">{error}</p>
            <button
              onClick={() => navigate('/resumes')}
              className="cv-gradient-button inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              {t('common.backToList')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="cv-surface mx-auto max-w-6xl rounded-[2.5rem] p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="cv-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-full"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <PageHeader title={t('adaptation.title')} subtitle={`CV: ${resume.Name || t('common.unnamed')}`} />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-[var(--cv-muted)]">
            <SparklesIcon className="h-4 w-4 text-[var(--cv-primary)]" />
            {selectedMission?.Title || t('adaptation.selectedMission')}
          </div>
        </div>

        <AdaptProgressSteps step={step} t={t} />

        <div className="section-shell overflow-hidden rounded-[2rem] p-0">
          <AnimatePresence mode="wait">
            {step === 'select-mission' && (
              <motion.div
                key="select-mission"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <MissionSelector
                  onSelect={handleMissionSelect}
                  onClose={handleCloseMissionSelector}
                />
              </motion.div>
            )}

            {step === 'analyzing' && (
              <AdaptLoadingState
                mode="analyzing"
                cycleIndex={cycleIndex}
                cycleMessages={cycleMessages}
                t={t}
              />
            )}

            {step === 'show-analysis' && matchAnalysis && (
              <motion.div
                key="show-analysis"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6"
              >
                <div className="mb-6">
                  <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                    <BriefcaseIcon className="h-5 w-5 text-[var(--cv-primary)]" />
                    {t('adaptation.selectedMission')}
                  </h3>
                  <div className="rounded-[1.5rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
                    <p className="font-medium text-slate-950 dark:text-[var(--cv-text)]">
                      {selectedMission?.Title || 'Sans titre'}
                    </p>
                  </div>
                </div>
                <MatchAnalysisDisplay
                  analysis={matchAnalysis}
                  onContinue={handleGenerateAdaptation}
                  onCancel={handleCancelAnalysis}
                />
              </motion.div>
            )}

            {step === 'adapting' && (
              <AdaptLoadingState
                mode="adapting"
                cycleIndex={cycleIndex}
                cycleMessages={cycleMessages}
                t={t}
              />
            )}

            {step === 'show-result' && adaptation && (
              <AdaptResultPanel
                resume={resume}
                mission={selectedMission}
                adaptation={adaptation}
                analysis={matchAnalysis}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onNewAdaptation={handleStartNewAdaptation}
                onViewAdaptation={handleViewAdaptation}
                t={t}
              />
            )}
          </AnimatePresence>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-[1.5rem] border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          >
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default ResumeAdaptPage;
