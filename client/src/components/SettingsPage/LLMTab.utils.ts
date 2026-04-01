import type { FormData, JsonRecord, ParameterDefinition } from './LLMTab.types';

export function fallbackText(t: (key: string) => string, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function getProviderDescription(provider: FormData['llmProvider'], t: (key: string) => string): string {
  if (provider === 'ollama') return t('settings.llm.ollamaDescription');
  if (provider === 'deepseek') return t('settings.llm.deepseekDescription');
  if (provider === 'glm') return t('settings.llm.glmDescription');
  if (provider === 'minimax') return t('settings.llm.minimaxDescription');
  return t('settings.llm.description');
}

export function getJsonPlaceholder(provider: FormData['llmProvider'], model: string): string {
  const modelKey = model || (provider === 'ollama' ? 'remote-model' : 'model');
  return `{\n  "${provider}": {\n    "${modelKey}": {\n      "temperature": 0,\n      "top_p": 1\n    }\n  }\n}`;
}

export function getExampleJson(provider: FormData['llmProvider'], model: string): string {
  const modelKey = model || (provider === 'ollama' ? 'remote-model' : 'model');
  const examplePayload =
    provider === 'ollama'
      ? {
          [provider]: {
            __global__: { keep_alive: '5m' },
            [modelKey]: { num_ctx: 8192, temperature: 0.2, top_k: 40 },
          },
        }
      : {
          [provider]: {
            [modelKey]: { temperature: 0, top_p: 1, max_tokens: 4096 },
          },
        };

  return JSON.stringify(examplePayload, null, 2);
}

export function parseJsonRecord(value: string): JsonRecord {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as JsonRecord;
  } catch {
    return {};
  }
}

export function getParsedJsonStatus(value: string): { valid: boolean; formatted: string | null } {
  try {
    const parsed = JSON.parse(value) as unknown;
    const isPlainObject = Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
    return {
      valid: isPlainObject,
      formatted: isPlainObject ? JSON.stringify(parsed, null, 2) : null,
    };
  } catch {
    return { valid: false, formatted: null };
  }
}

export function getJsonObjectSection(root: JsonRecord, provider: string, sectionKey: string): JsonRecord {
  const providerParams = root[provider];
  if (!providerParams || typeof providerParams !== 'object' || Array.isArray(providerParams)) {
    return {};
  }

  const value = (providerParams as JsonRecord)[sectionKey];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function updateProviderSection(
  current: JsonRecord,
  provider: string,
  sectionKey: string,
  fieldKey: string,
  nextValue: unknown
): JsonRecord {
  const currentProvider = current[provider] && typeof current[provider] === 'object' && !Array.isArray(current[provider])
    ? { ...(current[provider] as JsonRecord) }
    : {};
  const currentSection = currentProvider[sectionKey] && typeof currentProvider[sectionKey] === 'object' && !Array.isArray(currentProvider[sectionKey])
    ? { ...(currentProvider[sectionKey] as JsonRecord) }
    : {};

  if (nextValue === undefined || nextValue === '' || nextValue === null) {
    delete currentSection[fieldKey];
  } else {
    currentSection[fieldKey] = nextValue as JsonRecord[string];
  }

  if (Object.keys(currentSection).length === 0) {
    delete currentProvider[sectionKey];
  } else {
    currentProvider[sectionKey] = currentSection;
  }

  const nextRoot = { ...current };
  if (Object.keys(currentProvider).length === 0) {
    delete nextRoot[provider];
  } else {
    nextRoot[provider] = currentProvider;
  }

  return nextRoot;
}

export function getNumericInputProps(definition: ParameterDefinition): { min?: number; max?: number; step: number | 'any' } {
  return {
    min: definition.min,
    max: definition.max ?? definition.maxInclusive,
    step: definition.step ?? (definition.type === 'integer' ? 1 : 'any'),
  };
}
