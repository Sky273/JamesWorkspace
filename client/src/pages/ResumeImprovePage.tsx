/**
 * ResumeImprovePage Component
 * Dedicated page for resume improvement step
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { SkeletonCard } from '../components/ui/Skeleton';
import ImprovementAnimation from '../components/ImprovementAnimation';
import ConsentBadge, { ConsentStatus } from '../components/ConsentBadge';
import ImprovedTextTab from '../components/ResumeAnalysis/ImprovedTextTab';
import CompareTab from '../components/ResumeAnalysis/CompareTab';
import OverviewTab from '../components/ResumeAnalysis/OverviewTab';
import { loadTinyMCE } from '../utils/lazyTinyMCE';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import { TinyMCEEditor } from '../types/tinymce.d';
import { registerSuggestionsPlugin, parseSuggestions } from '../utils/tinymceSuggestionsPlugin';

const ResumeImprovePage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, resumes, improveCurrentResume, updateImprovedContent, loading: contextLoading, processingStep } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [activeTab, setActiveTab] = useState<'improved' | 'compare' | 'analysis'>('improved');
  const [localResume, setLocalResume] = useState<Resume | null>(null);
  const [tinymceLoaded, setTinymceLoaded] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const initializationInProgress = useRef(false);

  useEffect(() => {
    const loadResume = async () => {
      if (!id) {
        setError('No resume ID provided');
        setLoading(false);
        return;
      }

      const existingResume = resumes.find(r => r.id === id);
      if (existingResume) {
        setCurrentResume(existingResume);
        setLocalResume(existingResume);
        setLoading(false);
        return;
      }

      try {
        const resume = await resumeService.getResume(id);
        if (resume) {
          setCurrentResume(resume as Resume);
          setLocalResume(resume as Resume);
        } else {
          setError('Resume not found');
        }
      } catch (err) {
        logger.error('[ResumeImprovePage] Error fetching resume:', err);
        setError('Failed to load resume');
        toast.error(t('errors.loadResume'));
      } finally {
        setLoading(false);
      }
    };

    loadResume();
  }, [id, resumes, setCurrentResume, t]);

  useEffect(() => {
    if (currentResume) {
      setLocalResume(currentResume);
    }
  }, [currentResume]);

  // Load TinyMCE
  useEffect(() => {
    let mounted = true;
    loadTinyMCE()
      .then(() => { if (mounted) setTinymceLoaded(true); })
      .catch((err) => { logger.error('Failed to load TinyMCE:', err); });
    return () => { mounted = false; };
  }, []);

  // Initialize TinyMCE editor when on improved tab with improved text
  useEffect(() => {
    const tinymce = window.tinymce;
    if (!tinymceLoaded || !tinymce || initializationInProgress.current) return;
    if (activeTab !== 'improved' || !localResume?.['Improved Text']) return;

    const init = async (): Promise<void> => {
      try {
        initializationInProgress.current = true;
        const existingEditor = tinymce.get('templateEditor');
        if (existingEditor) existingEditor.remove();
        await new Promise(resolve => setTimeout(resolve, 100));

        await tinymce.init({
          selector: '#templateEditor',
          height: 500,
          menubar: true,
          plugins: ['advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview', 'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount'],
          toolbar: 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | suggestions | help',
          content_style: `body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; padding-left: 30px !important; }`,
          branding: false,
          promotion: false,
          license_key: 'gpl',
          setup: (editor: TinyMCEEditor) => {
            editorRef.current = editor;
            
            // Register suggestions plugin with parsed suggestions
            const suggestions = parseSuggestions(localResume['Improved Key Improvements'] || localResume['Key Improvements']);
            registerSuggestionsPlugin(editor, { suggestions });
            
            editor.on('init', () => {
              setEditorReady(true);
              editor.setContent(localResume['Improved Text'] || '');
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
      const editor = tinymce.get('templateEditor');
      if (editor) editor.remove();
    };
  }, [tinymceLoaded, activeTab, localResume]);

  const handleImprove = useCallback(async () => {
    if (!currentResume || isImproving) return;
    
    setIsImproving(true);
    try {
      await improveCurrentResume();
      toast.success(t('resume.improveSuccess'));
    } catch (err) {
      logger.error('Error improving resume:', err);
      toast.error(t('resume.improveError'));
    } finally {
      setIsImproving(false);
    }
  }, [currentResume, isImproving, improveCurrentResume, t]);

  const handleSaveImprovedContent = useCallback(async () => {
    if (!currentResume || !editorRef.current) return;
    try {
      const content = editorRef.current.getContent();
      const result = await updateImprovedContent(currentResume.id, content);
      toast.success(t('resume.saveSuccess'));
    } catch (err) {
      logger.error('Error saving improved content:', err);
      toast.error(t('resume.saveError'));
    }
  }, [currentResume, updateImprovedContent, t]);

  const handleAIModify = useCallback(async (instructions: string): Promise<string> => {
    if (!currentResume) return '';
    try {
      const tinymce = window.tinymce;
      const editor = tinymce?.get('templateEditor');
      const currentContent = editor?.getContent() || localResume?.['Improved Text'] || '';
      
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentContent, instructions })
      });
      
      const response = await fetchWithAuth(`/api/resumes/${currentResume.id}/ai-modify`, authOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to modify resume' }));
        throw new Error(errorData.error || 'Failed to modify resume with AI');
      }

      const { modifiedContent, message } = await response.json();
      if (editor && modifiedContent) {
        editor.setContent(modifiedContent);
      }
      return message || 'CV modifié avec succès par l\'IA';
    } catch (error) {
      logger.error('Failed to modify resume with AI:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de la modification par IA');
      throw error;
    }
  }, [currentResume, localResume]);

  const handleVersionRestored = useCallback(async (newVersion: number) => {
    if (!currentResume) return;
    try {
      const updatedResumeData = await resumeService.getResume(currentResume.id);
      if (updatedResumeData) {
        const updatedResume = { ...localResume, ...updatedResumeData, 'Current Version': newVersion };
        setLocalResume(updatedResume as Resume);
        setCurrentResume(updatedResume as Resume);
        
        const restoredText = updatedResumeData['Improved Text'] || updatedResumeData['improved_text'] || '';
        if (editorRef.current && restoredText) {
          editorRef.current.setContent(restoredText);
        }
        toast.success(`Version ${newVersion} chargée`);
      }
    } catch (error) {
      logger.error('Failed to reload after version restore:', error);
      toast.error('Erreur lors du rechargement du CV');
    }
  }, [currentResume, localResume, setCurrentResume]);

  const updateResumeField = useCallback(async (field: string, value: string) => {
    if (!currentResume) return;
    try {
      await resumeService.updateResume(currentResume.id, { [field]: value });
      const updated = { ...currentResume, [field]: value };
      setCurrentResume(updated);
      setLocalResume(updated);
    } catch (err) {
      logger.error(`Error updating ${field}:`, err);
      toast.error(`Failed to update ${field}`);
    }
  }, [currentResume, setCurrentResume]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <SkeletonCard className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !localResume) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-red-500 dark:text-red-400">{error || 'Resume not found'}</p>
          <Link to="/resumes" className="text-blue-500 hover:underline mt-4 inline-block">
            {t('common.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  const resumeName = localResume['Name'] || localResume['File Name'] || 'CV';
  const hasImprovedText = !!localResume['Improved Text'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Breadcrumbs */}
        <Breadcrumbs className="mb-4" />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resumeName}
                </h1>
                {localResume?.consent_status && (
                  <ConsentBadge
                    status={localResume.consent_status as ConsentStatus}
                    candidateName={localResume?.candidate_name as string | undefined}
                    candidateEmail={localResume?.candidate_email as string | undefined}
                    consentTokenExpiresAt={localResume?.consent_token_expires_at as string | null | undefined}
                    retentionUntil={localResume?.retention_until as string | null | undefined}
                    compact={true}
                  />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('resume.improve.title')}
              </p>
            </div>
        </motion.div>

        {/* Step indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Link 
              to={`/resumes/${id}/analysis`}
              className="px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t('resume.steps.analysis')}
            </Link>
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
              {t('resume.steps.improve')}
            </span>
            <ArrowRightIcon className="w-4 h-4 text-gray-400" />
            {hasImprovedText ? (
              <Link 
                to={`/resumes/${id}/export`}
                className="px-3 py-1 text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:underline"
              >
                {t('resume.steps.export')}
              </Link>
            ) : (
              <span className="px-3 py-1 text-gray-400 dark:text-gray-500">
                {t('resume.steps.export')}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {isImproving || contextLoading ? (
          <ImprovementAnimation currentStep={processingStep || 'improving'} />
        ) : !hasImprovedText ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <SparklesIcon className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('resume.improve.notYetImproved')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {t('resume.improve.description')}
            </p>
            <button
              onClick={handleImprove}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <SparklesIcon className="w-5 h-5" />
              {t('resume.actions.improveNow')}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('improved')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'improved'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {t('resume.analysis.tabs.improved')}
                </button>
                <button
                  onClick={() => setActiveTab('compare')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'compare'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {t('resume.analysis.tabs.compare')}
                </button>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'analysis'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {t('resume.analysis.tabs.overview')}
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'improved' && (
                <ImprovedTextTab
                  resume={localResume}
                  onSave={handleSaveImprovedContent}
                  onUpdateField={updateResumeField}
                  editorReady={editorReady}
                  onAIModify={handleAIModify}
                  onVersionRestored={handleVersionRestored}
                  onAdaptToMission={() => navigate(`/resumes/${id}/adapt`)}
                />
              )}
              {activeTab === 'compare' && <CompareTab resume={localResume} />}
              {activeTab === 'analysis' && <OverviewTab resume={localResume} t={t} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeImprovePage;
