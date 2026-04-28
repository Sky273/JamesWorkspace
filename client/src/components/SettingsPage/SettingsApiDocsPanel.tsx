import { DocumentTextIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

interface SettingsApiDocsPanelProps {
  t: TFunction;
}

export default function SettingsApiDocsPanel({ t }: SettingsApiDocsPanelProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {t('settings.apiDocs.title')}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.apiDocs.description')}
        </p>
      </div>

      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.apiDocs.swaggerUi')}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.apiDocs.swaggerUiDescription')}
            </p>
          </div>
          <button
            onClick={() => window.open(`/api/docs/ui?v=${Date.now()}`, '_blank')}
            className="app-primary-action inline-flex items-center rounded-[9px] px-4 py-2 text-sm font-medium"
          >
            <DocumentTextIcon className="w-5 h-5 mr-2" />
            {t('settings.apiDocs.openSwagger')}
          </button>
        </div>
      </div>

      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.apiDocs.openApiJson')}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.apiDocs.openApiJsonDescription')}
            </p>
          </div>
          <button
            onClick={() => window.open(`/api/docs?v=${Date.now()}`, '_blank')}
            className="app-button-secondary inline-flex items-center rounded-[9px] px-4 py-2 text-sm font-medium"
          >
            {t('settings.apiDocs.viewJson')}
          </button>
        </div>
      </div>
    </div>
  );
}
