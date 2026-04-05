const DEFAULT_PDF_SERVICE_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_SHARE_PDF_TIMEOUT_MS = 45_000;

function parsePositiveIntegerEnvValue(value) {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getPdfServiceRequestTimeoutMs() {
    return parsePositiveIntegerEnvValue(process.env.PDF_SERVER_REQUEST_TIMEOUT_MS)
        || DEFAULT_PDF_SERVICE_REQUEST_TIMEOUT_MS;
}

export function getSharePdfTimeoutMs() {
    return parsePositiveIntegerEnvValue(process.env.SHARE_PDF_TIMEOUT_MS)
        || parsePositiveIntegerEnvValue(process.env.PDF_SERVER_REQUEST_TIMEOUT_MS)
        || DEFAULT_SHARE_PDF_TIMEOUT_MS;
}

export function getPdfProxyTimeoutMs() {
    return parsePositiveIntegerEnvValue(process.env.PDF_PROXY_TIMEOUT_MS)
        || getPdfServiceRequestTimeoutMs();
}

export function getBatchExportPdfTimeoutMs() {
    return parsePositiveIntegerEnvValue(process.env.BATCH_EXPORT_PDF_TIMEOUT_MS)
        || getPdfServiceRequestTimeoutMs();
}
