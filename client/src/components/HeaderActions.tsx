import { useTranslation } from 'react-i18next';
import {
  ComputerDesktopIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import LanguageSelector from './LanguageSelector';
import {
  headerActionButtonClassName,
  headerActionGroupClassName,
  headerActionIconClassName,
} from './headerActionStyles';

interface HeaderActionsProps {
  theme: string;
  onToggleTheme: () => void;
  onOpenAbout: () => void;
}

const HeaderActions = ({
  theme,
  onToggleTheme,
  onOpenAbout,
}: HeaderActionsProps): JSX.Element => {
  const { t } = useTranslation();
  const themeLabel = theme === 'dark' ? t('header.theme.light') : t('header.theme.dark');

  return (
    <div className={headerActionGroupClassName} data-testid="header-actions">
      <button
        type="button"
        className={headerActionButtonClassName}
        onClick={onToggleTheme}
        aria-label={themeLabel}
      >
        <span className="sr-only">{themeLabel}</span>
        <ComputerDesktopIcon className={headerActionIconClassName} aria-hidden="true" />
      </button>

      <LanguageSelector variant="header" />

      <button
        type="button"
        className={headerActionButtonClassName}
        onClick={onOpenAbout}
        aria-label={t('common.about')}
      >
        <span className="sr-only">{t('common.about')}</span>
        <InformationCircleIcon className={headerActionIconClassName} aria-hidden="true" />
      </button>
    </div>
  );
};

export default HeaderActions;
