import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthFetch } from '../hooks/useAuthFetch';
import resumeAdaptationService from '../utils/resumeAdaptationService';
import type { MatchAnalysis } from '../utils/resumeAdaptationService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { markAdaptationsViewDirty } from '../utils/viewRefreshScopes';

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

export function useResumeAdaptPage() {
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
      "Évaluation de l'expérience pertinente...",
      'Analyse des mots-clés de la mission...',
      "Calcul du score d'adéquation...",
      'Identification des points forts...',
      'Détection des écarts de compétences...'
    ],
    []
  );

  const adaptingMessages = useMemo(
    () => [
      'Reformulation du résumé professionnel...',
      'Mise en avant des compétences clés...',
      "Adaptation de l'expérience à la mission...",
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
    const interval = window.setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % cycleMessages.length);
    }, 3500);

    return () => window.clearInterval(interval);
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
    void loadResume();
  }, [loadResume]);

  const handleMissionSelect = useCallback(async (mission: Mission) => {
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
  }, [id, t]);

  const handleGenerateAdaptation = useCallback(async () => {
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
      markAdaptationsViewDirty();
      setStep('show-result');
      toast.success(t('adaptation.generationComplete'));
    } catch (err) {
      logger.error('Error creating adaptation:', err);
      setError((err as Error).message || 'Erreur lors de la génération');
      toast.error(t('adaptation.generationError'));
      setStep('show-analysis');
    }
  }, [id, selectedMission, t]);

  const handleViewAdaptation = useCallback(() => {
    if (adaptation?.adaptationId) {
      navigate(`/adaptations/${adaptation.adaptationId}`);
      return;
    }

    navigate('/adaptations');
  }, [adaptation?.adaptationId, navigate]);

  const handleBack = useCallback(() => {
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
  }, [id, navigate, step]);

  const handleCancelAnalysis = useCallback(() => {
    setStep('select-mission');
  }, []);

  const handleStartNewAdaptation = useCallback(() => {
    setStep('select-mission');
  }, []);

  const handleCloseMissionSelector = useCallback(() => {
    navigate(`/resumes/${id}/improve`);
  }, [id, navigate]);

  return {
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
  };
}
