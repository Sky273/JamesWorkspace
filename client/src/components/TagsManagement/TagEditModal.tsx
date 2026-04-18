import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { EditingTag } from './types';

interface TagEditModalProps {
  editingTag: EditingTag | null;
  newTagName: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
  t: (key: string) => string;
}

export default function TagEditModal({
  editingTag,
  newTagName,
  onClose,
  onChange,
  onConfirm,
  t
}: TagEditModalProps): JSX.Element | null {
  if (!editingTag) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('tags.editTag')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('tags.editingIn')} <span className="font-medium">{editingTag.category}</span></p>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tags.tagName')}</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 mb-4"
            value={newTagName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onConfirm()}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn btn-secondary px-4 py-2">{t('tags.cancel')}</button>
            <button onClick={onConfirm} disabled={!newTagName.trim()} className={`app-primary-action px-4 py-2 ${!newTagName.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>{t('tags.save')}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
