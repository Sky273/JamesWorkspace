import { PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import type { PipelineTabTranslateFn } from './types';

interface PipelineTabHeaderProps {
  hasEntries: boolean;
  onAdd: () => void;
  t: PipelineTabTranslateFn;
}

export default function PipelineTabHeader({ hasEntries, onAdd, t }: PipelineTabHeaderProps): JSX.Element {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('pipeline.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('pipeline.description')}</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          {t('pipeline.addToProcess')}
        </button>
      </div>

      {!hasEntries && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <UserGroupIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t('pipeline.noEntries')}</p>
          <button onClick={onAdd} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
            {t('pipeline.addFirst')}
          </button>
        </div>
      )}
    </>
  );
}
