import type { TFunction } from 'i18next';
import PageHeader from '../page/PageHeader';

interface SettingsHeaderProps {
  t: TFunction;
}

export default function SettingsHeader({ t }: SettingsHeaderProps): JSX.Element {
  return <PageHeader title={t('navigation.settings', 'Paramètres')} subtitle={t('settings.subtitle')} />;
}
