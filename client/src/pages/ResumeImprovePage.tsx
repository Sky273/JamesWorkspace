/**
 * ResumeImprovePage Component
 * Dedicated page for resume improvement step
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import ShareQRCodeModal from '../components/ShareQRCodeModal';
import { templateService } from '../utils/templateService';
import { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import ImprovementAnimation from '../components/ImprovementAnimation';
import ImprovedTextTab from '../components/ResumeAnalysis/ImprovedTextTab';
import ResumeImproveHeader from '../components/ResumeImprove/ResumeImproveHeader';
import ResumeImproveStepIndicator from '../components/ResumeImprove/ResumeImproveStepIndicator';
import ResumeImproveEmptyState from '../components/ResumeImprove/ResumeImproveEmptyState';
import CompareTab from '../components/ResumeAnalysis/CompareTab';
import OverviewTab from '../components/ResumeAnalysis/OverviewTab';
import PipelineTab from '../components/ResumeAnalysis/PipelineTab';
import OriginalSourcePreview from '../components/ResumeAnalysis/OriginalSourcePreview';
import ResumeComments from '../components/ResumeComments';
import PageHeader from '../components/page/PageHeader';
import ResponsivePageTabs, { type ResponsivePageTabOption } from '../components/page/ResponsivePageTabs';
import { fetchWithAuth, fetchWithCsrfRetry, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import { FRONTEND_LLM_AI_MODIFICATION_TIMEOUT_MS } from '../constants/llmTimeouts';
import {
  summarizeTemplatePayload,
} from '../utils/templateFragments';
import { buildSharePayload } from './resumeDocumentPayload';
import TiptapEditor from '../components/TiptapEditor/DeferredTiptapEditor';
import { parseSuggestions } from '../components/TiptapEditor/suggestions.shared';
import { removeSuggestionMarkers } from '../components/TiptapEditor/suggestionsHtml';
import type { TiptapEditorRef } from '../components/TiptapEditor/TiptapEditor';
import { extractImprovedSkillProofs } from '../components/ResumeAnalysis/skillProofs';
import { applyResumeUpdate, normalizeResume } from '../utils/resumeNormalization';

const ResumeImprovePage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, improveCurrentResume, updateImprovedContent, loading: contextLoading, processingStep } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [activeTab, setActiveTab] = useState<'improved' | 'original' | 'compare' | 'analysis' | 'pipeline'>('improved');
  const [localResume, setLocalResume] = useState<Resume | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<TiptapEditorRef | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareLoading, setShareLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const improveTabOptions: ResponsivePageTabOption<'improved' | 'original' | 'compare' | 'analysis' | 'pipeline'>[] = [
    { value: 'improved', label: t('resume.analysis.tabs.improved'), icon: PencilSquareIcon },
    { value: 'original', label: t('resume.analysis.tabs.original'), icon: DocumentMagnifyingGlassIcon },
    { value: 'compare', label: t('resume.analysis.tabs.compare'), icon: ArrowsRightLeftIcon },
    { value: 'analysis', label: t('resume.analysis.tabs.overview'), icon: ChartBarIcon },
    { value: 'pipeline', label: t('resume.analysis.tabs.pipeline'), icon: QueueListIcon },
  ];

  useEffect(() => {
    const loadResume = async () => {
      if (!id) {
        setError('No resume ID provided');
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
  }, [id, setCurrentResume, t]);

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
    setIsSaving(true);
    try {
      const rawContent = editorRef.current.getContent();
      // Remove suggestion markers before saving to ensure clean content is stored
      const content = removeSuggestionMarkers(rawContent);
      const result = await updateImprovedContent(currentResume.id, content);
      // Update editor with cleaned content
      editorRef.current.setContent(content);
      // Update localResume to keep it in sync with saved content
      setLocalResume(prev => prev
        ? applyResumeUpdate(prev, {
            'Improved Text': content,
            'Current Version': result.currentVersion || prev['Current Version']
          })
        : null);
      toast.success(t('resume.saveSuccess'));
    } catch (err) {
      logger.error('Error saving improved content:', err);
      toast.error(t('resume.saveError'));
    } finally {
      setIsSaving(false);
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
      
      const response = await fetchWithAuth(`/api/resumes/${currentResume.id}/ai-modify`, authOptions, FRONTEND_LLM_AI_MODIFICATION_TIMEOUT_MS);
      if (!response.ok) {
        throw new Error('Failed to modify resume with AI');
      }

      const { modifiedContent, message } = await response.json();
      if (editorRef.current && modifiedContent) {
        editorRef.current.setContent(modifiedContent);
      }
      return message || 'CV modifie avec succes par l IA';
    } catch (error) {
      logger.error('Failed to modify resume with AI:', error);
      toast.error(t('resume.improveError'));
      throw error;
    }
  }, [currentResume, localResume, t]);

  const handleVersionRestored = useCallback(async (newVersion: number) => {
    if (!currentResume) return;
    try {
      const updatedResumeData = await resumeService.getResume(currentResume.id) as Record<string, unknown>;
      if (updatedResumeData) {
        const updatedResume = normalizeResume({
          ...(localResume || {}),
          ...updatedResumeData,
          'Current Version': newVersion
        } as Resume);
        setLocalResume(updatedResume as Resume);
        setCurrentResume(updatedResume as Resume);
        
        const restoredText = (updatedResumeData['Improved Text'] || updatedResumeData['improved_text'] || '') as string;
        if (editorRef.current && restoredText) {
          editorRef.current.setContent(restoredText);
        }
        toast.success(`Version ${newVersion} chargee`);
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
      const updated = normalizeResume({ ...currentResume, [field]: value });
      setCurrentResume(updated);
      setLocalResume(updated);
    } catch (err) {
      logger.error(`Error updating ${field}:`, err);
      toast.error(t('resume.saveError'));
    }
  }, [currentResume, setCurrentResume, t]);

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
      
      const payload = await buildSharePayload(localResume as Resume, template);
      logger.warn('Resume share payload normalized', {
        templateId: template.id,
        filename: payload.filename,
        htmlLength: payload.htmlContent.length,
        ...summarizeTemplatePayload(template),
      });
      
      // Generate and store the PDF
      const options = await createAuthOptionsWithCsrf({
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await fetchWithCsrfRetry(`/api/share/resume/${id}/generate`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        // Build URL on frontend using current origin - use /share/pdf route
        const shareUrl = `${window.location.origin}/share/pdf/${data.token}`;
        setShareUrl(shareUrl);
      } else {
        toast.error(t('share.error'));
        setShowShareModal(false);
      }
    } catch (err) {
      logger.error('Failed to generate share URL:', err);
      toast.error(t('share.error'));
      setShowShareModal(false);
    } finally {
      setShareLoading(false);
    }
  }, [id, localResume, t]);

  const resumeName = localResume?.['Name'] || localResume?.['File Name'] || 'CV';
  const hasImprovedText = !!localResume?.['Improved Text'];

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8"
      >
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <div className="section-shell rounded-[2rem] p-8">
            <div className="flex items-start gap-4">
              <ArrowPathIcon className="mt-1 h-6 w-6 animate-spin text-[var(--cv-primary)]" />
              <div className="flex-1 space-y-4">
                <div>
                  <div className="h-8 w-72 max-w-full rounded-full bg-gray-200/80 animate-pulse dark:bg-gray-700/70" />
                  <div className="mt-3 h-4 w-[34rem] max-w-full rounded-full bg-gray-200/70 animate-pulse dark:bg-gray-700/60" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="h-24 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                  <div className="h-24 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                  <div className="h-24 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error || !localResume) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <div className="section-shell rounded-[2rem] p-10 text-center">
            <DocumentTextIcon className="mx-auto mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
            <h2 className="text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">
              {error || 'Resume not found'}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-[var(--cv-muted)]">
              {t('resume.improve.description')}
            </p>
            <Link
              to="/resumes"
              className="cv-gradient-button mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              {t('common.backToList')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isImproving || contextLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <ImprovementAnimation currentStep={processingStep || 'improving'} fullscreen={true} />
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8"
      >
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <PageHeader title={t('resume.improve.title')} subtitle={t('resume.improve.description')} />
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">{resumeName}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">
              {hasImprovedText ? t('resume.analysis.improvedResume') : t('resume.improve.notYetImproved')}
            </span>
          </div>
        </div>

        <ResumeImproveHeader
          resume={localResume}
          resumeName={resumeName}
          hasImprovedText={hasImprovedText}
          isSaving={isSaving}
          editorReady={editorReady}
          onSave={handleSaveImprovedContent}
          onShare={handleShare}
          onAdapt={() => navigate(`/resumes/${id}/adapt`)}
          t={t}
        />

        {id && (
          <ResumeImproveStepIndicator
            resumeId={id}
            hasImprovedText={hasImprovedText}
            t={t}
          />
        )}

        {/* Content */}
        {!hasImprovedText ? (
          <ResumeImproveEmptyState
            onImprove={handleImprove}
            t={t}
          />
        ) : (
          <>
            <div className="section-shell overflow-hidden rounded-[2rem] p-0">
              <div className="border-b border-gray-200 dark:border-gray-700 px-2 pt-2">
                <ResponsivePageTabs
                  label={t('resume.improve.title')}
                  minItemWidthRem={10}
                  value={activeTab}
                  onChange={setActiveTab}
                  options={improveTabOptions}
                />
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
                        skillProofs={extractImprovedSkillProofs(localResume)}
                      />
                    }
                  />
                )}
                {activeTab === 'original' && (
                  <OriginalSourcePreview
                    resume={localResume}
                    title={t('resume.analysis.tabs.original')}
                    description="Le document importé est affiché ici dans son rendu source, indépendamment du texte extrait."
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
      </motion.div>
      {/* Share QR Code Modal */}
      <ShareQRCodeModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={shareUrl}
        title={t('share.improvedCV')}
        candidateName={localResume?.['Name'] || 'CV'}
        isLoading={shareLoading}
      />
    </>
  );
};

export default ResumeImprovePage;


