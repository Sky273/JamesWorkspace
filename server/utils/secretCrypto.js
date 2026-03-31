import crypto from 'crypto';
import { JWT_SECRET } from '../config/constants.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const PREFIX = 'enc:v1';

function getKeyMaterial(envVarNames = []) {
    for (const envVarName of envVarNames) {
        const value = process.env[envVarName];
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    if (typeof JWT_SECRET === 'string' && JWT_SECRET.length > 0) {
        return JWT_SECRET;
    }

    throw new Error('No encryption key material is configured');
}

function getDerivedKey({ envVarNames = [], purpose = 'default' } = {}) {
    const keyMaterial = getKeyMaterial(envVarNames);
    return crypto.scryptSync(keyMaterial, `resumeconverter:${purpose}`, 32);
}

export function isEncryptedSecret(value) {
    return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(value, options = {}) {
    if (!value) {
        return '';
    }

    if (isEncryptedSecret(value)) {
        return value;
    }

    const key = getDerivedKey(options);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag().toString('base64');
    return `${PREFIX}:${iv.toString('base64')}:${authTag}:${encrypted}`;
}

export function decryptSecret(value, options = {}) {
    if (!value) {
        return '';
    }

    if (!isEncryptedSecret(value)) {
        return value;
    }

    const [, version, ivBase64, authTagBase64, encrypted] = value.split(':');
    if (version !== 'v1' || !ivBase64 || !authTagBase64 || !encrypted) {
        throw new Error('Invalid encrypted secret format');
    }

    const key = getDerivedKey(options);
    const decipher = crypto.createDecipheriv(
        ENCRYPTION_ALGORITHM,
        key,
        Buffer.from(ivBase64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
