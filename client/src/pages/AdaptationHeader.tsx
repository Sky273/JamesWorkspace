/**
 * AdaptationHeader - Candidate name, adapted title editing, metadata row
 * Extracted from AdaptationViewPage.tsx
 */

import { useTranslation } from 'react-i18next';
import {
  DocumentTextIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChartBarIcon,
  UserIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Adaptation {
  id: string;
  'Candidate Name'?: string;
  'Resume Name'?: string;
  ResumeName?: string;
  'Adapted Title'?: string;
  'Mission Title'?: string;
  'Created At'?: string;
  Status?: string;
  'Match Score'?: number;
  Resume?: string[];
  Mission?: string[];
  [key: string]: unknown;
}

interface AdaptationHeaderProps {
  adaptation: Adaptation;
  editingTitle: boolean;
  editedTitle: string;
  savingTitle: boolean;
  onEditedTitleChange: (value: string) => void;
  onStartEditTitle: () => void;
  onSaveTitle: () => void;
  onCancelEditTitle: () => void;
  onViewResume: () => void;
  onViewMission: () => void;
  formatAdaptationDate: (dateStr?: string) => string;
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'Processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'Failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getScoreColor = (score?: number) => {
  if (!score) return 'text-gray-500';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

export default function AdaptationHeader({
  adaptation,
  editingTitle,
  editedTitle,
  savingTitle,
  onEditedTitleChange,
  onStartEditTitle,
  onSaveTitle,
  onCancelEditTitle,
  onViewResume,
  onViewMission,
  formatAdaptationDate
}: AdaptationHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Candidate name */}
          <div className="flex items-center gap-2 mb-1">
            <UserIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {adaptation['Candidate Name'] || adaptation['Resume Name'] || adaptation.ResumeName || t('adaptations.card.noName')}
            </h1>
          </div>

          {/* Adapted professional title - editable */}
          <div className="flex items-center gap-2 ml-7 mb-3">
            {editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => onEditedTitleChange(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-base font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder={t('adaptations.adaptedTitlePlaceholder', 'Titre professionnel adapté...')}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveTitle();
                    if (e.key === 'Escape') onCancelEditTitle();
                  }}
                />
                <button
                  onClick={onSaveTitle}
                  disabled={savingTitle}
                  className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                  title={t('common.save')}
                >
                  <CheckIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={onCancelEditTitle}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title={t('common.cancel')}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span className="text-base font-medium text-gray-600 dark:text-gray-300 italic">
                  {adaptation['Adapted Title'] || t('adaptations.noAdaptedTitle', 'Aucun titre adapté')}
                </span>
                <button
                  onClick={onStartEditTitle}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                  title={t('adaptations.editAdaptedTitle', 'Modifier le titre adapté')}
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Resume info */}
            <button
              onClick={onViewResume}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <DocumentTextIcon className="w-4 h-4" />
              {adaptation['Resume Name'] || adaptation.ResumeName || t('adaptations.card.noName')}
            </button>
            
            {/* Mission info */}
            <button
              onClick={onViewMission}
              className="flex items-center gap-1 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
            >
              <BriefcaseIcon className="w-4 h-4" />
              {adaptation['Mission Title'] || t('adaptations.card.unknownMission')}
            </button>

            {/* Date */}
            {adaptation['Created At'] && (
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <CalendarIcon className="w-4 h-4" />
                {formatAdaptationDate(adaptation['Created At'])}
              </span>
            )}

            {/* Status */}
            {adaptation.Status && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(adaptation.Status)}`}>
                {t(`adaptations.status.${adaptation.Status.toLowerCase()}`, adaptation.Status)}
              </span>
            )}

            {/* Score */}
            {adaptation['Match Score'] !== undefined && (
              <span className={`flex items-center gap-1 font-semibold ${getScoreColor(adaptation['Match Score'])}`}>
                <ChartBarIcon className="w-4 h-4" />
                {adaptation['Match Score']}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
