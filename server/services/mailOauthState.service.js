import { safeLog } from '../utils/logger.backend.js';
import { createEphemeralStateStore } from './ephemeralStateStore.service.js';

const mailOauthStateStore = createEphemeralStateStore({
    maxEntries: 100,
    ttlMs: 10 * 60 * 1000
});

export function setMailOauthState(state, value) {
    return mailOauthStateStore.set(state, value);
}

export function takeMailOauthState(state) {
    return mailOauthStateStore.take(state);
}

export function startMailStatesCleanup(intervalMs = 5 * 60 * 1000) {
    return mailOauthStateStore.startCleanup(intervalMs);
}

export function destroyMailStatesCleanup() {
    mailOauthStateStore.stopCleanup();
    mailOauthStateStore.clear();
    safeLog('info', 'Mail OAuth states cleanup destroyed');
}
