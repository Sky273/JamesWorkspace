/**
 * Adaptation Card Component
 * TypeScript version
 */

import { ArrowDownTrayIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';

import CardActionButton from '../page/CardActionButton';
import AnimatedCard from '../page/AnimatedCard';
import { formatDateTime } from '../../utils/dateFormatter';

interface Adaptation {
  id: string;
  'Match Score'?: number;
  Status?: string;
  'Created At'?: string;
  [key: string]: unknown;
}

interface AdaptationCardProps {
  adaptation: Adaptation;
  index: number;
  resumeName: string;
  candidateName?: string;
  adaptedTitle?: string;
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
    case 'Completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'Processing':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const AdaptationCard = ({
  adaptation,
  index,
  resumeName,
  candidateName,
  adaptedTitle,
  missionTitle,
  onView,
  onExport,
  onDelete,
  t,
}: AdaptationCardProps): JSX.Element => {
  const createdAt = adaptation['Created At'] ? formatDateTime(adaptation['Created At']) : '-';

  return (
    <AnimatedCard index={index} className="shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreBgColor(adaptation['Match Score'] || 0)}`}>
            <span className={getScoreColor(adaptation['Match Score'] || 0)}>{adaptation['Match Score'] || 0}% Match</span>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(adaptation.Status || '')}`}>
            {t(`adaptations.status.${(adaptation.Status || 'unknown').toLowerCase()}`)}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">{candidateName || resumeName}</h3>

        {adaptedTitle ? <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2 truncate italic">{adaptedTitle}</p> : null}

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 truncate">→ {missionTitle}</p>

        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">{createdAt}</p>

        <div className="flex items-center gap-2">
          <CardActionButton
            icon={EyeIcon}
            label={t('adaptations.actions.view')}
            onClick={() => onView(adaptation)}
            className="flex-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            tone="secondary"
          />
          <CardActionButton icon={ArrowDownTrayIcon} onClick={() => onExport(adaptation)} title={t('adaptations.actions.export')} tone="success" className="bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50" />
          <CardActionButton icon={TrashIcon} onClick={() => onDelete(adaptation.id)} title={t('adaptations.actions.delete')} tone="danger" className="bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50" />
        </div>
      </div>
    </AnimatedCard>
  );
};

export { getScoreColor, getScoreBgColor, getStatusColor };
export default AdaptationCard;
