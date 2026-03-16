/**
 * useBatchExport Hook
 * Handles batch export and delete logic for batch upload
 */

import { useCallback, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';
import type { FileStatus, ExportFormats } from '../batchUpload.utils';

interface UseBatchExportParams {
  filesRef: MutableRefObject<FileStatus[]>;
  isMountedRef: MutableRefObject<boolean>;
  processedResumeIdsRef: MutableRefObject<string[]>;
  selectedTemplate: string;
  exportFormats: ExportFormats;
  setIsExporting: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDeleting: React.Dispatch<React.SetStateAction<boolean>>;
  setResumesDeleted: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useBatchExport({
  filesRef,
  isMountedRef,
  processedResumeIdsRef,
  selectedTemplate,
  exportFormats,
  setIsExporting,
  setIsDeleting,
  setResumesDeleted,
}: UseBatchExportParams) {
  const { t } = useTranslation();

  // Batch export function - generates ZIP with all successful resumes
  const startBatchExport = useCallback(async (): Promise<boolean> => {
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
  }, [filesRef, isMountedRef, selectedTemplate, exportFormats, setIsExporting, t]);

  // Delete all successfully processed resumes using the ref (avoids closure issues)
  const deleteProcessedResumes = useCallback(async (): Promise<void> => {
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
  }, [isMountedRef, processedResumeIdsRef, setIsDeleting, setResumesDeleted]);

  return {
    startBatchExport,
    deleteProcessedResumes,
  };
}
