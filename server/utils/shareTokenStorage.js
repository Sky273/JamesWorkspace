import crypto from 'crypto';
import { decryptSecret, encryptSecret, isEncryptedSecret } from './secretCrypto.js';

const STORAGE_PREFIX = 'v2';
const TOKEN_OPTIONS = {
    envVarNames: ['SHARE_TOKEN_ENCRYPTION_KEY', 'MAIL_TOKEN_ENCRYPTION_KEY'],
    purpose: 'share-token'
};

function hashShareToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
}

export function createStoredShareToken(token) {
    const encryptedToken = encryptSecret(token, TOKEN_OPTIONS);
    return `${STORAGE_PREFIX}:${hashShareToken(token)}:${encryptedToken}`;
}

export function readStoredShareToken(storedValue) {
    if (!storedValue) {
        return null;
    }

    if (!storedValue.startsWith(`${STORAGE_PREFIX}:`)) {
        return storedValue;
    }

    const [, tokenHash, ...encryptedParts] = storedValue.split(':');
    const encryptedToken = encryptedParts.join(':');
    if (!tokenHash || !isEncryptedSecret(encryptedToken)) {
        throw new Error('Invalid stored share token format');
    }

    const decryptedToken = decryptSecret(encryptedToken, TOKEN_OPTIONS);
    if (hashShareToken(decryptedToken) !== tokenHash) {
        throw new Error('Stored share token integrity check failed');
    }

    return decryptedToken;
}

export function getStoredShareTokenLookup(token) {
    return {
        exactToken: token,
        v2Pattern: `${STORAGE_PREFIX}:${hashShareToken(token)}:%`
    };
}
