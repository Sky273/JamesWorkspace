import { useTranslation } from 'react-i18next';
import packageJson from '../../../package.json';
import LanguageSelector from './LanguageSelector';

interface HeaderActionsProps {
  theme: string;
  onToggleTheme: () => void;
  onOpenAbout: () => void;
}

const actionGroupClassName =
  'app-header-actions flex items-center gap-1.5 rounded-[13px] border border-[#E4E4E7] bg-[#F3F2EF] px-1.5 py-1 shadow-none dark:border-[#46505f] dark:bg-[#252b34]';

const actionButtonClassName =
  'app-header-actions__text-control inline-flex h-9 items-center justify-center rounded-[9px] border border-[#E4E4E7] bg-white px-3 text-[12px] font-bold text-[#3F3F46] shadow-none dark:border-[#536071] dark:bg-[#151b2a] dark:text-white';

const versionBadgeClassName =
  'app-header-actions__version inline-flex h-9 items-center justify-center rounded-[9px] border border-[#E4E4E7] bg-white px-3 text-[11px] font-extrabold text-[#18181B] shadow-none dark:border-[#64748b] dark:bg-[#0f172a] dark:text-white';

const HeaderActions = ({
  theme,
  onToggleTheme,
  onOpenAbout,
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

      <button
        type="button"
        className={versionBadgeClassName}
        onClick={onOpenAbout}
        aria-label={t('about.openChangelog', 'Afficher la version et le changelog')}
      >
        v{packageJson.version}
      </button>
    </div>
  );
};

export default HeaderActions;
