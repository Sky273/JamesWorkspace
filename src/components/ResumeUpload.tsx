/**
 * Resume Upload Component
 * TypeScript version
 */

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { useResume } from '../context/ResumeContext';
import ProcessingScreen from './ProcessingScreen';

const ResumeUpload = (): JSX.Element => {
  const { uploadResume } = useResume();
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]): Promise<void> => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setError(null);
      setCurrentStep('upload');
      await uploadResume(file);
      setCurrentStep('complete');
    } catch (err) {
      setError((err as Error).message || 'Failed to process resume');
      setCurrentStep(null);
    }
  }, [uploadResume]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    multiple: false
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div {...getRootProps()} className={`relative p-12 border-2 border-dashed rounded-xl ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'} transition-colors duration-200 cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20`}>
        <input {...getInputProps()} />
        <AnimatePresence mode="wait">
          {currentStep ? (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="text-center">
              <ProcessingScreen currentStep={currentStep} />
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="text-center">
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{isDragActive ? "Drop your resume here..." : "Drag and drop your resume, or click to browse"}</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Supports PDF, DOC, and DOCX files</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </motion.div>
      )}
    </div>
  );
};

export default ResumeUpload;
