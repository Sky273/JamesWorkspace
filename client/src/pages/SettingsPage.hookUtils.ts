import logger from '../utils/logger.frontend';
import type { OllamaModelCapability, SettingsFormData } from './SettingsPage.utils';
import { createSavePayload, getTotalWeight, type LLMModelParameters } from './SettingsPage.utils';

export interface OllamaDiscoveryResponse {
  models: Array<{ value: string; label: string }>;
  capabilitiesByModel: Record<string, OllamaModelCapability>;
  selectedModelExists: boolean;
}

export async function discoverOllamaModels(
  authGet: (url: string) => Promise<Response>,
  baseUrl: string,
  selectedModel?: string,
): Promise<OllamaDiscoveryResponse> {
  const params = new URLSearchParams({ baseUrl });
  if (selectedModel) {
    params.set('model', selectedModel);
  }

  const response = await authGet(`/api/settings/ollama/models?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to discover Ollama models');
  }

  return response.json() as Promise<OllamaDiscoveryResponse>;
}

export function applyDiscoveredOllamaModel(
  currentModel: string,
  models: Array<{ value: string; label: string }>,
): string | null {
  const stillExists = models.some((entry) => entry.value === currentModel);
  if (stillExists || !models[0]) {
    return null;
  }

  return models[0].value;
}

export function validateSettingsBeforeSave(
  formData: SettingsFormData,
  t: (key: string, options?: Record<string, unknown>) => string,
): { valid: true } | { valid: false; message: string } {
  const totalWeight = getTotalWeight(formData);
  if (totalWeight !== 100) {
    return {
      valid: false,
      message: t('settings.weights.totalMustEqualCurrent', { total: totalWeight }),
    };
  }

  return { valid: true };
}

export function buildSettingsSavePayload(
  formData: SettingsFormData,
): { payload: Record<string, string | number | boolean | LLMModelParameters> } | { error: string } {
  try {
    return { payload: createSavePayload(formData) };
  } catch (error) {
    logger.error('Invalid LLM parameters JSON:', error);
    return { error: 'JSON invalide dans les paramètres LLM' };
  }
}
