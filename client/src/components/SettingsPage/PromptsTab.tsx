import { ChangeEvent } from 'react';

interface FormData {
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

interface PromptTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helpText: string;
  placeholders: string[];
  governance?: PromptGovernanceEntry;
  t: (key: string) => string;
}

interface PromptsTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string) => void;
  promptGovernance?: Record<string, PromptGovernanceEntry>;
  t: (key: string) => string;
}

interface MetadataItemProps {
  label: string;
  value: string;
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

const PromptGovernancePanel = ({
  governance,
  value,
  t,
}: {
  governance?: PromptGovernanceEntry;
  value: string;
  t: (key: string) => string;
}): JSX.Element | null => {
  if (!governance) {
    return null;
  }

  const isDefaultPrompt = value.trim() === governance.defaultText.trim();
  const statusLabel = isDefaultPrompt
    ? fallbackText(t, 'settings.prompts.governance.defaultStatus', 'Par defaut')
    : fallbackText(t, 'settings.prompts.governance.customStatus', 'Personnalise');
  const statusClassName = isDefaultPrompt
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';

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

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.promptId', 'Prompt ID')}
          value={governance.promptId || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.promptVersion', 'Version prompt')}
          value={governance.promptVersion || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.contractId', 'Contract ID')}
          value={governance.contractId || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.contractVersion', 'Version contrat')}
          value={governance.contractVersion || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.domain', 'Domaine')}
          value={governance.promptDomain || '-'}
        />
        <MetadataItem
          label={fallbackText(t, 'settings.prompts.governance.operation', 'Operation')}
          value={governance.promptOperation || '-'}
        />
      </div>
    </div>
  );
};

const PromptTextarea = ({
  label,
  value,
  onChange,
  helpText,
  placeholders,
  governance,
  t,
}: PromptTextareaProps): JSX.Element => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <PromptGovernancePanel governance={governance} value={value} t={t} />

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
    </div>
  );
};

const PromptsTab = ({ formData, onInputChange, promptGovernance, t }: PromptsTabProps): JSX.Element => {
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

      <PromptTextarea
        label={t('settings.prompts.analysis')}
        value={formData['Analysis Prompt']}
        onChange={(value) => onInputChange('Analysis Prompt', value)}
        helpText={t('settings.prompts.analysisHelp')}
        placeholders={['{TEXT}']}
        governance={promptGovernance?.['Analysis Prompt']}
        t={t}
      />

      <PromptTextarea
        label={t('settings.prompts.improvement')}
        value={formData['Improvement Prompt']}
        onChange={(value) => onInputChange('Improvement Prompt', value)}
        helpText={t('settings.prompts.improvementHelp')}
        placeholders={['{TEXT}', '{ANALYSIS}']}
        governance={promptGovernance?.['Improvement Prompt']}
        t={t}
      />

      <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('settings.prompts.adaptationSection')}
        </h3>
      </div>

      <PromptTextarea
        label={t('settings.prompts.matchAnalysis')}
        value={formData['Match Analysis Prompt']}
        onChange={(value) => onInputChange('Match Analysis Prompt', value)}
        helpText={t('settings.prompts.matchAnalysisHelp')}
        placeholders={['{RESUME_TEXT}', '{MISSION_TITLE}', '{MISSION_CONTENT}']}
        governance={promptGovernance?.['Match Analysis Prompt']}
        t={t}
      />

      <PromptTextarea
        label={t('settings.prompts.adaptation')}
        value={formData['Adaptation Prompt']}
        onChange={(value) => onInputChange('Adaptation Prompt', value)}
        helpText={t('settings.prompts.adaptationHelp')}
        placeholders={['{RESUME_TEXT}', '{RESUME_ANALYSIS}', '{MISSION_TITLE}', '{MISSION_CONTENT}', '{MATCH_ANALYSIS}']}
        governance={promptGovernance?.['Adaptation Prompt']}
        t={t}
      />
    </div>
  );
};

export default PromptsTab;
