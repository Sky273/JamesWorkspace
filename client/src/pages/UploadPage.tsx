import { motion } from 'framer-motion';
import { CheckBadgeIcon, DocumentTextIcon, SparklesIcon } from '@heroicons/react/24/outline';
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
      <section className="section-shell mb-6 rounded-[2rem] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-[var(--cv-primary)]" />
          <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
            {t('upload.guidance.title')}
          </h2>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)]">
          {t('upload.guidance.description')}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--cv-text)]">
              <DocumentTextIcon className="h-4 w-4 text-[var(--cv-primary)]" />
              {t('upload.guidance.step1Title')}
            </div>
            <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
              {t('upload.guidance.step1Body')}
            </p>
          </div>
          <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--cv-text)]">
              <SparklesIcon className="h-4 w-4 text-[var(--cv-primary)]" />
              {t('upload.guidance.step2Title')}
            </div>
            <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
              {t('upload.guidance.step2Body')}
            </p>
          </div>
          <div className="rounded-[1.25rem] bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--cv-text)]">
              <CheckBadgeIcon className="h-4 w-4 text-[var(--cv-primary)]" />
              {t('upload.guidance.step3Title')}
            </div>
            <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
              {t('upload.guidance.step3Body')}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">{t('upload.guidance.formats')}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">{t('upload.guidance.maxSize')}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">{t('upload.guidance.tip')}</span>
        </div>
      </section>
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
