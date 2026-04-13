/**
 * ExtractTemplateModal Component
 * Modal for extracting a CV template from an uploaded CV file
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  SparklesIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import type { ExtractedTemplate } from '../utils/templateService';
import logger from '../utils/logger.frontend';

const TemplatePreviewFrame = lazy(() => import('./TemplatePreviewFrame'));


interface ExtractTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExtractionStep = 'upload' | 'extracting' | 'preview' | 'error';

const ExtractTemplateModal = ({ isOpen, onClose }: ExtractTemplateModalProps): JSX.Element | null => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preserveExtractedTemplateRef = useRef(false);
  const wasOpenRef = useRef(isOpen);
  
  const [step, setStep] = useState<ExtractionStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedTemplate, setExtractedTemplate] = useState<ExtractedTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string>('');
  const [extractionMethod, setExtractionMethod] = useState<string>('');

  const resetModal = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setExtractedTemplate(null);
    setError(null);
    setUsedModel('');
    setExtractionMethod('');
    // Clean up sessionStorage if user closes modal without creating template
    sessionStorage.removeItem('extractedTemplate');
  }, []);

  const handleClose = useCallback(() => {
    resetModal();
    onClose();
  }, [onClose, resetModal]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const handleExtract = async () => {
    if (!selectedFile) return;

    setStep('extracting');
    setError(null);

    try {
      const { templateService } = await import('../utils/templateService');
      const result = await templateService.extractFromCV(selectedFile);
      
      if (result.success && result.template) {
        setExtractedTemplate(result.template);
        setUsedModel(result.model || '');
        setExtractionMethod(result.extractionMethod || '');
        setStep('preview');
        toast.success(t('templates.extract.success'));
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Template extraction failed:', err);
      setError(errorMessage);
      setStep('error');
      toast.error(t('templates.extract.error'));
    }
  };

  const handleCreateTemplate = () => {
    if (!extractedTemplate) return;

    // Store extracted template in sessionStorage for NewTemplatePage to pick up
    sessionStorage.setItem('extractedTemplate', JSON.stringify(extractedTemplate));
    preserveExtractedTemplateRef.current = true;
    
    // Close modal WITHOUT calling resetModal (which would clear sessionStorage)
    // Reset state manually but keep sessionStorage intact
    setStep('upload');
    setSelectedFile(null);
    setExtractedTemplate(null);
    setError(null);
    setUsedModel('');
    setExtractionMethod('');
    onClose();
    
    // Navigate to new template page
    navigate('/admin/templates/new?fromExtraction=true');
  };

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (wasOpen && !isOpen) {
      if (preserveExtractedTemplateRef.current) {
        preserveExtractedTemplateRef.current = false;
        return;
      }
      resetModal();
    }
  }, [isOpen, resetModal]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <SparklesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('templates.extract.title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('templates.extract.subtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('common.close', 'Fermer')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-auto max-h-[70vh]">
            {/* Step: Upload */}
            {step === 'upload' && (
              <div className="space-y-6">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : selectedFile
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
                  }`}
                >
                  <input {...getInputProps()} />
                  
                  {selectedFile ? (
                    <div className="space-y-3">
                      <CheckCircleIcon className="w-12 h-12 mx-auto text-green-500" />
                      <div>
                        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('templates.extract.clickToChange')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <DocumentArrowUpIcon className="w-12 h-12 mx-auto text-gray-400" />
                      <div>
                        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          {isDragActive
                            ? t('templates.extract.dropHere')
                            : t('templates.extract.dragDrop')}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t('templates.extract.supportedFormats')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                    {t('templates.extract.howItWorks')}
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                    <li>- {t('templates.extract.step1')}</li>
                    <li>- {t('templates.extract.step2')}</li>
                    <li>- {t('templates.extract.step3')}</li>
                    <li>- {t('templates.extract.step4')}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step: Extracting */}
            {step === 'extracting' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-800 rounded-full animate-spin border-t-purple-600 dark:border-t-purple-400" />
                  <SparklesIcon className="w-8 h-8 text-purple-600 dark:text-purple-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t('templates.extract.analyzing')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('templates.extract.pleaseWait')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                    {t('templates.extract.longOperation') || 'Cette opération peut prendre 1 à 3 minutes selon la complexité du document.'}
                  </p>
                </div>
              </div>
            )}

            {/* Step: Preview */}
            {step === 'preview' && extractedTemplate && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="font-medium">{t('templates.extract.extractionComplete')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {extractionMethod && (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {extractionMethod === 'docx-html' ? 'DOCX -> HTML' : 
                         extractionMethod === 'pdf-vision' ? 'PDF -> Vision' : 
                         extractionMethod === 'pdf-text-fallback' ? 'PDF -> Texte' : extractionMethod}
                      </span>
                    )}
                    {usedModel && (
                      <span>{t('templates.extract.usedModel')}: {usedModel}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Template Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('templates.editor.name.label')}
                      </label>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        {extractedTemplate.name}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('templates.editor.description.label')}
                      </label>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {extractedTemplate.description}
                      </p>
                    </div>
                    {extractedTemplate.tags && extractedTemplate.tags.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Tags
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {extractedTemplate.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {extractedTemplate.extractedColors && extractedTemplate.extractedColors.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('templates.extract.extractedColors') || 'Couleurs extraites'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {extractedTemplate.extractedColors.map((color, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <div 
                                className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600" 
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {extractedTemplate.extractedFonts && extractedTemplate.extractedFonts.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('templates.extract.extractedFonts') || 'Polices extraites'}
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {extractedTemplate.extractedFonts.map((font, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                              style={{ fontFamily: font }}
                            >
                              {font}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Template Preview */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-80 overflow-auto">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {t('templates.extract.preview')}
                    </div>
                    <div className="overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700">
                      <Suspense fallback={<div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">Chargement de l’aperçu...</div>}>
                        <TemplatePreviewFrame
                        title={extractedTemplate.name}
                        stylesheet={extractedTemplate.stylesheet}
                        headerContent={extractedTemplate.headerContent}
                        templateContent={extractedTemplate.templateContent}
                        footerContent={extractedTemplate.footerContent}
                        className="h-64 w-full border-0 bg-white"
                        scale={0.75}
                      />
                    </Suspense>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {t('templates.extract.reviewNote')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Error */}
            {step === 'error' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <ExclamationTriangleIcon className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t('templates.extract.errorTitle')}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2 max-w-md">
                    {error}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('templates.extract.tryAgain')}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('common.cancel')}
            </button>

            {step === 'upload' && selectedFile && (
              <button
                type="button"
                onClick={handleExtract}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <SparklesIcon className="w-5 h-5" />
                {t('templates.extract.extractButton')}
              </button>
            )}

            {step === 'preview' && extractedTemplate && (
              <button
                type="button"
                onClick={handleCreateTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <DocumentTextIcon className="w-5 h-5" />
                {t('templates.extract.createTemplate')}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ExtractTemplateModal;

