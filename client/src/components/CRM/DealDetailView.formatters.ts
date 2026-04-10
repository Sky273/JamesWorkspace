import i18n from '../../i18n';
import { formatDate } from '../../utils/dateFormatter';

export function formatDealDate(value?: string): string {
  if (!value) {
    return '';
  }

  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
  return formatDate(value, 'long', locale) || '';
}

export function formatBudget(min?: number, max?: number): string | null {
  if (min == null && max == null) {
    return null;
  }

  const formatter = new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  if (min != null && max != null) {
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  }

  return formatter.format(min ?? max ?? 0);
}

export function getResumeStatusBadgeClass(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'improved':
      return 'cv-status-pill cv-status-success';
    case 'analyzed':
      return 'cv-status-pill cv-status-primary';
    case 'processing':
    case 'pending':
      return 'cv-status-pill cv-status-warning';
    case 'error':
    case 'failed':
      return 'cv-status-pill cv-status-danger';
    default:
      return 'cv-status-pill cv-status-neutral';
  }
}
