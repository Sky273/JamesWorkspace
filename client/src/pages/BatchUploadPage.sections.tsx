import type { ChangeEvent, JSX } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  FolderArrowDownIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../components/page/PageHeader';

interface HeaderProps {
  t: (key: string, fallback?: string) => string;
}

interface DropzoneProps {
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
  isLoadingFiles: boolean;
  isProcessing: boolean;
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void;
  t: (key: string, fallback?: string) => string;
}

interface ActionsProps {
  isProcessing: boolean;
  pendingCount: number;
  filesCount: number;
  exportOption: boolean;
  exportFormatsCount: number;
  successCount: number;
  isExporting: boolean;
  resumesDeleted: boolean;
  selectedTemplate: string;
  onBackToResumes: () => void;
  onStartProcessing: () => void;
  onStartExport: () => void;
  getEstimatedTime: () => string;
  t: (key: string, fallback?: string) => string;
}

export function BatchUploadHeader({ t }: HeaderProps): JSX.Element {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={t('batchUpload.title', 'Import par lot')}
        subtitle={t('batchUpload.subtitle', "Chargez plusieurs CVs d'un coup pour les analyser automatiquement")}
      />
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">{t('batchUpload.badges.pdfDocx')}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">{t('batchUpload.badges.limit')}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">{t('batchUpload.badges.gdpr')}</span>
      </div>
    </motion.div>
  );
}

export function BatchUploadDropzone({
  getRootProps,
  getInputProps,
  isDragActive,
  isLoadingFiles,
  isProcessing,
  onFolderChange,
  t,
}: DropzoneProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-6"
    >
      <div
        {...getRootProps()}
        className={`
          relative cursor-pointer rounded-[2rem] border-2 border-dashed p-8 text-center transition-all
          ${isDragActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 hover:border-indigo-400 dark:border-gray-600 dark:hover:border-indigo-500'}
          ${isProcessing || isLoadingFiles ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isLoadingFiles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[2rem] bg-white/80 dark:bg-gray-800/80"
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <ArrowPathIcon className="h-12 w-12 text-indigo-500" />
            </motion.div>
            <p className="mt-3 font-medium text-indigo-600 dark:text-indigo-400">
              {t('batchUpload.loadingFiles', 'Chargement des fichiers...')}
            </p>
          </motion.div>
        )}

        <FolderArrowDownIcon className="mx-auto mb-4 h-16 w-16 text-[var(--cv-primary)]/70 dark:text-[var(--cv-primary)]" />
        <p className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
          {isDragActive
            ? t('batchUpload.dropHere', 'Déposez les fichiers ici...')
            : t('batchUpload.dragDrop', 'Glissez-déposez vos CVs ici, ou cliquez pour sélectionner')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('batchUpload.fileTypes', 'PDF, DOC, DOCX • Max 50MB par fichier')}
        </p>
        <p className="mt-3 inline-flex max-w-3xl items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
          <InformationCircleIcon className="h-4 w-4 shrink-0" />
          {t('batchUpload.nominativeRecommendation', 'Pour une meilleure extraction des noms, privilégiez des fichiers nommés avec le nom du candidat (ex: Jean_Dupont_CV.pdf)')}
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t('batchUpload.lockedFilesWarning', "Fermez les fichiers ouverts dans Word, LibreOffice ou autre application avant l'import. Les fichiers verrouillés (ex: ~$document.docx) seront ignorés.")}
        </p>

        <div className="mt-4 flex justify-center">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-100 px-4 py-2 text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50">
            <FolderArrowDownIcon className="h-5 w-5" />
            {t('batchUpload.selectFolder', 'Sélectionner un dossier')}
            <input
              type="file"
              className="hidden"
              {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              multiple
              disabled={isProcessing}
              accept=".pdf,.doc,.docx"
              onChange={onFolderChange}
            />
          </label>
        </div>
      </div>
    </motion.div>
  );
}

export function BatchUploadActions({
  isProcessing,
  pendingCount,
  filesCount,
  exportOption,
  exportFormatsCount,
  successCount,
  isExporting,
  resumesDeleted,
  selectedTemplate,
  onBackToResumes,
  onStartProcessing,
  onStartExport,
  getEstimatedTime,
  t,
}: ActionsProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex flex-col gap-3 sm:flex-row sm:justify-center"
    >
      {isProcessing ? (
        <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-white opacity-75">
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
          {t('batchUpload.processing', 'Traitement en cours...')}
        </div>
      ) : (
        <>
          <button
            onClick={onBackToResumes}
            className="rounded-xl bg-gray-200 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t('batchUpload.backToResumes', 'Retour aux CVs')}
          </button>
          <div className="flex flex-col items-center">
            <button
              onClick={onStartProcessing}
              disabled={filesCount === 0 || pendingCount === 0 || (exportOption && exportFormatsCount === 0)}
              className="app-primary-action inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <DocumentArrowUpIcon className="h-5 w-5" />
              {t('batchUpload.process', 'Traiter')} {pendingCount > 0 ? `${pendingCount} ${t('batchUpload.files', 'fichier(s)')}` : ''}
            </button>
            {pendingCount > 0 && (
              <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{getEstimatedTime()}</span>
            )}
          </div>

          {exportOption && successCount > 0 && !isExporting && !resumesDeleted && (
            <button
              onClick={onStartExport}
              disabled={!selectedTemplate || isExporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {t('batchUpload.export', 'Exporter')} {successCount} CV(s)
            </button>
          )}

          {isExporting && (
            <button
              disabled
              className="inline-flex cursor-wait items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-white opacity-75"
            >
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              {t('batchUpload.exporting', 'Export en cours...')}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}

export function BatchUploadGdprNotice({
  t,
}: {
  t: (key: string, fallback?: string) => string;
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-8 rounded-[1.5rem] border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
    >
      <p className="text-sm text-blue-700 dark:text-blue-300">
        <strong>{t('batchUpload.gdprTitle', 'RGPD')} :</strong>{' '}
        {t('batchUpload.gdprInfo', "Les CVs importés par lot sont considérés comme internes (collaborateurs). Aucune demande de consentement ne sera envoyée et aucun nom de candidat n'est enregistré.")}
      </p>
    </motion.div>
  );
}
