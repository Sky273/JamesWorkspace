import { safeLog } from '../utils/logger.backend.js';
import { createEphemeralStateStore } from './ephemeralStateStore.service.js';

const authOauthStateStore = createEphemeralStateStore({
    maxEntries: 100,
    ttlMs: 10 * 60 * 1000
});

export function setAuthOauthState(state, value) {
    return authOauthStateStore.set(state, value);
}

export function hasAuthOauthState(state) {
    return authOauthStateStore.has(state);
}

export function takeAuthOauthState(state) {
    return authOauthStateStore.take(state);
}

export function startAuthOauthStatesCleanup(intervalMs = 60 * 1000) {
    return authOauthStateStore.startCleanup(intervalMs);
}

export function destroyAuthOauthStates() {
    authOauthStateStore.stopCleanup();
    authOauthStateStore.clear();
    safeLog('info', 'Auth OAuth states cleanup destroyed');
}
