import { ChangeEvent } from 'react';
import {
  PROMPT_SECTIONS,
  fallbackText,
  type FormData,
  type PromptGovernanceEntry,
  type PromptSectionDefinition,
  type PromptVersionStateEntry,
} from './PromptsTab.shared';
import SettingsSwitch from './SettingsSwitch';

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

const MetadataItem = ({ label, value }: MetadataItemProps): JSX.Element => (
  <div className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 dark:border-white/10 dark:bg-[#182235]">
    <div className="text-[11px] uppercase tracking-wide text-[var(--cv-muted)]">{label}</div>
    <div className="mt-1 break-all font-mono text-xs text-[var(--cv-text)]">{value}</div>
  </div>
);

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
    <div className="rounded-[9px] border border-[#dedbe8] bg-white p-3 dark:border-white/10 dark:bg-[#182235]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#dedbe8] px-2 py-1 text-xs font-medium text-[var(--cv-muted)] dark:border-white/10">
            {`v${entry.revision}`}
          </span>
          <span className="text-xs text-[var(--cv-muted)]">{sourceLabel}</span>
          <span className="text-xs text-[var(--cv-muted)]">{entry.reason}</span>
        </div>
        <button
          type="button"
          onClick={() => onRestore(entry.text)}
          disabled={isActive}
          className="rounded-[9px] border border-[#dedbe8] bg-white px-2 py-1 text-xs font-medium text-[var(--cv-muted)] transition hover:bg-[#ede9ff] hover:text-[#6246ea] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#111827] dark:hover:bg-white/10 dark:hover:text-[#c9ccff]"
        >
          {isActive
            ? fallbackText(t, 'settings.prompts.governance.currentVersion', 'Version active')
            : fallbackText(t, 'settings.prompts.governance.restoreAction', 'Restaurer dans l editeur')}
        </button>
      </div>
      <div className="mt-2 text-xs text-[var(--cv-muted)]">
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
    <div className="mb-3 rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[var(--cv-text)]">
          {fallbackText(t, 'settings.prompts.governance.title', 'Versioning')}
        </span>
        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.revision', 'Revision')} value={String(versionState?.currentRevision || 1)} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.historyCount', 'Historique')} value={String(versionState?.history.length || 1)} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.lastChangedAt', 'Dernier changement')} value={versionState?.lastChangedAt || '-'} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.activeSource', 'Source active')} value={versionState?.activeSource || '-'} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.promptId', 'Prompt ID')} value={governance?.promptId || '-'} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.promptVersion', 'Version prompt')} value={governance?.promptVersion || '-'} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.contractId', 'Contract ID')} value={governance?.contractId || '-'} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.contractVersion', 'Version contrat')} value={governance?.contractVersion || '-'} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.domain', 'Domaine')} value={governance?.promptDomain || '-'} />
        <MetadataItem label={fallbackText(t, 'settings.prompts.governance.operation', 'Operation')} value={governance?.promptOperation || '-'} />
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
      <label className="mb-2 block text-sm font-medium text-[var(--cv-muted)]">
        {label}
      </label>

      <PromptGovernancePanel governance={governance} versionState={versionState} value={value} t={t} />

      <textarea
        value={value}
        onChange={handleChange}
        rows={12}
        placeholder={t('settings.prompts.placeholder')}
        className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-4 py-2 font-mono text-sm text-[var(--cv-text)] focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
      />
      <p className="mt-2 text-sm text-[var(--cv-muted)]">
        {helpText}{' '}
        {placeholders.map((ph, idx) => (
          <span key={ph}>
            <code className="rounded bg-[#ede9ff] px-1 py-0.5 text-[#6246ea] dark:bg-white/10 dark:text-[#c9ccff]">{ph}</code>
            {idx < placeholders.length - 1 && ', '}
          </span>
        ))}
      </p>

      {history.length > 1 && (
        <details data-testid={`prompt-history-${String(promptKey)}`} className="mt-3 rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
          <summary className="cursor-pointer text-sm font-medium text-[var(--cv-text)]">
            {fallbackText(t, 'settings.prompts.governance.historyTitle', 'Historique des versions')}
          </summary>
          <p className="mt-2 text-xs text-[var(--cv-muted)]">
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
  <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
    <div className="flex items-start gap-3">
      <SettingsSwitch
        checked={checked}
        onChange={onChange}
        label={t('settings.prompts.preAnalysisEnabled')}
      />
      <div>
        <span className="block text-sm font-semibold text-[var(--cv-text)]">
          {t('settings.prompts.preAnalysisEnabled')}
        </span>
        <span className="mt-1 block text-sm text-[var(--cv-muted)]">
          {t('settings.prompts.preAnalysisEnabledHelp')}
        </span>
      </div>
    </div>
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
  <div className="space-y-5">
    {section.titleKey && (
      <div className="border-t border-[#dedbe8] pt-5 dark:border-white/10">
        <h3 className="mb-4 text-base font-semibold text-[var(--cv-text)]">
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
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 text-base font-semibold text-[var(--cv-text)]">
          {t('settings.prompts.title')}
        </h2>
        <p className="text-sm text-[var(--cv-muted)]">
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
