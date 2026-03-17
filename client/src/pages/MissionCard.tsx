/**
 * MissionCard - Individual mission card in the grid
 * Extracted from MissionsPage.tsx
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  PencilSquareIcon,
  TrashIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  EyeIcon,
  UserIcon
} from '@heroicons/react/24/outline';
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
    <motion.div
      key={mission.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow overflow-hidden"
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {mission.Title}
              </h3>
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
            {/* Client/Prospect info */}
            {mission['Client Name'] && (
              <div className="flex items-center gap-1 mt-1">
                <BuildingOfficeIcon className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-purple-600 dark:text-purple-400 font-medium truncate">
                  {mission['Client Name']}
                </span>
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                  mission['Client Type'] === 'prospect' 
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {mission['Client Type'] === 'prospect' ? t('clients.prospect', 'Prospect') : t('clients.client', 'Client')}
                </span>
              </div>
            )}
            {/* Contact info */}
            {mission['Contact Name'] && (
              <div className="flex items-center gap-1 mt-1">
                <UserIcon className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400 truncate">
                  {mission['Contact Name']}
                  {mission['Contact Role'] && <span className="text-gray-400 dark:text-gray-500"> - {mission['Contact Role']}</span>}
                </span>
              </div>
            )}
            {/* Deal info */}
            {mission['Deal Title'] && (
              <div className="flex items-center gap-1 mt-1">
                <BriefcaseIcon className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium truncate">
                  {mission['Deal Title']}
                </span>
              </div>
            )}
            {/* Firm info */}
            <div className="flex items-center gap-1 mt-1">
              <BuildingOfficeIcon className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {mission.Firm || t('missions.noFirm', 'Aucun cabinet')}
              </span>
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
        <button
          onClick={() => navigate(`/missions/${mission.id}`)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <EyeIcon className="w-4 h-4" />
          {t('missions.view')}
        </button>
        <button
          onClick={() => onEdit(mission)}
          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          title={t('common.edit')}
        >
          <PencilSquareIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(mission.id)}
          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          title={t('common.delete')}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
