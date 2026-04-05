import { safeLog } from '../utils/logger.backend.js';
import { createEphemeralStateStore } from './ephemeralStateStore.service.js';

const gdprMailOauthStateStore = createEphemeralStateStore({
    maxEntries: 100,
    ttlMs: 10 * 60 * 1000
});

export function setGdprMailOauthState(state, value) {
    return gdprMailOauthStateStore.set(state, value);
}

export function hasGdprMailOauthState(state) {
    return gdprMailOauthStateStore.has(state);
}

export function takeGdprMailOauthState(state) {
    return gdprMailOauthStateStore.take(state);
}

export function startGdprMailStatesCleanup(intervalMs = 5 * 60 * 1000) {
    return gdprMailOauthStateStore.startCleanup(intervalMs);
}

export function destroyGdprMailStatesCleanup() {
    gdprMailOauthStateStore.stopCleanup();
    gdprMailOauthStateStore.clear();
    safeLog('info', 'GDPR mail OAuth states cleanup destroyed');
}
