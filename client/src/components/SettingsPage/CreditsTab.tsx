import { BanknotesIcon, CpuChipIcon } from '@heroicons/react/24/outline';

interface CreditsTabProps {
  formData: Record<string, string | number | boolean | undefined>;
  onInputChange: (field: string, value: string | number | boolean) => void;
  t: (key: string) => string;
}

const CREDIT_ACTION_FIELDS = [
  { creditKey: 'aiCreditResumeAnalysis', maxTokensKey: 'aiMaxTokensResumeAnalysis', labelKey: 'settings.credits.actions.resumeAnalysis', fallback: 'Upload / analyse de CV' },
  { creditKey: 'aiCreditResumeImprovement', maxTokensKey: 'aiMaxTokensResumeImprovement', labelKey: 'settings.credits.actions.resumeImprovement', fallback: 'Amélioration / analyse post-amélioration' },
  { creditKey: 'aiCreditResumeAdaptation', maxTokensKey: 'aiMaxTokensResumeAdaptation', labelKey: 'settings.credits.actions.resumeAdaptation', fallback: 'Adaptation à une mission' },
  { creditKey: 'aiCreditProfileAnalysis', maxTokensKey: 'aiMaxTokensProfileAnalysis', labelKey: 'settings.credits.actions.profileAnalysis', fallback: 'Market radar : analyse détaillée de profil' },
  { creditKey: 'aiCreditProfileSearch', maxTokensKey: 'aiMaxTokensProfileSearch', labelKey: 'settings.credits.actions.profileSearch', fallback: 'Market radar : recherche de profils' },
  { creditKey: 'aiCreditResumeMatch', maxTokensKey: 'aiMaxTokensResumeMatch', labelKey: 'settings.credits.actions.resumeMatch', fallback: 'Matching CV / mission' },
  { creditKey: 'aiCreditResumeAiModify', maxTokensKey: 'aiMaxTokensResumeAiModify', labelKey: 'settings.credits.actions.resumeAiModify', fallback: 'Édition IA de CV' },
  { creditKey: 'aiCreditChatbotMessage', maxTokensKey: 'aiMaxTokensChatbotMessage', labelKey: 'settings.credits.actions.chatbotMessage', fallback: 'Message du chatbot' }
];

function NumericInput({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId?: string;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cv-muted)]">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2.5 text-sm text-[var(--cv-text)] outline-none transition focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
      />
    </label>
  );
}

export default function CreditsTab({
  formData,
  onInputChange,
  t,
}: CreditsTabProps): JSX.Element {
  const tx = (key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 text-base font-semibold text-[var(--cv-text)]">
          {tx('settings.credits.title', 'Crédits IA')}
        </h2>
        <p className="text-sm text-[var(--cv-muted)]">
          {tx('settings.credits.description', 'Paramétrez le crédit initial offert à chaque cabinet et le coût des actions IA facturées.')}
        </p>
      </div>

      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-[9px] bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <BanknotesIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--cv-text)]">
              {tx('settings.credits.initialGrantTitle', 'Crédit initial par cabinet')}
            </h3>
            <p className="mt-1 text-sm text-[var(--cv-muted)]">
              {tx('settings.credits.initialGrantDescription', "Ce montant est appliqué lors de la création d'un nouveau cabinet.")}
            </p>
          </div>
        </div>

        <NumericInput
          label={tx('settings.credits.initialGrantField', 'Crédits offerts à la création')}
          value={Number(formData.firmInitialCredits || 0)}
          onChange={(value) => onInputChange('firmInitialCredits', value)}
          testId="firm-initial-credits"
        />
      </div>

      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-[9px] bg-[#ede9ff] p-2.5 text-[#6246ea] dark:bg-white/10 dark:text-[#c9ccff]">
            <CpuChipIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--cv-text)]">
              {tx('settings.credits.aiActionsTitle', 'Coût des actions IA')}
            </h3>
            <p className="mt-1 text-sm text-[var(--cv-muted)]">
              {tx('settings.credits.aiActionsDescription', 'Chaque action ci-dessous correspond à un flux métier qui déclenche un ou plusieurs appels LLM.')}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {CREDIT_ACTION_FIELDS.map((field) => (
            <div key={field.creditKey} className="rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]">
              <div className="mb-3 text-sm font-semibold text-[var(--cv-text)]">
                {tx(field.labelKey, field.fallback)}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <NumericInput
                  label={tx('settings.credits.costField', 'Coût en crédits')}
                  value={Number(formData[field.creditKey] || 0)}
                  onChange={(value) => onInputChange(field.creditKey, value)}
                  testId={field.creditKey}
                />
                <NumericInput
                  label={tx('settings.credits.maxTokensField', 'Max tokens')}
                  value={Number(formData[field.maxTokensKey] || 0)}
                  onChange={(value) => onInputChange(field.maxTokensKey, value)}
                  testId={field.maxTokensKey}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
