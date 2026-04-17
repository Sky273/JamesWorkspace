const redisState = {
    initPromise: null,
    client: null,
    available: false,
    disabledReason: null
};

export function getRedisState() {
    return redisState;
}

export function getRedisConnectionSnapshot() {
    const connected = Boolean(redisState.client) && redisState.available;
    return {
        connected,
        effectiveBackend: connected ? 'redis' : 'memory',
        disabledReason: redisState.disabledReason || null
    };
}

export function setRedisInitPromise(promise) {
    redisState.initPromise = promise;
    return promise;
}

export function clearRedisInitPromise() {
    redisState.initPromise = null;
}

export function markRedisConnected(client) {
    redisState.client = client;
    redisState.available = true;
    redisState.disabledReason = null;
    return client;
}

export function markRedisUnavailable(reason = redisState.disabledReason) {
    redisState.available = false;
    redisState.disabledReason = reason || null;
}

export async function shutdownRedisClient(onWarn = null) {
    if (!redisState.client) {
        return false;
    }

    try {
        await redisState.client.quit();
        return true;
    } catch (error) {
        if (typeof onWarn === 'function') {
            onWarn(error);
        }
        return false;
    } finally {
        redisState.client = null;
        redisState.available = false;
    }
}
