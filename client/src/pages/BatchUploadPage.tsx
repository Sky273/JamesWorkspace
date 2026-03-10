/**
 * BatchUploadPage Component
 * Allows uploading multiple CVs at once with optional improvement
 * CVs are treated as internal (employee) without candidate name for GDPR
 */

import { useState, useCallback, useRef } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  DocumentArrowUpIcon, 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ArrowPathIcon,
  SparklesIcon,
  DocumentTextIcon,
  FolderArrowDownIcon
} from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import { extractResumeText } from '../utils/resumeProcessing';
import logger from '../utils/logger.frontend';
import toast from 'react-hot-toast';
import AdminFirmSelector from '../components/AdminFirmSelector';

interface FileStatus {
  file: File;
  status: 'pending' | 'uploading' | 'extracting' | 'analyzing' | 'improving' | 'success' | 'error';
  progress: number;
  error?: string;
  resumeId?: string;
  resumeName?: string;
}

const BatchUploadPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [improveOption, setImproveOption] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileStatus[] = acceptedFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

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
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isProcessing
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const updateFileStatus = (index: number, updates: Partial<FileStatus>) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const processFile = async (fileStatus: FileStatus, index: number, signal: AbortSignal): Promise<void> => {
    try {
      // Step 1: Upload
      updateFileStatus(index, { status: 'uploading', progress: 10 });
      
      const formData = new FormData();
      formData.append('file', fileStatus.file);
      formData.append('name', fileStatus.file.name);
      formData.append('title', '');
      // RGPD: CVs internes sans nom renseigné
      formData.append('profile_type', 'employee');
      formData.append('candidate_name', ''); // Pas de nom pour les imports par lot
      
      if (isAdmin && selectedFirmId) {
        formData.append('firm_id', selectedFirmId);
      }
      
      const uploadOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        body: formData
      });
      
      if (uploadOptions.headers) {
        delete uploadOptions.headers['Content-Type'];
      }
      
      const uploadResponse = await fetchWithAuth('/api/resumes/upload', {
        ...uploadOptions,
        signal
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Échec de l\'upload' }));
        throw new Error(errorData.error || 'Échec de l\'upload');
      }
      
      const uploadedResume = await uploadResponse.json();
      updateFileStatus(index, { 
        resumeId: uploadedResume.id, 
        resumeName: uploadedResume.Name,
        progress: 25 
      });
      
      // Step 2: Extract text
      updateFileStatus(index, { status: 'extracting', progress: 35 });
      const text = await extractResumeText(fileStatus.file);
      
      if (!text || text.length === 0) {
        throw new Error('Impossible d\'extraire le texte du CV');
      }
      
      updateFileStatus(index, { progress: 50 });
      
      // Step 3: Analyze
      updateFileStatus(index, { status: 'analyzing', progress: 55 });
      
      const analysisOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      const analysisResponse = await fetchWithAuth('/api/resumes/analyze-text', {
        ...analysisOptions,
        signal
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({ error: 'Échec de l\'analyse' }));
        throw new Error(errorData.error || 'Échec de l\'analyse');
      }
      
      const analysis = await analysisResponse.json();
      updateFileStatus(index, { progress: 70 });
      
      // Step 4: Update resume with analysis
      const tags = analysis.tags || { skills: [], industries: [], tools: [], softSkills: [] };
      const suggestions = analysis.suggestions || {};
      const originalText = analysis.structuredText || text;
      
      const updateOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'Original Text': originalText,
          'Global Rating': analysis.globalRating,
          'Skills Score': analysis.skillsRating,
          'Experience Score': analysis.experiencesRating,
          'Education Score': analysis.educationRating,
          'ATS Score': analysis.atsOptimizationRating,
          'Executive Summary Score': analysis.executiveSummaryRating,
          'Hobbies Languages Score': analysis.hobbiesLanguagesRating,
          'Skills': tags.skills || [],
          'Industries': tags.industries || [],
          'Tools': tags.tools || [],
          'Soft Skills': tags.softSkills || [],
          'Key Improvements': JSON.stringify(suggestions),
          'Name': analysis.name,
          'Original Name': analysis.originalName || analysis.name,
          'Title': analysis.title,
          'Status': 'Analyzed',
          'Analysis Date': new Date().toISOString()
        })
      });
      
      await fetchWithAuth(`/api/resumes/${uploadedResume.id}`, {
        ...updateOptions,
        signal
      });
      
      updateFileStatus(index, { progress: 80 });
      
      // Step 5: Improve (if option selected)
      if (improveOption) {
        updateFileStatus(index, { status: 'improving', progress: 85 });
        
        // Build analysis object like improveCurrentResume does
        const currentAnalysis = {
          globalRating: analysis.globalRating,
          skillsRating: analysis.skillsRating,
          experiencesRating: analysis.experiencesRating,
          educationRating: analysis.educationRating,
          atsOptimizationRating: analysis.atsOptimizationRating,
          executiveSummaryRating: analysis.executiveSummaryRating,
          hobbiesLanguagesRating: analysis.hobbiesLanguagesRating,
          suggestions: suggestions,
          name: analysis.name,
          originalName: analysis.originalName || analysis.name,
          title: analysis.title
        };
        
        const improveOptions = await createAuthOptionsWithCsrf({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: originalText,
            analysis: currentAnalysis
          })
        });
        
        // Use /api/resumes/improve (same as improveCurrentResume) for full post-improvement analysis
        const improveResponse = await fetchWithAuth('/api/resumes/improve', {
          ...improveOptions,
          signal
        });
        
        if (improveResponse.ok) {
          const { text: improvedText, analysis: improvedAnalysis } = await improveResponse.json();
          
          // Helper to get score value (handles 0 as valid value)
          const getScore = (primary: number | string | undefined, fallback: number | string | undefined): number => {
            if (primary !== undefined && primary !== null) return typeof primary === 'number' ? primary : parseInt(String(primary).replace('%', ''), 10) || 0;
            if (fallback !== undefined && fallback !== null) return typeof fallback === 'number' ? fallback : parseInt(String(fallback).replace('%', ''), 10) || 0;
            return 0;
          };
          
          // Save improved text and all improved scores (same as improveCurrentResume)
          const improvedSuggestions = improvedAnalysis?.suggestions || improvedAnalysis?.['Key Improvements'] || {};
          
          const saveImprovedOptions = await createAuthOptionsWithCsrf({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'Improved Text': improvedText,
              'Improved Global Rating': String(getScore(improvedAnalysis?.globalRating, improvedAnalysis?.['Global Rating'])),
              'Improved Skills Score': String(getScore(improvedAnalysis?.skillsRating, improvedAnalysis?.['Skills'])),
              'Improved Experience Score': String(getScore(improvedAnalysis?.experiencesRating, improvedAnalysis?.['Experience'])),
              'Improved Education Score': String(getScore(improvedAnalysis?.educationRating, improvedAnalysis?.['Education'])),
              'Improved ATS Score': String(getScore(improvedAnalysis?.atsOptimizationRating, improvedAnalysis?.['ATS Compatibility'])),
              'Improved Executive Summary Score': String(getScore(improvedAnalysis?.executiveSummaryRating, improvedAnalysis?.['Executive Summary'])),
              'Improved Hobbies Languages Score': String(getScore(improvedAnalysis?.hobbiesLanguagesRating, improvedAnalysis?.['Hobbies Languages'])),
              'Improved Skills': JSON.stringify(improvedAnalysis?.tags?.skills || []),
              'Improved Industries': JSON.stringify(improvedAnalysis?.tags?.industries || []),
              'Improved Tools': JSON.stringify(improvedAnalysis?.tags?.tools || []),
              'Improved Soft Skills': JSON.stringify(improvedAnalysis?.tags?.softSkills || []),
              'Improved Key Improvements': JSON.stringify(improvedSuggestions),
              'Status': 'Improved',
              'Last Improved': new Date().toISOString()
            })
          });
          
          await fetchWithAuth(`/api/resumes/${uploadedResume.id}`, {
            ...saveImprovedOptions,
            signal
          });
        }
        // Don't fail if improvement fails, just log it
        else {
          logger.warn(`[BatchUpload] Improvement failed for ${fileStatus.file.name}, continuing...`);
        }
      }
      
      updateFileStatus(index, { status: 'success', progress: 100 });
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        updateFileStatus(index, { status: 'error', error: 'Annulé' });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        logger.error(`[BatchUpload] Error processing ${fileStatus.file.name}:`, error);
        updateFileStatus(index, { status: 'error', error: errorMessage });
      }
    }
  };

  const startProcessing = async () => {
    if (files.length === 0) {
      toast.error('Aucun fichier à traiter');
      return;
    }
    
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();
    
    // Process files sequentially to avoid overwhelming the server
    for (let i = 0; i < files.length; i++) {
      if (abortControllerRef.current.signal.aborted) break;
      
      if (files[i].status === 'pending') {
        await processFile(files[i], i, abortControllerRef.current.signal);
      }
    }
    
    setIsProcessing(false);
    
    const successCount = files.filter(f => f.status === 'success').length;
    const errorCount = files.filter(f => f.status === 'error').length;
    
    if (successCount > 0) {
      toast.success(`${successCount} CV(s) traité(s) avec succès`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} CV(s) en erreur`);
    }
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

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
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <DocumentTextIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: FileStatus['status']) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'uploading': return 'Upload...';
      case 'extracting': return 'Extraction...';
      case 'analyzing': return 'Analyse...';
      case 'improving': return 'Amélioration...';
      case 'success': return 'Terminé';
      case 'error': return 'Erreur';
      default: return '';
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Breadcrumbs className="mb-4" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t('batchUpload.title', 'Import par lot')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t('batchUpload.subtitle', 'Chargez plusieurs CVs d\'un coup pour les analyser automatiquement')}
          </p>
        </motion.div>

        {/* Options */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Options de traitement
          </h2>
          
          <div className="space-y-4">
            {/* Improve option */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={improveOption}
                onChange={(e) => setImproveOption(e.target.checked)}
                disabled={isProcessing}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t('batchUpload.improveOption', 'Améliorer les CVs automatiquement')}
                </span>
              </div>
            </label>
            
            {improveOption && (
              <p className="text-sm text-amber-600 dark:text-amber-400 ml-8">
                ⚠️ L'amélioration prend plus de temps (environ 30-60 secondes par CV)
              </p>
            )}
            
            {/* Admin firm selector */}
            {isAdmin && (
              <div className="mt-4">
                <AdminFirmSelector
                  selectedFirmId={selectedFirmId}
                  onFirmChange={setSelectedFirmId}
                  disabled={isProcessing}
                  t={t}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
              }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <FolderArrowDownIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
              {isDragActive 
                ? 'Déposez les fichiers ici...' 
                : 'Glissez-déposez vos CVs ici, ou cliquez pour sélectionner'
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              PDF, DOC, DOCX • Max 50MB par fichier
            </p>
          </div>
        </motion.div>

        {/* File list */}
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Fichiers ({files.length})
              </h2>
              {!isProcessing && (
                <button
                  onClick={clearAllFiles}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Tout supprimer
                </button>
              )}
            </div>
            
            {/* Stats */}
            {(successCount > 0 || errorCount > 0) && (
              <div className="flex gap-4 mb-4 text-sm">
                {successCount > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    ✓ {successCount} réussi(s)
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    ✗ {errorCount} erreur(s)
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="text-gray-500 dark:text-gray-400">
                    ○ {pendingCount} en attente
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
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {fileStatus.file.name}
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
                    
                    {/* Remove button */}
                    {!isProcessing && fileStatus.status !== 'success' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center gap-4"
        >
          {isProcessing ? (
            <button
              onClick={cancelProcessing}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <XMarkIcon className="w-5 h-5" />
              Annuler
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/resumes')}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Retour aux CVs
              </button>
              <button
                onClick={startProcessing}
                disabled={files.length === 0 || pendingCount === 0}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DocumentArrowUpIcon className="w-5 h-5" />
                Traiter {pendingCount > 0 ? `${pendingCount} fichier(s)` : ''}
              </button>
            </>
          )}
        </motion.div>
        
        {/* RGPD Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>RGPD :</strong> Les CVs importés par lot sont considérés comme internes (collaborateurs). 
            Aucune demande de consentement ne sera envoyée et aucun nom de candidat n'est enregistré.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default BatchUploadPage;
