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

export function isValidFileSignature(buffer, mimeType) {
    switch (mimeType) {
        case 'application/pdf':
            return isPdf(buffer);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
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
