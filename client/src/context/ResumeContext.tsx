/**
 * Resume Context
 * TypeScript version with full type safety
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { extractResumeText } from '../utils/resumeProcessing';
import { useAuth } from './AuthContext';
import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import { showCaughtError, getUserFriendlyMessage } from '../components/ErrorToast';

// Import centralized types
import { Resume } from '../types/entities';

// Re-export Resume type for backward compatibility
export type { Resume };

// ============================================
// TYPES
// ============================================

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
  uploadResume: (file: File) => Promise<Resume | undefined>;
  improveCurrentResume: () => Promise<Resume>;
  updateResumeAnalysis: (resumeId: string, analysisData: Partial<Resume>) => Promise<Resume>;
  fetchResumes: () => Promise<void>;
  updateImprovedContent: (resumeId: string, content: string) => Promise<boolean>;
  deleteResume: (resumeId: string) => Promise<void>;
}

interface ResumeProviderProps {
  children: ReactNode;
}

// ============================================
// CONTEXT
// ============================================

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

export const useResume = (): ResumeContextType => {
  const context = useContext(ResumeContext);
  if (!context) {
    throw new Error('useResume must be used within a ResumeProvider');
  }
  return context;
};

// ============================================
// PROVIDER
// ============================================

export const ResumeProvider = ({ children }: ResumeProviderProps): JSX.Element => {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentResume, setCurrentResume] = useState<Resume | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController>(new AbortController());
  const [deleting, setDeleting] = useState<boolean>(false);

  const updateResumeAnalysis = useCallback(async (resumeId: string, analysisData: Partial<Resume>): Promise<Resume> => {
    if (abortController.signal.aborted) throw new Error('Operation aborted');
    
    try {
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
      
      const updatedResume = await response.json();

      if (!abortController.signal.aborted) {
        setResumes(prev =>
          prev.map(resume =>
            resume.id === resumeId ? updatedResume : resume
          )
        );
        setCurrentResume(updatedResume);
      }

      return updatedResume;
    } catch (error) {
      if (!abortController.signal.aborted) {
        logger.error('Error updating resume analysis:', error);
      }
      throw error;
    }
  }, [abortController]);

  const fetchResumes = useCallback(async (): Promise<void> => {
    const controller = new AbortController();
    setAbortController(controller);

    try {
      setLoading(true);
      const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/resumes', fetchOptions);
      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }
      const data = await response.json();
      const fetchedResumes = data.resumes || data;
      
      if (!controller.signal.aborted) {
        setResumes(fetchedResumes);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        // Don't log session expiration errors - user will be redirected
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
  }, []);

  const uploadResume = useCallback(async (file: File): Promise<Resume | undefined> => {
    const controller = new AbortController();
    setAbortController(controller);
    
    let initialRecord: Resume | null = null;

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

      if (controller.signal.aborted) return;

      // Upload file to backend API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('title', '');
      
      const uploadOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        body: formData
      });
      
      // Remove Content-Type header to let browser set it with boundary for multipart/form-data
      if (uploadOptions.headers) {
        delete uploadOptions.headers['Content-Type'];
      }
      
      const uploadResponse = await fetchWithAuth('/api/resumes/upload', {
        ...uploadOptions,
        signal: controller.signal
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Failed to upload resume' }));
        throw new Error(errorData.error || 'Failed to upload resume');
      }
      
      initialRecord = await uploadResponse.json();

      setProcessingStep('extract');
      const text = await extractResumeText(file);
      
      if (!text || text.length === 0) {
        throw new Error('Failed to extract text from resume');
      }
      
      if (controller.signal.aborted) return;

      setProcessingStep('analyze');
      
      // Call backend API for analysis (same endpoint used for post-improvement analysis)
      const analysisOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });
      
      const analysisResponse = await fetchWithAuth('/api/resumes/analyze-text', {
        ...analysisOptions,
        signal: controller.signal
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({ error: 'Failed to analyze resume' }));
        const errorMessage = typeof errorData === 'string' 
          ? errorData 
          : (errorData?.error || errorData?.message || JSON.stringify(errorData) || 'Failed to analyze resume');
        throw new Error(errorMessage);
      }
      
      const analysis = await analysisResponse.json();
      
      // Ensure tags and suggestions have default values if not present
      const tags = analysis.tags || { skills: [], industries: [], tools: [], softSkills: [] };
      const suggestions = analysis.suggestions || {};
      
      // Update resume with analysis data via API
      const updateOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'Original Text': text,
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
          'Analysis Date': new Date().toISOString(),
          'CustomerName': user?.CustomerName || undefined
        })
      });
      
      const updateResponse = await fetchWithAuth(`/api/resumes/${initialRecord!.id}`, {
        ...updateOptions,
        signal: controller.signal
      });
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({ error: 'Failed to update resume' }));
        logger.error('[ResumeContext] Update failed:', errorData);
        throw new Error(errorData.error || 'Failed to update resume');
      }
      
      if (controller.signal.aborted) return;

      const updatedRecord = await updateResponse.json();
      const newResume = updatedRecord;
      setResumes(prev => [newResume, ...prev]);
      setCurrentResume(newResume);

      return newResume;
    } catch (error) {
      if (!controller.signal.aborted) {
        // Convert technical error to user-friendly message
        const { message: userFriendlyMessage } = getUserFriendlyMessage(error);
        setProcessingError(userFriendlyMessage);
        logger.error('[ResumeContext] ERROR during upload:', error);
        showCaughtError(error);

        if (initialRecord?.id) {
          // Update resume status to Error via API
          try {
            const errorUpdateOptions = await createAuthOptionsWithCsrf({
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                'Status': 'Error'
              })
            });
            
            await fetchWithAuth(`/api/resumes/${initialRecord.id}`, errorUpdateOptions);
          } catch (updateError) {
            logger.error('[ResumeContext] Failed to update resume status to Error:', updateError);
          }
        }
      }
      throw error;
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setProcessingStep(null);
      }
    }
  }, [user]);

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
        suggestions: currentResume['Key Improvements'] 
          ? JSON.parse(currentResume['Key Improvements']) 
          : {},
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            analysis: currentAnalysis
          })
        });
        response = await fetchWithAuth('/api/resumes/improve', {
          ...authOptions,
          signal: controller.signal
        });
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
      
      // Save improved analysis data
      // Key Improvements = original suggestions (pre-improvement)
      // Improved Key Improvements = suggestions from post-improvement analysis
      const improvedSuggestions = improvedAnalysis?.suggestions || improvedAnalysis?.['Key Improvements'] || {};
      
      // Helper to get score value (handles 0 as valid value)
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
        // Save improved tags from post-improvement analysis
        'Improved Skills': JSON.stringify(improvedAnalysis?.tags?.skills || []),
        'Improved Industries': JSON.stringify(improvedAnalysis?.tags?.industries || []),
        'Improved Tools': JSON.stringify(improvedAnalysis?.tags?.tools || []),
        'Improved Soft Skills': JSON.stringify(improvedAnalysis?.tags?.softSkills || []),
        // Save suggestions from post-improvement analysis
        'Improved Key Improvements': JSON.stringify(improvedSuggestions),
        'Status': 'Improved' as const,
        'Last Improved': new Date().toISOString(),
        'CustomerName': user?.CustomerName || undefined
      };
      
      const updatedResume = await updateResumeAnalysis(currentResume.id, updatePayload);

      return updatedResume;
    } catch (error) {
      logger.error('Error improving resume:', error);
      showCaughtError(error);
      throw error;
    } finally {
      setLoading(false);
      setProcessingStep(null);
    }
  }, [currentResume, updateResumeAnalysis, user]);

  const updateImprovedContent = useCallback(async (resumeId: string, content: string): Promise<boolean> => {
    try {
      const updateOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'Improved Text': content })
      });
      const response = await fetchWithAuth(`/api/resumes/${resumeId}`, updateOptions);
      if (!response.ok) {
        throw new Error('Failed to update improved content');
      }

      setCurrentResume(prev => prev ? {
        ...prev,
        'Improved Text': content
      } : null);

      return true;
    } catch (error) {
      logger.error('Error updating improved content:', error);
      throw error;
    }
  }, []);

  const deleteResume = useCallback(async (resumeId: string): Promise<void> => {
    const controller = new AbortController();
    setAbortController(controller);
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
  }, [currentResume]);

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
    deleteResume
  };

  return (
    <ResumeContext.Provider value={value}>
      {children}
    </ResumeContext.Provider>
  );
};

export default ResumeContext;
