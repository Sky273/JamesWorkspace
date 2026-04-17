const DEFAULT_BATCH_EXPORT_MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_BATCH_EXPORT_MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;

export function getBatchExportMaxArchiveBytes() {
    const configuredValue = Number.parseInt(process.env.BATCH_EXPORT_MAX_ARCHIVE_BYTES || '', 10);
    if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
        return DEFAULT_BATCH_EXPORT_MAX_ARCHIVE_BYTES;
    }

    return Math.min(configuredValue, MAX_BATCH_EXPORT_MAX_ARCHIVE_BYTES);
}

export function getGeneratedArtifactByteLength(content) {
    if (content instanceof ArrayBuffer) {
        return content.byteLength;
    }

    if (ArrayBuffer.isView(content)) {
        return content.byteLength;
    }

    if (Buffer.isBuffer(content)) {
        return content.length;
    }

    return 0;
}

export function buildBatchExportArchiveBudgetError({ currentBytes, nextBytes, maxBytes }) {
    return new Error(
        `Batch export exceeds configured archive budget (${currentBytes + nextBytes}/${maxBytes} bytes)`
    );
}
