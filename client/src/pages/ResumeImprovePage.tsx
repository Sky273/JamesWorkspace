/**
 * ResumeImprovePage Component
 * Dedicated page for resume improvement step
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SparklesIcon, ShareIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import ShareQRCodeModal from '../components/ShareQRCodeModal';
import { templateService } from '../utils/templateService';
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
import PipelineTab from '../components/ResumeAnalysis/PipelineTab';
import ResumeComments from '../components/ResumeComments';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import { removeSuggestionMarkers } from '../utils/tinymceSuggestionsPlugin';
import { TiptapEditor, parseSuggestions } from '../components/TiptapEditor';
import type { TiptapEditorRef } from '../components/TiptapEditor';

const ResumeImprovePage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, resumes, improveCurrentResume, updateImprovedContent, loading: contextLoading, processingStep } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [activeTab, setActiveTab] = useState<'improved' | 'compare' | 'analysis' | 'pipeline'>('improved');
  const [localResume, setLocalResume] = useState<Resume | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<TiptapEditorRef | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareLoading, setShareLoading] = useState(false);

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
      const rawContent = editorRef.current.getContent();
      // Remove suggestion markers before saving to ensure clean content is stored
      const content = removeSuggestionMarkers(rawContent);
      const result = await updateImprovedContent(currentResume.id, content);
      // Update editor with cleaned content
      editorRef.current.setContent(content);
      // Update localResume to keep it in sync with saved content
      setLocalResume(prev => prev ? {
        ...prev,
        'Improved Text': content,
        'Current Version': result.currentVersion || prev['Current Version']
      } : null);
      toast.success(t('resume.saveSuccess'));
    } catch (err) {
      logger.error('Error saving improved content:', err);
      toast.error(t('resume.saveError'));
    }
  }, [currentResume, updateImprovedContent, t]);

  const handleAIModify = useCallback(async (instructions: string): Promise<string> => {
    if (!currentResume) return '';
    try {
      const currentContent = editorRef.current?.getContent() || localResume?.['Improved Text'] || '';
      
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
      if (editorRef.current && modifiedContent) {
        editorRef.current.setContent(modifiedContent);
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
      const updatedResumeData = await resumeService.getResume(currentResume.id) as Record<string, unknown>;
      if (updatedResumeData) {
        const updatedResume = { ...localResume, ...updatedResumeData, 'Current Version': newVersion };
        setLocalResume(updatedResume as Resume);
        setCurrentResume(updatedResume as Resume);
        
        const restoredText = (updatedResumeData['Improved Text'] || updatedResumeData['improved_text'] || '') as string;
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

  // Handle share improved PDF
  const handleShare = useCallback(async () => {
    if (!id || !localResume) return;
    
    setShareLoading(true);
    setShowShareModal(true);
    
    try {
      // Get the first available template
      const templates = await templateService.getAllTemplates();
      if (!templates || templates.length === 0) {
        throw new Error('No templates available');
      }
      const template = templates[0];
      
      // Prepare content with replacements - clean suggestion markers
      const rawContent = localResume['Improved Text'] || localResume['Original Text'] || '';
      const content = removeSuggestionMarkers(rawContent);
      const candidateName = localResume['Name'] || 'Candidat';
      const candidateTitle = localResume['Title'] || '';
      
      let processedBody = template.TemplateContent || '';
      processedBody = processedBody.replace(/-name-/g, candidateName);
      processedBody = processedBody.replace(/-title-/g, candidateTitle);
      processedBody = processedBody.replace(/-content-/g, content);
      
      let processedHeader = template.HeaderContent || '';
      if (processedHeader) {
        processedHeader = processedHeader.replace(/-name-/g, candidateName);
        processedHeader = processedHeader.replace(/-title-/g, candidateTitle);
      }
      
      let processedFooter = template.FooterContent || '';
      if (processedFooter) {
        processedFooter = processedFooter.replace(/-name-/g, candidateName);
        processedFooter = processedFooter.replace(/-title-/g, candidateTitle);
      }
      
      // Generate and store the PDF
      const options = await createAuthOptionsWithCsrf({
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await fetchWithAuth(`/api/share/resume/${id}/generate`, {
        ...options,
        method: 'POST',
        body: JSON.stringify({
          htmlContent: processedBody,
          filename: candidateName.replace(/\s+/g, '_'),
          stylesheet: template.Stylesheet || '',
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        // Build URL on frontend using current origin - use /share/pdf route
        const shareUrl = `${window.location.origin}/share/pdf/${data.token}`;
        setShareUrl(shareUrl);
      } else {
        toast.error(t('share.error', 'Failed to generate share link'));
        setShowShareModal(false);
      }
    } catch (err) {
      logger.error('Failed to generate share URL:', err);
      toast.error(t('share.error', 'Failed to generate share link'));
      setShowShareModal(false);
    } finally {
      setShareLoading(false);
    }
  }, [id, localResume, t]);

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
          <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
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
              {hasImprovedText && (
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                  title={t('share.button', 'Share')}
                >
                  <ShareIcon className="h-5 w-5" />
                  {t('share.button', 'Share')}
                </button>
              )}
            </div>
        </motion.div>

        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <div className="flex items-center">
            {/* Step 1 — Analysis (past) */}
            <Link to={`/resumes/${id}/analysis`} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/20">
                <CheckCircleIcon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">
                {t('resume.steps.analysis')}
              </span>
            </Link>

            {/* Connector 1→2 */}
            <div className="w-10 sm:w-16 h-[3px] mx-2 bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-full" />

            {/* Step 2 — Improve (active) */}
            <div className="flex items-center gap-2">
              <motion.div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/25"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SparklesIcon className="w-4 h-4 text-white" />
              </motion.div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {t('resume.steps.improve')}
              </span>
            </div>

            {/* Connector 2→3 */}
            <div className="w-10 sm:w-16 h-[3px] mx-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500"
                initial={false}
                animate={{ width: hasImprovedText ? '100%' : '30%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>

            {/* Step 3 — Export */}
            {hasImprovedText ? (
              <Link to={`/resumes/${id}/export`} className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-600 flex items-center justify-center shadow-sm shadow-purple-500/20">
                  <ArrowDownTrayIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400 group-hover:underline">
                  {t('resume.steps.export')}
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 opacity-50">
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <ArrowDownTrayIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  {t('resume.steps.export')}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Content */}
        {isImproving || contextLoading ? (
          <ImprovementAnimation currentStep={processingStep || 'improving'} />
        ) : !hasImprovedText ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-transparent to-indigo-50/40 dark:from-blue-950/20 dark:via-transparent dark:to-indigo-950/15" />

            {/* Floating sparkles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 8 }, (_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-indigo-400/25"
                  style={{ left: `${12 + i * 11}%`, top: `${20 + (i % 3) * 25}%`, width: 3 + (i % 3), height: 3 + (i % 3) }}
                  animate={{ y: [0, -14, 0], opacity: [0, 0.6, 0], scale: [0.5, 1.3, 0.5] }}
                  transition={{ duration: 3 + i * 0.4, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </div>

            <div className="relative flex flex-col items-center py-16 px-6">
              {/* Animated icon */}
              <motion.div
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-6"
                animate={{ scale: [1, 1.06, 1], rotate: [0, 2, -2, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SparklesIcon className="w-10 h-10 text-white" />
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                />
              </motion.div>

              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('resume.improve.notYetImproved')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-center">
                {t('resume.improve.description')}
              </p>

              <motion.button
                onClick={handleImprove}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-all"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <SparklesIcon className="w-5 h-5" />
                {t('resume.actions.improveNow')}
              </motion.button>

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                {t('resume.improve.duration', 'Environ 30–90 secondes')}
              </p>
            </div>
          </motion.div>
        ) : (
          <>
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
                  <button
                    onClick={() => setActiveTab('pipeline')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'pipeline'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    {t('resume.analysis.tabs.pipeline')}
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
                    editorSlot={
                      <TiptapEditor
                        ref={editorRef}
                        content={localResume?.['Improved Text'] || ''}
                        onReady={() => setEditorReady(true)}
                        height={500}
                        suggestions={parseSuggestions(
                          localResume?.['Improved Key Improvements'] ||
                          localResume?.['Key Improvements']
                        )}
                      />
                    }
                  />
                )}
                {activeTab === 'compare' && <CompareTab resume={localResume} />}
                {activeTab === 'analysis' && <OverviewTab resume={localResume} t={t} />}
                {activeTab === 'pipeline' && id && (
                  <PipelineTab
                    resumeId={id}
                    resumeName={(localResume?.['Name'] as string) || (localResume?.name as string) || 'CV'}
                  />
                )}
              </div>
            </div>

            {/* Comments section */}
            {id && (
              <div className="mt-6">
                <ResumeComments resumeId={id} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Share QR Code Modal */}
      <ShareQRCodeModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={shareUrl}
        title={t('share.improvedCV', 'Improved CV')}
        candidateName={localResume?.['Name'] || 'CV'}
        isLoading={shareLoading}
      />
    </div>
  );
};

export default ResumeImprovePage;
