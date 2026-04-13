import { BanknotesIcon, CpuChipIcon } from '@heroicons/react/24/outline';

interface CreditsTabProps {
  formData: Record<string, string | number | boolean | undefined>;
  onInputChange: (field: string, value: string | number | boolean) => void;
  t: (key: string) => string;
}

const CREDIT_ACTION_FIELDS = [
  { creditKey: 'aiCreditResumeAnalysis', maxTokensKey: 'aiMaxTokensResumeAnalysis', labelKey: 'settings.credits.actions.resumeAnalysis', fallback: 'Upload / analyse de CV' },
  { creditKey: 'aiCreditResumeImprovement', maxTokensKey: 'aiMaxTokensResumeImprovement', labelKey: 'settings.credits.actions.resumeImprovement', fallback: 'Amelioration / analyse post-amelioration' },
  { creditKey: 'aiCreditResumeAdaptation', maxTokensKey: 'aiMaxTokensResumeAdaptation', labelKey: 'settings.credits.actions.resumeAdaptation', fallback: 'Adaptation a une mission' },
  { creditKey: 'aiCreditProfileAnalysis', maxTokensKey: 'aiMaxTokensProfileAnalysis', labelKey: 'settings.credits.actions.profileAnalysis', fallback: 'Market radar : analyse detaillee de profil' },
  { creditKey: 'aiCreditProfileSearch', maxTokensKey: 'aiMaxTokensProfileSearch', labelKey: 'settings.credits.actions.profileSearch', fallback: 'Market radar : recherche de profils' },
  { creditKey: 'aiCreditResumeMatch', maxTokensKey: 'aiMaxTokensResumeMatch', labelKey: 'settings.credits.actions.resumeMatch', fallback: 'Matching CV / mission' },
  { creditKey: 'aiCreditResumeAiModify', maxTokensKey: 'aiMaxTokensResumeAiModify', labelKey: 'settings.credits.actions.resumeAiModify', fallback: 'Edition IA de CV' },
  { creditKey: 'aiCreditTemplateExtract', maxTokensKey: 'aiMaxTokensTemplateExtract', labelKey: 'settings.credits.actions.templateExtract', fallback: 'Extraction de modele depuis CV' },
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
      <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
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
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          {tx('settings.credits.title', 'Credits IA')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {tx('settings.credits.description', 'Parametrez le credit initial offert a chaque cabinet et le cout des actions IA facturees.')}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <BanknotesIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {tx('settings.credits.initialGrantTitle', 'Credit initial par cabinet')}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {tx('settings.credits.initialGrantDescription', "Ce montant est applique lors de la creation d'un nouveau cabinet.")}
            </p>
          </div>
        </div>

        <NumericInput
          label={tx('settings.credits.initialGrantField', 'Credits offerts a la creation')}
          value={Number(formData.firmInitialCredits || 0)}
          onChange={(value) => onInputChange('firmInitialCredits', value)}
          testId="firm-initial-credits"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <CpuChipIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {tx('settings.credits.aiActionsTitle', 'Cout des actions IA')}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {tx('settings.credits.aiActionsDescription', 'Chaque action ci-dessous correspond a un flux metier qui declenche un ou plusieurs appels LLM.')}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {CREDIT_ACTION_FIELDS.map((field) => (
            <div key={field.creditKey} className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                {tx(field.labelKey, field.fallback)}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <NumericInput
                  label={tx('settings.credits.costField', 'Cout en credits')}
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
