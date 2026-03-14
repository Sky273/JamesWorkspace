import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Breadcrumbs from '../components/Breadcrumbs';
import JobsTab from '../components/BatchUpload/JobsTab';

const BatchJobsPage = (): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <Breadcrumbs className="mb-4" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t('batchJobs.title', 'Jobs de traitement')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
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
