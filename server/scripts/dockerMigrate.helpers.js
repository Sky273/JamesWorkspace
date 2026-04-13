export function normalizeConstraintDefinition(definition = '') {
    return String(definition || '').toLowerCase();
}

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
