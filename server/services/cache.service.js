import { CACHE_BACKEND, CACHE_REDIS_URL, CACHE_TTL } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';
import { shutdownRedisClient } from './cacheRedisState.service.js';
import {
    buildInvalidationKeySet,
    invalidateCacheKeys,
    invalidateGroupedViewNamespace,
    invalidateNamespaceEntries
} from './cacheInvalidation.service.js';
import { createCacheNamespace } from './cacheNamespaces.service.js';

const cacheRegistry = new Map();

export function handleCacheInvalidationNotification(payload) {
    let invalidatedNamespaces = 0;

    for (const cache of cacheRegistry.values()) {
        if (typeof cache.applyInvalidationPayload === 'function' && cache.applyInvalidationPayload(payload)) {
            invalidatedNamespaces++;
        }
    }

    if (invalidatedNamespaces > 0) {
        safeLog('debug', 'Applied cache invalidation notification locally', {
            scope: payload?.scope || null,
            version: payload?.version ?? null,
            invalidatedNamespaces
        });
    }
}

function createRegisteredCacheNamespace(name, ttl, maxSize = 1000) {
    const cache = CACHE_BACKEND === 'redis'
        ? createCacheNamespace(name, ttl, maxSize)
        : createCacheNamespace(name, ttl, maxSize);

    cacheRegistry.set(name, cache);
    return cache;
}

export const CACHE_KEYS = {
    settings: {
        UI_SETTINGS: 'ui',
        LLM_SETTINGS: 'llm'
    },
    templates: {
        ALL_TEMPLATES: 'all'
    },
    firms: {
        ALL_FIRMS: 'all'
    },
    clients: {
        ALL_CLIENTS: 'all',
        INDUSTRIES: 'industries'
    },
    deals: {
        ALL_DEALS: 'all'
    },
    users: {
        ALL_USERS: 'all'
    },
    missions: {
        ALL_MISSIONS: 'all'
    },
    resumes: {
        ALL: 'all'
    },
    candidatePipeline: {
        ALL: 'all',
        AGGREGATES: 'aggregates'
    },
    emailTemplates: {
        ALL: 'all'
    },
    resumeComments: {
        ALL: 'all',
        RECENT: 'recent'
    },
    backupSettings: {
        CURRENT: 'current'
    },
    jobs: {
        ALL: 'all'
    },
    gdprAudit: {
        LOGS: 'logs',
        STATS: 'stats',
        FIRMS: 'firms',
        EXPORTS: 'exports'
    },
    tags: {
        RAW: 'raw',
        CLEANED: 'cleaned',
        ESCO: 'esco'
    },
    groupedViews: {
        ADMIN: 'admin'
    }
};

export const settingsCache = createRegisteredCacheNamespace('settings', CACHE_TTL.SETTINGS);
export const templatesCache = createRegisteredCacheNamespace('templates', CACHE_TTL.TEMPLATES);
export const firmsCache = createRegisteredCacheNamespace('firms', CACHE_TTL.FIRMS);
export const clientsCache = createRegisteredCacheNamespace('clients', CACHE_TTL.CLIENTS);
export const dealsCache = createRegisteredCacheNamespace('deals', CACHE_TTL.DEALS);
export const usersCache = createRegisteredCacheNamespace('users', CACHE_TTL.USERS);
export const missionsCache = createRegisteredCacheNamespace('missions', CACHE_TTL.MISSIONS);
export const resumesCache = createRegisteredCacheNamespace('resumes', CACHE_TTL.RESUMES);
export const candidatePipelineCache = createRegisteredCacheNamespace('candidatePipeline', CACHE_TTL.CANDIDATE_PIPELINE);
export const emailTemplatesCache = createRegisteredCacheNamespace('emailTemplates', CACHE_TTL.EMAIL_TEMPLATES);
export const resumeCommentsCache = createRegisteredCacheNamespace('resumeComments', CACHE_TTL.RESUME_COMMENTS);
export const backupSettingsCache = createRegisteredCacheNamespace('backupSettings', CACHE_TTL.BACKUP_SETTINGS);
export const jobsCache = createRegisteredCacheNamespace('jobs', CACHE_TTL.JOBS);
export const gdprAuditCache = createRegisteredCacheNamespace('gdprAudit', CACHE_TTL.GDPR_AUDIT);
export const tagsCache = createRegisteredCacheNamespace('tags', CACHE_TTL.TEMPLATES);
export const resumeGroupedViewCache = createRegisteredCacheNamespace('resumeGroupedViews', CACHE_TTL.GROUPED_VIEWS);
export const missionGroupedViewCache = createRegisteredCacheNamespace('missionGroupedViews', CACHE_TTL.GROUPED_VIEWS);
export const adaptationGroupedViewCache = createRegisteredCacheNamespace('adaptationGroupedViews', CACHE_TTL.GROUPED_VIEWS);

export function buildGroupedViewScopeKey({ firmId = null, isAdmin = false } = {}) {
    return isAdmin ? CACHE_KEYS.groupedViews.ADMIN : `firm:${firmId}`;
}

export async function invalidateSettingsCaches() {
    await Promise.all([
        settingsCache.invalidate(CACHE_KEYS.settings.UI_SETTINGS),
        settingsCache.invalidate(CACHE_KEYS.settings.LLM_SETTINGS)
    ]);
}

export async function invalidateTemplatesCaches() {
    await templatesCache.invalidate(CACHE_KEYS.templates.ALL_TEMPLATES);
}

export async function invalidateFirmsCaches() {
    await firmsCache.invalidate(CACHE_KEYS.firms.ALL_FIRMS);
}

export async function invalidateClientsCaches() {
    await Promise.all([
        clientsCache.invalidate(CACHE_KEYS.clients.ALL_CLIENTS),
        clientsCache.invalidate(CACHE_KEYS.clients.INDUSTRIES)
    ]);
}

export async function invalidateDealsCaches() {
    await dealsCache.invalidate(CACHE_KEYS.deals.ALL_DEALS);
}

export async function invalidateUsersCaches() {
    await usersCache.invalidate(CACHE_KEYS.users.ALL_USERS);
}

export async function invalidateMissionsCaches() {
    await missionsCache.invalidate(CACHE_KEYS.missions.ALL_MISSIONS);
}

export async function invalidateResumesCaches(scopeKey = null) {
    await invalidateNamespaceEntries(resumesCache, CACHE_KEYS.resumes.ALL, scopeKey);
}

export async function invalidateCandidatePipelineCaches(scopeKey = null) {
    await invalidateNamespaceEntries(candidatePipelineCache, CACHE_KEYS.candidatePipeline.ALL, scopeKey);
}

export async function invalidateEmailTemplatesCaches(scopeKey = null) {
    await invalidateNamespaceEntries(emailTemplatesCache, CACHE_KEYS.emailTemplates.ALL, scopeKey);
}

export async function invalidateResumeCommentsCaches(scopeKey = null) {
    await invalidateNamespaceEntries(resumeCommentsCache, CACHE_KEYS.resumeComments.ALL, scopeKey);
}

export async function invalidateBackupSettingsCaches() {
    await backupSettingsCache.invalidate(CACHE_KEYS.backupSettings.CURRENT);
}

export async function invalidateJobsCaches(scopeKey = null) {
    await invalidateNamespaceEntries(jobsCache, CACHE_KEYS.jobs.ALL, scopeKey);
}

export async function invalidateGdprAuditCaches(scopeKey = null) {
    const keys = buildInvalidationKeySet(CACHE_KEYS.gdprAudit.LOGS, [
        CACHE_KEYS.gdprAudit.STATS,
        CACHE_KEYS.gdprAudit.FIRMS,
        CACHE_KEYS.gdprAudit.EXPORTS,
        scopeKey
    ]);
    await invalidateCacheKeys(gdprAuditCache, keys);
}

export async function invalidateTagsCaches() {
    await Promise.all([
        tagsCache.invalidate(CACHE_KEYS.tags.RAW),
        tagsCache.invalidate(CACHE_KEYS.tags.CLEANED),
        tagsCache.invalidate(CACHE_KEYS.tags.ESCO)
    ]);
}

export async function invalidateResumeGroupedViewCaches(scopeKey = null) {
    await invalidateGroupedViewNamespace(resumeGroupedViewCache, CACHE_KEYS.groupedViews.ADMIN, scopeKey);
}

export async function invalidateMissionGroupedViewCaches(scopeKey = null) {
    await invalidateGroupedViewNamespace(missionGroupedViewCache, CACHE_KEYS.groupedViews.ADMIN, scopeKey);
}

export async function invalidateAdaptationGroupedViewCaches(scopeKey = null) {
    await invalidateGroupedViewNamespace(adaptationGroupedViewCache, CACHE_KEYS.groupedViews.ADMIN, scopeKey);
}

export async function getNamedCacheStats(cacheName) {
    const cache = cacheRegistry.get(cacheName);
    return cache ? cache.getStats() : null;
}

export async function getCacheRegistryStats() {
    const entries = await Promise.all(
        Array.from(cacheRegistry.entries()).map(async ([name, cache]) => [name, await cache.getStats()])
    );

    return Object.fromEntries(entries);
}

safeLog('info', 'Cache system initialized', {
    backend: CACHE_BACKEND,
    redisUrlConfigured: Boolean(CACHE_REDIS_URL),
    settingsTTL: `${CACHE_TTL.SETTINGS / 1000}s`,
    templatesTTL: `${CACHE_TTL.TEMPLATES / 1000}s`,
    firmsTTL: `${CACHE_TTL.FIRMS / 1000}s`
});

export const cleanupAllCaches = async () => {
    await Promise.all(Array.from(cacheRegistry.values()).map(cache => cache.destroy()));

    await shutdownRedisClient((error) => {
        safeLog('warn', 'Failed to close Redis cache client cleanly', {
            error: error.message
        });
    });

    safeLog('info', 'All caches destroyed');
};
