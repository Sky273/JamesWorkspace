import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import FileUpload from '../components/FileUpload';
import { useUploadPageFlow } from './UploadPage.hooks';

const UploadPage = (): JSX.Element => {
  const { t } = useTranslation();

  useUploadPageFlow();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-8 rounded-full bg-primary-500" />
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              {t('upload.title')}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
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
