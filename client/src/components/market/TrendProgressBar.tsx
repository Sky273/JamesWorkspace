import type { ReactNode } from 'react';

export function ProgressBar({ value, color = 'indigo', label }: { value: number; color?: string; label?: ReactNode }) {
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    teal: 'bg-teal-500'
  };

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-500 dark:text-gray-400 w-16 truncate">{label}</span>}
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color] || colorClasses.indigo} rounded-full transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right">{value.toFixed(0)}%</span>
    </div>
  );
}
