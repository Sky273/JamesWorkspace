/**
 * Adaptation Card Component
 * TypeScript version
 */

import { ArrowDownTrayIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';

import CardActionButton from '../page/CardActionButton';
import AnimatedCard from '../page/AnimatedCard';
import { formatDateTime } from '../../utils/dateFormatter';
import { getScoreBgColor, getScoreColor, getStatusColor } from './adaptationCard.utils';

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

export default AdaptationCard;
