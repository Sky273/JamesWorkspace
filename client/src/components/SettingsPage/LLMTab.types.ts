export interface FormData {
  llmProvider: 'openai' | 'anthropic' | 'huggingface' | 'gemma' | 'deepseek' | 'glm' | 'minimax' | 'ollama';
  llmModel: string;
  ollamaBaseUrl?: string;
  llmModelParametersJson?: string;
  cvMode?: 'nominative' | 'anonymous';
  webglEnabled?: 'on' | 'off';
}

export interface LLMAvailability {
  [provider: string]: {
    highspeedEnabled?: boolean;
    runtimeUnavailableModels?: string[];
  };
}

export interface ModelOption {
  value: string;
  label: string;
}

export interface ParameterDefinition {
  key: string;
  type: 'number' | 'integer' | 'string' | 'boolean' | 'enum' | 'object' | 'array' | 'union';
  label: string;
  min?: number;
  max?: number;
  maxInclusive?: number;
  maxExclusive?: number;
  step?: number;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  itemType?: string;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export interface OllamaCapabilitySummary {
  family: string | null;
  format: string | null;
  parameterSize: string | null;
  quantizationLevel: string | null;
  contextLength: number | null;
  architecture: string | null;
}

export interface LLMTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string | number) => void;
  onTestConnection: () => Promise<void>;
  testingConnection?: boolean;
  t: (key: string) => string;
  llmAvailability?: LLMAvailability;
  llmModelCatalog?: Record<string, ModelOption[]>;
  llmParameterDefinitions?: Record<string, Record<string, Record<string, ParameterDefinition>>>;
  ollamaDiscoveryLoading?: boolean;
  ollamaModelCapabilities?: Record<string, OllamaCapabilitySummary>;
}

export const OLLAMA_GLOBAL_KEY = '__global__';
