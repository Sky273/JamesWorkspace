export function buildInvalidationKeySet(defaultKey, scopeKeys = null) {
    const keys = new Set([defaultKey]);
    if (!scopeKeys) {
        return keys;
    }

    if (Array.isArray(scopeKeys) || scopeKeys instanceof Set) {
        for (const scopeKey of scopeKeys) {
            if (scopeKey) {
                keys.add(scopeKey);
            }
        }
        return keys;
    }

    keys.add(scopeKeys);
    return keys;
}

export async function invalidateCacheKeys(cacheNamespace, keys) {
    await Promise.all(Array.from(keys).map((key) => cacheNamespace.invalidate(key)));
}

export async function invalidateNamespaceEntries(cacheNamespace, defaultKey, scopeKeys = null) {
    const keys = buildInvalidationKeySet(defaultKey, scopeKeys);
    await invalidateCacheKeys(cacheNamespace, keys);
}

export async function invalidateGroupedViewNamespace(cacheNamespace, adminScopeKey, scopeKey = null) {
    const keys = buildInvalidationKeySet(adminScopeKey, scopeKey);
    await invalidateCacheKeys(cacheNamespace, keys);
}
