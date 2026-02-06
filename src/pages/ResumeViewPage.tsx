/**
 * ResumeViewPage Component
 * Displays a single resume by ID from URL parameter
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ResumeAnalysis from '../components/ResumeAnalysis';
import { Resume } from '../types/entities';
import { resumeService } from '../utils/resumeService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';

const ResumeViewPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentResume, setCurrentResume, resumes } = useResume();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResume = async () => {
      if (!id) {
        setError('No resume ID provided');
        setLoading(false);
        return;
      }

      // First check if resume is already in context
      const existingResume = resumes.find(r => r.id === id);
      if (existingResume) {
        setCurrentResume(existingResume);
        setLoading(false);
        return;
      }

      // Otherwise fetch from API
      try {
        logger.log('[ResumeViewPage] Fetching resume:', id);
        const resume = await resumeService.getResume(id);
        if (resume) {
          setCurrentResume(resume as Resume);
        } else {
          setError('Resume not found');
        }
      } catch (err) {
        logger.error('[ResumeViewPage] Error fetching resume:', err);
        setError('Failed to load resume');
        toast.error(t('errors.loadResume'));
      } finally {
        setLoading(false);
      }
    };

    loadResume();
  }, [id, resumes, setCurrentResume, t]);

  const handleBack = () => {
    // Go back to previous page or resumes list
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/resumes');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !currentResume) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {t('errors.resumeNotFound')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {error || t('errors.resumeNotFoundDescription')}
              </p>
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                {t('common.back')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            {t('common.back')}
          </button>
        </motion.div>

        {/* Resume content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <ResumeAnalysis resume={currentResume} />
        </motion.div>
      </div>
    </div>
  );
};

export default ResumeViewPage;
