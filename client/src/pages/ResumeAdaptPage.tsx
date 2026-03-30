/**
 * ResumeAdaptPage Component
 * Page for adapting a resume to a specific mission
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeftIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  SparklesIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import MissionSelector from '../components/MissionSelector';
import MatchAnalysisDisplay from '../components/MatchAnalysisDisplay';
import AdaptationComparison from '../components/AdaptationComparison';
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

  // Cycling messages for loading states
  const ANALYZING_MSGS = useMemo(() => [
    'Comparaison des compétences requises…',
    'Évaluation de l\'expérience pertinente…',
    'Analyse des mots-clés de la mission…',
    'Calcul du score d\'adéquation…',
    'Identification des points forts…',
    'Détection des écarts de compétences…',
  ], []);

  const ADAPTING_MSGS = useMemo(() => [
    'Reformulation du résumé professionnel…',
    'Mise en avant des compétences clés…',
    'Adaptation de l\'expérience à la mission…',
    'Optimisation pour les mots-clés cibles…',
    'Renforcement de la pertinence ATS…',
    'Harmonisation du profil candidat…',
    'Ajustement du vocabulaire sectoriel…',
    'Polissage final du CV adapté…',
  ], []);

  const cycleMessages = step === 'adapting' ? ADAPTING_MSGS : ANALYZING_MSGS;

  useEffect(() => {
    if (step !== 'analyzing' && step !== 'adapting') return;
    setCycleIndex(0);
    const interval = setInterval(() => {
      setCycleIndex(prev => (prev + 1) % (step === 'adapting' ? ADAPTING_MSGS.length : ANALYZING_MSGS.length));
    }, 3500);
    return () => clearInterval(interval);
  }, [step, ANALYZING_MSGS.length, ADAPTING_MSGS.length]);

  // Load resume data
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
  }, [id, authGet]);

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
      toast.success(t('adaptation.analysisComplete', 'Analyse d\'adéquation terminée'));
    } catch (err) {
      logger.error('Error analyzing match:', err);
      setError((err as Error).message || 'Erreur lors de l\'analyse');
      toast.error(t('adaptation.analysisError', 'Erreur lors de l\'analyse d\'adéquation'));
      setStep('select-mission');
    }
  };

  const handleGenerateAdaptation = async (): Promise<void> => {
    if (!selectedMission || !id) return;
    setStep('adapting');
    setError(null);

    try {
      logger.log('Generating adapted resume...');
      const result = await resumeAdaptationService.createAdaptation(id, selectedMission.id) as Adaptation;
      if (result.matchAnalysis) setMatchAnalysis(result.matchAnalysis);
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
    } else {
      navigate('/adaptations');
    }
  };

  const handleBack = () => {
    if (step === 'show-analysis') {
      setStep('select-mission');
      setSelectedMission(null);
      setMatchAnalysis(null);
    } else if (step === 'show-result') {
      setStep('show-analysis');
    } else {
      navigate(`/resumes/${id}/improve`);
    }
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
        {/* Header */}
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

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-start justify-center">
            {[
              {
                key: 'select',
                label: t('adaptation.steps.selectMission'),
                icon: BriefcaseIcon,
                completed: ['analyzing', 'show-analysis', 'adapting', 'show-result'].includes(step),
                active: step === 'select-mission',
              },
              {
                key: 'analyze',
                label: t('adaptation.steps.analyze'),
                icon: DocumentTextIcon,
                completed: ['adapting', 'show-result'].includes(step),
                active: ['analyzing', 'show-analysis'].includes(step),
              },
              {
                key: 'adapt',
                label: t('adaptation.steps.adapt'),
                icon: SparklesIcon,
                completed: step === 'show-result',
                active: step === 'adapting',
              },
            ].map((s, i, arr) => (
              <div key={s.key} className="flex items-start">
                {/* Step circle + label */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    {/* Pulse ring for active step */}
                    {s.active && (
                      <motion.div
                        className="absolute -inset-2 rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }}
                        animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <motion.div
                      className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-shadow duration-500 ${
                        s.completed
                          ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-green-500/25'
                          : s.active
                            ? 'bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg shadow-indigo-500/30'
                            : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      animate={s.active ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                      transition={s.active ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                    >
                      {s.completed ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                        >
                          <CheckCircleIcon className="w-6 h-6 text-white" />
                        </motion.div>
                      ) : (
                        <s.icon className={`w-5 h-5 ${s.active ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                      )}
                    </motion.div>
                  </div>
                  <motion.span
                    className={`mt-2.5 text-xs font-semibold tracking-wide ${
                      s.completed ? 'text-emerald-600 dark:text-emerald-400' :
                      s.active ? 'text-indigo-600 dark:text-blue-400' :
                      'text-gray-400 dark:text-gray-500'
                    }`}
                    animate={s.active ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                    transition={s.active ? { duration: 2, repeat: Infinity } : {}}
                  >
                    {s.label}
                  </motion.span>
                </div>
                {/* Connector line */}
                {i < arr.length - 1 && (
                  <div className="w-20 sm:w-32 h-[3px] mx-3 sm:mx-5 mt-[20px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                      initial={false}
                      animate={{ width: s.completed ? '100%' : s.active ? '40%' : '0%' }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
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
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative flex flex-col items-center justify-center py-20 overflow-hidden"
              >
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-transparent to-indigo-50/40 dark:from-blue-950/30 dark:via-transparent dark:to-indigo-950/20" />

                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {Array.from({ length: 10 }, (_, i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full bg-indigo-400/30"
                      style={{ left: `${10 + i * 9}%`, top: `${15 + (i % 3) * 25}%`, width: 3 + (i % 4), height: 3 + (i % 4) }}
                      animate={{ y: [0, -18, 0], x: [0, i % 2 === 0 ? 6 : -6, 0], opacity: [0, 0.6, 0], scale: [0.5, 1.3, 0.5] }}
                      transition={{ duration: 3 + i * 0.4, delay: i * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ))}
                </div>

                {/* Multi-ring animated spinner */}
                <div className="relative w-32 h-32 mb-8">
                  {/* Outer glow */}
                  <motion.div
                    className="absolute -inset-4 rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-500/10"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  {/* Outer ring - slow rotation */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-[3px] border-blue-200/50 dark:border-blue-800/30"
                    style={{ borderTopColor: 'rgb(99, 102, 241)', borderRightColor: 'rgb(99, 102, 241)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Middle ring - opposite rotation */}
                  <motion.div
                    className="absolute inset-3 rounded-full border-[3px] border-indigo-200/30 dark:border-indigo-800/20"
                    style={{ borderBottomColor: 'rgb(79, 70, 229)', borderLeftColor: 'rgb(79, 70, 229)' }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Inner ring - fast rotation */}
                  <motion.div
                    className="absolute inset-6 rounded-full border-[2px] border-purple-200/20 dark:border-purple-800/15"
                    style={{ borderTopColor: 'rgb(147, 51, 234)', borderRightColor: 'rgb(147, 51, 234)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Central icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
                      animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <DocumentTextIcon className="w-7 h-7 text-white" />
                      {/* Shimmer overlay */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                      />
                    </motion.div>
                  </div>
                </div>

                <h3 className="relative text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('adaptation.analyzing', 'Analyse d\'adéquation en cours…')}
                </h3>

                {/* Cycling sub-message */}
                <div className="relative h-6 mb-6">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={cycleIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-gray-500 dark:text-gray-400 text-center"
                    >
                      {cycleMessages[cycleIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Shimmer progress bar */}
                <div className="relative w-64 h-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden mb-5">
                  <motion.div
                    className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full"
                    animate={{ left: ['-50%', '100%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>

                {/* Bouncing dots */}
                <div className="relative flex items-center gap-1.5 mt-2">
                  {[0, 1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-400"
                      animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              </motion.div>
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
                    <p className="font-medium text-gray-900 dark:text-gray-100">{selectedMission?.Title || 'Sans titre'}</p>
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
              <motion.div
                key="adapting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative flex flex-col items-center justify-center py-20 overflow-hidden"
              >
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-50/60 via-transparent to-fuchsia-50/40 dark:from-purple-950/30 dark:via-transparent dark:to-fuchsia-950/20" />

                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {Array.from({ length: 10 }, (_, i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full bg-purple-400/30"
                      style={{ left: `${8 + i * 9}%`, top: `${10 + (i % 4) * 22}%`, width: 3 + (i % 3), height: 3 + (i % 3) }}
                      animate={{ y: [0, -16, 0], x: [0, i % 2 === 0 ? 7 : -7, 0], opacity: [0, 0.5, 0], scale: [0.4, 1.2, 0.4] }}
                      transition={{ duration: 3.5 + i * 0.3, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ))}
                </div>

                {/* Multi-ring spinner with orbiting particles */}
                <div className="relative w-32 h-32 mb-8">
                  {/* Outer glow */}
                  <motion.div
                    className="absolute -inset-4 rounded-full bg-gradient-to-br from-purple-400/10 to-fuchsia-500/10"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  {/* Outer ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-[3px] border-purple-200/50 dark:border-purple-800/30"
                    style={{ borderTopColor: 'rgb(147, 51, 234)', borderRightColor: 'rgb(147, 51, 234)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Middle ring */}
                  <motion.div
                    className="absolute inset-3 rounded-full border-[3px] border-fuchsia-200/30 dark:border-fuchsia-800/20"
                    style={{ borderBottomColor: 'rgb(192, 38, 211)', borderLeftColor: 'rgb(192, 38, 211)' }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Inner ring */}
                  <motion.div
                    className="absolute inset-6 rounded-full border-[2px] border-indigo-200/20 dark:border-indigo-800/15"
                    style={{ borderTopColor: 'rgb(99, 102, 241)', borderRightColor: 'rgb(99, 102, 241)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Orbiting particles */}
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="absolute inset-0"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4 + i * 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
                    >
                      <motion.div
                        className={`absolute w-2 h-2 rounded-full ${
                          i === 0 ? 'bg-purple-400' : i === 1 ? 'bg-fuchsia-400' : 'bg-indigo-400'
                        }`}
                        style={{ top: `-4px`, left: '50%', marginLeft: '-4px' }}
                        animate={{ scale: [0.6, 1.3, 0.6], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                      />
                    </motion.div>
                  ))}
                  {/* Central icon card */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30"
                      animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <SparklesIcon className="w-7 h-7 text-white" />
                      <motion.div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                      />
                    </motion.div>
                  </div>
                </div>

                <h3 className="relative text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('adaptation.generating')}
                </h3>

                {/* Cycling sub-message */}
                <div className="relative h-6 mb-6">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={cycleIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-gray-500 dark:text-gray-400 text-center"
                    >
                      {cycleMessages[cycleIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Shimmer progress bar */}
                <div className="relative w-64 h-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden mb-5">
                  <motion.div
                    className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500 rounded-full"
                    animate={{ left: ['-50%', '100%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>

                <p className="relative text-xs text-gray-400 dark:text-gray-500">
                  {t('adaptation.generatingTime')}
                </p>

                {/* Bouncing dots */}
                <div className="relative flex items-center gap-1.5 mt-3">
                  {[0, 1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-purple-400"
                      animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'show-result' && adaptation && (
              <motion.div
                key="show-result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-green-500" />
                    {t('adaptation.result', 'Résultat de l\'adaptation')}
                  </h3>
                  <span className="text-sm text-gray-500">
                    Mission: {selectedMission?.Title}
                  </span>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                  <nav className="flex gap-8">
                    <button
                      onClick={() => setActiveTab('analysis')}
                      className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'analysis'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {t('adaptation.tabs.analysis', 'Analyse d\'Adéquation')}
                    </button>
                    <button
                      onClick={() => setActiveTab('adapted')}
                      className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'adapted'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {t('adaptation.tabs.adapted')}
                    </button>
                  </nav>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'analysis' && matchAnalysis && (
                    <motion.div
                      key="analysis-tab"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <MatchAnalysisDisplay analysis={matchAnalysis} hideActions={true} />
                    </motion.div>
                  )}
                  {activeTab === 'adapted' && (
                    <motion.div
                      key="adapted-tab"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <AdaptationComparison
                        originalText={resume['Original Text'] || resume['Improved Text'] || ''}
                        adaptedText={adaptation.adaptedText || adaptation['Adapted Text'] || ''}
                        matchScore={adaptation.matchScore || adaptation['Match Score']}
                        candidateName={resume.Name || 'Candidat'}
                        candidateTitle={resume.Title || 'Titre Professionnel'}
                        simplified={true}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setStep('select-mission')}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {t('adaptation.newAdaptation')}
                  </button>
                  <button
                    onClick={handleViewAdaptation}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    {t('adaptation.viewAdaptation', 'Voir l\'adaptation')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error display */}
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
