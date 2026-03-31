import type { TFunction } from 'i18next';

interface SettingsHeaderProps {
  t: TFunction;
}

export default function SettingsHeader({ t }: SettingsHeaderProps): JSX.Element {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-1 h-8 rounded-full bg-primary-500" />
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          {t('settings.title')}
        </h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
        {t('settings.subtitle')}
      </p>
    </div>
  );
}
