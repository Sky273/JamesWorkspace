/**
 * Improved Text Tab Component
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, UserIcon, BriefcaseIcon, SparklesIcon, ExclamationTriangleIcon, ClockIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import VersionsPanel from './VersionsPanel';
import { getVersions } from '../../services/resumeVersionsService';

interface Resume {
  id: string;
  'Global Rating'?: string | number;
  'Improved Global Rating'?: string | number;
  'Name'?: string;
  'Title'?: string;
  'Current Version'?: number;
  [key: string]: unknown;
}

// Helper function to parse score values (handles number, "75%", "75")
const parseScoreValue = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

interface ImprovedTextTabProps {
  resume: Resume;
  onSave?: () => Promise<void>;
  onUpdateField?: (field: string, value: string) => Promise<void>;
  editorReady?: boolean;
  onAIModify?: (instructions: string) => Promise<string>;
  onVersionRestored?: (newVersion: number) => void;
  onAdaptToMission?: () => void;
  editorSlot?: React.ReactNode;
}

const ImprovedTextTab = ({ resume, onSave, onUpdateField, editorReady = false, onAIModify, onVersionRestored, onAdaptToMission, editorSlot }: ImprovedTextTabProps): JSX.Element => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [candidateName, setCandidateName] = useState<string>(resume['Name'] || '');
  const [professionalTitle, setProfessionalTitle] = useState<string>(resume['Title'] || '');
  const [aiInstructions, setAiInstructions] = useState<string>('');
  const [isAIModifying, setIsAIModifying] = useState<boolean>(false);
  const [aiResponseMessage, setAiResponseMessage] = useState<string>('');
  const [isVersionsPanelOpen, setIsVersionsPanelOpen] = useState<boolean>(false);
  const [currentVersion, setCurrentVersion] = useState<number>(resume['Current Version'] || 0);
  const [hasVersions, setHasVersions] = useState<boolean>(false);
  const [versionsLoaded, setVersionsLoaded] = useState<boolean>(false);

  // Load versions count on mount
  useEffect(() => {
    const checkVersions = async () => {
      if (!resume.id || versionsLoaded) return;
      try {
        const response = await getVersions(resume.id, { limit: 1 });
        if (response.total > 0) {
          setHasVersions(true);
          if (response.versions.length > 0) {
            setCurrentVersion(response.versions[0].versionNumber);
          }
        }
        setVersionsLoaded(true);
      } catch {
        setVersionsLoaded(true);
      }
    };
    checkVersions();
  }, [resume.id, versionsLoaded]);

  useEffect(() => {
    setCandidateName(resume['Name'] || '');
    setProfessionalTitle(resume['Title'] || '');
    if (resume['Current Version'] && resume['Current Version'] > 0) {
      setCurrentVersion(resume['Current Version']);
      setHasVersions(true);
    }
  }, [resume]);

  const originalRating = parseScoreValue(resume['Global Rating']);
  const improvedRating = parseScoreValue(resume['Improved Global Rating']);
  const improvement = improvedRating - originalRating;
  const hasImprovement = improvement !== 0;
  const isNegativeImprovement = improvement < 0;

  const handleSave = async (): Promise<void> => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameBlur = async (): Promise<void> => {
    if (onUpdateField && candidateName !== resume['Name']) {
      await onUpdateField('Name', candidateName);
    }
  };

  const handleTitleBlur = async (): Promise<void> => {
    if (onUpdateField && professionalTitle !== resume['Title']) {
      await onUpdateField('Title', professionalTitle);
    }
  };

  const handleVersionRestored = async (newVersion: number): Promise<void> => {
    setCurrentVersion(newVersion);
    setHasVersions(true);
    setIsVersionsPanelOpen(false);
    
    // Reload the latest version content
    try {
      const response = await getVersions(resume.id, { limit: 1 });
      if (response.versions.length > 0) {
        // Notify parent to update editor content
        if (onVersionRestored) {
          onVersionRestored(newVersion);
        }
      }
    } catch {
      // Still notify parent even if reload fails
      if (onVersionRestored) {
        onVersionRestored(newVersion);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('resume.analysis.improvedText')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('resume.analysis.improvedTextDescription')}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Version indicator */}
          {(hasVersions || currentVersion > 0) && (
            <button
              onClick={() => setIsVersionsPanelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('versions.openHistory', 'Voir l\'historique des versions')}
            >
              <ClockIcon className="w-4 h-4" />
              {currentVersion > 0 ? `v${currentVersion}` : t('versions.history', 'Historique')}
            </button>
          )}
          
          {/* Original Score */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Score :</span>
            <span className="px-2 py-1 text-sm font-medium rounded-full text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30">
              {originalRating}%
            </span>
          </div>
          
          {/* Improved Score */}
          {improvedRating > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Amélioré :</span>
              <span className="px-2 py-1 text-sm font-medium rounded-full text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30">
                {improvedRating}%
              </span>
              {hasImprovement && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  isNegativeImprovement 
                    ? 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    : 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                }`}>
                  {isNegativeImprovement ? '' : '+'}{improvement}%
                </span>
              )}
            </div>
          )}
          {onAdaptToMission && (
            <button
              onClick={onAdaptToMission}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              {t('resume.actions.adaptToMission')}
            </button>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving || !editorReady}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                isSaving || !editorReady
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('resume.actions.saving')}
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  {t('resume.actions.saveChanges')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Candidate Name and Professional Title fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <UserIcon className="inline-block w-4 h-4 mr-1" />
            {t('resume.analysis.candidateName')}
          </label>
          <input
            type="text"
            value={candidateName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCandidateName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder={t('resume.analysis.candidateNamePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <BriefcaseIcon className="inline-block w-4 h-4 mr-1" />
            {t('resume.analysis.professionalTitle')}
          </label>
          <input
            type="text"
            value={professionalTitle}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setProfessionalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder={t('resume.analysis.professionalTitlePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {editorSlot || <div className="min-h-[500px]"></div>}
      </div>

      {/* AI Modification Section */}
      {onAIModify && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Modifier par IA
            </h4>
          </div>
          
          {/* Warning message */}
          <div className="mb-4 flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Attention : Les modifications générées par l'IA peuvent parfois dégrader la qualité du CV. Vérifiez toujours le résultat avant de sauvegarder.
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Utilisez l'IA pour modifier ce CV selon vos instructions spécifiques
          </p>
          
          <textarea
            value={aiInstructions}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAiInstructions(e.target.value)}
            placeholder="Exemple : Rendre le résumé plus concis, ajouter plus de détails techniques sur les projets Docker, mettre l'accent sur les compétences en leadership..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            disabled={isAIModifying}
          />
          
          <button
            onClick={async () => {
              if (!aiInstructions.trim() || !onAIModify) return;
              setIsAIModifying(true);
              setAiResponseMessage('');
              try {
                const message = await onAIModify(aiInstructions);
                if (message) {
                  setAiResponseMessage(message);
                }
                setAiInstructions('');
              } catch {
                setAiResponseMessage('');
              } finally {
                setIsAIModifying(false);
              }
            }}
            disabled={isAIModifying || !aiInstructions.trim()}
            className={`mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
              isAIModifying || !aiInstructions.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isAIModifying ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Modification en cours...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4" />
                Appliquer
              </>
            )}
          </button>
          
          {/* AI Response Message */}
          {aiResponseMessage && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                {aiResponseMessage}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Versions Panel */}
      <VersionsPanel
        resumeId={resume.id}
        currentVersion={currentVersion}
        isOpen={isVersionsPanelOpen}
        onClose={() => setIsVersionsPanelOpen(false)}
        onVersionRestored={handleVersionRestored}
      />
    </div>
  );
};

export default ImprovedTextTab;
