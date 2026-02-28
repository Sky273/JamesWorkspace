/**
 * ResumeAdaptPage Component
 * Page for adapting a resume to a specific mission
 */

import { useState, useEffect, useCallback } from 'react';
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
import Breadcrumbs from '../components/Breadcrumbs';

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
      toast.success(t('adaptation.generationComplete', 'CV adapté généré avec succès'));
    } catch (err) {
      logger.error('Error creating adaptation:', err);
      setError((err as Error).message || 'Erreur lors de la génération');
      toast.error(t('adaptation.generationError', 'Erreur lors de la génération du CV adapté'));
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {t('errors.resumeNotFound', 'CV non trouvé')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/resumes')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              {t('common.backToResumes', 'Retour aux CVs')}
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
        <Breadcrumbs className="mb-4" />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('adaptation.title', 'Adapter le CV à une Mission')}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                CV: {resume.Name || t('common.unnamed', 'Sans nom')}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step === 'select-mission' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'select-mission' ? 'bg-blue-100 text-blue-600' : 
                ['analyzing', 'show-analysis', 'adapting', 'show-result'].includes(step) ? 'bg-green-100 text-green-600' : 'bg-gray-100'
              }`}>
                {['analyzing', 'show-analysis', 'adapting', 'show-result'].includes(step) ? <CheckCircleIcon className="w-5 h-5" /> : '1'}
              </div>
              <span className="text-sm font-medium">{t('adaptation.steps.selectMission', 'Sélectionner')}</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className={`flex items-center gap-2 ${['analyzing', 'show-analysis'].includes(step) ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                ['analyzing', 'show-analysis'].includes(step) ? 'bg-blue-100 text-blue-600' : 
                ['adapting', 'show-result'].includes(step) ? 'bg-green-100 text-green-600' : 'bg-gray-100'
              }`}>
                {['adapting', 'show-result'].includes(step) ? <CheckCircleIcon className="w-5 h-5" /> : '2'}
              </div>
              <span className="text-sm font-medium">{t('adaptation.steps.analyze', 'Analyser')}</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className={`flex items-center gap-2 ${['adapting', 'show-result'].includes(step) ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                ['adapting', 'show-result'].includes(step) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'
              }`}>
                {step === 'show-result' ? <CheckCircleIcon className="w-5 h-5" /> : '3'}
              </div>
              <span className="text-sm font-medium">{t('adaptation.steps.adapt', 'Adapter')}</span>
            </div>
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
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {t('adaptation.analyzing', 'Analyse en cours...')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                  {t('adaptation.analyzingDescription', 'Analyse de l\'adéquation entre le CV et la mission sélectionnée')}
                </p>
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <BriefcaseIcon className="w-5 h-5 text-blue-500" />
                    {t('adaptation.selectedMission', 'Mission Sélectionnée')}
                  </h3>
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMission?.Title || 'Sans titre'}</p>
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
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {t('adaptation.generating', 'Génération du CV adapté...')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                  {t('adaptation.generatingDescription', 'Optimisation du CV pour maximiser la correspondance avec la mission')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
                  {t('adaptation.generatingTime', 'Cela peut prendre 30-90 secondes')}
                </p>
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
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
                      {t('adaptation.tabs.adapted', 'CV Adapté')}
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
                    {t('adaptation.newAdaptation', 'Nouvelle adaptation')}
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
