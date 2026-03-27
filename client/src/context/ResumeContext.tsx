/* eslint-disable react-refresh/only-export-components */
/**
 * Resume Context
 * TypeScript version with full type safety
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import { showCaughtError, getUserFriendlyMessage } from '../components/errorToast.helpers';
import { applyResumeUpdate, normalizeResume, normalizeResumeList } from '../utils/resumeNormalization';

import { Resume } from '../types/entities';

export type { Resume };

export interface CandidateInfo {
  profileType: 'employee' | 'external';
  candidateName: string;
  candidateEmail: string;
  firmId?: string;
}

export type ProcessingStep = 'upload' | 'extract' | 'analyze' | 'improving' | 'analyzing' | null;

interface ResumeContextType {
  resumes: Resume[];
  currentResume: Resume | null;
  loading: boolean;
  processingStep: ProcessingStep;
  processingError: string | null;
  deleting: boolean;
  setProcessingError: (error: string | null) => void;
  setCurrentResume: (resume: Resume | null) => void;
  setResumes: React.Dispatch<React.SetStateAction<Resume[]>>;
  uploadResume: (file: File, candidateInfo?: CandidateInfo) => Promise<Resume | undefined>;
  improveCurrentResume: () => Promise<Resume>;
  updateResumeAnalysis: (resumeId: string, analysisData: Partial<Resume>) => Promise<Resume>;
  fetchResumes: () => Promise<void>;
  updateImprovedContent: (resumeId: string, content: string) => Promise<{ success: boolean; currentVersion?: number }>;
  updateOriginalContent: (resumeId: string, content: string) => Promise<{ success: boolean }>;
  deleteResume: (resumeId: string) => Promise<void>;
}

interface ResumeProviderProps {
  children: ReactNode;
}

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

const SINGLE_UPLOAD_JOB_POLL_INTERVAL_MS = 2000;
const SINGLE_UPLOAD_JOB_TIMEOUT_MS = 10 * 60 * 1000;

export const useResume = (): ResumeContextType => {
  const context = useContext(ResumeContext);
  if (!context) {
    throw new Error('useResume must be used within a ResumeProvider');
  }
  return context;
};

export const ResumeProvider = ({ children }: ResumeProviderProps): JSX.Element => {
  const { user } = useAuth();
  const [resumes, setResumesState] = useState<Resume[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentResume, setCurrentResumeState] = useState<Resume | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const [deleting, setDeleting] = useState<boolean>(false);

  const setCurrentResume = useCallback((resume: Resume | null): void => {
    setCurrentResumeState(resume ? normalizeResume(resume) : null);
  }, []);

  const setResumes: React.Dispatch<React.SetStateAction<Resume[]>> = useCallback((value) => {
    setResumesState(prev => {
      const nextValue = typeof value === 'function' ? value(prev) : value;
      return normalizeResumeList(nextValue);
    });
  }, []);

  const updateResumeAnalysis = useCallback(async (resumeId: string, analysisData: Partial<Resume>): Promise<Resume> => {
    if (abortControllerRef.current.signal.aborted) throw new Error('Operation aborted');

    const updateOptions = await createAuthOptionsWithCsrf({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisData)
    });

    const response = await fetchWithAuth(`/api/resumes/${resumeId}`, updateOptions);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update resume' }));
      throw new Error(errorData.error || 'Failed to update resume');
    }

    const updatedResume = normalizeResume(await response.json());

    if (!abortControllerRef.current.signal.aborted) {
      setResumes(prev => prev.map(resume => (resume.id === resumeId ? updatedResume : resume)));
      setCurrentResume(updatedResume);
    }

    return updatedResume;
  }, [setCurrentResume, setResumes]);

  const fetchResumes = useCallback(async (): Promise<void> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/resumes', fetchOptions);
      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }
      const data = await response.json();
      const fetchedResumes = normalizeResumeList(data.resumes || data.data || data);

      if (!controller.signal.aborted) {
        setResumes(fetchedResumes);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : '';
        if (!errorMessage.includes('Session expired')) {
          logger.error('Error fetching resumes:', error);
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [setResumes]);

  const deriveUploadProcessingStep = (jobData: { status?: string; items?: Array<{ progress?: number; status?: string }> }): ProcessingStep => {
    const item = jobData.items?.[0];
    const progress = typeof item?.progress === 'number' ? item.progress : 0;

    if (item?.status === 'success' || jobData.status === 'completed') {
      return 'analyze';
    }
    if (progress >= 40 || item?.status === 'pending_name') {
      return 'analyze';
    }
    if (progress >= 30 || item?.status === 'processing') {
      return 'extract';
    }
    return 'upload';
  };

  const fetchResumeById = useCallback(async (resumeId: string, signal: AbortSignal): Promise<Resume> => {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`/api/resumes/${resumeId}`, {
      ...fetchOptions,
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch resume' }));
      throw new Error(errorData.error || 'Failed to fetch resume');
    }

    return normalizeResume(await response.json());
  }, []);

  const waitForUploadJobCompletion = useCallback(async (jobId: string, signal: AbortSignal): Promise<string> => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < SINGLE_UPLOAD_JOB_TIMEOUT_MS) {
      if (signal.aborted) {
        throw new Error('Operation aborted');
      }

      const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
      const jobResponse = await fetchWithAuth(`/api/batch-jobs/${jobId}`, {
        ...fetchOptions,
        signal
      }, 30000);

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json().catch(() => ({ error: 'Failed to fetch upload job' }));
        throw new Error(errorData.error || 'Failed to fetch upload job');
      }

      const jobData = await jobResponse.json() as {
        status?: string;
        error_message?: string;
        items?: Array<{
          status?: string;
          progress?: number;
          resume_id?: string;
          error_message?: string;
        }>;
      };

      setProcessingStep(deriveUploadProcessingStep(jobData));

      const item = jobData.items?.[0];
      if (item?.status === 'pending_name') {
        throw new Error("L'analyse du CV necessite une confirmation du nom du candidat.");
      }

      if (item?.status === 'error') {
        throw new Error(item.error_message || 'Failed to process resume');
      }

      if (jobData.status === 'failed' || jobData.status === 'cancelled') {
        throw new Error(jobData.error_message || 'Failed to process resume');
      }

      if (item?.resume_id && (item.status === 'success' || jobData.status === 'completed')) {
        return item.resume_id;
      }

      await new Promise<void>((resolve, reject) => {
        let timeoutId = 0;
        const handleAbort = () => {
          window.clearTimeout(timeoutId);
          signal.removeEventListener('abort', handleAbort);
          reject(new Error('Operation aborted'));
        };

        timeoutId = window.setTimeout(() => {
          signal.removeEventListener('abort', handleAbort);
          resolve();
        }, SINGLE_UPLOAD_JOB_POLL_INTERVAL_MS);

        signal.addEventListener('abort', handleAbort, { once: true });
      });
    }

    throw new Error('Le traitement du CV a dépassé le délai maximum autorisé.');
  }, []);

  const uploadResume = useCallback(async (file: File, candidateInfo?: CandidateInfo): Promise<Resume | undefined> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (controller.signal.aborted) return;

      setLoading(true);
      setProcessingError(null);
      setProcessingStep('upload');

      const MAX_FILE_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 50MB limit');
      }

      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a PDF, DOC, or DOCX file');
      }

      const formData = new FormData();
      formData.append('files', file);

      if (candidateInfo) {
        formData.append('profile_type', candidateInfo.profileType);
        formData.append('candidate_name', candidateInfo.candidateName);
        if (candidateInfo.candidateEmail) {
          formData.append('candidate_email', candidateInfo.candidateEmail);
        }
        if (candidateInfo.firmId) {
          formData.append('firm_id', candidateInfo.firmId);
        }
      }

      const uploadOptions = await createAuthOptionsWithCsrf({ method: 'POST', body: formData });
      if (uploadOptions.headers) {
        delete uploadOptions.headers['Content-Type'];
      }

      const uploadResponse = await fetchWithAuth('/api/batch-jobs', {
        ...uploadOptions,
        signal: controller.signal
      }, 300000);

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Failed to create upload job' }));
        throw new Error(errorData.error || 'Failed to create upload job');
      }

      const uploadJob = await uploadResponse.json() as { id?: string };
      if (!uploadJob.id) {
        throw new Error('Upload job was created without an identifier');
      }

      const resumeId = await waitForUploadJobCompletion(uploadJob.id, controller.signal);
      if (controller.signal.aborted) return;

      const newResume = await fetchResumeById(resumeId, controller.signal);
      if (controller.signal.aborted) return;

      setResumes(prev => [newResume, ...prev.filter(resume => resume.id !== newResume.id)]);
      setCurrentResume(newResume);

      return newResume;
    } catch (error) {
      if (!controller.signal.aborted) {
        const { message: userFriendlyMessage } = getUserFriendlyMessage(error);
        setProcessingError(userFriendlyMessage);
        logger.error('[ResumeContext] ERROR during upload:', error);
        showCaughtError(error);
      }
      throw error;
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setProcessingStep(null);
      }
    }
  }, [fetchResumeById, setCurrentResume, setResumes, waitForUploadJobCompletion]);

  const improveCurrentResume = useCallback(async (): Promise<Resume> => {
    if (!currentResume) {
      throw new Error('No resume selected for improvement');
    }

    setLoading(true);
    setProcessingStep('improving');

    try {
      const text = currentResume['Original Text'];
      const currentAnalysis = {
        globalRating: currentResume['Global Rating'],
        skillsRating: currentResume['Skills Score'],
        experiencesRating: currentResume['Experience Score'],
        educationRating: currentResume['Education Score'],
        atsOptimizationRating: currentResume['ATS Score'],
        executiveSummaryRating: currentResume['Executive Summary Score'],
        hobbiesLanguagesRating: currentResume['Hobbies Languages Score'],
        suggestions: currentResume['Key Improvements'] ? JSON.parse(String(currentResume['Key Improvements'])) : {},
        name: currentResume['Name'],
        originalName: currentResume['Original Name'] || currentResume['Name'],
        title: currentResume['Title']
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      let response: Response;
      try {
        const authOptions = await createAuthOptionsWithCsrf({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, analysis: currentAnalysis })
        });
        response = await fetchWithAuth('/api/resumes/improve', {
          ...authOptions,
          signal: controller.signal
        }, 300000);
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        logger.error('Fetch error:', fetchError);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 5 minutes.');
        }
        throw new Error('Network error: Unable to connect to the server.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to improve resume' }));
        throw new Error(errorData.error || 'Failed to improve resume');
      }

      const responseData = await response.json();
      const { text: improvedText, analysis: improvedAnalysis } = responseData;

      setProcessingStep('analyzing');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const improvedSuggestions = improvedAnalysis?.suggestions || improvedAnalysis?.['Key Improvements'] || {};
      const getScore = (primary: number | string | undefined, fallback: number | string | undefined): number => {
        if (primary !== undefined && primary !== null) return typeof primary === 'number' ? primary : parseInt(String(primary).replace('%', ''), 10) || 0;
        if (fallback !== undefined && fallback !== null) return typeof fallback === 'number' ? fallback : parseInt(String(fallback).replace('%', ''), 10) || 0;
        return 0;
      };

      const updatePayload = {
        'Original Text': text,
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
        'Status': 'Improved' as const,
        'Last Improved': new Date().toISOString(),
        'FirmName': user?.firm || undefined
      };

      return await updateResumeAnalysis(currentResume.id, updatePayload);
    } catch (error) {
      logger.error('Error improving resume:', error);
      showCaughtError(error);
      throw error;
    } finally {
      setLoading(false);
      setProcessingStep(null);
    }
  }, [currentResume, updateResumeAnalysis, user]);

  const updateImprovedContent = useCallback(async (resumeId: string, content: string): Promise<{ success: boolean; currentVersion?: number }> => {
    const updateOptions = await createAuthOptionsWithCsrf({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'Improved Text': content })
    });
    const response = await fetchWithAuth(`/api/resumes/${resumeId}`, updateOptions);
    if (!response.ok) {
      throw new Error('Failed to update improved content');
    }

    const updatedData = normalizeResume(await response.json());
    const newVersion = updatedData['Current Version'] || 0;

    setCurrentResumeState(prev => (prev ? applyResumeUpdate(prev, { 'Improved Text': content, 'Current Version': newVersion }) : null));
    setResumes(prev => prev.map(resume => (
      resume.id === resumeId
        ? applyResumeUpdate(resume, { 'Improved Text': content, 'Current Version': newVersion })
        : resume
    )));

    return { success: true, currentVersion: newVersion };
  }, [setResumes]);

  const updateOriginalContent = useCallback(async (resumeId: string, content: string): Promise<{ success: boolean }> => {
    const updateOptions = await createAuthOptionsWithCsrf({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'Original Text': content })
    });
    const response = await fetchWithAuth(`/api/resumes/${resumeId}`, updateOptions);
    if (!response.ok) {
      throw new Error('Failed to update original content');
    }

    setCurrentResumeState(prev => (prev ? applyResumeUpdate(prev, { 'Original Text': content }) : null));
    setResumes(prev => prev.map(resume => (
      resume.id === resumeId ? applyResumeUpdate(resume, { 'Original Text': content }) : resume
    )));

    return { success: true };
  }, [setResumes]);

  const deleteResume = useCallback(async (resumeId: string): Promise<void> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setDeleting(true);
    try {
      const deleteOptions = await createAuthOptionsWithCsrf({ method: 'DELETE' });
      const response = await fetchWithAuth(`/api/resumes/${resumeId}`, deleteOptions);
      if (!response.ok) {
        throw new Error('Failed to delete resume');
      }
      if (!controller.signal.aborted) {
        setResumes(prevResumes => prevResumes.filter(resume => resume.id !== resumeId));
        if (currentResume?.id === resumeId) {
          setCurrentResume(null);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        logger.error('Error deleting resume:', error);
        const { message: userFriendlyMessage } = getUserFriendlyMessage(error);
        setProcessingError(userFriendlyMessage);
      }
    } finally {
      if (!controller.signal.aborted) {
        setDeleting(false);
      }
    }
  }, [currentResume, setCurrentResume, setResumes]);

  const value: ResumeContextType = {
    resumes,
    currentResume,
    loading,
    processingStep,
    processingError,
    deleting,
    setProcessingError,
    setCurrentResume,
    setResumes,
    uploadResume,
    improveCurrentResume,
    updateResumeAnalysis,
    fetchResumes,
    updateImprovedContent,
    updateOriginalContent,
    deleteResume
  };

  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>;
};

export default ResumeContext;

