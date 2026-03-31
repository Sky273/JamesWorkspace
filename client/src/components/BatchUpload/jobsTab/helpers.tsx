import {
  ArrowDownTrayIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { Job, TranslateFn } from './types';

export function getStatusIcon(status: Job['status']): JSX.Element {
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
}

export function getProgressPercentage(job: Job): number {
  if (job.total_items === 0) return 0;
  return Math.round((job.processed_items / job.total_items) * 100);
}

export function getEstimatedTimeRemaining(job: Job): string | null {
  if (job.status !== 'processing' || !job.started_at || job.processed_items === 0) return null;

  const startTime = new Date(job.started_at).getTime();
  const now = Date.now();
  const elapsed = now - startTime;
  const itemsRemaining = job.total_items - job.processed_items;
  const timePerItem = elapsed / job.processed_items;
  const estimatedRemaining = timePerItem * itemsRemaining;

  if (estimatedRemaining < 60000) {
    return `~${Math.round(estimatedRemaining / 1000)}s`;
  }

  return `~${Math.round(estimatedRemaining / 60000)}min`;
}

export function getStatusText(status: Job['status'], t: TranslateFn): string {
  switch (status) {
    case 'pending':
      return t('batchJobs.status.pending');
    case 'processing':
      return t('batchJobs.status.processing');
    case 'completed':
      return t('batchJobs.status.completed');
    case 'failed':
      return t('batchJobs.status.failed');
    case 'cancelled':
      return t('batchJobs.status.cancelled');
    default:
      return status;
  }
}

export function getStatusBadgeClass(status: Job['status']): string {
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
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function isCollectionJob(jobType: Job['job_type']): boolean {
  return ['collect-trends', 'collect-facts', 'collect-metiers'].includes(jobType);
}

export function getJobTypeIcon(jobType: Job['job_type']): JSX.Element {
  if (jobType === 'improve') return <SparklesIcon className="w-4 h-4 text-yellow-500" />;
  if (jobType === 'adapt') return <BriefcaseIcon className="w-4 h-4 text-indigo-500" />;
  if (jobType === 'match') return <DocumentMagnifyingGlassIcon className="w-4 h-4 text-sky-500" />;
  if (jobType === 'profile-search') return <MagnifyingGlassIcon className="w-4 h-4 text-cyan-500" />;
  if (jobType === 'profile-analysis') return <DocumentMagnifyingGlassIcon className="w-4 h-4 text-emerald-500" />;
  if (jobType === 'deal-export') return <ArrowDownTrayIcon className="w-4 h-4 text-purple-500" />;
  if (jobType === 'collect-trends') return <ChartBarIcon className="w-4 h-4 text-teal-500" />;
  if (jobType === 'collect-facts') return <GlobeAltIcon className="w-4 h-4 text-emerald-500" />;
  if (jobType === 'collect-metiers') return <BriefcaseIcon className="w-4 h-4 text-orange-500" />;
  return <DocumentTextIcon className="w-4 h-4 text-blue-500" />;
}

export function getJobTypeText(job: Job, t: TranslateFn): string {
  if (job.job_type === 'improve') return t('batchJobs.type.improve');
  if (job.job_type === 'adapt') return t('batchJobs.type.adapt');
  if (job.job_type === 'match') return t('batchJobs.type.match');
  if (job.job_type === 'profile-search') return t('batchJobs.type.profileSearch');
  if (job.job_type === 'profile-analysis') return t('batchJobs.type.profileAnalysis');
  if (job.job_type === 'deal-export') {
    const dealTitle = job.options?.dealTitle || '';
    return dealTitle ? t('batchJobs.type.dealExportNamed', { title: dealTitle }) : t('batchJobs.type.dealExport');
  }
  if (job.job_type === 'collect-trends') return t('batchJobs.type.collectTrends');
  if (job.job_type === 'collect-facts') {
    const source = job.options?.source || 'all';
    return source === 'all' ? t('batchJobs.type.collectFacts') : t('batchJobs.type.collectFactsSource', { source });
  }
  if (job.job_type === 'collect-metiers') return t('batchJobs.type.collectMetiers');
  if (job.options?.improve) return t('batchJobs.type.importImprove');
  return t('batchJobs.type.import');
}

export function getSummaryText(job: Job): string {
  const successLabel = `${job.success_count} succès`;
  if (job.error_count > 0) {
    return `${successLabel} • ${job.error_count} erreur${job.error_count > 1 ? 's' : ''}`;
  }
  return successLabel;
}

export function getItemRenameText(originalName: string, displayName: string): string {
  return `${originalName} -> ${displayName}`;
}

export function getProcessingDetailsText(jobItem: NonNullable<Job['items']>[number]): string | null {
  const details = jobItem.pending_data?.progressDetails;
  if (!details?.stageLabel) return null;

  const fragments = [details.stageLabel];
  if (typeof details.totalResumes === 'number') fragments.push(`${details.totalResumes} CV`);
  if (typeof details.profilesSentToLlm === 'number') fragments.push(`${details.profilesSentToLlm} scorés IA`);
  if (typeof details.profileCount === 'number') fragments.push(`${details.profileCount} résultats`);
  if (typeof details.overallScore === 'number') fragments.push(`score ${details.overallScore}`);
  return fragments.join(' • ');
}
