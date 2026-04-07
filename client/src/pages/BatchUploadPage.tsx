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
import { ArrowRightIcon, CloudArrowUpIcon, FolderPlusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
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
            toast.error(t('batchUpload.loadTemplatesError'));
          }
        });

      return () => {
        isCancelled = true;
      };
    }
    return undefined;
  }, [exportOption, t, templates.length]);

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
    <div className="mx-auto max-w-4xl">
      <div className="cv-surface app-page-shell">
        <BatchUploadHeader t={tf} />

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="section-shell mb-6 rounded-[2rem] p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <CloudArrowUpIcon className="h-5 w-5 text-[var(--cv-primary)]" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
              {t('batchUpload.howItWorks.title')}
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--cv-text)]">
                <FolderPlusIcon className="h-4 w-4 text-[var(--cv-primary)]" />
                {t('batchUpload.howItWorks.step1Title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                {t('batchUpload.howItWorks.step1Body')}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--cv-text)]">
                <ArrowRightIcon className="h-4 w-4 text-[var(--cv-primary)]" />
                {t('batchUpload.howItWorks.step2Title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                {t('batchUpload.howItWorks.step2Body')}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--cv-text)]">
                <ShieldCheckIcon className="h-4 w-4 text-[var(--cv-primary)]" />
                {t('batchUpload.howItWorks.step3Title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                {t('batchUpload.howItWorks.step3Body')}
              </p>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="section-shell mb-6 rounded-[2rem] p-6"
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

        <div className="mb-6">
          <BatchUploadDropzone
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
            isLoadingFiles={isLoadingFiles}
            isProcessing={isProcessing}
            onFolderChange={handleFolderSelection}
            t={tf}
          />
        </div>

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

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="section-shell mb-6 rounded-[2rem] p-6"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--cv-muted)]">
                {t('batchUpload.summary.files')}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{files.length}</p>
            </div>
            <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--cv-muted)]">
                {t('batchUpload.summary.ready')}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{pendingCount}</p>
            </div>
            <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--cv-muted)]">
                {t('batchUpload.summary.completed')}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{successCount}</p>
            </div>
          </div>
        </motion.section>

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
