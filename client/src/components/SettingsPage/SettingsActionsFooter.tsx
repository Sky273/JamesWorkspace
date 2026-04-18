import type { TFunction } from 'i18next';

interface SettingsActionsFooterProps {
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
  t: TFunction;
}

export default function SettingsActionsFooter({
  saving,
  onReset,
  onSave,
  t
}: SettingsActionsFooterProps): JSX.Element {
  return (
    <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={onReset}
        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
      >
        {t('settings.reset')}
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className={`app-primary-action px-6 py-2 font-medium ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {saving ? t('settings.saving') : t('settings.save')}
      </button>
    </div>
  );
}
