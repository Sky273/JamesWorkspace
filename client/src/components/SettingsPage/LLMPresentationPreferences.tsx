interface LLMPresentationPreferencesProps {
  cvMode?: 'nominative' | 'anonymous';
  webglEnabled?: 'on' | 'off';
  onCvModeChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onWebglToggle: () => void;
  t: (key: string) => string;
  fallbackText: (key: string, fallback: string) => string;
}

export default function LLMPresentationPreferences({
  cvMode,
  webglEnabled,
  onCvModeChange,
  onWebglToggle,
  t,
  fallbackText
}: LLMPresentationPreferencesProps): JSX.Element {
  return (
    <>
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('settings.llm.cvMode')}
        </label>
        <select
          value={cvMode || 'nominative'}
          onChange={onCvModeChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="nominative">{fallbackText('settings.llm.cvModeNominative', 'Nominatif')}</option>
          <option value="anonymous">{fallbackText('settings.llm.cvModeAnonymous', 'Anonyme')}</option>
        </select>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {cvMode === 'anonymous'
            ? fallbackText('settings.llm.cvModeAnonymousDescription', 'Le CV amélioré sera anonymisé.')
            : fallbackText('settings.llm.cvModeNominativeDescription', 'Le CV amélioré conserve les informations nominatives.')}
        </p>
      </div>

      <div className="pt-6 pb-2 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={webglEnabled === 'on'}
            onChange={onWebglToggle}
            className="mt-1 h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
          />
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('settings.llm.webglEnabled')}
            </span>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('settings.llm.webglEnabledDescription')}
            </p>
          </div>
        </label>
      </div>
    </>
  );
}
