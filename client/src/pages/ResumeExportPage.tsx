import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DocumentArrowDownIcon, CheckCircleIcon, SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { SkeletonCard } from '../components/ui/Skeleton';
import ExportTab from '../components/ResumeAnalysis/ExportTab';
import ConsentBadge, { ConsentStatus } from '../components/ConsentBadge';
import SendEmailModal from '../components/ResumeAnalysis/SendEmailModal';
import { useResumeExportPage } from './ResumeExportPage.hooks';

const ResumeExportPage = (): JSX.Element => {
  const {
    id,
    currentResume,
    loading,
    error,
    templates,
    selectedTemplate,
    setSelectedTemplate,
    loadingTemplates,
    exportLoading,
    showEmailModal,
    setShowEmailModal,
    selectedFormat,
    setSelectedFormat,
    resumeName,
    hasImprovedText,
    exportSource,
    handleExport,
    generateEmailAttachment,
    t,
  } = useResumeExportPage();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <SkeletonCard className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !currentResume) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-red-500 dark:text-red-400">{error || 'Resume not found'}</p>
          <Link to="/resumes" className="text-blue-500 hover:underline mt-4 inline-block">
            {t('common.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {resumeName}
              </h1>
              {currentResume?.consent_status && (
                <ConsentBadge
                  status={currentResume.consent_status as ConsentStatus}
                  candidateName={currentResume?.candidate_name as string | undefined}
                  candidateEmail={currentResume?.candidate_email as string | undefined}
                  consentTokenExpiresAt={currentResume?.consent_token_expires_at as string | null | undefined}
                  retentionUntil={currentResume?.retention_until as string | null | undefined}
                  compact={true}
                />
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('resume.export.title')}
            </p>
          </div>
        </motion.div>

        <div className="mb-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
            exportSource === 'improved'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}>
            <DocumentArrowDownIcon className="w-5 h-5" />
            <span className="font-medium">
              {exportSource === 'improved'
                ? t('resume.export.exportingImproved', 'Exporting improved CV')
                : t('resume.export.exportingOriginal', 'Exporting original CV')}
            </span>
            {exportSource === 'original' && (
              <Link
                to={`/resumes/${id}/analysis`}
                className="ml-2 text-sm underline hover:no-underline"
              >
                {t('resume.export.improveFirst', 'Improve first?')}
              </Link>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <div className="flex items-center">
            <Link to={`/resumes/${id}/analysis`} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/20">
                <CheckCircleIcon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">
                {t('resume.steps.analysis')}
              </span>
            </Link>

            <div className="w-10 sm:w-16 h-[3px] mx-2 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full" />

            {hasImprovedText ? (
              <Link to={`/resumes/${id}/improve`} className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/20">
                  <CheckCircleIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">
                  {t('resume.steps.improve')}
                </span>
              </Link>
            ) : (
              <Link to={`/resumes/${id}/analysis`} className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-indigo-400 transition-colors">
                  <SparklesIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 transition-colors" />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {t('resume.steps.improve')}
                </span>
              </Link>
            )}

            <div className="w-10 sm:w-16 h-[3px] mx-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-purple-500"
                initial={false}
                animate={{ width: hasImprovedText ? '100%' : '40%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>

            <div className="flex items-center gap-2">
              <motion.div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-600 flex items-center justify-center shadow-md shadow-purple-500/25"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ArrowDownTrayIcon className="w-4 h-4 text-white" />
              </motion.div>
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                {t('resume.steps.export')}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ExportTab
            resume={currentResume}
            templates={templates}
            selectedTemplate={selectedTemplate}
            onTemplateChange={setSelectedTemplate}
            loadingTemplates={loadingTemplates}
            exportLoading={exportLoading}
            onExport={handleExport}
            onSendEmail={() => setShowEmailModal(true)}
            selectedFormat={selectedFormat}
            onFormatChange={setSelectedFormat}
          />
        </div>
      </div>

      {showEmailModal && (
        <SendEmailModal
          isOpen={showEmailModal}
          resumeId={currentResume.id}
          resumeName={(currentResume['Name'] as string) || ''}
          resumeTitle={(currentResume['Title'] as string) || ''}
          onClose={() => setShowEmailModal(false)}
          attachmentFormat={selectedFormat}
          onGenerateAttachment={generateEmailAttachment}
        />
      )}
    </div>
  );
};

export default ResumeExportPage;
