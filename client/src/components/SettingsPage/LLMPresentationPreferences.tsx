import SettingsSwitch from './SettingsSwitch';

interface LLMPresentationPreferencesProps {
  cvMode?: 'nominative' | 'anonymous';
  webglEnabled?: 'on' | 'off';
  publicHomeEnabled?: boolean;
  onCvModeChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onWebglToggle: () => void;
  onPublicHomeToggle: () => void;
  t: (key: string) => string;
  fallbackText: (key: string, fallback: string) => string;
}

export default function LLMPresentationPreferences({
  cvMode,
  webglEnabled,
  publicHomeEnabled,
  onCvModeChange,
  onWebglToggle,
  onPublicHomeToggle,
  t,
  fallbackText
}: LLMPresentationPreferencesProps): JSX.Element {
  return (
    <section className="settings-preferences-panel rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]">
      <div className="space-y-3">
        <div className="settings-preference-card rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
          <label className="mb-2 block text-sm font-semibold text-[var(--cv-text)]">
            {t('settings.llm.cvMode')}
          </label>
          <select
            value={cvMode || 'nominative'}
            onChange={onCvModeChange}
            className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-4 py-3 text-sm text-[var(--cv-text)] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#182235] dark:text-gray-100"
          >
            <option value="nominative">{fallbackText('settings.llm.cvModeNominative', 'Nominatif')}</option>
            <option value="anonymous">{fallbackText('settings.llm.cvModeAnonymous', 'Anonyme')}</option>
          </select>
          <p className="mt-3 text-sm text-[var(--cv-muted)]">
            {cvMode === 'anonymous'
              ? fallbackText('settings.llm.cvModeAnonymousDescription', 'Le CV améliore sera anonymisé.')
              : fallbackText('settings.llm.cvModeNominativeDescription', 'Le CV améliore conserve les informations nominatives.')}
          </p>
        </div>

        <div className="settings-preference-card grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
          <SettingsSwitch
            checked={webglEnabled === 'on'}
            onChange={onWebglToggle}
            label={t('settings.llm.webglEnabled')}
          />
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--cv-text)]">
              {t('settings.llm.webglEnabled')}
            </span>
            <p className="mt-1 text-sm text-[var(--cv-muted)]">
              {t('settings.llm.webglEnabledDescription')}
            </p>
          </div>
        </div>

        <div className="settings-preference-card grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
          <SettingsSwitch
            checked={publicHomeEnabled === true}
            onChange={onPublicHomeToggle}
            label={fallbackText('settings.chatbot.publicHomeTitle', "Activer la page d'accueil publique")}
          />
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--cv-text)]">
              {fallbackText('settings.chatbot.publicHomeTitle', "Activer la page d'accueil publique")}
            </span>
            <p className="mt-1 text-sm text-[var(--cv-muted)]">
              {fallbackText(
                'settings.chatbot.publicHomeDescription',
                'Affiche la page /welcome aux visiteurs non connectés au lieu de les rediriger vers la connexion.'
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
