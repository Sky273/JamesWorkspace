/**
 * VersionsPanel Component
 * Displays version history for a resume's improved text
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  ArrowPathIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { ResumeVersion, ResumeVersionsResponse } from '../../types/entities';
import {
  getVersions,
  restoreVersion,
  formatChangeReason,
  formatVersionDate
} from '../../services/resumeVersionsService';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';

interface VersionsPanelProps {
  resumeId: string;
  currentVersion: number;
  isOpen: boolean;
  onClose: () => void;
  onVersionRestored: (newVersion: number) => void;
  onPreviewVersion?: (version: ResumeVersion) => void;
}

const VersionsPanel = ({
  resumeId,
  currentVersion,
  isOpen,
  onClose,
  onVersionRestored,
  onPreviewVersion
}: VersionsPanelProps): JSX.Element | null => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const loadVersions = useCallback(async () => {
    if (!resumeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response: ResumeVersionsResponse = await getVersions(resumeId, { limit: 50 });
      setVersions(response.versions);
      setHasMore(response.hasMore);
      setTotal(response.total);
    } catch (err) {
      logger.error('[VersionsPanel] Error loading versions:', err);
      setError(t('versions.loadError', 'Erreur lors du chargement des versions'));
    } finally {
      setLoading(false);
    }
  }, [resumeId, t]);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, loadVersions]);

  const handleRestore = async (versionNumber: number) => {
    if (restoringVersion !== null) return;
    
    setRestoringVersion(versionNumber);
    
    try {
      const result = await restoreVersion(resumeId, versionNumber);
      toast.success(t('versions.restoreSuccess', `Version ${versionNumber} restaurée avec succès`));
      onVersionRestored(result.newVersion.versionNumber);
      await loadVersions();
    } catch (err) {
      logger.error('[VersionsPanel] Error restoring version:', err);
      toast.error(t('versions.restoreError', 'Erreur lors de la restauration'));
    } finally {
      setRestoringVersion(null);
    }
  };

  const handlePreview = (version: ResumeVersion) => {
    if (onPreviewVersion) {
      onPreviewVersion(version);
    }
    setExpandedVersion(expandedVersion === version.versionNumber ? null : version.versionNumber);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-[500px] max-h-[70vh] flex flex-col overflow-hidden mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <ClockIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('versions.title', 'Historique des versions')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('versions.subtitle', '{{count}} version(s)', { count: total })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={loadVersions}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('common.retry', 'Réessayer')}
                </button>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClockIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {t('versions.noVersions', 'Aucune version disponible')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      version.versionNumber === currentVersion
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          version.versionNumber === currentVersion
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}>
                          v{version.versionNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatChangeReason(version.changeReason)}
                            </span>
                            {version.versionNumber === currentVersion && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                                <CheckCircleIcon className="w-3 h-3" />
                                {t('versions.current', 'Actuelle')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{formatVersionDate(version.createdAt)}</span>
                            {version.createdByName && (
                              <>
                                <span>•</span>
                                <span>{version.createdByName}</span>
                              </>
                            )}
                          </div>
                          {version.improvedGlobalRating !== null && version.improvedGlobalRating !== undefined && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Score: {version.improvedGlobalRating}%
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePreview(version)}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title={t('versions.preview', 'Aperçu')}
                        >
                          {expandedVersion === version.versionNumber ? (
                            <ChevronUpIcon className="w-5 h-5" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5" />
                          )}
                        </button>
                        
                        {version.versionNumber !== currentVersion && (
                          <button
                            onClick={() => handleRestore(version.versionNumber)}
                            disabled={restoringVersion !== null}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                              restoringVersion === version.versionNumber
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                                : 'bg-blue-50 dark:bg-blue-600 text-blue-700 dark:text-white border-blue-200 dark:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-500'
                            }`}
                            title={t('versions.restore', 'Restaurer')}
                          >
                            {restoringVersion === version.versionNumber ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-300"></div>
                            ) : (
                              <ArrowPathIcon className="w-4 h-4" />
                            )}
                            {t('versions.restore', 'Restaurer')}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded preview */}
                    <AnimatePresence>
                      {expandedVersion === version.versionNumber && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-300 max-h-48 overflow-y-auto prose prose-sm dark:prose-invert">
                              <div 
                                dangerouslySetInnerHTML={{ 
                                  __html: version.improvedText?.substring(0, 1000) + 
                                    (version.improvedText?.length > 1000 ? '...' : '') 
                                }} 
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {hasMore && (
            <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-center bg-white dark:bg-gray-800">
              <button
                onClick={() => {/* Load more logic */}}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('versions.loadMore', 'Charger plus de versions')}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VersionsPanel;
