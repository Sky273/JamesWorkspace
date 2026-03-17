/**
 * BatchUploadFileList - File list display with status, progress, retry/remove
 * Extracted from BatchUploadPage.tsx
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import type { FileStatus } from './batchUpload.utils';

interface BatchUploadFileListProps {
  files: FileStatus[];
  isProcessing: boolean;
  pendingCount: number;
  successCount: number;
  errorCount: number;
  maxFiles: number;
  showClearConfirm: boolean;
  setShowClearConfirm: (v: boolean) => void;
  onRemoveFile: (index: number) => void;
  onRetryFile: (index: number) => void;
  onClearAll: () => void;
  onRetryAll: () => void;
}

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

export default function BatchUploadFileList({
  files,
  isProcessing,
  pendingCount,
  successCount,
  errorCount,
  maxFiles,
  showClearConfirm,
  setShowClearConfirm,
  onRemoveFile,
  onRetryFile,
  onClearAll,
  onRetryAll
}: BatchUploadFileListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

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

  if (files.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('batchUpload.filesCount', `Fichiers (${files.length}/${maxFiles})`)}
        </h2>
        {!isProcessing && (
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <button
                onClick={onRetryAll}
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
                  onClick={onClearAll}
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
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={fileStatus.relativePath || fileStatus.file.name}>
                  {fileStatus.relativePath ? (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">
                        {fileStatus.relativePath.split('/').slice(0, -1).join('/') + '/'}
                      </span>
                      {fileStatus.file.name}
                    </>
                  ) : fileStatus.file.name}
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
                  onClick={() => onRetryFile(index)}
                  className="p-1 text-amber-500 hover:text-amber-600 transition-colors"
                  title={t('batchUpload.retry', 'Réessayer')}
                >
                  <ArrowPathIcon className="w-5 h-5" />
                </button>
              )}
              
              {/* Remove button */}
              {!isProcessing && fileStatus.status !== 'success' && (
                <button
                  onClick={() => onRemoveFile(index)}
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
  );
}
