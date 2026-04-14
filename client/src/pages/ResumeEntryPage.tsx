import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { resumeService } from '../utils/resumeService';
import type { Resume } from '../types/entities';
import { resolveResumeForPage } from './resumeLoader';
import logger from '../utils/logger.frontend';

function hasImprovedContent(resume: Resume | null): boolean {
  if (!resume) {
    return false;
  }

  const improvedText = resume['Improved Text'] ?? resume.improvedText ?? resume.improved_text;
  return typeof improvedText === 'string' && improvedText.trim().length > 0;
}

export default function ResumeEntryPage(): JSX.Element | null {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { currentResume, resumes, setCurrentResume } = useResume();
  const [targetPath, setTargetPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolveTarget = async () => {
      try {
        const resolvedResume = await resolveResumeForPage({
          id,
          currentResume: currentResume?.id === id ? currentResume : null,
          resumes,
          fetchResume: async (resumeId) => await resumeService.getResume(resumeId) as Resume | null,
          preferFresh: true,
        });

        if (!active) {
          return;
        }

        if (resolvedResume.kind === 'missing-id' || resolvedResume.kind === 'not-found') {
          setTargetPath('/resumes');
          return;
        }

        const resume = resolvedResume.resume;
        if (resolvedResume.kind !== 'current') {
          setCurrentResume(resume);
        }

        setTargetPath(`/resumes/${resume.id}/${hasImprovedContent(resume) ? 'improve' : 'analysis'}`);
      } catch (error) {
        logger.error('[ResumeEntryPage] Failed to resolve resume entry route', error);
        if (active) {
          setTargetPath('/resumes');
        }
      }
    };

    void resolveTarget();

    return () => {
      active = false;
    };
  }, [currentResume, id, resumes, setCurrentResume]);

  if (!targetPath) {
    return null;
  }

  return <Navigate to={targetPath} replace state={location.state} />;
}
