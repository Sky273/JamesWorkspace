export const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

export const getScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

export const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|[;,]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(item => String(item ?? '').trim())
      .filter(Boolean);
  }

  return [];
};
