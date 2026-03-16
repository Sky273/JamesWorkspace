/**
 * BatchUploadPage Component
 * Allows uploading multiple CVs at once with optional improvement
 * CVs are treated as internal (employee) without candidate name for GDPR
 * 
 * Processing logic extracted to:
 * - ./batchUpload/useBatchProcessing.ts
 * - ./batchUpload/useBatchExport.ts
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  DocumentArrowUpIcon, 
  ArrowPathIcon,
  FolderArrowDownIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger.frontend';
import toast from 'react-hot-toast';
import { templateService, Template } from '../utils/templateService';
import { type FileWithPath, type FileStatus, type ExportFormats, getFilesFromEvent } from './batchUpload.utils';
import BatchUploadOptions from './BatchUploadOptions';
import BatchUploadFileList from './BatchUploadFileList';
import { useBatchExport } from './batchUpload/useBatchExport';
import { useBatchProcessing } from './batchUpload/useBatchProcessing';

const BatchUploadPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  
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
  const MAX_FILES = 200;

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

  // --- File management callbacks ---

  const updateFileStatus = useCallback((index: number, updates: Partial<FileStatus>) => {
    if (!isMountedRef.current) return; // Guard against unmount
    setFiles(prev => {
      const updated = prev.map((f, i) => i === index ? { ...f, ...updates } : f);
      filesRef.current = updated;
      return updated;
    });
  }, []);

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
  
  // Retry a failed file
  const retryFile = (index: number) => {
    setFiles(prev => {
      const updated = prev.map((f, i) => i === index ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f);
      filesRef.current = updated;
      return updated;
    });
  };

  // --- Hooks for processing and export ---

  const { startBatchExport, deleteProcessedResumes } = useBatchExport({
    filesRef,
    isMountedRef,
    processedResumeIdsRef,
    selectedTemplate,
    exportFormats,
    setIsExporting,
    setIsDeleting,
    setResumesDeleted,
  });

  const { startProcessing, getEstimatedTime } = useBatchProcessing({
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
  });

  // --- Dropzone ---

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
        
        const newFiles: FileStatus[] = uniqueFiles.map(file => {
          const fileWithPath = file as FileWithPath;
          // Check customRelativePath (from drag & drop) or webkitRelativePath (from folder button)
          const customPath = fileWithPath.customRelativePath;
          const webkitPath = fileWithPath.webkitRelativePath;
          // Use customPath first (drag & drop), then webkitPath (folder selection)
          const relativePath = (customPath && customPath.length > 0) 
            ? customPath 
            : (webkitPath && webkitPath.length > 0) 
              ? webkitPath 
              : undefined;
          // Log for debugging
          logger.info('File added', { fileName: file.name, customPath, webkitPath, relativePath });
          return {
            file,
            relativePath,
            status: 'pending' as const,
            progress: 0
          };
        });
        
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
    getFilesFromEvent: getFilesFromEvent as (event: DropEvent) => Promise<File[]>,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isProcessing
  });

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
          
          <BatchUploadOptions
            improveOption={improveOption}
            setImproveOption={setImproveOption}
            exportOption={exportOption}
            setExportOption={setExportOption}
            deleteAfterExport={deleteAfterExport}
            setDeleteAfterExport={setDeleteAfterExport}
            templates={templates}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            exportFormats={exportFormats}
            setExportFormats={setExportFormats}
            isProcessing={isProcessing}
            isAdmin={isAdmin}
            selectedFirmId={selectedFirmId}
            setSelectedFirmId={setSelectedFirmId}
          />
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
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              💡 {t('batchUpload.nominativeRecommendation', 'Pour une meilleure extraction des noms, privilégiez des fichiers nommés avec le nom du candidat (ex: Jean_Dupont_CV.pdf)')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ⚠️ {t('batchUpload.lockedFilesWarning', 'Fermez les fichiers ouverts dans Word, LibreOffice ou autre application avant l\'import. Les fichiers verrouillés (ex: ~$document.docx) seront ignorés.')}
            </p>
            
            {/* Folder selection button */}
            <div className="mt-4 flex justify-center">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors">
                <FolderArrowDownIcon className="w-5 h-5" />
                {t('batchUpload.selectFolder', 'Sélectionner un dossier')}
<input
                  type="file"
                  className="hidden"
                  {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
                  multiple
                  disabled={isProcessing}
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const fileList = e.target.files;
                    if (fileList) {
                      const filesArray = Array.from(fileList);
                      // Log webkitRelativePath for debugging
                      logger.info('Folder selection - files with paths', { 
                        count: filesArray.length,
                        samplePaths: filesArray.slice(0, 5).map(f => ({
                          name: f.name,
                          webkitRelativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath
                        }))
                      });
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
        <BatchUploadFileList
          files={files}
          isProcessing={isProcessing}
          pendingCount={pendingCount}
          successCount={successCount}
          errorCount={errorCount}
          maxFiles={MAX_FILES}
          showClearConfirm={showClearConfirm}
          setShowClearConfirm={setShowClearConfirm}
          onRemoveFile={removeFile}
          onRetryFile={retryFile}
          onClearAll={clearAllFiles}
          onRetryAll={() => files.forEach((f, i) => { if (f.status === 'error') retryFile(i); })}
        />

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
      </div>
    </div>
  );
};

export default BatchUploadPage;
