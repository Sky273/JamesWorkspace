function resolveLogoSource(logo = {}) {
    if (logo?.logo_data) {
        const mimeType = logo.logo_mime_type || 'image/png';
        const base64 = Buffer.isBuffer(logo.logo_data)
            ? logo.logo_data.toString('base64')
            : Buffer.from(logo.logo_data).toString('base64');
        return `data:${mimeType};base64,${base64}`;
    }

    const logoUrl = typeof logo?.logo_url === 'string' ? logo.logo_url.trim() : '';
    if (!logoUrl) {
        return '';
    }

    if (/^https?:\/\//i.test(logoUrl) || logoUrl.startsWith('data:')) {
        return logoUrl;
    }

    const baseUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    if (logoUrl.startsWith('/') && baseUrl) {
        return `${baseUrl}${logoUrl}`;
    }

    return logoUrl;
}

export function buildFirmLogoMarkup(logo = {}) {
    const source = resolveLogoSource(logo);
    if (!source) {
        return '';
    }

    return `<img src="${source}" alt="Logo du cabinet" class="firm-logo" style="max-height:60px;">`;
}

export function replaceExportTemplatePlaceholders(content, { name = '', title = '', logoMarkup = '' } = {}) {
    if (!content) {
        return '';
    }

    return content
        .replace(/-name-/gi, name)
        .replace(/-title-/gi, title)
        .replace(/-logo-/gi, logoMarkup);
}
