import path from 'path';

function hasWindowsDrivePrefix(value) {
    return /^[a-zA-Z]:/.test(value);
}

function containsControlCharacters(value) {
    for (let index = 0; index < value.length; index += 1) {
        if (value.charCodeAt(index) <= 31) {
            return true;
        }
    }

    return false;
}

export function normalizeArchiveRelativePath(input) {
    if (input === null || input === undefined) {
        return null;
    }

    const rawValue = String(input).trim();
    if (!rawValue) {
        return null;
    }

    if (containsControlCharacters(rawValue)) {
        throw new Error('Invalid archive path');
    }

    const slashNormalized = rawValue.replace(/\\/g, '/');
    if (
        slashNormalized.startsWith('/')
        || slashNormalized.startsWith('//')
        || hasWindowsDrivePrefix(slashNormalized)
    ) {
        throw new Error('Archive path must be relative');
    }

    const normalized = path.posix.normalize(slashNormalized);
    if (
        !normalized
        || normalized === '.'
        || normalized === '..'
        || normalized.startsWith('../')
        || normalized.startsWith('/')
    ) {
        throw new Error('Archive path must stay within the export root');
    }

    const segments = normalized.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes(':'))) {
        throw new Error('Archive path contains invalid segments');
    }

    return normalized;
}
