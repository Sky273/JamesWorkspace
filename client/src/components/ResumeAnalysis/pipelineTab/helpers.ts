export function formatPipelineDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatRelativePipelineTime(dateStr: string, locale: string, isEnglish: boolean): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return isEnglish ? 'Today' : "Aujourd'hui";
  if (diffDays === 1) return isEnglish ? 'Tomorrow' : 'Demain';
  if (diffDays > 0 && diffDays <= 7) return isEnglish ? `In ${diffDays} days` : `Dans ${diffDays} jours`;
  return formatPipelineDate(dateStr, locale);
}
