import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import MissionSelector from '../components/MissionSelector';
import MatchAnalysisDisplay from '../components/MatchAnalysisDisplay';
import AdaptProgressSteps from '../components/ResumeAdapt/AdaptProgressSteps';
import AdaptLoadingState from '../components/ResumeAdapt/AdaptLoadingState';
import AdaptResultPanel from '../components/ResumeAdapt/AdaptResultPanel';
import { useResumeAdaptPage } from './ResumeAdaptPage.hooks';

const ResumeAdaptPage = (): JSX.Element => {
  const {
    id,
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (step === 'error' || !resume) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('errors.resumeNotFound')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/resumes')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              {t('common.backToResumes')}
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
      className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8"
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('adaptation.title')}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                CV: {resume.Name || t('common.unnamed')}
              </p>
            </div>
          </div>
        </div>

        <AdaptProgressSteps step={step} t={t} />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <BriefcaseIcon className="w-5 h-5 text-blue-500" />
                    {t('adaptation.selectedMission')}
                  </h3>
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
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
            className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
          >
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default ResumeAdaptPage;
