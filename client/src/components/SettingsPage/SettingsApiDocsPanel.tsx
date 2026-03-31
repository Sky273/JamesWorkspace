import { DocumentTextIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

interface SettingsApiDocsPanelProps {
  t: TFunction;
}

export default function SettingsApiDocsPanel({ t }: SettingsApiDocsPanelProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {t('settings.apiDocs.title')}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.apiDocs.description')}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.apiDocs.swaggerUi')}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.apiDocs.swaggerUiDescription')}
            </p>
          </div>
          <button
            onClick={() => window.open(`/api/docs/ui?v=${Date.now()}`, '_blank')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
          >
            <DocumentTextIcon className="w-5 h-5 mr-2" />
            {t('settings.apiDocs.openSwagger')}
          </button>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.apiDocs.openApiJson')}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.apiDocs.openApiJsonDescription')}
            </p>
          </div>
          <button
            onClick={() => window.open(`/api/docs?v=${Date.now()}`, '_blank')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 font-medium text-sm"
          >
            {t('settings.apiDocs.viewJson')}
          </button>
        </div>
      </div>
    </div>
  );
}
