import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import MissionSelector from '../components/MissionSelector';
import MatchAnalysisDisplay from '../components/MatchAnalysisDisplay';
import AdaptProgressSteps from '../components/ResumeAdapt/AdaptProgressSteps';
import AdaptLoadingState from '../components/ResumeAdapt/AdaptLoadingState';
import AdaptResultPanel from '../components/ResumeAdapt/AdaptResultPanel';
import resumeAdaptationService from '../utils/resumeAdaptationService';
import type { MatchAnalysis } from '../utils/resumeAdaptationService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';

interface Resume {
  id: string;
  Name?: string;
  Title?: string;
  'Original Text'?: string;
  'Improved Text'?: string;
  Status?: string;
}

interface Mission {
  id: string;
  Title?: string;
  Content?: string;
}

interface Adaptation {
  adaptedText?: string;
  'Adapted Text'?: string;
  matchScore?: string | number;
  'Match Score'?: string | number;
  matchAnalysis?: MatchAnalysis;
  adaptationId?: string;
}

type Step = 'loading' | 'select-mission' | 'analyzing' | 'show-analysis' | 'adapting' | 'show-result' | 'error';

const ResumeAdaptPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();

  const [resume, setResume] = useState<Resume | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [adaptation, setAdaptation] = useState<Adaptation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'adapted'>('analysis');
  const [cycleIndex, setCycleIndex] = useState(0);

  const analyzingMessages = useMemo(
    () => [
      'Comparaison des compétences requises...',
      'Évaluation de l\'expérience pertinente...',
      'Analyse des mots-clés de la mission...',
      'Calcul du score d\'adéquation...',
      'Identification des points forts...',
      'Détection des écarts de compétences...'
    ],
    []
  );

  const adaptingMessages = useMemo(
    () => [
      'Reformulation du résumé professionnel...',
      'Mise en avant des compétences clés...',
      'Adaptation de l\'expérience à la mission...',
      'Optimisation pour les mots-clés cibles...',
      'Renforcement de la pertinence ATS...',
      'Harmonisation du profil candidat...',
      'Ajustement du vocabulaire sectoriel...',
      'Polissage final du CV adapté...'
    ],
    []
  );

  const cycleMessages = step === 'adapting' ? adaptingMessages : analyzingMessages;

  useEffect(() => {
    if (step !== 'analyzing' && step !== 'adapting') {
      return;
    }

    setCycleIndex(0);

    const interval = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % cycleMessages.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [cycleMessages.length, step]);

  const loadResume = useCallback(async () => {
    if (!id) {
      setError('No resume ID provided');
      setStep('error');
      return;
    }

    try {
      const response = await authGet(`/api/resumes/${id}`);
      if (!response.ok) {
        throw new Error('Resume not found');
      }

      const data = await response.json();
      setResume(data);
      setStep('select-mission');
    } catch (err) {
      logger.error('Error loading resume:', err);
      setError('Failed to load resume');
      setStep('error');
    }
  }, [authGet, id]);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const handleMissionSelect = async (mission: Mission): Promise<void> => {
    setSelectedMission(mission);
    setStep('analyzing');
    setError(null);

    try {
      logger.log('Analyzing match between resume and mission...');
      const analysis = await resumeAdaptationService.analyzeMatch(id!, mission.id);
      setMatchAnalysis(analysis);
      setStep('show-analysis');
      toast.success(t('adaptation.analysisComplete', "Analyse d'adéquation terminée"));
    } catch (err) {
      logger.error('Error analyzing match:', err);
      setError((err as Error).message || "Erreur lors de l'analyse");
      toast.error(t('adaptation.analysisError', "Erreur lors de l'analyse d'adéquation"));
      setStep('select-mission');
    }
  };

  const handleGenerateAdaptation = async (): Promise<void> => {
    if (!selectedMission || !id) {
      return;
    }

    setStep('adapting');
    setError(null);

    try {
      logger.log('Generating adapted resume...');
      const result = await resumeAdaptationService.createAdaptation(id, selectedMission.id) as Adaptation;
      if (result.matchAnalysis) {
        setMatchAnalysis(result.matchAnalysis);
      }
      setAdaptation(result);
      setStep('show-result');
      toast.success(t('adaptation.generationComplete'));
    } catch (err) {
      logger.error('Error creating adaptation:', err);
      setError((err as Error).message || 'Erreur lors de la génération');
      toast.error(t('adaptation.generationError'));
      setStep('show-analysis');
    }
  };

  const handleViewAdaptation = (): void => {
    if (adaptation?.adaptationId) {
      navigate(`/adaptations/${adaptation.adaptationId}`);
      return;
    }

    navigate('/adaptations');
  };

  const handleBack = (): void => {
    if (step === 'show-analysis') {
      setStep('select-mission');
      setSelectedMission(null);
      setMatchAnalysis(null);
      return;
    }

    if (step === 'show-result') {
      setStep('show-analysis');
      return;
    }

    navigate(`/resumes/${id}/improve`);
  };

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
                  onClose={() => navigate(`/resumes/${id}/improve`)}
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
                  onCancel={() => setStep('select-mission')}
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
                onNewAdaptation={() => setStep('select-mission')}
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
