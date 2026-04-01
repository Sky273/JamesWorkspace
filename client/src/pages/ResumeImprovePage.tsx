/**
 * ResumeImprovePage Component
 * Dedicated page for resume improvement step
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { useTranslation } from 'react-i18next';
import ShareQRCodeModal from '../components/ShareQRCodeModal';
import { templateService } from '../utils/templateService';
import { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { SkeletonCard } from '../components/ui/Skeleton';
import ImprovementAnimation from '../components/ImprovementAnimation';
import ImprovedTextTab from '../components/ResumeAnalysis/ImprovedTextTab';
import ResumeImproveHeader from '../components/ResumeImprove/ResumeImproveHeader';
import ResumeImproveStepIndicator from '../components/ResumeImprove/ResumeImproveStepIndicator';
import ResumeImproveEmptyState from '../components/ResumeImprove/ResumeImproveEmptyState';
import CompareTab from '../components/ResumeAnalysis/CompareTab';
import OverviewTab from '../components/ResumeAnalysis/OverviewTab';
import PipelineTab from '../components/ResumeAnalysis/PipelineTab';
import ResumeComments from '../components/ResumeComments';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import { removeSuggestionMarkers } from '../utils/tinymceSuggestionsPlugin';
import { FRONTEND_LLM_AI_MODIFICATION_TIMEOUT_MS } from '../constants/llmTimeouts';
import { DeferredTiptapEditor as TiptapEditor, parseSuggestions } from '../components/TiptapEditor';
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
  const [isSaving, setIsSaving] = useState(false);

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
    setIsSaving(true);
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

  if (isImproving || contextLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <ImprovementAnimation currentStep={processingStep || 'improving'} fullscreen={true} />
        </div>
      </div>
    );
  }

  const resumeName = localResume['Name'] || localResume['File Name'] || 'CV';
  const hasImprovedText = !!localResume['Improved Text'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
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
        title={t('share.improvedCV')}
        candidateName={localResume?.['Name'] || 'CV'}
        isLoading={shareLoading}
      />
    </div>
  );
};

export default ResumeImprovePage;


