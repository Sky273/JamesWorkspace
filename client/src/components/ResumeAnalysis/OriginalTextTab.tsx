/**
 * Original Text Tab Component
 * TypeScript version with TinyMCE editor for editing
 */

import { useEffect, useState, useRef, useCallback, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UserIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { useResume } from '../../context/ResumeContext';
import { loadTinyMCE } from '../../utils/lazyTinyMCE';
import { TinyMCEEditor } from '../../types/tinymce.d';
import { registerSuggestionsPlugin, parseSuggestions } from '../../utils/tinymceSuggestionsPlugin';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';

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
}

const OriginalTextTab = ({ resume }: OriginalTextTabProps): JSX.Element => {
  const { t } = useTranslation();
  const { updateOriginalContent, updateResumeAnalysis } = useResume();
  const [tinymceLoaded, setTinymceLoaded] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const initializationInProgress = useRef(false);
  const initialContentRef = useRef<string>('');
  
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

  // Load TinyMCE
  useEffect(() => {
    let mounted = true;
    loadTinyMCE()
      .then(() => { if (mounted) setTinymceLoaded(true); })
      .catch((err) => { logger.error('Failed to load TinyMCE:', err); });
    return () => { mounted = false; };
  }, []);

  // Initialize TinyMCE editor
  useEffect(() => {
    const tinymce = window.tinymce;
    if (!tinymceLoaded || !tinymce || initializationInProgress.current) return;
    if (!resume?.['Original Text']) return;

    const init = async (): Promise<void> => {
      try {
        initializationInProgress.current = true;
        const existingEditor = tinymce.get('originalTextEditor');
        if (existingEditor) existingEditor.remove();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Store initial content for change detection
        initialContentRef.current = resume['Original Text'] || '';

        await tinymce.init({
          selector: '#originalTextEditor',
          height: 500,
          menubar: true,
          plugins: ['advlist', 'autolink', 'lists', 'link', 'charmap', 'preview', 'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen', 'insertdatetime', 'table', 'help', 'wordcount'],
          toolbar: 'undo redo | blocks | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | suggestions | help',
          content_style: `body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; padding-left: 30px !important; }`,
          branding: false,
          promotion: false,
          license_key: 'gpl',
          setup: (editor: TinyMCEEditor) => {
            editorRef.current = editor;
            
            // Register suggestions plugin with parsed suggestions from original analysis
            const suggestions = parseSuggestions(resume['Key Improvements']);
            registerSuggestionsPlugin(editor, { suggestions });
            
            editor.on('init', () => {
              setEditorReady(true);
              editor.setContent(resume['Original Text'] || '');
            });

            // Track changes
            editor.on('change keyup', () => {
              const currentContent = editor.getContent();
              setHasChanges(currentContent !== initialContentRef.current);
            });
          }
        });
      } catch (err) {
        logger.error('Failed to initialize TinyMCE:', err);
      } finally {
        initializationInProgress.current = false;
      }
    };

    init();

    return () => {
      const editor = tinymce.get('originalTextEditor');
      if (editor) editor.remove();
    };
  }, [tinymceLoaded, resume]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!resume?.id || !editorRef.current) return;
    
    setSaving(true);
    try {
      const content = editorRef.current.getContent();
      await updateOriginalContent(resume.id, content);
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
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

      {/* TinyMCE Editor */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {!editorReady && (
          <div className="flex items-center justify-center h-[500px] bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('common.loading', 'Loading editor...')}
            </div>
          </div>
        )}
        <textarea 
          id="originalTextEditor" 
          defaultValue={resume['Original Text'] || ''} 
          style={{ visibility: editorReady ? 'visible' : 'hidden' }}
        />
      </div>
    </div>
  );
};

export default OriginalTextTab;
