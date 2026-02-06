/**
 * FileUpload Component
 * TypeScript version
 */

import { useCallback } from 'react';
import { useDropzone, FileRejection, FileError } from 'react-dropzone';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useResume } from '../context/ResumeContext';
import ProcessingScreen from './ProcessingScreen';
import { useTranslation } from 'react-i18next';
import logger from '../utils/logger.frontend';

const FileUpload = (): JSX.Element => {
  const { t } = useTranslation();
  const { uploadResume, loading, processingStep, processingError, setProcessingError } = useResume();

  const onDrop = useCallback(async (acceptedFiles: File[]): Promise<void> => {
    if (acceptedFiles.length > 0) {
      try {
        logger.log('[FileUpload] File accepted', { name: acceptedFiles[0].name, type: acceptedFiles[0].type, size: acceptedFiles[0].size });
        await uploadResume(acceptedFiles[0]);
      } catch (error) {
        logger.error('[FileUpload] Error uploading file:', error);
      }
    }
  }, [uploadResume]);

  const onDropRejected = useCallback((fileRejections: FileRejection[]): void => {
    logger.error('[FileUpload] Files rejected:', fileRejections);
    
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      const errors = rejection.errors;
      
      let errorMessage = 'Fichier refusé : ';
      
      errors.forEach((error: FileError) => {
        logger.error('[FileUpload] Rejection reason', { code: error.code, message: error.message });
        
        switch (error.code) {
          case 'file-too-large':
            errorMessage += `Le fichier est trop volumineux (max 50MB). Taille actuelle: ${(rejection.file.size / 1024 / 1024).toFixed(2)}MB`;
            break;
          case 'file-invalid-type':
            errorMessage += `Type de fichier non supporté: ${rejection.file.type || 'inconnu'}. Formats acceptés: PDF, DOC, DOCX`;
            break;
          case 'too-many-files':
            errorMessage += 'Un seul fichier à la fois';
            break;
          default:
            errorMessage += error.message;
        }
      });
      
      setProcessingError(errorMessage);
      
      setTimeout(() => {
        setProcessingError(null);
      }, 5000);
    }
  }, [setProcessingError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    disabled: loading || !!processingStep,
    validator: (file: File) => {
      logger.log('[FileUpload] Validating file', { name: file.name, type: file.type, size: file.size });
      
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (file.size < 100) {
          return {
            code: 'file-too-small',
            message: 'Le fichier PDF semble corrompu ou vide'
          };
        }
      }
      
      return null;
    }
  });

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      <AnimatePresence mode="wait">
        {processingStep ? (
          <ProcessingScreen
            currentStep={processingStep}
            error={processingError}
            fullscreen={true}
          />
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div
              {...getRootProps()}
              className={`
                relative rounded-lg border-2 border-dashed p-12
                text-center transition-colors duration-300 ease-in-out
                ${isDragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                bg-white dark:bg-gray-900
              `}
            >
              <input {...getInputProps()} />
              
              <div className="space-y-4">
                <div className="flex justify-center">
                  <DocumentArrowUpIcon 
                    className={`h-12 w-12 ${
                      isDragActive 
                        ? 'text-blue-500 dark:text-blue-400' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`} 
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragActive 
                      ? t('fileUpload.dropYourResumeHere') 
                      : t('fileUpload.dragAndDropYourResumeHere')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('fileUpload.or')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {t('fileUpload.supportedFormats')}
                  </p>
                </div>
                
                {processingError && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {processingError}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;
