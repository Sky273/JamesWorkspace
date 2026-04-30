import { useTranslation } from 'react-i18next';
import packageJson from '../../../package.json';
import LanguageSelector from './LanguageSelector';

interface HeaderActionsProps {
  theme: string;
  onToggleTheme: () => void;
}

const actionGroupClassName =
  'flex items-center gap-1.5 rounded-[13px] border border-[#E4E4E7] bg-[#F3F2EF] px-1.5 py-1 shadow-none dark:border-[#46505f] dark:bg-[#252b34]';

const actionButtonClassName =
  'inline-flex h-9 items-center justify-center rounded-[9px] border border-[#E4E4E7] bg-white px-3 text-[12px] font-semibold text-[#3F3F46] shadow-none dark:border-[#3f4754] dark:bg-[#1b2028] dark:text-[#F8FAFC]';

const versionBadgeClassName =
  'inline-flex h-9 items-center justify-center rounded-[9px] border border-[#E4E4E7] bg-white px-3 text-[11px] font-bold text-[#18181B] shadow-none dark:border-[#51607a] dark:bg-[#111827] dark:text-[#FFFFFF]';

const HeaderActions = ({
  theme,
  onToggleTheme,
}: HeaderActionsProps): JSX.Element => {
  const { t } = useTranslation();
  const nextThemeLabel = theme === 'dark' ? t('header.theme.light') : t('header.theme.dark');
  const currentThemeLabel = theme === 'dark' ? t('header.theme.dark') : t('header.theme.light');

  return (
    <div className={actionGroupClassName} data-testid="header-actions" aria-label={t('header.actions', 'Actions du header')}>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={onToggleTheme}
        aria-label={nextThemeLabel}
      >
        {currentThemeLabel}
      </button>

      <LanguageSelector variant="header" />

      <span className={versionBadgeClassName} aria-label={t('header.version', 'Version')}>
        v{packageJson.version}
      </span>
    </div>
  );
};

export default HeaderActions;
