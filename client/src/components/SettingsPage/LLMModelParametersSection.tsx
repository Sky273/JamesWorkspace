import type { ChangeEvent } from 'react';

interface ParameterOption {
  value: string;
  label: string;
}

interface ParameterDefinition {
  key: string;
  type: 'integer' | 'number' | 'string' | 'enum';
  label: string;
  min?: number;
  max?: number;
  maxInclusive?: number;
  maxExclusive?: number;
  step?: number;
  defaultValue?: string | number;
  helpText?: string;
  options?: ParameterOption[];
}

interface LLMModelParametersSectionProps {
  modelLabel: string;
  parameterDefinitions: Record<string, ParameterDefinition>;
  values: Record<string, string | number>;
  onParameterChange: (key: string, value: string | number) => void;
}

function getResolvedValue(
  definition: ParameterDefinition,
  values: Record<string, string | number>
): string | number {
  return values[definition.key] ?? definition.defaultValue ?? '';
}

export default function LLMModelParametersSection({
  modelLabel,
  parameterDefinitions,
  values,
  onParameterChange,
}: LLMModelParametersSectionProps): JSX.Element | null {
  const definitions = Object.values(parameterDefinitions);

  if (definitions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Parametres par defaut du modele
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Ces valeurs sont appliquees automatiquement pour <span className="font-medium">{modelLabel}</span>, sauf
          surcharge explicite d'un flux metier.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {definitions.map((definition) => {
          const value = getResolvedValue(definition, values);

          if (definition.type === 'enum') {
            return (
              <label key={definition.key} className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {definition.label}
                </span>
                <select
                  value={String(value)}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => onParameterChange(definition.key, event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  {definition.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {definition.helpText && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{definition.helpText}</p>
                )}
              </label>
            );
          }

          if (definition.type === 'string') {
            return (
              <label key={definition.key} className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {definition.label}
                </span>
                <input
                  type="text"
                  value={String(value)}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onParameterChange(definition.key, event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
                {definition.helpText && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{definition.helpText}</p>
                )}
              </label>
            );
          }

          return (
            <label key={definition.key} className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {definition.label}
              </span>
              <input
                type="number"
                value={String(value)}
                min={definition.min}
                max={definition.max ?? definition.maxInclusive}
                step={definition.step ?? (definition.type === 'integer' ? 1 : 0.1)}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onParameterChange(
                    definition.key,
                    definition.type === 'integer' ? Number.parseInt(event.target.value, 10) : Number.parseFloat(event.target.value)
                  )
                }
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              {definition.helpText && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{definition.helpText}</p>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
