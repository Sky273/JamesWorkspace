import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { JsonRecord, JsonValue, ParameterDefinition } from './LLMTab.types';
import { getNumericInputProps } from './LLMTab.utils';
import SettingsSwitch from './SettingsSwitch';

interface OllamaParametersSectionProps {
  currentModel: string;
  globalDefinitions: Record<string, ParameterDefinition>;
  modelDefinitions: Record<string, ParameterDefinition>;
  globalParameters: JsonRecord;
  modelParameters: JsonRecord;
  onFieldChange: (sectionKey: string, fieldKey: string, nextValue: JsonValue | undefined) => void;
}

function renderOllamaField(
  t: (key: string, options?: Record<string, unknown>) => string,
  scopeLabel: string,
  sectionKey: string,
  definition: ParameterDefinition,
  currentValue: JsonValue | undefined,
  onFieldChange: (sectionKey: string, fieldKey: string, nextValue: JsonValue | undefined) => void
): JSX.Element {
  const inputId = `ollama-${scopeLabel}-${sectionKey}-${definition.key}`;

  if (definition.type === 'boolean') {
    return (
      <div key={inputId} className="flex items-center justify-between gap-3 rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#182235]">
        <span className="font-medium text-[var(--cv-text)]">{definition.label}</span>
        <SettingsSwitch
          checked={currentValue === true}
          onChange={(checked) => onFieldChange(sectionKey, definition.key, checked ? true : undefined)}
          label={definition.label}
        />
      </div>
    );
  }

  if (definition.type === 'enum' && definition.options) {
    return (
      <label key={inputId} htmlFor={inputId} className="block space-y-2">
        <span className="text-sm font-medium text-[var(--cv-muted)]">{definition.label}</span>
        <select
          id={inputId}
          value={typeof currentValue === 'string' ? currentValue : ''}
          onChange={(event) => onFieldChange(sectionKey, definition.key, event.target.value || undefined)}
          className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
        >
          <option value="">{t('settings.llm.useDefaultValue')}</option>
          {definition.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.type === 'array') {
    return (
      <label key={inputId} htmlFor={inputId} className="block space-y-2">
        <span className="text-sm font-medium text-[var(--cv-muted)]">{definition.label}</span>
        <input
          id={inputId}
          type="text"
          value={Array.isArray(currentValue) ? currentValue.join(', ') : ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const values = event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean);
            onFieldChange(sectionKey, definition.key, values.length > 0 ? values : undefined);
          }}
          placeholder="value1, value2"
          className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
        />
      </label>
    );
  }

  const inputType = definition.type === 'number' || definition.type === 'integer' ? 'number' : 'text';
  const inputValue = typeof currentValue === 'string' || typeof currentValue === 'number' ? String(currentValue) : '';
  const numericProps = getNumericInputProps(definition);

  return (
    <label key={inputId} htmlFor={inputId} className="block space-y-2">
      <span className="text-sm font-medium text-[var(--cv-muted)]">{definition.label}</span>
      <input
        id={inputId}
        type={inputType}
        value={inputValue}
        min={numericProps.min}
        max={numericProps.max}
        step={numericProps.step}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const rawValue = event.target.value;
          if (!rawValue.trim()) {
            onFieldChange(sectionKey, definition.key, undefined);
            return;
          }

          if (definition.type === 'number' || definition.type === 'integer') {
            const numericValue = definition.type === 'integer' ? parseInt(rawValue, 10) : Number(rawValue);
            onFieldChange(sectionKey, definition.key, Number.isFinite(numericValue) ? numericValue : undefined);
            return;
          }

          onFieldChange(sectionKey, definition.key, rawValue);
        }}
        className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
      />
    </label>
  );
}

export function OllamaParametersSection({
  currentModel,
  globalDefinitions,
  modelDefinitions,
  globalParameters,
  modelParameters,
  onFieldChange,
}: OllamaParametersSectionProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.llm.ollamaParameters')}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('settings.llm.ollamaParametersHelp')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border border-emerald-200/80 bg-white/70 p-4 dark:border-emerald-900/70 dark:bg-gray-900/40">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.llm.globalParameters')}</h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('settings.llm.storedUnder', { path: 'ollama.__global__' })}</p>
          </div>
          <div className="grid gap-3">
            {Object.values(globalDefinitions).map((definition) =>
              renderOllamaField(t, 'global', '__global__', definition, globalParameters[definition.key], onFieldChange)
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-emerald-200/80 bg-white/70 p-4 dark:border-emerald-900/70 dark:bg-gray-900/40">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.llm.modelParameters')}</h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {currentModel ? t('settings.llm.storedUnder', { path: `ollama.${currentModel}` }) : t('settings.llm.selectRemoteModelFirst')}
            </p>
          </div>
          {currentModel ? (
            <div className="grid gap-3">
              {Object.values(modelDefinitions).map((definition) =>
                renderOllamaField(t, 'model', currentModel, definition, modelParameters[definition.key], onFieldChange)
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.llm.noOllamaModelSelected')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdvancedJsonEditorSectionProps {
  advancedJsonOpen: boolean;
  jsonPlaceholder: string;
  jsonValidationState: 'idle' | 'valid' | 'invalid';
  jsonValue: string;
  onFormatJson: () => void;
  onInjectExample: () => void;
  onResetJson: () => void;
  onToggleOpen: () => void;
  onValidateJson: () => void;
  onValueChange: (value: string) => void;
}

export function AdvancedJsonEditorSection({
  advancedJsonOpen,
  jsonPlaceholder,
  jsonValidationState,
  jsonValue,
  onFormatJson,
  onInjectExample,
  onResetJson,
  onToggleOpen,
  onValidateJson,
  onValueChange,
}: AdvancedJsonEditorSectionProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.llm.advancedJson')}</h3>
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            {advancedJsonOpen ? t('settings.llm.hideJson') : t('settings.llm.showJson')}
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('settings.llm.advancedJsonHelp')}
        </p>
      </div>

      {advancedJsonOpen && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onFormatJson} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">{t('settings.llm.formatJson')}</button>
            <button type="button" onClick={onValidateJson} className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50">{t('settings.llm.validateJson')}</button>
            <button type="button" onClick={onInjectExample} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50">{t('settings.llm.injectExample')}</button>
            <button type="button" onClick={onResetJson} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">{t('settings.llm.resetJson')}</button>
            <span className={`text-sm ${jsonValidationState === 'valid' ? 'text-green-700 dark:text-green-300' : jsonValidationState === 'invalid' ? 'text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>
              {jsonValidationState === 'valid' ? t('settings.llm.jsonValid') : jsonValidationState === 'invalid' ? t('settings.llm.jsonInvalid') : t('settings.llm.localValidation')}
            </span>
          </div>

          <textarea
            value={jsonValue}
            onChange={(event) => onValueChange(event.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            placeholder={jsonPlaceholder}
          />
        </>
      )}
    </div>
  );
}
