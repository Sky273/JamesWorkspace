/**
 * JobsTab Component
 * Displays and manages batch processing jobs
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  DocumentMagnifyingGlassIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  UserIcon,
  PaperAirplaneIcon,
  ChartBarIcon,
  GlobeAltIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';

interface JobItem {
  id: string;
  file_name: string;
  relative_path?: string;
  status: 'pending' | 'processing' | 'pending_name' | 'success' | 'error' | 'skipped';
  progress: number;
  error_message?: string;
  resume_id?: string;
  adaptation_id?: string;
  original_name?: string;
  display_name?: string;
  pending_data?: {
    analysis?: Record<string, unknown>;
    text?: string;
    improve?: boolean;
    progressDetails?: {
      progress?: number;
      stage?: string;
      stageLabel?: string;
      totalResumes?: number;
      profilesSentToLlm?: number;
      profileCount?: number;
      overallScore?: number | null;
    };
  };
}

interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  job_type: 'import' | 'improve' | 'adapt' | 'match' | 'profile-search' | 'profile-analysis' | 'deal-export' | 'collect-trends' | 'collect-facts' | 'collect-metiers';
  options: {
    improve?: boolean;
    export?: boolean;
    exportFormat?: string;
    exportFormats?: string[];
    templateId?: string;
    dealId?: string;
    dealTitle?: string;
  };
  total_items: number;
  processed_items: number;
  success_count: number;
  error_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  user_name?: string;
  firm_name?: string;
  items?: JobItem[];
  export_file_path?: string;
  export_file_name?: string;
  export_file_available?: boolean;
}

const JobsTab = (): JSX.Element => {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshEnabled, _setAutoRefreshEnabled] = useState(true);
  const [pendingNameInputs, setPendingNameInputs] = useState<Record<string, string>>({});
  const [submittingName, setSubmittingName] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/batch-jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
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
        setJobs(prev => prev.map(j => j.id === jobId ? data : j));
      }
    } catch (error) {
      logger.error('Error fetching job details:', error);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh for active jobs - faster refresh rate (2 seconds)
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    
    const hasActiveJobs = jobs.some(j => j.status === 'pending' || j.status === 'processing');
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchJobs();
      // Also refresh expanded job details
      if (expandedJobId) {
        fetchJobDetails(expandedJobId);
      }
    }, 2000); // Refresh every 2 seconds for active jobs

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, jobs, expandedJobId, fetchJobs, fetchJobDetails]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleToggleExpand = (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
      fetchJobDetails(jobId);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'POST' });
      const response = await fetchWithAuth(`/api/batch-jobs/${jobId}/cancel`, options);
      
      if (response.ok) {
        toast.success(t('batchJobs.jobCancelled', 'Job annulÃ©'));
        fetchJobs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de l\'annulation');
      }
    } catch (error) {
      logger.error('Error cancelling job:', error);
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'DELETE' });
      const response = await fetchWithAuth(`/api/batch-jobs/${jobId}`, options);
      
      if (response.ok) {
        toast.success(t('batchJobs.jobDeleted', 'Job supprimÃ©'));
        setJobs(prev => prev.filter(j => j.id !== jobId));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      logger.error('Error deleting job:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDownloadExport = async (jobId: string, fileName: string) => {
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
        toast.success(t('batchJobs.downloadStarted', 'TÃ©lÃ©chargement dÃ©marrÃ©'));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du tÃ©lÃ©chargement');
      }
    } catch (error) {
      logger.error('Error downloading export:', error);
      toast.error('Erreur lors du tÃ©lÃ©chargement');
    }
  };

  const handleProvideName = async (itemId: string) => {
    const name = pendingNameInputs[itemId]?.trim();
    if (!name) {
      toast.error(t('batchJobs.nameRequired', 'Veuillez saisir le nom du candidat'));
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
        toast.success(t('batchJobs.nameProvided', 'Nom fourni, traitement en cours...'));
        setPendingNameInputs(prev => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
        // Refresh job details
        if (expandedJobId) {
          fetchJobDetails(expandedJobId);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la soumission du nom');
      }
    } catch (error) {
      logger.error('Error providing name:', error);
      toast.error('Erreur lors de la soumission du nom');
    } finally {
      setSubmittingName(null);
    }
  };

  const getStatusIcon = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <XCircleIcon className="w-5 h-5 text-gray-500" />;
      case 'processing':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getProgressPercentage = (job: Job) => {
    if (job.total_items === 0) return 0;
    return Math.round((job.processed_items / job.total_items) * 100);
  };

  const getEstimatedTimeRemaining = (job: Job) => {
    if (job.status !== 'processing' || !job.started_at || job.processed_items === 0) return null;
    
    const startTime = new Date(job.started_at).getTime();
    const now = Date.now();
    const elapsed = now - startTime;
    const itemsRemaining = job.total_items - job.processed_items;
    const timePerItem = elapsed / job.processed_items;
    const estimatedRemaining = timePerItem * itemsRemaining;
    
    if (estimatedRemaining < 60000) {
      return `~${Math.round(estimatedRemaining / 1000)}s`;
    } else {
      return `~${Math.round(estimatedRemaining / 60000)}min`;
    }
  };

  const getStatusText = (status: Job['status']) => {
    switch (status) {
      case 'pending': return t('batchJobs.status.pending', 'En attente');
      case 'processing': return t('batchJobs.status.processing', 'En cours');
      case 'completed': return t('batchJobs.status.completed', 'TerminÃ©');
      case 'failed': return t('batchJobs.status.failed', 'Ã‰chouÃ©');
      case 'cancelled': return t('batchJobs.status.cancelled', 'AnnulÃ©');
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isCollectionJob = (jobType: Job['job_type']) => {
    return ['collect-trends', 'collect-facts', 'collect-metiers'].includes(jobType);
  };

  const getJobTypeIcon = (jobType: Job['job_type']) => {
    if (jobType === 'improve') {
      return <SparklesIcon className="w-4 h-4 text-yellow-500" />;
    }
    if (jobType === 'adapt') {
      return <BriefcaseIcon className="w-4 h-4 text-indigo-500" />;
    }
    if (jobType === 'match') {
      return <DocumentMagnifyingGlassIcon className="w-4 h-4 text-sky-500" />;
    }
    if (jobType === 'profile-search') {
      return <MagnifyingGlassIcon className="w-4 h-4 text-cyan-500" />;
    }
    if (jobType === 'profile-analysis') {
      return <DocumentMagnifyingGlassIcon className="w-4 h-4 text-emerald-500" />;
    }
    if (jobType === 'deal-export') {
      return <ArrowDownTrayIcon className="w-4 h-4 text-purple-500" />;
    }
    if (jobType === 'collect-trends') {
      return <ChartBarIcon className="w-4 h-4 text-teal-500" />;
    }
    if (jobType === 'collect-facts') {
      return <GlobeAltIcon className="w-4 h-4 text-emerald-500" />;
    }
    if (jobType === 'collect-metiers') {
      return <BriefcaseIcon className="w-4 h-4 text-orange-500" />;
    }
    return <DocumentTextIcon className="w-4 h-4 text-blue-500" />;
  };

  const getJobTypeText = (job: Job) => {
    if (job.job_type === 'improve') {
      return t('batchJobs.type.improve', 'AmÃ©lioration');
    }
    if (job.job_type === 'adapt') {
      return t('batchJobs.type.adapt', 'Adaptation');
    }
    if (job.job_type === 'match') {
      return t('batchJobs.type.match', 'Analyse de match');
    }
    if (job.job_type === 'profile-search') {
      return t('batchJobs.type.profileSearch', 'Recherche de profils');
    }
    if (job.job_type === 'profile-analysis') {
      return t('batchJobs.type.profileAnalysis', 'Analyse détaillée de profil');
    }
    if (job.job_type === 'deal-export') {
      const options = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
      const dealTitle = options?.dealTitle || '';
      return dealTitle
        ? t('batchJobs.type.dealExportNamed', 'Export affaire : {{title}}', { title: dealTitle })
        : t('batchJobs.type.dealExport', 'Export affaire');
    }
    if (job.job_type === 'collect-trends') {
      return t('batchJobs.type.collectTrends', 'Collecte tendances marchÃ©');
    }
    if (job.job_type === 'collect-facts') {
      const options = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
      const source = options?.source || 'all';
      return source === 'all'
        ? t('batchJobs.type.collectFacts', 'Collecte offres d\'emploi')
        : t('batchJobs.type.collectFactsSource', 'Collecte offres ({{source}})', { source });
    }
    if (job.job_type === 'collect-metiers') {
      return t('batchJobs.type.collectMetiers', 'Collecte mÃ©tiers & compÃ©tences');
    }
    const options = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
    if (options?.improve) {
      return t('batchJobs.type.importImprove', 'Import + AmÃ©lioration');
    }
    return t('batchJobs.type.import', 'Import');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('batchJobs.title', 'Jobs de traitement')}
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('batchJobs.refresh', 'Actualiser')}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">{t('batchJobs.serverInfo.title', 'Traitement en arriÃ¨re-plan')}</p>
          <p className="mt-1 text-blue-600 dark:text-blue-400">
            {t('batchJobs.serverInfo.description', 'Les jobs sont traitÃ©s sur le serveur. Vous pouvez naviguer librement dans l\'application sans interrompre le traitement.')}
          </p>
        </div>
      </div>

      {/* Jobs list */}
      {jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <ClockIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('batchJobs.noJobs', 'Aucun job de traitement')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Job header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => handleToggleExpand(job.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        {getJobTypeIcon(job.job_type)}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {getJobTypeText(job)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadgeClass(job.status)}`}>
                          {getStatusText(job.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(job.created_at)}
                        {job.user_name && ` â€¢ ${job.user_name}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress */}
                    <div className="text-right min-w-[80px]">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {job.processed_items} / {job.total_items}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {job.success_count} âœ“ {job.error_count > 0 && `â€¢ ${job.error_count} âœ—`}
                      </div>
                    </div>

                    {/* Progress bar with percentage */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <motion.div 
                          className={`h-full ${
                            job.status === 'failed' ? 'bg-red-500' :
                            job.status === 'completed' ? 'bg-green-500' :
                            'bg-gradient-to-r from-indigo-500 to-purple-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${getProgressPercentage(job)}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                        {job.status === 'processing' && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-semibold ${
                          job.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                          job.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                          'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {getProgressPercentage(job)}%
                        </span>
                        {getEstimatedTimeRemaining(job) && (
                          <span className="text-gray-500 dark:text-gray-400">
                            {getEstimatedTimeRemaining(job)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Download button for completed jobs with export */}
                      {job.status === 'completed' && job.export_file_available && job.export_file_name && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadExport(job.id, job.export_file_name!); }}
                          className="p-1.5 text-green-500 hover:text-green-600 transition-colors"
                          title={t('batchJobs.download', 'TÃ©lÃ©charger l\'export')}
                        >
                          <ArrowDownTrayIcon className="w-5 h-5" />
                        </button>
                      )}
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelJob(job.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title={t('batchJobs.cancel', 'Annuler')}
                        >
                          <XCircleIcon className="w-5 h-5" />
                        </button>
                      )}
                      {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title={t('batchJobs.delete', 'Supprimer')}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                      {expandedJobId === job.id ? (
                        <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Job details (expanded) */}
              <AnimatePresence>
                {expandedJobId === job.id && isCollectionJob(job.job_type) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                          <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.processed', 'TraitÃ©s')}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{job.processed_items}</span>
                        </div>
                        <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                          <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.success', 'SuccÃ¨s')}</span>
                          <span className="font-medium text-green-600 dark:text-green-400">{job.success_count}</span>
                        </div>
                        <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                          <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.errors', 'Erreurs')}</span>
                          <span className={`font-medium ${job.error_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{job.error_count}</span>
                        </div>
                        {job.started_at && (
                          <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.startedAt', 'DÃ©marrÃ©')}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(job.started_at)}</span>
                          </div>
                        )}
                      </div>
                      {job.error_message && (
                        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                          {job.error_message}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                {expandedJobId === job.id && !isCollectionJob(job.job_type) && job.items && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 max-h-64 overflow-y-auto">
                      {job.items.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t('batchJobs.noItems', 'Aucun Ã©lÃ©ment')}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {job.items.map(item => (
                            <div 
                              key={item.id}
                              className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {item.status === 'success' && <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                {item.status === 'error' && <ExclamationCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                {item.status === 'processing' && <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                                {item.status === 'pending' && <ClockIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                                {item.status === 'pending_name' && <UserIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                                {item.status === 'skipped' && <XCircleIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={item.file_name}>
                                    {item.file_name}
                                  </span>
                                  {item.relative_path && (
                                    <span
                                      className="text-xs text-gray-500 dark:text-gray-400 truncate"
                                      title={item.relative_path}
                                    >
                                      {item.relative_path}
                                    </span>
                                  )}
                                  {job.job_type === 'deal-export' && !item.relative_path && item.original_name && (
                                    <span
                                      className="text-xs text-gray-500 dark:text-gray-400 truncate"
                                      title={item.original_name}
                                    >
                                      {item.original_name}
                                    </span>
                                  )}
                                  {job.job_type !== 'deal-export' && item.original_name && !item.display_name && (
                                    <span
                                      className="text-xs text-gray-500 dark:text-gray-400 truncate"
                                      title={item.original_name}
                                    >
                                      {item.original_name}
                                    </span>
                                  )}
                                  {job.job_type !== 'deal-export' && item.original_name && item.display_name && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {item.original_name} â†’ <span className="font-medium text-indigo-600 dark:text-indigo-400">{item.display_name}</span>
                                    </span>
                                  )}
                                  {item.status === 'processing' && item.pending_data?.progressDetails?.stageLabel && (
                                    <span className="text-xs text-cyan-600 dark:text-cyan-400 truncate">
                                      {item.pending_data.progressDetails.stageLabel}
                                      {typeof item.pending_data.progressDetails.totalResumes === 'number' && ` � ${item.pending_data.progressDetails.totalResumes} CV`}
                                      {typeof item.pending_data.progressDetails.profilesSentToLlm === 'number' && ` � ${item.pending_data.progressDetails.profilesSentToLlm} scor�s IA`}
                                      {typeof item.pending_data.progressDetails.profileCount === 'number' && ` � ${item.pending_data.progressDetails.profileCount} r�sultats`}
                                      {typeof item.pending_data.progressDetails.overallScore === 'number' && ` � score ${item.pending_data.progressDetails.overallScore}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {item.status === 'processing' && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                      <motion.div 
                                        className="h-full bg-blue-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.progress}%` }}
                                        transition={{ duration: 0.3 }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 min-w-[32px]">
                                      {item.progress}%
                                    </span>
                                  </div>
                                )}
                                {item.status !== 'pending_name' && item.error_message && (
                                  <span className="text-xs text-red-500 truncate max-w-xs" title={item.error_message}>
                                    {item.error_message}
                                  </span>
                                )}
                              </div>
                              {/* Name input for pending_name items */}
                              {item.status === 'pending_name' && (
                                <div className="flex items-center gap-2 ml-2">
                                  <input
                                    type="text"
                                    value={pendingNameInputs[item.id] || ''}
                                    onChange={(e) => setPendingNameInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleProvideName(item.id)}
                                    placeholder={t('batchJobs.enterCandidateName', 'Nom du candidat...')}
                                    className="w-40 px-2 py-1 text-sm border border-orange-300 dark:border-orange-600 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                                    disabled={submittingName === item.id}
                                  />
                                  <button
                                    onClick={() => handleProvideName(item.id)}
                                    disabled={submittingName === item.id || !pendingNameInputs[item.id]?.trim()}
                                    className="p-1.5 text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded transition-colors"
                                    title={t('batchJobs.submitName', 'Valider le nom')}
                                  >
                                    {submittingName === item.id ? (
                                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <PaperAirplaneIcon className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobsTab;
