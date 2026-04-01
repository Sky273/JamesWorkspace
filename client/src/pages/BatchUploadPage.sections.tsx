import type { ChangeEvent, JSX } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  FolderArrowDownIcon,
} from '@heroicons/react/24/outline';

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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-1 h-8 rounded-full bg-primary-500" />
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          {t('batchUpload.title', 'Import par lot')}
        </h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
        {t('batchUpload.subtitle', "Chargez plusieurs CVs d'un coup pour les analyser automatiquement")}
      </p>
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
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all relative
          ${isDragActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'}
          ${isProcessing || isLoadingFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isLoadingFiles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 rounded-xl flex flex-col items-center justify-center z-10"
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
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
            : t('batchUpload.dragDrop', 'Glissez-déposez vos CVs ici, ou cliquez pour sélectionner')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('batchUpload.fileTypes', 'PDF, DOC, DOCX • Max 50MB par fichier')}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          💡 {t('batchUpload.nominativeRecommendation', 'Pour une meilleure extraction des noms, privilégiez des fichiers nommés avec le nom du candidat (ex: Jean_Dupont_CV.pdf)')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          ⚠️ {t('batchUpload.lockedFilesWarning', "Fermez les fichiers ouverts dans Word, LibreOffice ou autre application avant l'import. Les fichiers verrouillés (ex: ~$document.docx) seront ignorés.")}
        </p>

        <div className="mt-4 flex justify-center">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors">
            <FolderArrowDownIcon className="w-5 h-5" />
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
              onClick={onBackToResumes}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('batchUpload.backToResumes', 'Retour aux CVs')}
            </button>
          </div>
          <div className="flex flex-col items-center">
            <button
              onClick={onStartProcessing}
              disabled={filesCount === 0 || pendingCount === 0 || (exportOption && exportFormatsCount === 0)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentArrowUpIcon className="w-5 h-5" />
              {t('batchUpload.process', 'Traiter')} {pendingCount > 0 ? `${pendingCount} ${t('batchUpload.files', 'fichier(s)')}` : ''}
            </button>
            {pendingCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{getEstimatedTime()}</span>
            )}
          </div>

          {exportOption && successCount > 0 && !isExporting && !resumesDeleted && (
            <button
              onClick={onStartExport}
              disabled={!selectedTemplate || isExporting}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              {t('batchUpload.export', 'Exporter')} {successCount} CV(s)
            </button>
          )}

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
      className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
    >
      <p className="text-sm text-blue-700 dark:text-blue-300">
        <strong>{t('batchUpload.gdprTitle', 'RGPD')} :</strong>{' '}
        {t('batchUpload.gdprInfo', "Les CVs importés par lot sont considérés comme internes (collaborateurs). Aucune demande de consentement ne sera envoyée et aucun nom de candidat n'est enregistré.")}
      </p>
    </motion.div>
  );
}
