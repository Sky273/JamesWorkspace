export function resolveTrustProxySetting(rawValue = process.env.TRUST_PROXY || '', nodeEnv = process.env.NODE_ENV) {
    const trimmedValue = String(rawValue).trim();
    if (!trimmedValue) {
        return nodeEnv === 'production' ? 1 : 'loopback';
    }

    const normalizedValue = trimmedValue.toLowerCase();
    if (normalizedValue === 'true') {
        return true;
    }
    if (normalizedValue === 'false') {
        return false;
    }
    if (/^\d+$/.test(trimmedValue)) {
        return Number.parseInt(trimmedValue, 10);
    }

    return trimmedValue;
}
