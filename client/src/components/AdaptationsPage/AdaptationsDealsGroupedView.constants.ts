export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  won: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnée',
  lost: 'Perdue',
  on_hold: 'En attente',
};

export const PRIORITY_ICONS: Record<string, { icon: string; color: string }> = {
  low: { icon: '○', color: 'text-gray-400' },
  medium: { icon: '●', color: 'text-blue-500' },
  high: { icon: '●●', color: 'text-orange-500' },
  urgent: { icon: '●●●', color: 'text-red-500' },
};

export const MISSION_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const INITIAL_ADAPTATIONS_LIMIT = 6;

export const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-700 dark:text-green-400';
  if (score >= 60) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
};

export const getScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};
