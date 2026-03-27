/**
 * useBatchProcessing Hook
 * Handles file processing logic for batch upload:
 * - Single file processing (legacy sequential)
 * - Batch job creation via API
 * - Cancel and estimated time
 */

import { useCallback, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';
import type { FileStatus, ExportFormats } from '../batchUpload.utils';
import {
  FRONTEND_LLM_ANALYSIS_TIMEOUT_MS,
  FRONTEND_LLM_IMPROVEMENT_TIMEOUT_MS,
} from '../../constants/llmTimeouts';

const loadResumeProcessing = async () => import('../../utils/resumeProcessing');
const loadApiInterceptor = async () => import('../../utils/apiInterceptor');

interface UseBatchProcessingParams {
  filesRef: MutableRefObject<FileStatus[]>;
  isMountedRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  processedResumeIdsRef: MutableRefObject<string[]>;
  keepAliveIntervalRef: MutableRefObject<NodeJS.Timeout | null>;
  timeoutRefs: MutableRefObject<NodeJS.Timeout[]>;
  isAdmin: boolean;
  selectedFirmId: string;
  improveOption: boolean;
  exportOption: boolean;
  exportFormats: ExportFormats;
  selectedTemplate: string;
  deleteAfterExport: boolean;
  isProcessing: boolean;
  setFiles: React.Dispatch<React.SetStateAction<FileStatus[]>>;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  updateFileStatus: (index: number, updates: Partial<FileStatus>) => void;
  startBatchExport: () => Promise<boolean>;
  deleteProcessedResumes: () => Promise<void>;
}

export function useBatchProcessing({
  filesRef,
  isMountedRef,
  abortControllerRef,
  processedResumeIdsRef,
  keepAliveIntervalRef,
  timeoutRefs,
  isAdmin,
  selectedFirmId,
  improveOption,
  exportOption,
  exportFormats,
  selectedTemplate,
  deleteAfterExport,
  isProcessing,
  setFiles,
  setIsProcessing,
  updateFileStatus,
  startBatchExport,
  deleteProcessedResumes,
}: UseBatchProcessingParams) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const processFile = useCallback(async (fileStatus: FileStatus, index: number, signal: AbortSignal): Promise<void> => {
    try {
      // Step 1: Upload
      updateFileStatus(index, { status: 'uploading', progress: 10 });
      
      const formData = new FormData();
      formData.append('file', fileStatus.file);
      formData.append('name', fileStatus.file.name);
      formData.append('title', '');
      // RGPD: CVs internes sans nom renseigné
      formData.append('profile_type', 'employee');
      formData.append('candidate_name', ''); // Pas de nom pour les imports par lot
      
      if (isAdmin && selectedFirmId) {
        formData.append('firm_id', selectedFirmId);
      }
      
      const uploadOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        body: formData
      });
      
      if (uploadOptions.headers) {
        delete (uploadOptions.headers as Record<string, string>)['Content-Type'];
      }
      
      const uploadResponse = await fetchWithAuth('/api/resumes/upload', {
        ...uploadOptions,
        signal
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Échec de l\'upload' }));
        throw new Error(errorData.error || 'Échec de l\'upload');
      }
      
      const uploadedResume = await uploadResponse.json();
      updateFileStatus(index, { 
        resumeId: uploadedResume.id, 
        resumeName: uploadedResume.Name,
        progress: 25 
      });
      
      // Track this resume ID for potential deletion later
      if (uploadedResume.id) {
        processedResumeIdsRef.current.push(uploadedResume.id);
      }
      
      // Step 2: Extract text
      updateFileStatus(index, { status: 'extracting', progress: 35 });
      const { extractResumeText } = await loadResumeProcessing();
      const text = await extractResumeText(fileStatus.file);
      
      if (!text || text.length === 0) {
        throw new Error('Impossible d\'extraire le texte du CV');
      }
      
      updateFileStatus(index, { progress: 50 });
      
      // Step 3: Analyze
      updateFileStatus(index, { status: 'analyzing', progress: 55 });
      
      const analysisOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      const analysisResponse = await fetchWithAuth('/api/resumes/analyze-text', {
        ...analysisOptions,
        signal
      }, FRONTEND_LLM_ANALYSIS_TIMEOUT_MS);
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({ error: 'Échec de l\'analyse' }));
        throw new Error(errorData.error || 'Échec de l\'analyse');
      }
      
      const analysis = await analysisResponse.json();
      updateFileStatus(index, { progress: 70 });
      
      // Step 4: Update resume with analysis
      const tags = analysis.tags || { skills: [], industries: [], tools: [], softSkills: [] };
      const suggestions = analysis.suggestions || {};
      const originalText = analysis.structuredText || text;
      
      const updateOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'Original Text': originalText,
          'Global Rating': analysis.globalRating,
          'Skills Score': analysis.skillsRating,
          'Experience Score': analysis.experiencesRating,
          'Education Score': analysis.educationRating,
          'ATS Score': analysis.atsOptimizationRating,
          'Executive Summary Score': analysis.executiveSummaryRating,
          'Hobbies Languages Score': analysis.hobbiesLanguagesRating,
          'Skills': tags.skills || [],
          'Industries': tags.industries || [],
          'Tools': tags.tools || [],
          'Soft Skills': tags.softSkills || [],
          'Key Improvements': JSON.stringify(suggestions),
          'Name': analysis.name,
          'Original Name': analysis.originalName || analysis.name,
          'Title': analysis.title,
          'Status': 'Analyzed',
          'Analysis Date': new Date().toISOString()
        })
      });
      
      await fetchWithAuth(`/api/resumes/${uploadedResume.id}`, {
        ...updateOptions,
        signal
      });
      
      updateFileStatus(index, { progress: 80 });
      
      // Step 5: Improve (if option selected)
      if (improveOption) {
        updateFileStatus(index, { status: 'improving', progress: 85 });
        
        // Build analysis object like improveCurrentResume does
        const currentAnalysis = {
          globalRating: analysis.globalRating,
          skillsRating: analysis.skillsRating,
          experiencesRating: analysis.experiencesRating,
          educationRating: analysis.educationRating,
          atsOptimizationRating: analysis.atsOptimizationRating,
          executiveSummaryRating: analysis.executiveSummaryRating,
          hobbiesLanguagesRating: analysis.hobbiesLanguagesRating,
          suggestions: suggestions,
          name: analysis.name,
          originalName: analysis.originalName || analysis.name,
          title: analysis.title
        };
        
        const improveOptions = await createAuthOptionsWithCsrf({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: originalText,
            analysis: currentAnalysis
          })
        });
        
        // Use /api/resumes/improve (same as improveCurrentResume) for full post-improvement analysis
        const improveResponse = await fetchWithAuth('/api/resumes/improve', {
          ...improveOptions,
          signal
        }, FRONTEND_LLM_IMPROVEMENT_TIMEOUT_MS);
        
        if (improveResponse.ok) {
          const { text: improvedText, analysis: improvedAnalysis } = await improveResponse.json();
          
          // Helper to get score value (handles 0 as valid value)
          const getScore = (primary: number | string | undefined, fallback: number | string | undefined): number => {
            if (primary !== undefined && primary !== null) return typeof primary === 'number' ? primary : parseInt(String(primary).replace('%', ''), 10) || 0;
            if (fallback !== undefined && fallback !== null) return typeof fallback === 'number' ? fallback : parseInt(String(fallback).replace('%', ''), 10) || 0;
            return 0;
          };
          
          // Save improved text and all improved scores (same as improveCurrentResume)
          const improvedSuggestions = improvedAnalysis?.suggestions || improvedAnalysis?.['Key Improvements'] || {};
          
          const saveImprovedOptions = await createAuthOptionsWithCsrf({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'Improved Text': improvedText,
              'Improved Global Rating': String(getScore(improvedAnalysis?.globalRating, improvedAnalysis?.['Global Rating'])),
              'Improved Skills Score': String(getScore(improvedAnalysis?.skillsRating, improvedAnalysis?.['Skills'])),
              'Improved Experience Score': String(getScore(improvedAnalysis?.experiencesRating, improvedAnalysis?.['Experience'])),
              'Improved Education Score': String(getScore(improvedAnalysis?.educationRating, improvedAnalysis?.['Education'])),
              'Improved ATS Score': String(getScore(improvedAnalysis?.atsOptimizationRating, improvedAnalysis?.['ATS Compatibility'])),
              'Improved Executive Summary Score': String(getScore(improvedAnalysis?.executiveSummaryRating, improvedAnalysis?.['Executive Summary'])),
              'Improved Hobbies Languages Score': String(getScore(improvedAnalysis?.hobbiesLanguagesRating, improvedAnalysis?.['Hobbies Languages'])),
              'Improved Skills': JSON.stringify(improvedAnalysis?.tags?.skills || []),
              'Improved Industries': JSON.stringify(improvedAnalysis?.tags?.industries || []),
              'Improved Tools': JSON.stringify(improvedAnalysis?.tags?.tools || []),
              'Improved Soft Skills': JSON.stringify(improvedAnalysis?.tags?.softSkills || []),
              'Improved Key Improvements': JSON.stringify(improvedSuggestions),
              'Status': 'Improved',
              'Last Improved': new Date().toISOString()
            })
          });
          
          await fetchWithAuth(`/api/resumes/${uploadedResume.id}`, {
            ...saveImprovedOptions,
            signal
          });
        }
        // Don't fail if improvement fails, just log it
        else {
          logger.warn(`[BatchUpload] Improvement failed for ${fileStatus.file.name}, continuing...`);
        }
      }
      
      updateFileStatus(index, { status: 'success', progress: 100 });
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        updateFileStatus(index, { status: 'error', error: 'Annulé' });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        logger.error(`[BatchUpload] Error processing ${fileStatus.file.name}:`, error);
        updateFileStatus(index, { status: 'error', error: errorMessage });
      }
    }
  }, [isAdmin, selectedFirmId, improveOption, updateFileStatus, processedResumeIdsRef]);

  const startProcessing = useCallback(async () => {
    const currentFiles = filesRef.current;
    if (currentFiles.length === 0) {
      toast.error(t('batchUpload.noFiles', 'Aucun fichier à traiter'));
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create a batch job with all files - backend will process in parallel
      const formData = new FormData();
      const relativePaths: (string | null)[] = [];
      
      currentFiles.forEach((fileStatus) => {
        formData.append('files', fileStatus.file);
        relativePaths.push(fileStatus.relativePath || null);
      });
      
      // Add relative paths to preserve folder structure
      formData.append('relativePaths', JSON.stringify(relativePaths));
      
      // Add options as individual form fields
      formData.append('improve', String(improveOption));
      formData.append('export', String(exportOption));
      formData.append('exportFormats', JSON.stringify(exportFormats));
      if (selectedTemplate) {
        formData.append('templateId', selectedTemplate);
      }
      formData.append('deleteAfterExport', String(deleteAfterExport));
      
      // Mark all files as uploading
      currentFiles.forEach((_, index) => {
        updateFileStatus(index, { status: 'uploading', progress: 10 });
      });
      
      // Create the job - get CSRF token and send with FormData
      // IMPORTANT: Don't set Content-Type header - browser will set it with correct boundary for multipart/form-data
      const csrfOptions = await createAuthOptionsWithCsrf({ method: 'POST' });
      const response = await fetchWithAuth('/api/batch-jobs', {
        method: 'POST',
        headers: {
          'x-csrf-token': ((csrfOptions.headers as Record<string, string>)?.['x-csrf-token']) || ''
        },
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du job');
      }
      
      const job = await response.json();
      logger.info('[BatchUpload] Job created', { jobId: job.id, itemCount: job.total_items });
      
      // Mark all files as processing (backend handles the rest)
      currentFiles.forEach((_, index) => {
        updateFileStatus(index, { status: 'analyzing', progress: 50 });
      });
      
      toast.success(t('batchJobs.jobCreated', { count: job.total_items }));
      
      // Clear files and redirect to the dedicated Jobs page
      setFiles([]);
      navigate('/batch-jobs');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      logger.error('[BatchUpload] Error creating job:', error);
      toast.error(errorMessage);
      
      // Mark all files as error
      currentFiles.forEach((_, index) => {
        updateFileStatus(index, { status: 'error', error: errorMessage });
      });
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [filesRef, isMountedRef, improveOption, exportOption, exportFormats, selectedTemplate, deleteAfterExport, setFiles, setIsProcessing, updateFileStatus, navigate, t]);

  // Legacy sequential processing (kept for reference but not used)
  const startProcessingLegacy = useCallback(async () => {
    const currentFiles = filesRef.current;
    if (currentFiles.length === 0) {
      toast.error(t('batchUpload.noFiles', 'Aucun fichier à traiter'));
      return;
    }
    
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();
    processedResumeIdsRef.current = []; // Reset the list of processed resume IDs
    
    // Start session keep-alive interval (refresh token every 2 minutes)
    // This prevents session expiration during long batch processing
    const KEEP_ALIVE_INTERVAL = 2 * 60 * 1000; // 2 minutes
    keepAliveIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current || !isProcessing) {
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }
        return;
      }
      
      logger.info('[BatchUpload] Session keep-alive: refreshing token...');
      const { attemptTokenRefresh } = await loadApiInterceptor();
      const success = await attemptTokenRefresh();
      if (!success) {
        logger.warn('[BatchUpload] Session keep-alive: token refresh failed');
      } else {
        logger.debug('[BatchUpload] Session keep-alive: token refreshed successfully');
      }
    }, KEEP_ALIVE_INTERVAL);
    
    // Process files sequentially to avoid overwhelming the server
    for (let i = 0; i < currentFiles.length; i++) {
      if (abortControllerRef.current.signal.aborted) break;
      
      // Use filesRef to get current status (avoids stale closure)
      if (filesRef.current[i]?.status === 'pending') {
        await processFile(filesRef.current[i], i, abortControllerRef.current.signal);
      }
    }
    
    // Stop keep-alive interval when processing is done
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    
    if (isMountedRef.current) {
      setIsProcessing(false);
    }
    
    // Use filesRef to get accurate counts (avoids stale closure issue)
    const updatedFiles = filesRef.current;
    const finalSuccessCount = updatedFiles.filter(f => f.status === 'success').length;
    const finalErrorCount = updatedFiles.filter(f => f.status === 'error').length;
    
    if (finalSuccessCount > 0) {
      toast.success(t('batchUpload.successCount', `${finalSuccessCount} CV(s) traité(s) avec succès`));
      
      // Auto-trigger batch export if option is enabled, then delete if requested
      if (exportOption && selectedTemplate) {
        // Small delay to ensure state is updated - track timeout for cleanup
        const exportTimeout = setTimeout(async () => {
          if (!isMountedRef.current) return; // Guard against unmount
          
          await startBatchExport();
          
          // Delete resumes after export (regardless of export success) if option is enabled
          if (deleteAfterExport && isMountedRef.current) {
            await deleteProcessedResumes();
          }
        }, 500);
        timeoutRefs.current.push(exportTimeout);
      } else if (deleteAfterExport) {
        // Delete without export if only delete option is enabled - track timeout
        const deleteTimeout = setTimeout(async () => {
          if (!isMountedRef.current) return; // Guard against unmount
          await deleteProcessedResumes();
        }, 500);
        timeoutRefs.current.push(deleteTimeout);
      }
    }
    if (finalErrorCount > 0) {
      toast.error(t('batchUpload.errorCount', `${finalErrorCount} CV(s) en erreur`));
    }
  }, [filesRef, isMountedRef, abortControllerRef, processedResumeIdsRef, keepAliveIntervalRef, timeoutRefs, isProcessing, exportOption, selectedTemplate, deleteAfterExport, setIsProcessing, processFile, startBatchExport, deleteProcessedResumes, t]);
  
  // Estimate processing time based on options
  const getEstimatedTime = useCallback((): string => {
    const pending = filesRef.current.filter(f => f.status === 'pending').length;
    if (pending === 0) return '';
    
    // Base time: ~10s per file for upload+extract+analyze
    // Improve adds ~45s per file
    let secondsPerFile = 10;
    if (improveOption) secondsPerFile += 45;
    
    const totalSeconds = pending * secondsPerFile;
    const minutes = Math.ceil(totalSeconds / 60);
    
    if (minutes < 1) return t('batchUpload.estimatedTime', '< 1 minute');
    if (minutes === 1) return t('batchUpload.estimatedTime1min', '~1 minute');
    return t('batchUpload.estimatedTimeMinutes', `~${minutes} minutes`);
  }, [filesRef, improveOption, t]);

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Stop keep-alive interval
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (isMountedRef.current) {
      setIsProcessing(false);
      toast(t('batchUpload.processingCancelled', 'Traitement annulé'), { icon: '⚠️' });
    }
  }, [abortControllerRef, keepAliveIntervalRef, isMountedRef, setIsProcessing, t]);

  return {
    processFile,
    startProcessing,
    startProcessingLegacy,
    getEstimatedTime,
    cancelProcessing,
  };
}
