import { ChangeEvent } from 'react';

interface FormData {
  preAnalysisEnabled?: boolean;
  'Pre Analysis Prompt': string;
  'Analysis Prompt': string;
  'Improvement Prompt': string;
  'Match Analysis Prompt': string;
  'Adaptation Prompt': string;
}

interface PromptGovernanceEntry {
  settingKey: string;
  promptKey: string;
  promptId: string | null;
  promptVersion: string | null;
  promptDomain: string | null;
  promptOperation: string | null;
  contractId: string | null;
  contractVersion: string | null;
  sourceModule: string | null;
  defaultText: string;
}

interface PromptVersionStateEntry {
  currentRevision: number;
  activeSource: 'default' | 'custom';
  activeTextHash: string;
  isModified: boolean;
  lastChangedAt: string | null;
  history: Array<{
    revision: number;
    source: 'default' | 'custom';
    reason: string;
    text: string;
    textHash: string;
    changedAt: string | null;
    changedByUserId: string | null;
    changedByEmail: string | null;
    promptId: string | null;
    promptVersion: string | null;
    contractId: string | null;
    contractVersion: string | null;
  }>;
}

interface PromptTextareaProps {
  promptKey: keyof FormData;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helpText: string;
  placeholders: string[];
  governance?: PromptGovernanceEntry;
  versionState?: PromptVersionStateEntry;
  t: (key: string) => string;
}

interface PromptsTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string | boolean) => void;
  promptGovernance?: Record<string, PromptGovernanceEntry>;
  promptVersionState?: Record<string, PromptVersionStateEntry>;
  t: (key: string) => string;
}

interface MetadataItemProps {
  label: string;
  value: string;
}

interface PromptHistoryItemProps {
  entry: PromptVersionStateEntry['history'][number];
  isActive: boolean;
  onRestore: (text: string) => void;
  t: (key: string) => string;
}

interface PromptFieldDefinition {
  promptKey: keyof FormData;
  labelKey: string;
  helpTextKey: string;
  placeholders: string[];
}

interface PromptSectionDefinition {
  id: string;
  titleKey?: string;
  fields: PromptFieldDefinition[];
}

const fallbackText = (t: (key: string) => string, key: string, fallback: string): string => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const MetadataItem = ({ label, value }: MetadataItemProps): JSX.Element => (
  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
    <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-1 break-all font-mono text-xs text-slate-900 dark:text-slate-100">{value}</div>
  </div>
);

const PROMPT_SECTIONS: PromptSectionDefinition[] = [
  {
    id: 'pre-analysis',
    fields: [
      {
        promptKey: 'Pre Analysis Prompt',
        labelKey: 'settings.prompts.preAnalysis',
        helpTextKey: 'settings.prompts.preAnalysisHelp',
        placeholders: ['{TEXT}', '{FILENAME}'],
      },
    ],
  },
  {
    id: 'core-analysis',
    fields: [
      {
        promptKey: 'Analysis Prompt',
        labelKey: 'settings.prompts.analysis',
        helpTextKey: 'settings.prompts.analysisHelp',
        placeholders: ['{TEXT}'],
      },
      {
        promptKey: 'Improvement Prompt',
        labelKey: 'settings.prompts.improvement',
        helpTextKey: 'settings.prompts.improvementHelp',
        placeholders: ['{TEXT}', '{ANALYSIS}'],
      },
    ],
  },
  {
    id: 'adaptation',
    titleKey: 'settings.prompts.adaptationSection',
    fields: [
      {
        promptKey: 'Match Analysis Prompt',
        labelKey: 'settings.prompts.matchAnalysis',
        helpTextKey: 'settings.prompts.matchAnalysisHelp',
        placeholders: ['{RESUME_TEXT}', '{MISSION_TITLE}', '{MISSION_CONTENT}'],
      },
      {
        promptKey: 'Adaptation Prompt',
        labelKey: 'settings.prompts.adaptation',
        helpTextKey: 'settings.prompts.adaptationHelp',
        placeholders: ['{RESUME_TEXT}', '{RESUME_ANALYSIS}', '{MISSION_TITLE}', '{MISSION_CONTENT}', '{MATCH_ANALYSIS}'],
      },
    ],
  },
];

const PromptHistoryItem = ({
  entry,
  isActive,
  onRestore,
  t,
}: PromptHistoryItemProps): JSX.Element => {
  const sourceLabel = entry.source === 'default'
    ? fallbackText(t, 'settings.prompts.governance.defaultStatus', 'Par defaut')
    : fallbackText(t, 'settings.prompts.governance.customStatus', 'Personnalise');

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200">
            {`v${entry.revision}`}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{sourceLabel}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{entry.reason}</span>
        </div>
        <button
          type="button"
          onClick={() => onRestore(entry.text)}
          disabled={isActive}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {isActive
            ? fallbackText(t, 'settings.prompts.governance.currentVersion', 'Version active')
            : fallbackText(t, 'settings.prompts.governance.restoreAction', 'Restaurer dans l editeur')}
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {entry.changedAt || '-'}
      </div>
    </div>
  );
};

const PromptGovernancePanel = ({
  governance,
  versionState,
  value,
  t,
}: {
  governance?: PromptGovernanceEntry;
  versionState?: PromptVersionStateEntry;
  value: string;
  t: (key: string) => string;
}): JSX.Element | null => {
  if (!governance && !versionState) {
    return null;
  }

  const isModified = versionState?.isModified ?? (governance ? value.trim() !== governance.defaultText.trim() : false);
  const statusLabel = isModified
    ? fallbackText(t, 'settings.prompts.governance.customStatus', 'Personnalise')
    : fallbackText(t, 'settings.prompts.governance.defaultStatus', 'Par defaut');
  const statusClassName = isModified
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {fallbackText(t, 'settings.prompts.governance.title', 'Versioning')}
        </span>
        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.revision', 'Revision')}
          value={String(versionState?.currentRevision || 1)}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.historyCount', 'Historique')}
          value={String(versionState?.history.length || 1)}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.lastChangedAt', 'Dernier changement')}
          value={versionState?.lastChangedAt || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.activeSource', 'Source active')}
          value={versionState?.activeSource || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.promptId', 'Prompt ID')}
          value={governance?.promptId || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.promptVersion', 'Version prompt')}
          value={governance?.promptVersion || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.contractId', 'Contract ID')}
          value={governance?.contractId || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.contractVersion', 'Version contrat')}
          value={governance?.contractVersion || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.domain', 'Domaine')}
          value={governance?.promptDomain || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.operation', 'Operation')}
          value={governance?.promptOperation || '-'}
        />
      </div>
    </div>
  );
};

const PromptTextarea = ({
  promptKey,
  label,
  value,
  onChange,
  helpText,
  placeholders,
  governance,
  versionState,
  t,
}: PromptTextareaProps): JSX.Element => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value);
  };
  const history = versionState?.history ? [...versionState.history].sort((a, b) => b.revision - a.revision) : [];

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <PromptGovernancePanel governance={governance} versionState={versionState} value={value} t={t} />

      <textarea
        value={value}
        onChange={handleChange}
        rows={12}
        placeholder={t('settings.prompts.placeholder')}
        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {helpText}{' '}
        {placeholders.map((ph, idx) => (
          <span key={ph}>
            <code className="rounded bg-gray-200 px-1 py-0.5 dark:bg-gray-600">{ph}</code>
            {idx < placeholders.length - 1 && ', '}
          </span>
        ))}
      </p>

      {history.length > 1 && (
        <details data-testid={`prompt-history-${String(promptKey)}`} className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <summary className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100">
            {fallbackText(t, 'settings.prompts.governance.historyTitle', 'Historique des versions')}
          </summary>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {fallbackText(t, 'settings.prompts.governance.historyHelp', 'Choisissez une ancienne version pour la recharger dans l editeur, puis enregistrez.')}
          </p>
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <PromptHistoryItem
                key={`${entry.revision}-${entry.textHash}`}
                entry={entry}
                isActive={entry.textHash === versionState?.activeTextHash}
                onRestore={onChange}
                t={t}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

const PromptToggleCard = ({
  checked,
  onChange,
  t,
}: {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  t: (key: string) => string;
}): JSX.Element => (
  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div>
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
          {t('settings.prompts.preAnalysisEnabled')}
        </span>
        <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
          {t('settings.prompts.preAnalysisEnabledHelp')}
        </span>
      </div>
    </label>
  </div>
);

const PromptSection = ({
  section,
  formData,
  onInputChange,
  promptGovernance,
  promptVersionState,
  t,
}: {
  section: PromptSectionDefinition;
  formData: FormData;
  onInputChange: (key: string, value: string | boolean) => void;
  promptGovernance?: Record<string, PromptGovernanceEntry>;
  promptVersionState?: Record<string, PromptVersionStateEntry>;
  t: (key: string) => string;
}): JSX.Element => (
  <div className="space-y-6">
    {section.titleKey && (
      <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t(section.titleKey)}
        </h3>
      </div>
    )}

    {section.fields.map((field) => (
      <PromptTextarea
        key={field.promptKey}
        promptKey={field.promptKey}
        label={t(field.labelKey)}
        value={formData[field.promptKey] as string}
        onChange={(nextValue) => onInputChange(field.promptKey, nextValue)}
        helpText={t(field.helpTextKey)}
        placeholders={field.placeholders}
        governance={promptGovernance?.[field.promptKey]}
        versionState={promptVersionState?.[field.promptKey]}
        t={t}
      />
    ))}
  </div>
);

const PromptsTab = ({
  formData,
  onInputChange,
  promptGovernance,
  promptVersionState,
  t,
}: PromptsTabProps): JSX.Element => {
  const visibleSections = PROMPT_SECTIONS.filter((section) => (
    section.id !== 'pre-analysis' || !!formData.preAnalysisEnabled
  ));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
          {t('settings.prompts.title')}
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {t('settings.prompts.description')}
        </p>
      </div>

      <PromptToggleCard
        checked={!!formData.preAnalysisEnabled}
        onChange={(nextValue) => onInputChange('preAnalysisEnabled', nextValue)}
        t={t}
      />

      {visibleSections.map((section) => (
        <PromptSection
          key={section.id}
          section={section}
          formData={formData}
          onInputChange={onInputChange}
          promptGovernance={promptGovernance}
          promptVersionState={promptVersionState}
          t={t}
        />
      ))}
    </div>
  );
};

export default PromptsTab;
