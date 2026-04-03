/**
 * FileUpload Component
 * TypeScript version
 * 
 * Two-step upload flow:
 * 1. GDPR info form (profile type, candidate name, email for external)
 * 2. File upload
 */

import { useCallback, useEffect, useState } from 'react';
import { useDropzone, FileRejection, FileError } from 'react-dropzone';
import { DocumentArrowUpIcon, UserIcon, BuildingOfficeIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useResume } from '../context/ResumeContext';
import { useAuth } from '../context/AuthContext';
import ProcessingScreen from './ProcessingScreen';
import AdminFirmSelector from './AdminFirmSelector';
import InputWithLeadingIcon from './form/InputWithLeadingIcon';
import { useTranslation } from 'react-i18next';
import logger from '../utils/logger.frontend';
import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';

interface CandidateInfo {
  profileType: 'employee' | 'external';
  candidateName: string;
  candidateEmail: string;
  firmId: string;
}

const FileUpload = (): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { uploadResume, loading, processingStep, processingError, setProcessingError } = useResume();
  
  // Step management: 'info' for GDPR form, 'upload' for file upload
  const [step, setStep] = useState<'info' | 'upload'>('info');
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo>({
    profileType: 'external',
    candidateName: '',
    candidateEmail: '',
    firmId: ''
  });
  const [preAnalysisEnabled, setPreAnalysisEnabled] = useState<boolean>(true);
  
  const _isAdmin = user?.role === 'admin';
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    let isMounted = true;

    const loadPreAnalysisSetting = async (): Promise<void> => {
      try {
        const options = await createAuthOptionsWithCsrf({ method: 'GET' });
        const response = await fetchWithAuth('/api/settings', options);
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }

        const settings = await response.json() as { preAnalysisEnabled?: boolean };
        if (isMounted) {
          setPreAnalysisEnabled(Boolean(settings.preAnalysisEnabled));
        }
      } catch (error) {
        logger.warn('[FileUpload] Failed to load pre-analysis setting, keeping default processing steps', error);
      }
    };

    loadPreAnalysisSetting();

    return () => {
      isMounted = false;
    };
  }, []);

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle form submission to proceed to upload step
  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; email?: string } = {};
    
    if (!candidateInfo.candidateName.trim()) {
      errors.name = t('fileUpload.gdpr.errors.nameRequired', 'Le nom est requis');
    }
    
    if (candidateInfo.profileType === 'external') {
      if (!candidateInfo.candidateEmail.trim()) {
        errors.email = t('fileUpload.gdpr.errors.emailRequired', 'L\'email est requis pour les externes');
      } else if (!isValidEmail(candidateInfo.candidateEmail)) {
        errors.email = t('fileUpload.gdpr.errors.emailInvalid', 'Format d\'email invalide');
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    setStep('upload');
  };

  // Go back to info step
  const handleBackToInfo = () => {
    setStep('info');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]): Promise<void> => {
    if (acceptedFiles.length > 0) {
      try {
        logger.log('[FileUpload] File accepted', { 
          name: acceptedFiles[0].name, 
          type: acceptedFiles[0].type, 
          size: acceptedFiles[0].size,
          candidateInfo 
        });
        // Pass candidate info along with the file
        await uploadResume(acceptedFiles[0], candidateInfo);
      } catch (error) {
        logger.error('[FileUpload] Error uploading file:', error);
      }
    }
  }, [uploadResume, candidateInfo]);

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

  // Render GDPR info form (step 1)
  const renderInfoForm = () => (
    <motion.div
      key="info-form"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
    >
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
        {t('fileUpload.gdpr.title', 'Informations du candidat')}
      </h2>
      
      <form onSubmit={handleInfoSubmit} className="space-y-6">
        {/* Admin Firm Selector - only visible for admins */}
        <AdminFirmSelector
          selectedFirmId={candidateInfo.firmId}
          onFirmChange={(firmId) => setCandidateInfo(prev => ({ ...prev, firmId }))}
          className="mb-2"
          t={t}
        />
        
        {/* Profile Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('fileUpload.gdpr.profileType', 'Type de profil')}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setCandidateInfo(prev => ({ ...prev, profileType: 'employee', candidateEmail: '' }))}
              className={`flex items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${
                candidateInfo.profileType === 'employee'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <BuildingOfficeIcon className="h-6 w-6" />
              <span className="font-medium">{t('fileUpload.gdpr.employee', 'Collaborateur')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCandidateInfo(prev => ({ ...prev, profileType: 'external' }))}
              className={`flex items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${
                candidateInfo.profileType === 'external'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <UserIcon className="h-6 w-6" />
              <span className="font-medium">{t('fileUpload.gdpr.external', 'Externe')}</span>
            </button>
          </div>
        </div>

        {/* Candidate Name */}
        <div>
          <label htmlFor="candidateName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('fileUpload.gdpr.candidateName', 'Nom complet du candidat')} *
          </label>
          <InputWithLeadingIcon
            icon={UserIcon}
            type="text"
            id="candidateName"
            value={candidateInfo.candidateName}
            onChange={(e) => setCandidateInfo(prev => ({ ...prev, candidateName: e.target.value }))}
            inputClassName={`w-full rounded-xl border ${
              formErrors.name
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } mb-0 bg-white dark:bg-gray-700 py-3 pl-14 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2`}
            placeholder={t('fileUpload.gdpr.namePlaceholder', 'Ex: Jean Dupont')}
          />
          {formErrors.name && (
            <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('fileUpload.gdpr.nameHint', 'Ce nom sera utilisé pour le consentement RGPD (distinct du nom affiché sur le CV)')}
          </p>
        </div>

        {/* Candidate Email (only for external) */}
        {candidateInfo.profileType === 'external' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <label htmlFor="candidateEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fileUpload.gdpr.candidateEmail', 'Email du candidat')} *
            </label>
            <InputWithLeadingIcon
              icon={EnvelopeIcon}
              type="email"
              id="candidateEmail"
              value={candidateInfo.candidateEmail}
              onChange={(e) => setCandidateInfo(prev => ({ ...prev, candidateEmail: e.target.value }))}
              inputClassName={`w-full rounded-xl border ${
                formErrors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              } mb-0 bg-white dark:bg-gray-700 py-3 pl-14 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2`}
              placeholder={t('fileUpload.gdpr.emailPlaceholder', 'candidat@email.com')}
            />
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('fileUpload.gdpr.emailHint', 'Un email de demande de consentement RGPD sera envoyé automatiquement')}
            </p>
          </motion.div>
        )}

        {/* Info box for external */}
        {candidateInfo.profileType === 'external' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('fileUpload.gdpr.externalInfo', 'Pour les candidats externes, un email de demande de consentement RGPD sera envoyé automatiquement après l\'upload du CV.')}
            </p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          className="btn btn-primary w-full py-3 px-4 flex items-center justify-center gap-2"
        >
          <DocumentArrowUpIcon className="h-5 w-5" />
          {t('fileUpload.gdpr.continue', 'Continuer vers l\'upload')}
        </button>
      </form>
    </motion.div>
  );

  // Render file upload dropzone (step 2)
  const renderUploadZone = () => (
    <motion.div
      key="dropzone"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Summary of candidate info */}
      <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          {candidateInfo.profileType === 'employee' ? (
            <BuildingOfficeIcon className="h-5 w-5 text-blue-500" />
          ) : (
            <UserIcon className="h-5 w-5 text-green-500" />
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{candidateInfo.candidateName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {candidateInfo.profileType === 'employee' 
                ? t('fileUpload.gdpr.employee', 'Collaborateur')
                : candidateInfo.candidateEmail
              }
            </p>
          </div>
        </div>
        <button
          onClick={handleBackToInfo}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          {t('fileUpload.gdpr.modify', 'Modifier')}
        </button>
      </div>

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
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
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
  );

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      <AnimatePresence mode="wait">
        {processingStep ? (
          <ProcessingScreen
            currentStep={processingStep}
            error={processingError}
            fullscreen={true}
            preAnalysisEnabled={preAnalysisEnabled}
          />
        ) : step === 'info' ? (
          renderInfoForm()
        ) : (
          renderUploadZone()
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;
