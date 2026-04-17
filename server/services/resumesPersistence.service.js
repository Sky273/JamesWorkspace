import { stripNullCharacters } from '../utils/sanitizer.backend.js';

export function resolveResumeExecutor(executor) {
    if (typeof executor === 'function') {
        return executor;
    }

    if (executor && typeof executor.query === 'function') {
        return executor.query.bind(executor);
    }

    return null;
}

export function sanitizeResumePersistenceValue(value) {
    return typeof value === 'string' ? stripNullCharacters(value) : value;
}

export function buildResumeUpdateStatement(updateData, allowedColumns) {
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && allowedColumns.has(key)) {
            setClauses.push(`${key} = $${idx}`);
            params.push(sanitizeResumePersistenceValue(value));
            idx++;
        }
    }

    return {
        setClauses,
        params,
        idParamIndex: idx
    };
}
