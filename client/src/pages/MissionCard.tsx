/**
 * MissionCard - Individual mission card in the grid
 * Extracted from MissionsPage.tsx
 */

import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import CardActionButton from '../components/page/CardActionButton';
import AnimatedCard from '../components/page/AnimatedCard';
import { createSafeHtml } from '../utils/sanitizer.frontend';

export interface MissionItem {
  id: string;
  Title?: string;
  Content?: string;
  Firm?: string;
  'Firm ID'?: string;
  Status?: 'Active' | 'Closed' | 'Draft';
  'Client Name'?: string;
  'Client Type'?: string;
  'Contact Name'?: string;
  'Contact Role'?: string;
  'Deal Title'?: string;
  [key: string]: unknown;
}

interface MissionCardProps {
  mission: MissionItem;
  index: number;
  onEdit: (mission: MissionItem) => void;
  onDelete: (id: string) => void;
}

export default function MissionCard({ mission, index, onEdit, onDelete }: MissionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <AnimatedCard index={index} className="shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{mission.Title}</h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                mission.Status === 'Closed'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : mission.Status === 'Draft'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {t(`missions.status.${mission.Status || 'Active'}`)}
              </span>
            </div>
            {mission['Client Name'] ? (
              <div className="flex items-center gap-1 mt-1">
                <BuildingOfficeIcon className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-purple-600 dark:text-purple-400 font-medium truncate">{mission['Client Name']}</span>
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                  mission['Client Type'] === 'prospect'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {mission['Client Type'] === 'prospect' ? t('clients.prospect', 'Prospect') : t('clients.client', 'Client')}
                </span>
              </div>
            ) : null}
            {mission['Contact Name'] ? (
              <div className="flex items-center gap-1 mt-1">
                <UserIcon className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400 truncate">
                  {mission['Contact Name']}
                  {mission['Contact Role'] ? <span className="text-gray-400 dark:text-gray-500"> - {mission['Contact Role']}</span> : null}
                </span>
              </div>
            ) : null}
            {mission['Deal Title'] ? (
              <div className="flex items-center gap-1 mt-1">
                <BriefcaseIcon className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium truncate">{mission['Deal Title']}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1 mt-1">
              <BuildingOfficeIcon className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400 dark:text-gray-500">{mission.Firm || t('missions.noFirm', 'Aucun cabinet')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {mission.Content ? (
          <div
            className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={createSafeHtml(mission.Content)}
          />
        ) : (
          <p className="text-sm text-gray-400 italic">{t('missions.noDescription')}</p>
        )}
      </div>

      <div className="flex items-center gap-2 p-4 pt-0">
        <CardActionButton
          icon={EyeIcon}
          label={t('missions.view')}
          onClick={() => navigate(`/missions/${mission.id}`)}
          className="flex-1"
          tone="secondary"
        />
        <CardActionButton icon={PencilSquareIcon} onClick={() => onEdit(mission)} title={t('common.edit')} tone="info" />
        <CardActionButton icon={TrashIcon} onClick={() => onDelete(mission.id)} title={t('common.delete')} tone="danger" />
      </div>
    </AnimatedCard>
  );
}
