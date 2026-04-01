import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';

export function useUploadPageFlow() {
  const { currentResume, setCurrentResume } = useResume();
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadState, setUploadState] = useState<'resetting' | 'ready'>('resetting');
  const entryResumeIdRef = useRef<string | null>(null);
  const latestResumeIdRef = useRef<string | null>(currentResume?.id || null);
  const currentResumeId = currentResume?.id || null;

  useEffect(() => {
    latestResumeIdRef.current = currentResumeId;
  }, [currentResumeId]);

  useEffect(() => {
    entryResumeIdRef.current = latestResumeIdRef.current;
    setUploadState('resetting');
    setCurrentResume(null);
  }, [location.key, setCurrentResume]);

  useEffect(() => {
    if (uploadState === 'resetting' && currentResume === null) {
      setUploadState('ready');
    }
  }, [currentResume, uploadState]);

  useEffect(() => {
    if (uploadState === 'ready' && currentResumeId && currentResumeId !== entryResumeIdRef.current) {
      navigate(`/resumes/${currentResumeId}/analysis`);
    }
  }, [currentResumeId, navigate, uploadState]);
}
