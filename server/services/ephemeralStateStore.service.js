export function createEphemeralStateStore({
    maxEntries = 100,
    ttlMs = 10 * 60 * 1000
} = {}) {
    const entries = new Map();
    let cleanupInterval = null;

    function prune() {
        const now = Date.now();
        for (const [key, value] of entries.entries()) {
            if (now - value.createdAt > ttlMs) {
                entries.delete(key);
            }
        }

        while (entries.size > maxEntries) {
            const oldestKey = entries.keys().next().value;
            if (!oldestKey) {
                break;
            }
            entries.delete(oldestKey);
        }
    }

    function set(key, value) {
        prune();
        entries.set(key, {
            ...value,
            createdAt: value?.createdAt || Date.now()
        });
        return key;
    }

    function get(key) {
        return entries.get(key) || null;
    }

    function has(key) {
        return entries.has(key);
    }

    function deleteEntry(key) {
        return entries.delete(key);
    }

    function take(key) {
        const value = get(key);
        if (!value) {
            return null;
        }
        deleteEntry(key);
        return value;
    }

    function clear() {
        entries.clear();
    }

    function startCleanup(intervalMs = 60 * 1000) {
        if (cleanupInterval) {
            return cleanupInterval;
        }
        cleanupInterval = setInterval(prune, intervalMs);
        return cleanupInterval;
    }

    function stopCleanup() {
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
            cleanupInterval = null;
        }
    }

    return {
        clear,
        delete: deleteEntry,
        get,
        has,
        prune,
        set,
        startCleanup,
        stopCleanup,
        take
    };
}
