/**
 * PipelineHistoryModal - Stage change history modal
 * Extracted from PipelineTab.tsx
 */

import { useTranslation } from 'react-i18next';
import type { PipelineHistory, PipelineStage } from '../../services/pipelineService';

interface PipelineHistoryModalProps {
  history: PipelineHistory[];
  stages: PipelineStage[];
  isEnglish: boolean;
  formatDate: (dateStr: string) => string;
  onClose: () => void;
}

export default function PipelineHistoryModal({
  history,
  stages,
  isEnglish,
  formatDate,
  onClose
}: PipelineHistoryModalProps) {
  const { t } = useTranslation();

  const getStageInfo = (stageId: string) => {
    return stages.find(s => s.id === stageId) || { label: stageId, labelEn: stageId, color: '#6B7280' };
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('pipeline.historyTitle')}
        </h3>

        {history.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            {t('pipeline.noHistory')}
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => {
              const fromStage = entry.from_stage ? getStageInfo(entry.from_stage) : null;
              const toStage = getStageInfo(entry.to_stage);

              return (
                <div
                  key={entry.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-sm">
                    {fromStage && (
                      <>
                        <span
                          className="px-2 py-0.5 rounded text-white text-xs"
                          style={{ backgroundColor: fromStage.color }}
                        >
                          {isEnglish ? fromStage.labelEn : fromStage.label}
                        </span>
                        <span className="text-gray-400">→</span>
                      </>
                    )}
                    <span
                      className="px-2 py-0.5 rounded text-white text-xs"
                      style={{ backgroundColor: toStage.color }}
                    >
                      {isEnglish ? toStage.labelEn : toStage.label}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {entry.changed_by_name && <span>{entry.changed_by_name} • </span>}
                    {formatDate(entry.created_at)}
                  </div>
                  {entry.notes && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {entry.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
