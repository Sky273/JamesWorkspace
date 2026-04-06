import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import FileUpload from '../components/FileUpload';
import PageHeader from '../components/page/PageHeader';
import { useUploadPageFlow } from './UploadPage.hooks';

const UploadPage = (): JSX.Element => {
  const { t } = useTranslation();

  useUploadPageFlow();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8"
    >
      <PageHeader title={t('upload.title')} subtitle={t('upload.subtitle')} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="cv-panel rounded-[2rem] p-4 sm:p-6"
      >
        <FileUpload />
      </motion.div>
    </motion.div>
  );
};

export default UploadPage;
