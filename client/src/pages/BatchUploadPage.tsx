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
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger.frontend';
import toast from 'react-hot-toast';
import type { Template } from '../utils/templateService';
import { type FileWithPath, type FileStatus, type ExportFormats, getFilesFromEvent } from './batchUpload.utils';
import BatchUploadOptions from './BatchUploadOptions';
import BatchUploadFileList from './BatchUploadFileList';
import {
  BatchUploadActions,
  BatchUploadDropzone,
  BatchUploadGdprNotice,
  BatchUploadHeader
} from './BatchUploadPage.sections';
import { useBatchExport } from './batchUpload/useBatchExport';
import { useBatchProcessing } from './batchUpload/useBatchProcessing';

const BatchUploadPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const tf = (key: string, fallback?: string): string => t(key, fallback || key);

  const [files, setFiles] = useState<FileStatus[]>([]);
  const [improveOption, setImproveOption] = useState<boolean>(false);
  const [exportOption, setExportOption] = useState<boolean>(false);
  const [deleteAfterExport, setDeleteAfterExport] = useState<boolean>(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [exportFormats, setExportFormats] = useState<ExportFormats>(['pdf']);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [, setIsDeleting] = useState<boolean>(false);
  const [resumesDeleted, setResumesDeleted] = useState<boolean>(false);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processedResumeIdsRef = useRef<string[]>([]);
  const filesRef = useRef<FileStatus[]>([]);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef<boolean>(true);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_FILES = 200;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }

      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];

      filesRef.current = [];
      processedResumeIdsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (exportOption && templates.length === 0) {
      let isCancelled = false;

      import('../utils/templateService')
        .then(({ templateService }) => templateService.getAllTemplates())
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
    return undefined;
  }, [exportOption, templates.length]);

  const updateFileStatus = useCallback((index: number, updates: Partial<FileStatus>) => {
    if (!isMountedRef.current) return;
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

  const retryFile = (index: number) => {
    setFiles(prev => {
      const updated = prev.map((f, i) =>
        i === index ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f
      );
      filesRef.current = updated;
      return updated;
    });
  };

  const { startBatchExport } = useBatchExport({
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
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsLoadingFiles(true);

    setTimeout(() => {
      try {
        const currentCount = filesRef.current.length;
        const availableSlots = MAX_FILES - currentCount;

        if (availableSlots <= 0) {
          toast.error(t('batchUpload.maxFilesReached', `Maximum ${MAX_FILES} fichiers autorisés`));
          setIsLoadingFiles(false);
          return;
        }

        const filesToAdd = acceptedFiles.slice(0, availableSlots);
        if (filesToAdd.length < acceptedFiles.length) {
          toast(
            t('batchUpload.someFilesSkipped', `${acceptedFiles.length - filesToAdd.length} fichier(s) ignoré(s) (limite: ${MAX_FILES})`),
            { icon: '⚠️' }
          );
        }

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
          const customPath = fileWithPath.customRelativePath;
          const webkitPath = fileWithPath.webkitRelativePath;
          const relativePath = (customPath && customPath.length > 0)
            ? customPath
            : (webkitPath && webkitPath.length > 0)
              ? webkitPath
              : undefined;

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
        setIsLoadingFiles(false);
      }
    }, 50);
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
    maxSize: 50 * 1024 * 1024,
    disabled: isProcessing
  });

  const { pendingCount, successCount, errorCount } = useMemo(() => ({
    pendingCount: files.filter(f => f.status === 'pending').length,
    successCount: files.filter(f => f.status === 'success').length,
    errorCount: files.filter(f => f.status === 'error').length
  }), [files]);

  const handleFolderSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      const filesArray = Array.from(fileList);
      logger.info('Folder selection - files with paths', {
        count: filesArray.length,
        samplePaths: filesArray.slice(0, 5).map(f => ({
          name: f.name,
          webkitRelativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath
        }))
      });
      const validFiles = filesArray.filter(f =>
        f.name.toLowerCase().endsWith('.pdf') ||
        f.name.toLowerCase().endsWith('.doc') ||
        f.name.toLowerCase().endsWith('.docx')
      );
      if (validFiles.length > 0) {
        onDrop(validFiles);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <BatchUploadHeader t={tf} />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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

        <BatchUploadDropzone
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          isLoadingFiles={isLoadingFiles}
          isProcessing={isProcessing}
          onFolderChange={handleFolderSelection}
          t={tf}
        />

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

        <BatchUploadActions
          isProcessing={isProcessing}
          pendingCount={pendingCount}
          filesCount={files.length}
          exportOption={exportOption}
          exportFormatsCount={exportFormats.length}
          successCount={successCount}
          isExporting={isExporting}
          resumesDeleted={resumesDeleted}
          selectedTemplate={selectedTemplate}
          onBackToResumes={() => navigate('/resumes')}
          onStartProcessing={startProcessing}
          onStartExport={startBatchExport}
          getEstimatedTime={getEstimatedTime}
          t={tf}
        />

        <BatchUploadGdprNotice t={tf} />
      </div>
    </div>
  );
};

export default BatchUploadPage;
