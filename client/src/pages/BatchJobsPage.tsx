import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import JobsTab from '../components/BatchUpload/JobsTab';
import PageHeader from '../components/page/PageHeader';

const BatchJobsPage = (): JSX.Element => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="cv-surface mx-auto max-w-6xl rounded-[2.5rem] p-6 sm:p-8"
    >
      <PageHeader
        title={t('batchJobs.title', 'Jobs de traitement')}
        subtitle={t('batchJobs.subtitle', 'Suivez les imports, améliorations et exports lancés en arrière-plan.')}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="cv-panel rounded-[2rem] p-4 sm:p-6"
      >
        <JobsTab />
      </motion.div>
    </motion.div>
  );
};

export default BatchJobsPage;
