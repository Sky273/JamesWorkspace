/**
 * MissionPreviewModal - Preview modal for a mission
 * Extracted from MissionsPage.tsx
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { createSafeHtml } from '../utils/sanitizer.frontend';

interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Firm?: string;
  [key: string]: unknown;
}

interface MissionPreviewModalProps {
  mission: Mission;
  onClose: () => void;
  onEdit: (mission: Mission) => void;
}

export default function MissionPreviewModal({ mission, onClose, onEdit }: MissionPreviewModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {mission.Title}
            </h3>
            {mission.Firm && (
              <p className="text-sm text-blue-600 dark:text-blue-400">{mission.Firm}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh]">
          {mission.Content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={createSafeHtml(mission.Content)} />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 italic">{t('missions.noDescription')}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            {t('common.close')}
          </button>
          <button onClick={() => { onEdit(mission); onClose(); }} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            <PencilSquareIcon className="w-4 h-4" />
            {t('common.edit')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
