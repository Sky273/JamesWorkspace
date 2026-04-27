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
      className="cv-surface app-page-shell mx-auto min-h-[70vh] max-w-6xl"
    >
      <PageHeader
        title={t('batchJobs.title', 'Jobs de traitement')}
        subtitle={t('batchJobs.subtitle', 'Suivez les imports, améliorations et exports lancés en arrière-plan.')}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="section-shell min-h-[52rem] rounded-[13px] p-4 sm:p-5"
      >
        <JobsTab />
      </motion.div>
    </motion.div>
  );
};

export default BatchJobsPage;
