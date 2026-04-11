/**
 * Cache Version Service
 * Database-backed cache scope version store and invalidation notifications
 */

import { query, getClientWithRetry } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';

export const CACHE_SCOPE_VERSION_TABLE = 'public.cache_scope_versions';
export const CACHE_INVALIDATION_CHANNEL = 'cache_invalidations';

const DEFAULT_CACHE_SCOPE_VERSION = 1;

const listenerState = {
    client: null,
    startPromise: null,
    notificationHandler: null,
    errorHandler: null,
    endHandler: null,
    activeHandler: null
};

function normalizeCacheScope(scope) {
    return String(scope || '').trim();
}

function assertCacheScope(scope) {
    const normalizedScope = normalizeCacheScope(scope);
    if (!normalizedScope) {
        throw new Error('Cache scope is required');
    }
    return normalizedScope;
}

function parseNotificationPayload(rawPayload) {
    if (typeof rawPayload !== 'string' || rawPayload.trim() === '') {
        return { rawPayload: rawPayload ?? null };
    }

    try {
        return JSON.parse(rawPayload);
    } catch {
        return { rawPayload };
    }
}

async function ensureCacheScopeVersionRow(scope) {
    await query(`
        INSERT INTO public.cache_scope_versions (scope, version)
        VALUES ($1, $2)
        ON CONFLICT (scope) DO NOTHING
    `, [scope, DEFAULT_CACHE_SCOPE_VERSION]);
}

async function getCacheScopeVersionRow(scope, { createIfMissing = true } = {}) {
    const normalizedScope = assertCacheScope(scope);

    if (createIfMissing) {
        await ensureCacheScopeVersionRow(normalizedScope);
    }

    const result = await query(`
        SELECT scope, version, updated_at
        FROM public.cache_scope_versions
        WHERE scope = $1
        LIMIT 1
    `, [normalizedScope]);

    return result.rows[0] || null;
}

function buildInvalidationPayload(scope, version, metadata = {}) {
    const payload = {
        scope,
        timestamp: new Date().toISOString()
    };

    if (Number.isFinite(Number(version))) {
        payload.version = Number(version);
    }

    if (metadata.reason) {
        payload.reason = String(metadata.reason);
    }

    if (metadata.source) {
        payload.source = String(metadata.source);
    }

    if (metadata.details !== undefined) {
        payload.details = metadata.details;
    }

    return payload;
}

function dispatchCacheInvalidation(payload) {
    if (typeof listenerState.activeHandler !== 'function') {
        return;
    }

    try {
        listenerState.activeHandler(payload);
    } catch (error) {
        safeLog('warn', 'Cache invalidation handler failed', {
            error: error.message
        });
    }
}

function cleanupListenerState({ preserveHandler = false } = {}) {
    listenerState.client = null;
    listenerState.startPromise = null;
    listenerState.notificationHandler = null;
    listenerState.errorHandler = null;
    listenerState.endHandler = null;

    if (!preserveHandler) {
        listenerState.activeHandler = null;
    }
}

/**
 * Get the current version for a cache scope.
 * Creates the row on first read when missing.
 * @param {string} scope - Cache scope name
 * @param {Object} options - Read options
 * @param {boolean} options.createIfMissing - Insert the scope row if it does not exist
 * @returns {Promise<number|null>}
 */
export async function getCacheScopeVersion(scope, { createIfMissing = true } = {}) {
    const row = await getCacheScopeVersionRow(scope, { createIfMissing });
    return row ? Number(row.version) : null;
}

/**
 * Get versions for multiple cache scopes.
 * @param {Array<string>} scopes - Cache scope names
 * @param {Object} options - Read options
 * @returns {Promise<Record<string, number|null>>}
 */
export async function getCacheScopeVersions(scopes = [], { createIfMissing = true } = {}) {
    const entries = await Promise.all(
        scopes.map(async (scope) => {
            const normalizedScope = assertCacheScope(scope);
            const version = await getCacheScopeVersion(normalizedScope, { createIfMissing });
            return [normalizedScope, version];
        })
    );

    return Object.fromEntries(entries);
}

/**
 * Bump the version for a cache scope.
 * @param {string} scope - Cache scope name
 * @returns {Promise<number>}
 */
export async function bumpCacheScopeVersion(scope) {
    const normalizedScope = assertCacheScope(scope);
    const result = await query(`
        INSERT INTO public.cache_scope_versions (scope, version, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (scope) DO UPDATE
        SET version = public.cache_scope_versions.version + 1,
            updated_at = CURRENT_TIMESTAMP
        RETURNING scope, version, updated_at
    `, [normalizedScope, DEFAULT_CACHE_SCOPE_VERSION + 1]);

    return Number(result.rows[0].version);
}

/**
 * Publish a cache invalidation notification.
 * @param {string} scope - Cache scope name
 * @param {number|null} version - Current scope version
 * @param {Object} metadata - Notification metadata
 * @returns {Promise<Object>} Notification payload
 */
export async function publishCacheInvalidation(scope, version = null, metadata = {}) {
    const normalizedScope = assertCacheScope(scope);
    const payload = buildInvalidationPayload(normalizedScope, version, metadata);

    await query('SELECT pg_notify($1, $2)', [
        CACHE_INVALIDATION_CHANNEL,
        JSON.stringify(payload)
    ]);

    return payload;
}

/**
 * Start a PostgreSQL LISTEN subscription for cache invalidations.
 * @param {Function|null} handler - Optional callback for received notifications
 * @returns {Promise<import("pg").PoolClient>}
 */
export async function subscribeToCacheInvalidations(handler = null) {
    if (typeof handler === 'function') {
        listenerState.activeHandler = handler;
    }

    if (listenerState.client) {
        return listenerState.client;
    }

    if (listenerState.startPromise) {
        return listenerState.startPromise;
    }

    listenerState.startPromise = (async () => {
        const client = await getClientWithRetry();

        listenerState.notificationHandler = (message) => {
            if (message.channel !== CACHE_INVALIDATION_CHANNEL) {
                return;
            }

            const payload = parseNotificationPayload(message.payload);
            safeLog('info', 'Cache invalidation notification received', {
                channel: message.channel,
                scope: payload.scope || null,
                version: payload.version ?? null
            });
            dispatchCacheInvalidation(payload);
        };

        listenerState.errorHandler = (error) => {
            safeLog('warn', 'Cache invalidation listener error', {
                error: error.message
            });
        };

        listenerState.endHandler = () => {
            safeLog('warn', 'Cache invalidation listener connection ended');
            cleanupListenerState({ preserveHandler: true });
        };

        client.on('notification', listenerState.notificationHandler);
        client.on('error', listenerState.errorHandler);
        client.on('end', listenerState.endHandler);

        await client.query(`LISTEN ${CACHE_INVALIDATION_CHANNEL}`);

        listenerState.client = client;
        safeLog('info', 'Cache invalidation listener started', {
            channel: CACHE_INVALIDATION_CHANNEL
        });

        return client;
    })().catch((error) => {
        cleanupListenerState();
        safeLog('error', 'Failed to start cache invalidation listener', {
            error: error.message
        });
        throw error;
    }).finally(() => {
        listenerState.startPromise = null;
    });

    return listenerState.startPromise;
}

/**
 * Stop the cache invalidation listener.
 * @returns {Promise<void>}
 */
export async function unsubscribeFromCacheInvalidations() {
    const client = listenerState.client || await listenerState.startPromise;
    if (!client) {
        cleanupListenerState();
        return;
    }

    try {
        await client.query(`UNLISTEN ${CACHE_INVALIDATION_CHANNEL}`);
    } catch (error) {
        safeLog('warn', 'Failed to unsubscribe cache invalidation listener cleanly', {
            error: error.message
        });
    }

    if (listenerState.notificationHandler) {
        client.off('notification', listenerState.notificationHandler);
    }
    if (listenerState.errorHandler) {
        client.off('error', listenerState.errorHandler);
    }
    if (listenerState.endHandler) {
        client.off('end', listenerState.endHandler);
    }

    try {
        client.release();
    } catch (error) {
        safeLog('warn', 'Failed to release cache invalidation listener client', {
            error: error.message
        });
    } finally {
        cleanupListenerState();
    }

    safeLog('info', 'Cache invalidation listener stopped', {
        channel: CACHE_INVALIDATION_CHANNEL
    });
}

