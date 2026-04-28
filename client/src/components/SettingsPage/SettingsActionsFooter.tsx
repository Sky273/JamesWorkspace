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
    <div className="mt-6 flex items-center justify-between border-t border-[#dedbe8] pt-4 dark:border-white/10">
      <button
        onClick={onReset}
        className="app-button-secondary rounded-[9px] px-4 py-2 text-sm font-medium"
      >
        {t('settings.reset')}
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className={`app-primary-action rounded-[9px] px-5 py-2 text-sm font-medium ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {saving ? t('settings.saving') : t('settings.save')}
      </button>
    </div>
  );
}
