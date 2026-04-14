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
    <section className="rounded-3xl border border-white/10 bg-slate-950/10 p-5">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <label className="mb-2 block text-sm font-semibold text-white">
            {t('settings.llm.cvMode')}
          </label>
          <select
            value={cvMode || 'nominative'}
            onChange={onCvModeChange}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-slate-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="nominative">{fallbackText('settings.llm.cvModeNominative', 'Nominatif')}</option>
            <option value="anonymous">{fallbackText('settings.llm.cvModeAnonymous', 'Anonyme')}</option>
          </select>
          <p className="mt-3 text-sm text-slate-300">
            {cvMode === 'anonymous'
              ? fallbackText('settings.llm.cvModeAnonymousDescription', 'Le CV améliore sera anonymisé.')
              : fallbackText('settings.llm.cvModeNominativeDescription', 'Le CV améliore conserve les informations nominatives.')}
          </p>
        </div>

        <label className="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <input
            type="checkbox"
            checked={webglEnabled === 'on'}
            onChange={onWebglToggle}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
          />
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              {t('settings.llm.webglEnabled')}
            </span>
            <p className="mt-1 text-sm text-slate-300">
              {t('settings.llm.webglEnabledDescription')}
            </p>
          </div>
        </label>

        <label className="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <input
            type="checkbox"
            checked={publicHomeEnabled === true}
            onChange={onPublicHomeToggle}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
          />
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              {fallbackText('settings.chatbot.publicHomeTitle', "Activer la page d'accueil publique")}
            </span>
            <p className="mt-1 text-sm text-slate-300">
              {fallbackText(
                'settings.chatbot.publicHomeDescription',
                'Affiche la page /welcome aux visiteurs non connectés au lieu de les rediriger vers la connexion.'
              )}
            </p>
          </div>
        </label>
      </div>
    </section>
  );
}
