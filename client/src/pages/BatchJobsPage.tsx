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
      className="mx-auto min-h-[70vh] max-w-6xl rounded-[2.5rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_right,rgba(111,118,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(113,89,255,0.08),transparent_24%),linear-gradient(180deg,#f8f7ff,#eef4ff)] p-6 shadow-[0_20px_40px_rgba(45,62,110,0.12)] sm:p-8 dark:border-white/8 dark:bg-[radial-gradient(circle_at_top_right,rgba(163,166,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(193,128,255,0.12),transparent_24%),linear-gradient(180deg,rgba(9,19,40,0.96),rgba(6,14,32,0.98))] dark:shadow-[0_20px_40px_rgba(1,6,16,0.24)]"
    >
      <PageHeader
        title={t('batchJobs.title', 'Jobs de traitement')}
        subtitle={t('batchJobs.subtitle', 'Suivez les imports, améliorations et exports lancés en arrière-plan.')}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="min-h-[52rem] rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,248,255,0.98))] p-4 shadow-[0_20px_40px_rgba(45,62,110,0.12)] sm:p-6 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(15,25,48,0.94),rgba(9,19,40,0.98))] dark:shadow-[0_20px_40px_rgba(1,6,16,0.24)]"
      >
        <JobsTab />
      </motion.div>
    </motion.div>
  );
};

export default BatchJobsPage;
