import { ExclamationTriangleIcon, InformationCircleIcon, ShieldCheckIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import { formatDateTime } from '../utils/dateFormatter';

export function getSecurityLevelIcon(level?: string): JSX.Element {
  switch (level) {
    case 'SECURITY':
      return <ShieldCheckIcon className="w-5 h-5 text-red-500" />;
    case 'ERROR':
      return <XCircleIcon className="w-5 h-5 text-red-500" />;
    case 'WARNING':
      return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
    case 'INFO':
      return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
    default:
      return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
  }
}

export function getSecurityLevelColor(level?: string): string {
  switch (level) {
    case 'SECURITY':
    case 'ERROR':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'WARNING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'INFO':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'DEBUG':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

export function formatSecurityTimestamp(timestamp: string): string {
  return formatDateTime(timestamp, true);
}

export function getSecuritySourceBadgeClass(source?: string): string {
  return source === 'security'
    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
}

export function getSecurityStatusCodeClass(statusCode?: number): string {
  if (!statusCode) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }

  if (statusCode >= 500) {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }

  if (statusCode >= 400) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  }

  if (statusCode >= 200) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  }

  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
}

export function getSecurityLoadErrorMessage(status: number, t: TFunction): string {
  if (status === 403) {
    return t('security.accessDenied');
  }

  if (status === 401) {
    return t('security.sessionExpired');
  }

  return t('security.loadError', { defaultValue: 'Unable to load security logs.' });
}
