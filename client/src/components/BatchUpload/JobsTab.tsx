import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import JobsTabHeader from './jobsTab/JobsTabHeader';
import JobCard from './jobsTab/JobCard';
import type { Job, TranslateFn } from './jobsTab/types';
import {
  loadJobProgressSnapshots,
  persistJobProgressSnapshots,
  syncSingleJobProgressSnapshot,
  syncJobProgressSnapshots,
} from './jobsTab/helpers';
import type { JobProgressSnapshot } from './jobsTab/types';


const JobsTab = (): JSX.Element => {
  const { t } = useTranslation();
  const tr = useCallback<TranslateFn>((key: string, options?: unknown) => {
    return String(t(key, options as never));
  }, [t]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshEnabled] = useState(true);
  const [pendingNameInputs, setPendingNameInputs] = useState<Record<string, string>>({});
  const [submittingName, setSubmittingName] = useState<string | null>(null);
  const [progressSnapshots, setProgressSnapshots] = useState<Record<string, JobProgressSnapshot>>(() => loadJobProgressSnapshots());
  const [now, setNow] = useState(() => Date.now());

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/batch-jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
        setProgressSnapshots((prev) => syncJobProgressSnapshots(prev, data, Date.now()));
      }
    } catch (error) {
      logger.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchJobDetails = useCallback(async (jobId: string) => {
    try {
      const response = await fetchWithAuth(`/api/batch-jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(prev => prev.map(j => (j.id === jobId ? data : j)));
        setProgressSnapshots((prev) => syncSingleJobProgressSnapshot(prev, data, Date.now()));
      }
    } catch (error) {
      logger.error('Error fetching job details:', error);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const hasActiveJobs = jobs.some(j => j.status === 'pending' || j.status === 'processing');
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      void fetchJobs();
      if (expandedJobId) {
        void fetchJobDetails(expandedJobId);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, jobs, expandedJobId, fetchJobs, fetchJobDetails]);

  useEffect(() => {
    persistJobProgressSnapshots(progressSnapshots);
  }, [progressSnapshots]);

  useEffect(() => {
    const hasProcessingJobs = jobs.some((job) => job.status === 'processing');
    if (!hasProcessingJobs) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [jobs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchJobs();
  }, [fetchJobs]);

  const handleToggleExpand = useCallback((jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }

    setExpandedJobId(jobId);
    void fetchJobDetails(jobId);
  }, [expandedJobId, fetchJobDetails]);

  const handleCancelJob = useCallback(async (jobId: string) => {
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'POST' });
      const response = await fetchWithAuth(`/api/batch-jobs/${jobId}/cancel`, options);

      if (response.ok) {
        toast.success(t('batchJobs.jobCancelled'));
        void fetchJobs();
        return;
      }

      const error = await response.json();
      toast.error(error.error || t('batchJobs.cancelError', { defaultValue: "Erreur lors de l'annulation" }));
    } catch (error) {
      logger.error('Error cancelling job:', error);
      toast.error(t('batchJobs.cancelError', { defaultValue: "Erreur lors de l'annulation" }));
    }
  }, [fetchJobs, t]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'DELETE' });
      const response = await fetchWithAuth(`/api/batch-jobs/${jobId}`, options);

      if (response.ok) {
        toast.success(t('batchJobs.jobDeleted'));
        setJobs(prev => prev.filter(j => j.id !== jobId));
        return;
      }

      const error = await response.json();
      toast.error(error.error || t('batchJobs.deleteError', { defaultValue: 'Erreur lors de la suppression' }));
    } catch (error) {
      logger.error('Error deleting job:', error);
      toast.error(t('batchJobs.deleteError', { defaultValue: 'Erreur lors de la suppression' }));
    }
  }, [t]);

  const handleDownloadExport = useCallback(async (jobId: string, fileName: string) => {
    try {
      const response = await fetchWithAuth(`/api/batch-jobs/${jobId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || `export_${jobId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(t('batchJobs.downloadStarted'));
        return;
      }

      const error = await response.json();
      toast.error(error.error || t('batchJobs.downloadError', { defaultValue: 'Erreur lors du téléchargement' }));
    } catch (error) {
      logger.error('Error downloading export:', error);
      toast.error(t('batchJobs.downloadError', { defaultValue: 'Erreur lors du téléchargement' }));
    }
  }, [t]);

  const handlePendingNameChange = useCallback((itemId: string, value: string) => {
    setPendingNameInputs(prev => ({ ...prev, [itemId]: value }));
  }, []);

  const handleProvideName = useCallback(async (itemId: string) => {
    const name = pendingNameInputs[itemId]?.trim();
    if (!name) {
      toast.error(t('batchJobs.nameRequired'));
      return;
    }

    setSubmittingName(itemId);
    try {
      const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const response = await fetchWithAuth(`/api/batch-jobs/items/${itemId}/provide-name`, options);

      if (response.ok) {
        toast.success(t('batchJobs.nameProvided'));
        setPendingNameInputs(prev => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
        if (expandedJobId) {
          void fetchJobDetails(expandedJobId);
        }
        return;
      }

      const error = await response.json();
      toast.error(error.error || t('batchJobs.provideNameError', { defaultValue: 'Erreur lors de la soumission du nom' }));
    } catch (error) {
      logger.error('Error providing name:', error);
      toast.error(t('batchJobs.provideNameError', { defaultValue: 'Erreur lors de la soumission du nom' }));
    } finally {
      setSubmittingName(null);
    }
  }, [expandedJobId, fetchJobDetails, pendingNameInputs, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <JobsTabHeader refreshing={refreshing} onRefresh={handleRefresh} t={tr} />

      {jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <ClockIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('batchJobs.noJobs')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              expanded={expandedJobId === job.id}
              pendingNameInputs={pendingNameInputs}
              progressSnapshot={progressSnapshots[job.id]}
              submittingName={submittingName}
              now={now}
              onToggleExpand={handleToggleExpand}
              onCancelJob={handleCancelJob}
              onDeleteJob={handleDeleteJob}
              onDownloadExport={handleDownloadExport}
              onPendingNameChange={handlePendingNameChange}
              onProvideName={handleProvideName}
              t={tr}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JobsTab;
