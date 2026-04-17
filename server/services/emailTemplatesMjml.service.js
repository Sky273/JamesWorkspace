import { safeLog } from '../utils/logger.backend.js';

let mjml2html = null;
let mjmlCoreModule = null;
let mjmlPreset = null;
let mjmlLastUsed = 0;
let mjmlUnloadTimer = null;

const MJML_UNLOAD_TIMEOUT = 10 * 60 * 1000;

function scheduleMjmlUnload() {
    if (mjmlUnloadTimer) {
        clearTimeout(mjmlUnloadTimer);
    }

    mjmlUnloadTimer = setTimeout(() => {
        if (mjml2html && Date.now() - mjmlLastUsed >= MJML_UNLOAD_TIMEOUT) {
            unloadMjml();
        }
    }, MJML_UNLOAD_TIMEOUT + 1000);

    if (mjmlUnloadTimer.unref) {
        mjmlUnloadTimer.unref();
    }
}

function unloadMjml() {
    if (mjml2html || mjmlCoreModule) {
        mjml2html = null;
        mjmlCoreModule = null;
        mjmlPreset = null;
        mjmlLastUsed = 0;

        if (global.gc) {
            global.gc();
            safeLog('info', 'mjml-core references released and GC triggered (~10MB freed)');
        } else {
            safeLog('info', 'mjml-core references released (~10MB will be freed by GC)');
        }
    }
}

async function getMjml() {
    mjmlLastUsed = Date.now();

    if (!mjml2html) {
        mjmlCoreModule = await import('mjml-core');
        const mjmlPresetModule = await import('mjml-preset-core');
        mjmlPreset = mjmlPresetModule.default;
        mjml2html = mjmlCoreModule.default.default;
        safeLog('info', 'mjml-core module loaded lazily with preset support (~10MB)');
    }

    scheduleMjmlUnload();
    return mjml2html;
}

export async function compileMjml(mjmlContent) {
    try {
        const mjml = await getMjml();
        const result = mjml(mjmlContent, {
            validationLevel: 'soft',
            minify: false,
            presets: mjmlPreset ? [mjmlPreset] : []
        });

        if (result.errors && result.errors.length > 0) {
            safeLog('warn', 'MJML compilation warnings', { errors: result.errors });
        }

        let html = result.html;
        if (html && !html.includes('charset="UTF-8"') && !html.includes("charset='UTF-8'") && !html.includes('charset=UTF-8')) {
            html = html.replace(/<head>/i, '<head>\n    <meta charset="UTF-8">');
        }

        return html;
    } catch (error) {
        safeLog('error', 'MJML compilation failed', { error: error.message });
        throw new Error(`MJML compilation failed: ${error.message}`);
    }
}

export function destroyMjml() {
    if (mjmlUnloadTimer) {
        clearTimeout(mjmlUnloadTimer);
        mjmlUnloadTimer = null;
    }
    unloadMjml();
}
