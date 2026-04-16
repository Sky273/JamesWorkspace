import JSZip from 'jszip';

function toBuffer(input) {
    return Buffer.isBuffer(input) ? input : Buffer.from(input || []);
}

function hasPrefix(buffer, prefix) {
    const source = toBuffer(buffer);
    const expected = Buffer.from(prefix);
    if (source.length < expected.length) {
        return false;
    }
    return source.subarray(0, expected.length).equals(expected);
}

function isPdf(buffer) {
    return hasPrefix(buffer, '%PDF-');
}

function isDocx(buffer) {
    return hasPrefix(buffer, [0x50, 0x4B, 0x03, 0x04]) || hasPrefix(buffer, [0x50, 0x4B, 0x05, 0x06]) || hasPrefix(buffer, [0x50, 0x4B, 0x07, 0x08]);
}

function isDoc(buffer) {
    return hasPrefix(buffer, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
}

function isPng(buffer) {
    return hasPrefix(buffer, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
}

function isJpeg(buffer) {
    return hasPrefix(buffer, [0xFF, 0xD8, 0xFF]);
}

function isGif(buffer) {
    return hasPrefix(buffer, 'GIF87a') || hasPrefix(buffer, 'GIF89a');
}

function isWebp(buffer) {
    const source = toBuffer(buffer);
    return source.length >= 12
        && source.subarray(0, 4).equals(Buffer.from('RIFF'))
        && source.subarray(8, 12).equals(Buffer.from('WEBP'));
}

function normalizeZipEntryName(entryName) {
    return String(entryName || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function extractMainWordDocumentPart(contentTypesXml) {
    if (typeof contentTypesXml !== 'string' || contentTypesXml.trim().length === 0) {
        return '';
    }

    const overrideTags = contentTypesXml.match(/<Override\b[^>]*\/?>/gi) || [];

    for (const overrideTag of overrideTags) {
        if (!/ContentType\s*=\s*["']application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml["']/i.test(overrideTag)) {
            continue;
        }

        const partMatch = overrideTag.match(/PartName\s*=\s*["']([^"']+)["']/i);
        if (partMatch?.[1]) {
            return normalizeZipEntryName(partMatch[1]);
        }
    }

    return '';
}

function hasRootRelationshipsEntry(entryNames) {
    return entryNames.includes('_rels/.rels');
}

export async function isValidDocxArchive(buffer) {
    if (!isDocx(buffer)) {
        return false;
    }

    try {
        const zip = await JSZip.loadAsync(toBuffer(buffer));
        const entryNames = Object.keys(zip.files).map(normalizeZipEntryName);

        if (!entryNames.includes('[Content_Types].xml')) {
            return false;
        }

        const contentTypesEntry = zip.file('[Content_Types].xml');
        if (!contentTypesEntry) {
            return false;
        }

        const contentTypesXml = await contentTypesEntry.async('string');
        if (!hasRootRelationshipsEntry(entryNames)) {
            return false;
        }

        const declaredMainDocument = extractMainWordDocumentPart(contentTypesXml);
        if (!declaredMainDocument) {
            return false;
        }

        return entryNames.includes(declaredMainDocument);
    } catch {
        return false;
    }
}

export function isValidFileSignature(buffer, mimeType) {
    switch (mimeType) {
        case 'application/pdf':
            return isPdf(buffer);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            // DOCX files are validated more thoroughly by the upload handlers.
            return isDocx(buffer);
        case 'application/msword':
            return isDoc(buffer);
        case 'image/png':
            return isPng(buffer);
        case 'image/jpeg':
            return isJpeg(buffer);
        case 'image/gif':
            return isGif(buffer);
        case 'image/webp':
            return isWebp(buffer);
        default:
            return false;
    }
}

export function getRequiredSignatureBytes(mimeType) {
    switch (mimeType) {
        case 'application/pdf':
            return 5;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return 4;
        case 'application/msword':
            return 8;
        case 'image/png':
            return 8;
        case 'image/jpeg':
            return 3;
        case 'image/gif':
            return 6;
        case 'image/webp':
            return 12;
        default:
            return 0;
    }
}
