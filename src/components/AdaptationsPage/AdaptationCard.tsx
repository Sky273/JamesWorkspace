/**
 * Adaptation Card Component
 * TypeScript version
 */

import { motion } from 'framer-motion';
import { 
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { formatDateTime } from '../../utils/dateFormatter';

interface Adaptation {
  id: string;
  'Match Score'?: number;
  'Status'?: string;
  'Created At'?: string;
  [key: string]: unknown;
}

interface AdaptationCardProps {
  adaptation: Adaptation;
  index: number;
  resumeName: string;
  missionTitle: string;
  onView: (adaptation: Adaptation) => void;
  onExport: (adaptation: Adaptation) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-700 dark:text-green-400';
  if (score >= 60) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
};

const getScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'Processing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const AdaptationCard = ({ 
  adaptation, 
  index, 
  resumeName, 
  missionTitle, 
  onView, 
  onExport, 
  onDelete, 
  t 
}: AdaptationCardProps): JSX.Element => {
  const createdAt = adaptation['Created At'] 
    ? formatDateTime(adaptation['Created At'])
    : '-';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreBgColor(adaptation['Match Score'] || 0)}`}>
            <span className={getScoreColor(adaptation['Match Score'] || 0)}>
              {adaptation['Match Score'] || 0}% Match
            </span>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(adaptation['Status'] || '')}`}>
            {t(`adaptations.status.${(adaptation['Status'] || 'unknown').toLowerCase()}`)}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 truncate">
          {resumeName}
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 truncate">
          → {missionTitle}
        </p>

        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
          {createdAt}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(adaptation)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <EyeIcon className="w-4 h-4" />
            <span className="text-sm">{t('adaptations.actions.view')}</span>
          </button>
          <button
            onClick={() => onExport(adaptation)}
            className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            title={t('adaptations.actions.export')}
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(adaptation.id)}
            className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            title={t('adaptations.actions.delete')}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export { getScoreColor, getScoreBgColor, getStatusColor };
export default AdaptationCard;
