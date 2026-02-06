/**
 * UploadPage Component
 * TypeScript version
 */

import { useEffect } from 'react';
import { useResume } from '../context/ResumeContext';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import FileUpload from '../components/FileUpload';
import ResumeAnalysis from '../components/ResumeAnalysis';

const UploadPage = (): JSX.Element => {
  const { currentResume, setCurrentResume } = useResume();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') !== null) {
      setCurrentResume(null);
    }
  }, [location.search, setCurrentResume]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t('upload.title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t('upload.subtitle')}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!currentResume ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <FileUpload />
            </motion.div>
          ) : (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <ResumeAnalysis resume={currentResume} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default UploadPage;
