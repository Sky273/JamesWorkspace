/**
 * Original Text Tab Component
 * TypeScript version with Tiptap editor for editing
 */

import { useEffect, useState, useRef, useCallback, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UserIcon, BriefcaseIcon, SparklesIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useResume } from '../../context/ResumeContext';
import {
  DeferredTiptapEditor as TiptapEditor,
  parseSuggestions,
  removeSuggestionMarkers,
} from '../TiptapEditor';
import type { TiptapEditorRef } from '../TiptapEditor';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';

interface Resume {
  id: string;
  'Original Text'?: string;
  'Improved Text'?: string;
  'Key Improvements'?: string;
  'Name'?: string;
  'Title'?: string;
  [key: string]: unknown;
}

interface OriginalTextTabProps {
  resume: Resume;
  onAIModify?: (instructions: string) => Promise<string>;
}

const OriginalTextTab = ({ resume, onAIModify }: OriginalTextTabProps): JSX.Element => {
  const { t } = useTranslation();
  const { updateOriginalContent, updateResumeAnalysis } = useResume();
  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef<TiptapEditorRef | null>(null);
  const initialContentRef = useRef<string>('');
  const [aiInstructions, setAiInstructions] = useState<string>('');
  const [isAIModifying, setIsAIModifying] = useState<boolean>(false);
  const [aiResponseMessage, setAiResponseMessage] = useState<string>('');

  // Internal AI modify handler that uses the editor's current content
  const handleAIModifyInternal = useCallback(async (instructions: string): Promise<string> => {
    if (!resume?.id) return '';
    const currentContent = editorRef.current?.getContent() || resume['Original Text'] || '';
    
    const authOptions = await createAuthOptionsWithCsrf({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: currentContent, instructions })
    });
    
    const response = await fetchWithAuth(`/api/resumes/${resume.id}/ai-modify`, authOptions);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to modify resume' }));
      throw new Error(errorData.error || 'Failed to modify resume with AI');
    }

    const { modifiedContent, message } = await response.json();
    if (editorRef.current && modifiedContent) {
      editorRef.current.setContent(modifiedContent);
      setHasChanges(true);
    }
    return message || 'CV modifié avec succès par l\'IA';
  }, [resume]);
  
  // Name and Title state
  const [candidateName, setCandidateName] = useState<string>(resume['Name'] || '');
  const [professionalTitle, setProfessionalTitle] = useState<string>(resume['Title'] || '');

  // Update name/title when resume changes
  useEffect(() => {
    setCandidateName(resume['Name'] || '');
    setProfessionalTitle(resume['Title'] || '');
  }, [resume]);

  // Handle name field blur - save to backend
  const handleNameBlur = useCallback(async () => {
    if (candidateName !== resume['Name'] && resume.id) {
      try {
        await updateResumeAnalysis(resume.id, { Name: candidateName });
        toast.success(t('resume.analysis.nameSaved', 'Name saved'));
      } catch (error) {
        logger.error('Failed to save name:', error);
        toast.error(t('resume.analysis.nameSaveError', 'Failed to save name'));
      }
    }
  }, [candidateName, resume, updateResumeAnalysis, t]);

  // Handle title field blur - save to backend
  const handleTitleBlur = useCallback(async () => {
    if (professionalTitle !== resume['Title'] && resume.id) {
      try {
        await updateResumeAnalysis(resume.id, { Title: professionalTitle });
        toast.success(t('resume.analysis.titleSaved', 'Title saved'));
      } catch (error) {
        logger.error('Failed to save title:', error);
        toast.error(t('resume.analysis.titleSaveError', 'Failed to save title'));
      }
    }
  }, [professionalTitle, resume, updateResumeAnalysis, t]);

  // Store initial content for change detection
  useEffect(() => {
    if (resume?.['Original Text']) {
      initialContentRef.current = resume['Original Text'];
    }
  }, [resume]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!resume?.id || !editorRef.current) return;
    
    setSaving(true);
    try {
      const rawContent = editorRef.current.getContent();
      // Remove suggestion markers before saving to ensure clean content is stored
      const content = removeSuggestionMarkers(rawContent);
      await updateOriginalContent(resume.id, content);
      // Update editor with cleaned content and reset change tracking
      editorRef.current.setContent(content);
      initialContentRef.current = content;
      setHasChanges(false);
      toast.success(t('resume.saveSuccess', 'Modifications saved successfully'));
    } catch (err) {
      logger.error('Error saving original content:', err);
      toast.error(t('resume.saveError', 'Failed to save modifications'));
    } finally {
      setSaving(false);
    }
  }, [resume?.id, updateOriginalContent, t]);

  return (
    <div className="space-y-4">
      {/* Header bar with title and save button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('resume.analysis.originalText')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('resume.analysis.originalTextDescriptionEditable', 'Edit the extracted text before improvement')}
          </p>
        </div>
        
        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges || !editorReady}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            hasChanges && editorReady
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {t('common.save', 'Save')}
            </>
          )}
        </button>
      </div>

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {t('resume.unsavedChanges', 'You have unsaved changes')}
        </div>
      )}

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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tiptap Editor */}
      <TiptapEditor
        ref={editorRef}
        content={resume['Original Text'] || ''}
        onChange={(html) => setHasChanges(html !== initialContentRef.current)}
        onReady={() => setEditorReady(true)}
        height={500}
        suggestions={parseSuggestions(resume['Key Improvements'])}
      />

      {/* AI Modification Section */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Modifier par IA
            </h4>
          </div>
          
          {/* Warning message */}
          <div className="mb-4 flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Attention : Les modifications générées par l&apos;IA peuvent parfois dégrader la qualité du CV. Vérifiez toujours le résultat avant de sauvegarder.
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Utilisez l&apos;IA pour modifier le texte original selon vos instructions spécifiques
          </p>
          
          <textarea
            value={aiInstructions}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAiInstructions(e.target.value)}
            placeholder="Exemple : Reformuler le résumé, corriger les fautes d'orthographe, restructurer les expériences professionnelles..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            disabled={isAIModifying}
          />
          
          <button
            onClick={async () => {
              const aiHandler = onAIModify || handleAIModifyInternal;
              if (!aiInstructions.trim()) return;
              setIsAIModifying(true);
              setAiResponseMessage('');
              try {
                const message = await aiHandler(aiInstructions);
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
    </div>
  );
};

export default OriginalTextTab;
