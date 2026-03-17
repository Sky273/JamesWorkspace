/**
 * UploadPage Component
 * TypeScript version
 */

import { useEffect, useRef, useState } from 'react';
import { useResume } from '../context/ResumeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import FileUpload from '../components/FileUpload';
import Breadcrumbs from '../components/Breadcrumbs';

const UploadPage = (): JSX.Element => {
  const { currentResume, setCurrentResume } = useResume();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  // Use state to track if we're ready to redirect (after clearing old resume)
  const [readyForUpload, setReadyForUpload] = useState(false);
  const previousResumeIdRef = useRef<string | null>(null);

  // Clear current resume immediately when component mounts or location changes
  useEffect(() => {
    // Store the previous resume ID before clearing
    previousResumeIdRef.current = currentResume?.id || null;
    // Clear the current resume
    setCurrentResume(null);
    // Mark as ready for new upload after a tick
    const timer = setTimeout(() => setReadyForUpload(true), 50);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]); // Re-run when navigation key changes (new navigation to /upload)

  // Redirect to analysis page only when a NEW resume is uploaded (after we're ready)
  useEffect(() => {
    if (readyForUpload && currentResume?.id && currentResume.id !== previousResumeIdRef.current) {
      navigate(`/resumes/${currentResume.id}/analysis`);
    }
  }, [currentResume, navigate, readyForUpload]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <Breadcrumbs className="mb-4" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('upload.title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t('upload.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <FileUpload />
        </motion.div>
      </div>
    </div>
  );
};

export default UploadPage;
