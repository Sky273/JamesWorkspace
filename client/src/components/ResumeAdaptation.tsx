/**
 * Resume Adaptation Component
 * TypeScript version
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import MissionSelector from './MissionSelector';
import MatchAnalysisDisplay from './MatchAnalysisDisplay';
import AdaptationComparison from './AdaptationComparison';
import resumeAdaptationService from '../utils/resumeAdaptationService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';

interface Mission {
  id: string;
  Title?: string;
  Content?: string;
}

interface MatchAnalysis {
  matchScore?: string | number;
  strengths?: string[];
  gaps?: string[];
  keywordMatches?: string[];
  missingKeywords?: string[];
  recommendations?: Record<string, string[]>;
}

interface Adaptation {
  adaptedText?: string;
  'Adapted Text'?: string;
  matchScore?: string | number;
  'Match Score'?: string | number;
  matchAnalysis?: MatchAnalysis;
}

interface Resume {
  id: string;
  Name?: string;
  'Original Text'?: string;
  'Improved Text'?: string;
  Title?: string;
  [key: string]: unknown;
}

interface ResumeAdaptationProps {
  resume: Resume;
  onClose: () => void;
}

type Step = 'select-mission' | 'analyzing' | 'show-analysis' | 'adapting' | 'show-result';

const ResumeAdaptation = ({ resume, onClose }: ResumeAdaptationProps): JSX.Element => {
  const [step, setStep] = useState<Step>('select-mission');
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [adaptation, setAdaptation] = useState<Adaptation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'adapted'>('analysis');

  const handleMissionSelect = async (mission: Mission): Promise<void> => {
    setSelectedMission(mission);
    setStep('analyzing');
    setLoading(true);
    setError(null);

    try {
      logger.log('Analyzing match between resume and mission...');
      const analysis = await resumeAdaptationService.analyzeMatch(resume.id, mission.id);
      setMatchAnalysis(analysis);
      setStep('show-analysis');
      toast.success('Analyse d\'adéquation terminée');
    } catch (err) {
      logger.error('Error analyzing match:', err);
      setError((err as Error).message || 'Erreur lors de l\'analyse');
      toast.error('Erreur lors de l\'analyse d\'adéquation');
      setStep('select-mission');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAdaptation = async (): Promise<void> => {
    if (!selectedMission) return;
    setStep('adapting');
    setLoading(true);
    setError(null);

    try {
      logger.log('Generating adapted resume...');
      const result = await resumeAdaptationService.createAdaptation(resume.id, selectedMission.id) as Adaptation;
      if (result.matchAnalysis) setMatchAnalysis(result.matchAnalysis);
      setAdaptation(result);
      setStep('show-result');
      toast.success('CV adapté généré avec succès');
    } catch (err) {
      logger.error('Error creating adaptation:', err);
      setError((err as Error).message || 'Erreur lors de la génération');
      toast.error('Erreur lors de la génération du CV adapté');
      setStep('show-analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndClose = (): void => {
    toast.success('Adaptation sauvegardée');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Adapter le CV à une Mission</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">CV: {resume.Name || 'Sans nom'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 'select-mission' && <MissionSelector onSelect={handleMissionSelect} onClose={onClose} />}

            {step === 'analyzing' && (
              <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Analyse en cours...</h3>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">Analyse de l'adéquation entre le CV et la mission sélectionnée</p>
              </motion.div>
            )}

            {step === 'show-analysis' && matchAnalysis && (
              <motion.div key="show-analysis" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Mission Sélectionnée</h3>
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMission?.Title || 'Sans titre'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{selectedMission?.Content || 'Pas de description'}</p>
                  </div>
                </div>
                <MatchAnalysisDisplay analysis={matchAnalysis} onContinue={handleGenerateAdaptation} onCancel={() => setStep('select-mission')} />
              </motion.div>
            )}

            {step === 'adapting' && (
              <motion.div key="adapting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Génération du CV adapté...</h3>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">Optimisation du CV pour maximiser la correspondance avec la mission</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">Cela peut prendre 30-90 secondes</p>
              </motion.div>
            )}

            {step === 'show-result' && adaptation && (
              <motion.div key="show-result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className="mb-6"><h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Mission: {selectedMission?.Title}</h3></div>
                <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                  <nav className="flex gap-8">
                    <button onClick={() => setActiveTab('analysis')} className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'analysis' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>Analyse d'Adéquation</button>
                    <button onClick={() => setActiveTab('adapted')} className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'adapted' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>CV Adapté</button>
                  </nav>
                </div>
                <AnimatePresence mode="wait">
                  {activeTab === 'analysis' && (<motion.div key="analysis-tab" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}><MatchAnalysisDisplay analysis={matchAnalysis} hideActions={true} /></motion.div>)}
                  {activeTab === 'adapted' && (<motion.div key="adapted-tab" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}><AdaptationComparison originalText={resume['Original Text'] || resume['Improved Text'] || ''} adaptedText={adaptation.adaptedText || adaptation['Adapted Text'] || ''} matchScore={adaptation.matchScore || adaptation['Match Score']} candidateName={resume['Name'] || 'Candidat'} candidateTitle={resume['Title'] || 'Titre Professionnel'} simplified={true} /></motion.div>)}
                </AnimatePresence>
                <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={handleSaveAndClose} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">Terminer</button>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default ResumeAdaptation;
