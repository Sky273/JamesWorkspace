import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import JobsTab from '../components/BatchUpload/JobsTab';

const BatchJobsPage = (): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-8 rounded-full bg-primary-500" />
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              {t('batchJobs.title', 'Jobs de traitement')}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
            {t('batchJobs.subtitle', 'Suivez les imports, améliorations et exports lancés en arrière-plan.')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <JobsTab />
        </motion.div>
      </div>
    </div>
  );
};

export default BatchJobsPage;
