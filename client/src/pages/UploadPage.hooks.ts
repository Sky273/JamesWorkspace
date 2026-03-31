import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';

export function useUploadPageFlow() {
  const { currentResume, setCurrentResume } = useResume();
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadState, setUploadState] = useState<'resetting' | 'ready'>('resetting');
  const entryResumeIdRef = useRef<string | null>(null);

  useEffect(() => {
    entryResumeIdRef.current = currentResume?.id || null;
    setUploadState('resetting');
    setCurrentResume(null);
  }, [location.key, setCurrentResume]);

  useEffect(() => {
    if (uploadState === 'resetting' && currentResume === null) {
      setUploadState('ready');
    }
  }, [currentResume, uploadState]);

  useEffect(() => {
    if (uploadState === 'ready' && currentResume?.id && currentResume.id !== entryResumeIdRef.current) {
      navigate(`/resumes/${currentResume.id}/analysis`);
    }
  }, [currentResume, navigate, uploadState]);
}
