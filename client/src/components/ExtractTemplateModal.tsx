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
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { ExtractedTemplate } from '../utils/templateService';
import logger from '../utils/logger.frontend';
import { markTemplatesViewDirty } from '../utils/viewRefreshScopes';

const TemplatePreviewFrame = lazy(() => import('./TemplatePreviewFrame'));

interface ExtractTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExtractionStep = 'upload' | 'extracting' | 'preview' | 'error';
type EditableField = 'name' | 'description' | 'headerContent' | 'templateContent' | 'footerContent' | 'stylesheet';

function getExtractionMethodLabel(method: string): string {
  switch (method) {
    case 'office-pdf-layout-html':
      return 'Office -> PDF -> Layout HTML';
    case 'pdf-layout-html':
      return 'PDF -> Layout HTML';
    case 'pdf-vision-fallback':
      return 'PDF -> Vision (Fallback)';
    case 'pdf-text-fallback':
      return 'PDF -> Texte (Fallback)';
    default:
      return method;
  }
}

function getConfidenceLabel(level?: 'low' | 'medium' | 'high'): string {
  if (level === 'high') return 'Confiance élevée';
  if (level === 'medium') return 'Confiance moyenne';
  if (level === 'low') return 'Confiance faible';
  return 'Confiance inconnue';
}

function getConfidenceClasses(level?: 'low' | 'medium' | 'high'): string {
  if (level === 'high') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (level === 'medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (level === 'low') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function metricValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'n/a';
}

const ExtractTemplateModal = ({ isOpen, onClose }: ExtractTemplateModalProps): JSX.Element | null => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preserveExtractedTemplateRef = useRef(false);
  const wasOpenRef = useRef(isOpen);

  const [step, setStep] = useState<ExtractionStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedTemplate, setExtractedTemplate] = useState<ExtractedTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState('');
  const [extractionMethod, setExtractionMethod] = useState('');

  const resetModal = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setExtractedTemplate(null);
    setError(null);
    setUsedModel('');
    setExtractionMethod('');
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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleExtract = async () => {
    if (!selectedFile) return;
    setStep('extracting');
    setError(null);

    try {
      const { templateService } = await import('../utils/templateService');
      const result = await templateService.extractFromCV(selectedFile);
      if (!result.success || !result.template) throw new Error('Invalid response from server');
      setExtractedTemplate(result.template);
      setUsedModel(result.model || '');
      setExtractionMethod(result.extractionMethod || '');
      setStep('preview');
      markTemplatesViewDirty();
      toast.success(t('templates.extract.success'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Template extraction failed:', err);
      setError(errorMessage);
      setStep('error');
      toast.error(t('templates.extract.error'));
    }
  };

  const handleFieldChange = useCallback((field: EditableField, value: string) => {
    setExtractedTemplate((current) => current ? { ...current, [field]: value } : current);
  }, []);

  const applyDetectedField = useCallback((field: EditableField, source: 'headerHtml' | 'contentHtml' | 'footerHtml' | 'stylesheet') => {
    setExtractedTemplate((current) => {
      if (!current?.extractionReview) return current;
      const nextValue = current.extractionReview[source];
      if (typeof nextValue !== 'string' || nextValue.length === 0) return current;
      return { ...current, [field]: nextValue };
    });
  }, []);

  const applyDetectedLayout = useCallback(() => {
    setExtractedTemplate((current) => {
      if (!current?.extractionReview) return current;
      return {
        ...current,
        headerContent: current.extractionReview.headerHtml || current.headerContent,
        templateContent: current.extractionReview.contentHtml || current.templateContent,
        footerContent: current.extractionReview.footerHtml || current.footerContent,
        stylesheet: current.extractionReview.stylesheet || current.stylesheet,
      };
    });
  }, []);

  const handleCreateTemplate = () => {
    if (!extractedTemplate) return;
    sessionStorage.setItem('extractedTemplate', JSON.stringify(extractedTemplate));
    markTemplatesViewDirty();
    preserveExtractedTemplateRef.current = true;
    setStep('upload');
    setSelectedFile(null);
    setExtractedTemplate(null);
    setError(null);
    setUsedModel('');
    setExtractionMethod('');
    onClose();
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

  const review = extractedTemplate?.extractionReview;
  const metrics = review?.layoutMetrics || {};
  const visualBlockCount = review?.visualBlocks?.length ?? metrics.visualBlockCount;
  const imageRegionCount = review?.imageRegions?.length ?? metrics.imageBlockCount;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <SparklesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('templates.extract.title')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('templates.extract.subtitle')}</p>
              </div>
            </div>
            <button type="button" onClick={handleClose} aria-label={t('common.close', 'Fermer')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 overflow-auto max-h-[70vh]">
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
                        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('templates.extract.clickToChange')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <DocumentArrowUpIcon className="w-12 h-12 mx-auto text-gray-400" />
                      <div>
                        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          {isDragActive ? t('templates.extract.dropHere') : t('templates.extract.dragDrop')}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">PDF, DOCX, DOC</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">{t('templates.extract.howItWorks')}</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                    <li>- {t('templates.extract.step1')}</li>
                    <li>- {t('templates.extract.step2')}</li>
                    <li>- {t('templates.extract.step3')}</li>
                    <li>- {t('templates.extract.step4')}</li>
                  </ul>
                </div>
              </div>
            )}

            {step === 'extracting' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-800 rounded-full animate-spin border-t-purple-600 dark:border-t-purple-400" />
                  <SparklesIcon className="w-8 h-8 text-purple-600 dark:text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('templates.extract.analyzing')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('templates.extract.pleaseWait')}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Cette opération peut prendre 1 à 3 minutes selon la complexité du document.</p>
                </div>
              </div>
            )}

            {step === 'preview' && extractedTemplate && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="font-medium">{t('templates.extract.extractionComplete')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    {extractionMethod && <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{getExtractionMethodLabel(extractionMethod)}</span>}
                    {usedModel && <span>{t('templates.extract.usedModel')}: {usedModel}</span>}
                    {extractedTemplate.extractionConfidence && (
                      <span className={`inline-flex items-center px-2 py-1 rounded ${getConfidenceClasses(extractedTemplate.extractionConfidence.level)}`}>
                        {getConfidenceLabel(extractedTemplate.extractionConfidence.level)} {Math.round(extractedTemplate.extractionConfidence.score * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-6">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Revue et correction</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Ajuste le template final avant création.</div>
                        </div>
                        {review && (
                          <button type="button" onClick={applyDetectedLayout} className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 text-sm">
                            Utiliser toute la détection
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="extract-template-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('templates.editor.name.label')}</label>
                          <input id="extract-template-name" type="text" value={extractedTemplate.name} onChange={(event) => handleFieldChange('name', event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                        <div>
                          <label htmlFor="extract-template-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('templates.editor.description.label')}</label>
                          <input id="extract-template-description" type="text" value={extractedTemplate.description} onChange={(event) => handleFieldChange('description', event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <label htmlFor="extract-template-header" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Header final</label>
                            {review?.headerHtml && <button type="button" onClick={() => applyDetectedField('headerContent', 'headerHtml')} className="text-xs text-purple-700 dark:text-purple-300">Utiliser le header détecté</button>}
                          </div>
                          <textarea id="extract-template-header" value={extractedTemplate.headerContent} onChange={(event) => handleFieldChange('headerContent', event.target.value)} rows={5} className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <label htmlFor="extract-template-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contenu final</label>
                            {review?.contentHtml && <button type="button" onClick={() => applyDetectedField('templateContent', 'contentHtml')} className="text-xs text-purple-700 dark:text-purple-300">Utiliser le contenu détecté</button>}
                          </div>
                          <textarea id="extract-template-content" value={extractedTemplate.templateContent} onChange={(event) => handleFieldChange('templateContent', event.target.value)} rows={10} className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <label htmlFor="extract-template-footer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Footer final</label>
                            {review?.footerHtml && <button type="button" onClick={() => applyDetectedField('footerContent', 'footerHtml')} className="text-xs text-purple-700 dark:text-purple-300">Utiliser le footer détecté</button>}
                          </div>
                          <textarea id="extract-template-footer" value={extractedTemplate.footerContent} onChange={(event) => handleFieldChange('footerContent', event.target.value)} rows={5} className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <label htmlFor="extract-template-stylesheet" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Feuille de style finale</label>
                            {review?.stylesheet && <button type="button" onClick={() => applyDetectedField('stylesheet', 'stylesheet')} className="text-xs text-purple-700 dark:text-purple-300">Utiliser le CSS détecté</button>}
                          </div>
                          <textarea id="extract-template-stylesheet" value={extractedTemplate.stylesheet} onChange={(event) => handleFieldChange('stylesheet', event.target.value)} rows={8} className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Diagnostic d'extraction</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="rounded bg-gray-50 dark:bg-gray-900 p-3"><div className="text-gray-500 dark:text-gray-400">Méthode</div><div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{getExtractionMethodLabel(review?.extractionMethod || extractionMethod)}</div></div>
                        <div className="rounded bg-gray-50 dark:bg-gray-900 p-3"><div className="text-gray-500 dark:text-gray-400">Texte détecté</div><div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{review?.textLength ?? 0} caractères</div></div>
                        <div className="rounded bg-gray-50 dark:bg-gray-900 p-3"><div className="text-gray-500 dark:text-gray-400">Blocs visuels</div><div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{metricValue(visualBlockCount)}</div></div>
                        <div className="rounded bg-gray-50 dark:bg-gray-900 p-3"><div className="text-gray-500 dark:text-gray-400">Zones image</div><div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{metricValue(imageRegionCount)}</div></div>
                      </div>
                      <div className="mt-3 rounded bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <div>Lignes détectées: {metricValue(metrics.totalLines)}</div>
                        <div>Header lines: {metricValue(metrics.headerLines)}</div>
                        <div>Content lines: {metricValue(metrics.contentLines)}</div>
                        <div>Footer lines: {metricValue(metrics.footerLines)}</div>
                      </div>
                    </div>

                    {review && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Fragments détectés</div>
                        <div className="space-y-3">
                          <div><div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Header détecté</div><pre className="max-h-32 overflow-auto rounded bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">{review.headerHtml || '(vide)'}</pre></div>
                          <div><div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Contenu détecté</div><pre className="max-h-40 overflow-auto rounded bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">{review.contentHtml || '(vide)'}</pre></div>
                          <div><div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Footer détecté</div><pre className="max-h-32 overflow-auto rounded bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">{review.footerHtml || '(vide)'}</pre></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[32rem] overflow-auto">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('templates.extract.preview')}</div>
                      <div className="overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700">
                        <Suspense fallback={<div className="flex h-80 items-center justify-center text-sm text-gray-500 dark:text-gray-400">Chargement de l'aperçu...</div>}>
                          <TemplatePreviewFrame
                            title={extractedTemplate.name}
                            stylesheet={extractedTemplate.stylesheet}
                            headerContent={extractedTemplate.headerContent}
                            templateContent={extractedTemplate.templateContent}
                            footerContent={extractedTemplate.footerContent}
                            className="h-80 w-full border-0 bg-white"
                            scale={0.72}
                          />
                        </Suspense>
                      </div>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">{t('templates.extract.reviewNote')}</p>
                      </div>
                    </div>

                    {extractedTemplate.extractedColors && extractedTemplate.extractedColors.length > 0 && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('templates.extract.extractedColors') || 'Couleurs extraites'}</div>
                        <div className="flex flex-wrap gap-2">
                          {extractedTemplate.extractedColors.map((color, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <div className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: color }} title={color} />
                              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {extractedTemplate.extractedFonts && extractedTemplate.extractedFonts.length > 0 && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('templates.extract.extractedFonts') || 'Polices extraites'}</div>
                        <div className="flex flex-wrap gap-1">
                          {extractedTemplate.extractedFonts.map((font, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" style={{ fontFamily: font }}>
                              {font}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <ExclamationTriangleIcon className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('templates.extract.errorTitle')}</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2 max-w-md">{error}</p>
                </div>
                <button type="button" onClick={() => setStep('upload')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                  {t('templates.extract.tryAgain')}
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              {t('common.cancel')}
            </button>
            {step === 'upload' && selectedFile && (
              <button type="button" onClick={handleExtract} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                <SparklesIcon className="w-5 h-5" />
                {t('templates.extract.extractButton')}
              </button>
            )}
            {step === 'preview' && extractedTemplate && (
              <button type="button" onClick={handleCreateTemplate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
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
