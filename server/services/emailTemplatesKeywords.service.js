/**
 * Email template keyword substitution helpers.
 */

function getBaseUrl() {
    return process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
}

function extractFirstName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts[0] || '';
}

function formatDate(date = new Date()) {
    const months = [
        'janvier',
        'f' + String.fromCharCode(0x00e9) + 'vrier',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'ao' + String.fromCharCode(0x00fb) + 't',
        'septembre',
        'octobre',
        'novembre',
        'd' + String.fromCharCode(0x00e9) + 'cembre'
    ];

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    return {
        today: `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`,
        todayLong: `${day} ${months[month]} ${year}`
    };
}

export const TEMPLATE_KEYWORDS = {
    client: ['name', 'type', 'industry'],
    contact: ['name', 'firstName', 'role'],
    resume: ['name', 'title', 'version'],
    firm: ['name', 'logo'],
    user: ['name', 'email', 'jobTitle', 'phone'],
    date: ['today', 'todayLong']
};

export function substituteKeywords(content, context = {}) {
    const { client, contact, resume, firm, user } = context;
    const dateValues = formatDate();

    let logoUrl = firm?.logo || '';
    if (logoUrl && logoUrl.startsWith('/')) {
        logoUrl = `${getBaseUrl()}${logoUrl}`;
    }

    const replacements = {
        'client.name': client?.name || '',
        'client.type': client?.type === 'client' ? 'Client' : 'Prospect',
        'client.industry': client?.industry || '',
        'contact.name': contact?.name || '',
        'contact.firstName': extractFirstName(contact?.name),
        'contact.role': contact?.role || '',
        'resume.name': resume?.name || '',
        'resume.title': resume?.title || '',
        'resume.version': resume?.version?.toString() || '1',
        'firm.name': firm?.name || '',
        'firm.logo': logoUrl,
        'user.name': user?.name || '',
        'user.email': user?.email || '',
        'user.jobTitle': user?.jobTitle || '',
        'user.phone': user?.phone || '',
        'date.today': dateValues.today,
        'date.todayLong': dateValues.todayLong
    };

    let result = content;
    for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value);
    }

    return result;
}
