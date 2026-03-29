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
import { fetchWithAuth, createAuthOptionsWithCsrf, getResponseErrorMessage } from '../../utils/apiInterceptor';
import { createAndTrackJob } from '../../utils/longRunningOperation';
import { waitForResumeImprovementJobCompletion } from '../../utils/resumeImprovementJob';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';
import type { FileStatus, ExportFormats } from '../batchUpload.utils';
import {
  FRONTEND_LLM_ANALYSIS_TIMEOUT_MS,
} from '../../constants/llmTimeouts';

interface UseBatchProcessingParams {
  filesRef: MutableRefObject<FileStatus[]>;
  isMountedRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  isAdmin: boolean;
  selectedFirmId: string;
  improveOption: boolean;
  exportOption: boolean;
  exportFormats: ExportFormats;
  selectedTemplate: string;
  deleteAfterExport: boolean;
  setFiles: React.Dispatch<React.SetStateAction<FileStatus[]>>;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  updateFileStatus: (index: number, updates: Partial<FileStatus>) => void;
}

export function useBatchProcessing({
  filesRef,
  isMountedRef,
  abortControllerRef,
  isAdmin,
  selectedFirmId,
  improveOption,
  exportOption,
  exportFormats,
  selectedTemplate,
  deleteAfterExport,
  setFiles,
  setIsProcessing,
  updateFileStatus,
}: UseBatchProcessingParams) {
  const { t } = useTranslation();
  const navigate = useNavigate();


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
      const { created: job } = await createAndTrackJob({
        create: async () => {
          const response = await fetchWithAuth('/api/batch-jobs', {
            method: 'POST',
            headers: {
              'x-csrf-token': ((csrfOptions.headers as Record<string, string>)?.['x-csrf-token']) || ''
            },
            credentials: 'include',
            body: formData
          });
          
          if (!response.ok) {
            const errorMessage = await getResponseErrorMessage(response, 'Erreur lors de la creation du job');
            throw new Error(errorMessage);
          }
          
          return response.json() as Promise<{ id?: string; total_items?: number }>;
        },
        getJobId: created => created.id
      });
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


  return {
    startProcessing,
    getEstimatedTime,
  };
}
