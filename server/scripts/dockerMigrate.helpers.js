export function normalizeConstraintDefinition(definition = '') {
    return String(definition || '').toLowerCase();
}

export const SUPPORTED_LLM_PROVIDERS_FOR_CONSTRAINT = Object.freeze([
    'openai',
    'anthropic',
    'huggingface',
    'gemma',
    'deepseek',
    'glm',
    'minimax',
    'ollama'
]);

export function extractAllowedLlmProvidersFromConstraint(definition = '') {
    const normalized = normalizeConstraintDefinition(definition);
    const matches = normalized.matchAll(/'([a-z0-9_-]+)'::text/g);
    return Array.from(new Set(Array.from(matches, (match) => match[1]).filter(Boolean))).sort();
}

export function hasExactSupportedProviders(definition = '', expectedProviders = []) {
    const actual = extractAllowedLlmProvidersFromConstraint(definition);
    const expected = Array.from(new Set(expectedProviders.map((provider) => String(provider || '').trim().toLowerCase()).filter(Boolean))).sort();

    if (actual.length !== expected.length) {
        return false;
    }

    return actual.every((provider, index) => provider === expected[index]);
}

export function sanitizeSqlForPgExecution(sql = '') {
    return String(sql ?? '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((line) => !/^\s*\\[A-Za-z]/.test(line))
        .join('\n');
}
