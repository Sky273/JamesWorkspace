/**
 * BatchUploadPage Component
 * Allows uploading multiple CVs at once with optional improvement
 * CVs are treated as internal (employee) without candidate name for GDPR
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  DocumentArrowUpIcon, 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ArrowPathIcon,
  SparklesIcon,
  DocumentTextIcon,
  FolderArrowDownIcon,
  ArrowDownTrayIcon,
  QueueListIcon
} from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth, createAuthOptionsWithCsrf, attemptTokenRefresh } from '../utils/apiInterceptor';
import { extractResumeText } from '../utils/resumeProcessing';
import logger from '../utils/logger.frontend';
import toast from 'react-hot-toast';
import AdminFirmSelector from '../components/AdminFirmSelector';
import { templateService, Template } from '../utils/templateService';
import JobsTab from '../components/BatchUpload/JobsTab';

interface FileStatus {
  file: File;
  relativePath?: string; // Preserve folder structure from webkitRelativePath
  status: 'pending' | 'uploading' | 'extracting' | 'analyzing' | 'improving' | 'exporting' | 'success' | 'error';
  progress: number;
  error?: string;
  resumeId?: string;
  resumeName?: string;
}

type ExportFormat = 'pdf' | 'docx' | 'doc';
type ExportFormats = ExportFormat[];

const BatchUploadPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  
  const [activeTab, setActiveTab] = useState<'import' | 'jobs'>('import');
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [improveOption, setImproveOption] = useState<boolean>(false);
  const [exportOption, setExportOption] = useState<boolean>(false);
  const [deleteAfterExport, setDeleteAfterExport] = useState<boolean>(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [exportFormats, setExportFormats] = useState<ExportFormats>(['pdf']);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [resumesDeleted, setResumesDeleted] = useState<boolean>(false); // Track if resumes were deleted
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false); // Loading state when files are being added
  const abortControllerRef = useRef<AbortController | null>(null);
  const processedResumeIdsRef = useRef<string[]>([]);
  const filesRef = useRef<FileStatus[]>([]); // Ref to track current files state
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]); // Track timeouts for cleanup
  const isMountedRef = useRef<boolean>(true); // Track component mount state
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null); // Session keep-alive interval
  
  // Constants
  const MAX_FILES = 100;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Abort any ongoing processing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear keep-alive interval
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
      
      // Clear all pending timeouts
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
      
      // Clear refs to allow garbage collection
      filesRef.current = [];
      processedResumeIdsRef.current = [];
    };
  }, []);

  // Load templates when export option is enabled
  useEffect(() => {
    if (exportOption && templates.length === 0) {
      let isCancelled = false;
      
      templateService.getAllTemplates()
        .then(fetchedTemplates => {
          if (!isCancelled && isMountedRef.current) {
            setTemplates(fetchedTemplates);
            if (fetchedTemplates.length > 0) {
              setSelectedTemplate(fetchedTemplates[0].id);
            }
          }
        })
        .catch(err => {
          if (!isCancelled && isMountedRef.current) {
            logger.error('Error fetching templates:', err);
            toast.error('Erreur lors du chargement des modèles');
          }
        });
      
      return () => {
        isCancelled = true;
      };
    }
  }, [exportOption, templates.length]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Show loading animation immediately
    setIsLoadingFiles(true);
    
    // Use setTimeout to allow the UI to update before processing files
    setTimeout(() => {
      try {
        // Check file limit
        const currentCount = filesRef.current.length;
        const availableSlots = MAX_FILES - currentCount;
        
        if (availableSlots <= 0) {
          toast.error(t('batchUpload.maxFilesReached', `Maximum ${MAX_FILES} fichiers autorisés`));
          setIsLoadingFiles(false);
          return;
        }
        
        // Limit files to available slots
        const filesToAdd = acceptedFiles.slice(0, availableSlots);
        if (filesToAdd.length < acceptedFiles.length) {
          toast(t('batchUpload.someFilesSkipped', `${acceptedFiles.length - filesToAdd.length} fichier(s) ignoré(s) (limite: ${MAX_FILES})`), { icon: '⚠️' });
        }
        
        // Filter duplicates by filename
        const existingNames = new Set(filesRef.current.map(f => f.file.name));
        const uniqueFiles = filesToAdd.filter(file => {
          if (existingNames.has(file.name)) {
            toast(t('batchUpload.duplicateSkipped', `"${file.name}" déjà dans la liste`), { icon: '⚠️' });
            return false;
          }
          return true;
        });
        
        if (uniqueFiles.length === 0) {
          setIsLoadingFiles(false);
          return;
        }
        
        const newFiles: FileStatus[] = uniqueFiles.map(file => ({
          file,
          relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
          status: 'pending',
          progress: 0
        }));
        
        setFiles(prev => {
          const updated = [...prev, ...newFiles];
          filesRef.current = updated;
          return updated;
        });
      } finally {
        // Stop loading animation after files are added
        setIsLoadingFiles(false);
      }
    }, 50); // Small delay to allow UI to show loading state
  }, [t]);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    fileRejections.forEach(rejection => {
      const errorMessage = rejection.errors.map(e => {
        switch (e.code) {
          case 'file-too-large':
            return `${rejection.file.name}: Fichier trop volumineux (max 50MB)`;
          case 'file-invalid-type':
            return `${rejection.file.name}: Type non supporté (PDF, DOC, DOCX uniquement)`;
          default:
            return `${rejection.file.name}: ${e.message}`;
        }
      }).join(', ');
      toast.error(errorMessage);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isProcessing
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      filesRef.current = updated;
      return updated;
    });
  };

  const clearAllFiles = () => {
    setFiles([]);
    filesRef.current = [];
    setShowClearConfirm(false);
  };

  const updateFileStatus = (index: number, updates: Partial<FileStatus>) => {
    if (!isMountedRef.current) return; // Guard against unmount
    setFiles(prev => {
      const updated = prev.map((f, i) => i === index ? { ...f, ...updates } : f);
      filesRef.current = updated;
      return updated;
    });
  };
  
  // Retry a failed file
  const retryFile = (index: number) => {
    setFiles(prev => {
      const updated = prev.map((f, i) => i === index ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f);
      filesRef.current = updated;
      return updated;
    });
  };

  const processFile = async (fileStatus: FileStatus, index: number, signal: AbortSignal): Promise<void> => {
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
        delete uploadOptions.headers['Content-Type'];
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
      });
      
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
        });
        
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
  };

  const startProcessing = async () => {
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
          'x-csrf-token': (csrfOptions.headers as Record<string, string>)?.['x-csrf-token'] || ''
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
      
      // Clear files and switch to Jobs tab
      setFiles([]);
      setActiveTab('jobs');
      
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
  };

  // Legacy sequential processing (kept for reference but not used)
  const startProcessingLegacy = async () => {
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
  };
  
  // Estimate processing time based on options
  const getEstimatedTime = (): string => {
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
  };

  const cancelProcessing = () => {
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
  };

  // Batch export function - generates ZIP with all successful resumes
  const startBatchExport = async () => {
    // Use filesRef to avoid stale closure issue
    const successfulFiles = filesRef.current.filter(f => f.status === 'success' && f.resumeId);
    
    if (successfulFiles.length === 0) {
      toast.error(t('batchUpload.noFilesToExport', 'Aucun CV traité à exporter'));
      return false;
    }
    
    if (!selectedTemplate) {
      toast.error(t('batchUpload.selectTemplate', 'Veuillez sélectionner un modèle'));
      return false;
    }
    
    setIsExporting(true);
    
    try {
      const resumeIds = successfulFiles.map(f => f.resumeId).filter(Boolean);
      
      const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeIds,
          templateId: selectedTemplate,
          formats: exportFormats
        })
      });
      
      const response = await fetchWithAuth('/api/batch-export', options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur d\'export' }));
        throw new Error(errorData.error || 'Erreur lors de l\'export');
      }
      
      // Download ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_cvs_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`${resumeIds.length} CV(s) exporté(s) avec succès`);
      
      // Return true to indicate successful export (for delete after export flow)
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      logger.error('[BatchUpload] Export error:', error);
      toast.error(errorMessage);
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false);
      }
    }
  };

  // Delete all successfully processed resumes using the ref (avoids closure issues)
  const deleteProcessedResumes = async () => {
    if (!isMountedRef.current) return;
    
    const resumeIdsToDelete = processedResumeIdsRef.current;
    
    if (resumeIdsToDelete.length === 0) {
      logger.warn('[BatchUpload] No resume IDs to delete');
      return;
    }
    
    logger.info(`[BatchUpload] Deleting ${resumeIdsToDelete.length} resumes`);
    setIsDeleting(true);
    let deletedCount = 0;
    
    try {
      for (const resumeId of resumeIdsToDelete) {
        try {
          const options = await createAuthOptionsWithCsrf({
            method: 'DELETE'
          });
          
          const response = await fetchWithAuth(`/api/resumes/${resumeId}`, options);
          
          if (response.ok) {
            deletedCount++;
            logger.debug(`[BatchUpload] Deleted resume ${resumeId}`);
          } else {
            logger.warn(`[BatchUpload] Failed to delete resume ${resumeId}`);
          }
        } catch (err) {
          logger.error(`[BatchUpload] Error deleting resume ${resumeId}:`, err);
        }
      }
      
      // Clear the ref after deletion
      processedResumeIdsRef.current = [];
      
      if (deletedCount > 0) {
        toast.success(`${deletedCount} CV(s) supprimé(s) de la base de données`);
        if (isMountedRef.current) {
          setResumesDeleted(true); // Mark that resumes have been deleted
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
    }
  };

  const getStatusIcon = (status: FileStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      case 'uploading':
      case 'extracting':
      case 'analyzing':
      case 'improving':
      case 'exporting':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <DocumentTextIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: FileStatus['status']) => {
    switch (status) {
      case 'pending': return t('batchUpload.status.pending', 'En attente');
      case 'uploading': return t('batchUpload.status.uploading', 'Upload...');
      case 'extracting': return t('batchUpload.status.extracting', 'Extraction...');
      case 'analyzing': return t('batchUpload.status.analyzing', 'Analyse...');
      case 'improving': return t('batchUpload.status.improving', 'Amélioration...');
      case 'exporting': return t('batchUpload.status.exporting', 'Export...');
      case 'success': return t('batchUpload.status.success', 'Terminé');
      case 'error': return t('batchUpload.status.error', 'Erreur');
      default: return '';
    }
  };

  // Memoize counters to avoid recalculating on every render
  const { pendingCount, successCount, errorCount } = useMemo(() => ({
    pendingCount: files.filter(f => f.status === 'pending').length,
    successCount: files.filter(f => f.status === 'success').length,
    errorCount: files.filter(f => f.status === 'error').length
  }), [files]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Breadcrumbs className="mb-4" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t('batchUpload.title', 'Import par lot')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t('batchUpload.subtitle', 'Chargez plusieurs CVs d\'un coup pour les analyser automatiquement')}
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <DocumentArrowUpIcon className="w-5 h-5" />
            {t('batchUpload.tabs.import', 'Import')}
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'jobs'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <QueueListIcon className="w-5 h-5" />
            {t('batchUpload.tabs.jobs', 'Jobs')}
          </button>
        </div>

        {/* Jobs Tab Content */}
        {activeTab === 'jobs' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <JobsTab />
          </motion.div>
        )}

        {/* Import Tab Content */}
        {activeTab === 'import' && (
          <>
        {/* Options */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('batchUpload.processingOptions', 'Options de traitement')}
          </h2>
          
          <div className="space-y-4">
            {/* Improve option */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={improveOption}
                onChange={(e) => setImproveOption(e.target.checked)}
                disabled={isProcessing}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t('batchUpload.improveOption', 'Améliorer les CVs automatiquement')}
                </span>
              </div>
            </label>
            
            {improveOption && (
              <p className="text-sm text-amber-600 dark:text-amber-400 ml-8">
                ⚠️ {t('batchUpload.improveWarning', 'L\'amélioration prend plus de temps (environ 30-60 secondes par CV)')}
              </p>
            )}

            {/* Export option */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOption}
                onChange={(e) => setExportOption(e.target.checked)}
                disabled={isProcessing}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <div className="flex items-center gap-2">
                <ArrowDownTrayIcon className="w-5 h-5 text-green-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t('batchUpload.exportOption', 'Exporter les CVs après traitement (ZIP)')}
                </span>
              </div>
            </label>

            {/* Export options - template and format selection */}
            {exportOption && (
              <div className="ml-8 space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('batchUpload.exportTemplate', 'Modèle d\'export')}
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    disabled={isProcessing || templates.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {templates.length === 0 ? (
                      <option value="">{t('batchUpload.loadingTemplates', 'Chargement des modèles...')}</option>
                    ) : (
                      templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.Name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('batchUpload.exportFormats', 'Formats d\'export (sélection multiple)')}
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportFormats.includes('pdf')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportFormats([...exportFormats, 'pdf']);
                          } else {
                            setExportFormats(exportFormats.filter(f => f !== 'pdf'));
                          }
                        }}
                        disabled={isProcessing}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">PDF</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportFormats.includes('docx')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportFormats([...exportFormats, 'docx']);
                          } else {
                            setExportFormats(exportFormats.filter(f => f !== 'docx'));
                          }
                        }}
                        disabled={isProcessing}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">DOCX</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportFormats.includes('doc')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportFormats([...exportFormats, 'doc']);
                          } else {
                            setExportFormats(exportFormats.filter(f => f !== 'doc'));
                          }
                        }}
                        disabled={isProcessing}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">DOC</span>
                    </label>
                  </div>
                  {exportFormats.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      {t('batchUpload.selectAtLeastOneFormat', 'Sélectionnez au moins un format')}
                    </p>
                  )}
                </div>
                
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  ℹ️ {t('batchUpload.zipInfo', 'Un fichier ZIP contenant tous les CVs exportés sera téléchargé à la fin du traitement')}
                </p>
              </div>
            )}

            {/* Delete after processing option */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteAfterExport}
                onChange={(e) => setDeleteAfterExport(e.target.checked)}
                disabled={isProcessing}
                className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <div className="flex items-center gap-2">
                <XMarkIcon className="w-5 h-5 text-red-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t('batchUpload.deleteAfterOption', 'Supprimer les CVs après traitement')}
                </span>
              </div>
            </label>

            {deleteAfterExport && (
              <p className="text-sm text-red-600 dark:text-red-400 ml-8">
                ⚠️ {t('batchUpload.deleteWarning', `Les CVs seront supprimés de la base de données après ${exportOption ? 'l\'export' : 'le traitement'}. Cette action est irréversible.`)}
              </p>
            )}
            
            {/* Admin firm selector */}
            {isAdmin && (
              <div className="mt-4">
                <AdminFirmSelector
                  selectedFirmId={selectedFirmId}
                  onFirmChange={setSelectedFirmId}
                  disabled={isProcessing}
                  t={t}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all relative
              ${isDragActive 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
              }
              ${isProcessing || isLoadingFiles ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {/* Loading overlay when files are being added */}
            {isLoadingFiles && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 rounded-xl flex flex-col items-center justify-center z-10"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <ArrowPathIcon className="w-12 h-12 text-indigo-500" />
                </motion.div>
                <p className="mt-3 text-indigo-600 dark:text-indigo-400 font-medium">
                  {t('batchUpload.loadingFiles', 'Chargement des fichiers...')}
                </p>
              </motion.div>
            )}
            
            <FolderArrowDownIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
              {isDragActive 
                ? t('batchUpload.dropHere', 'Déposez les fichiers ici...') 
                : t('batchUpload.dragDrop', 'Glissez-déposez vos CVs ici, ou cliquez pour sélectionner')
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('batchUpload.fileTypes', 'PDF, DOC, DOCX • Max 50MB par fichier')}
            </p>
            
            {/* Folder selection button */}
            <div className="mt-4 flex justify-center">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors">
                <FolderArrowDownIcon className="w-5 h-5" />
                {t('batchUpload.selectFolder', 'Sélectionner un dossier')}
                <input
                  type="file"
                  className="hidden"
                  // @ts-expect-error webkitdirectory is not in standard types
                  webkitdirectory=""
                  directory=""
                  multiple
                  disabled={isProcessing}
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const fileList = e.target.files;
                    if (fileList) {
                      const filesArray = Array.from(fileList);
                      // Filter for supported file types
                      const validFiles = filesArray.filter(f => 
                        f.name.toLowerCase().endsWith('.pdf') || 
                        f.name.toLowerCase().endsWith('.doc') || 
                        f.name.toLowerCase().endsWith('.docx')
                      );
                      if (validFiles.length > 0) {
                        onDrop(validFiles);
                      }
                    }
                    // Reset input to allow selecting same folder again
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </motion.div>

        {/* File list */}
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('batchUpload.filesCount', `Fichiers (${files.length}/${MAX_FILES})`)}
              </h2>
              {!isProcessing && (
                <div className="flex items-center gap-2">
                  {errorCount > 0 && (
                    <button
                      onClick={() => {
                        // Retry all failed files
                        files.forEach((f, i) => {
                          if (f.status === 'error') retryFile(i);
                        });
                      }}
                      className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                      {t('batchUpload.retryAll', 'Réessayer les erreurs')}
                    </button>
                  )}
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('batchUpload.confirmClear', 'Confirmer ?')}
                      </span>
                      <button
                        onClick={clearAllFiles}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 font-medium"
                      >
                        {t('common.yes', 'Oui')}
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
                      >
                        {t('common.no', 'Non')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      {t('batchUpload.clearAll', 'Tout supprimer')}
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Stats */}
            {(successCount > 0 || errorCount > 0 || pendingCount > 0) && (
              <div className="flex gap-4 mb-4 text-sm">
                {successCount > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    ✓ {successCount} {t('batchUpload.stats.success', 'réussi(s)')}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    ✗ {errorCount} {t('batchUpload.stats.error', 'erreur(s)')}
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="text-gray-500 dark:text-gray-400">
                    ○ {pendingCount} {t('batchUpload.stats.pending', 'en attente')}
                  </span>
                )}
              </div>
            )}
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {files.map((fileStatus, index) => (
                  <motion.div
                    key={`${fileStatus.file.name}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    {getStatusIcon(fileStatus.status)}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {fileStatus.file.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${
                          fileStatus.status === 'error' ? 'text-red-500' :
                          fileStatus.status === 'success' ? 'text-green-500' :
                          'text-gray-500 dark:text-gray-400'
                        }`}>
                          {fileStatus.error || getStatusText(fileStatus.status)}
                        </span>
                        {fileStatus.resumeId && fileStatus.status === 'success' && (
                          <button
                            onClick={() => navigate(`/resumes/${fileStatus.resumeId}/analysis`)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                          >
                            Voir →
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    {['uploading', 'extracting', 'analyzing', 'improving'].includes(fileStatus.status) && (
                      <div className="w-20">
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${fileStatus.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Retry button for failed files */}
                    {!isProcessing && fileStatus.status === 'error' && (
                      <button
                        onClick={() => retryFile(index)}
                        className="p-1 text-amber-500 hover:text-amber-600 transition-colors"
                        title={t('batchUpload.retry', 'Réessayer')}
                      >
                        <ArrowPathIcon className="w-5 h-5" />
                      </button>
                    )}
                    
                    {/* Remove button */}
                    {!isProcessing && fileStatus.status !== 'success' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title={t('batchUpload.remove', 'Supprimer')}
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center gap-4"
        >
          {isProcessing ? (
            <div className="px-6 py-3 bg-indigo-600 text-white rounded-lg flex items-center gap-2 opacity-75">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              {t('batchUpload.processing', 'Traitement en cours...')}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <button
                  onClick={() => navigate('/resumes')}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('batchUpload.backToResumes', 'Retour aux CVs')}
                </button>
              </div>
              <div className="flex flex-col items-center">
                <button
                  onClick={startProcessing}
                  disabled={files.length === 0 || pendingCount === 0 || (exportOption && exportFormats.length === 0)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentArrowUpIcon className="w-5 h-5" />
                  {t('batchUpload.process', 'Traiter')} {pendingCount > 0 ? `${pendingCount} ${t('batchUpload.files', 'fichier(s)')}` : ''}
                </button>
                {/* Estimated time */}
                {pendingCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {getEstimatedTime()}
                  </span>
                )}
              </div>
              
              {/* Manual export button - shown when there are successful files, export option is enabled, and resumes not deleted */}
              {exportOption && successCount > 0 && !isExporting && !resumesDeleted && (
                <button
                  onClick={startBatchExport}
                  disabled={!selectedTemplate || isExporting}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  {t('batchUpload.export', 'Exporter')} {successCount} CV(s)
                </button>
              )}
              
              {/* Export in progress indicator */}
              {isExporting && (
                <button
                  disabled
                  className="px-6 py-3 bg-green-600 text-white rounded-lg flex items-center gap-2 opacity-75 cursor-wait"
                >
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  {t('batchUpload.exporting', 'Export en cours...')}
                </button>
              )}
            </>
          )}
        </motion.div>
        
        {/* RGPD Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>{t('batchUpload.gdprTitle', 'RGPD')} :</strong> {t('batchUpload.gdprInfo', 'Les CVs importés par lot sont considérés comme internes (collaborateurs). Aucune demande de consentement ne sera envoyée et aucun nom de candidat n\'est enregistré.')}
          </p>
        </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default BatchUploadPage;
