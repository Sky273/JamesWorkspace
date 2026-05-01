import { normalizeUtf8Text } from '../services/openai/textUtils.js';

export function normalizeRequestTextValue(value) {
    if (typeof value === 'string') {
        return normalizeUtf8Text(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeRequestTextValue(item));
    }
    return value;
}

export function normalizeRequestTextFields(payload, fields) {
    const normalized = { ...payload };
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(normalized, field)) {
            normalized[field] = normalizeRequestTextValue(normalized[field]);
        }
    }
    return normalized;
}
