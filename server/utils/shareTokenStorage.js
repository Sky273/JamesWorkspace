import crypto from 'crypto';
import { decryptSecret, isEncryptedSecret } from './secretCrypto.js';

const STORAGE_PREFIX = 'v2';
const MAX_SHARE_TOKEN_STORAGE_LENGTH = 64;

function hashShareToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
}

export function createStoredShareToken(token) {
    if (!token) {
        return token;
    }

    // Resume share-token columns are varchar(64), so the persisted storage
    // format must stay within the original 64-hex-character contract.
    return token.slice(0, MAX_SHARE_TOKEN_STORAGE_LENGTH);
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

    const decryptedToken = decryptSecret(encryptedToken, {
        envVarNames: ['SHARE_TOKEN_ENCRYPTION_KEY', 'MAIL_TOKEN_ENCRYPTION_KEY'],
        purpose: 'share-token'
    });
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
