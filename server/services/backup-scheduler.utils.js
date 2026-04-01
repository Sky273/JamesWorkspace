const PARIS_TIME_ZONE = 'Europe/Paris';
const BACKUP_DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const BACKUP_TYPE_LABELS = {
    daily: 'quotidienne',
    weekly: 'hebdomadaire',
    monthly: 'mensuelle'
};

export function parseTime(timeStr) {
    const [hours, minutes] = String(timeStr || '02:00').split(':').map(Number);
    return { hours, minutes };
}

export function getParisTime() {
    const now = new Date();
    const parisStr = now.toLocaleString('en-US', {
        timeZone: PARIS_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parisDate = new Date(now.toLocaleString('en-US', { timeZone: PARIS_TIME_ZONE }));
    const [hours, minutes] = parisStr.split(':').map(Number);

    return {
        hours,
        minutes,
        dayOfWeek: parisDate.getDay(),
        dayOfMonth: parisDate.getDate()
    };
}

export function timeMatches(configTime, currentHours, currentMinutes) {
    const { hours, minutes } = parseTime(configTime);
    return hours === currentHours && minutes === currentMinutes;
}

export function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

export function getBackupExecutionKey(type, todayKey) {
    if (type === 'weekly') {
        return `${todayKey}-weekly`;
    }
    if (type === 'monthly') {
        return `${todayKey}-monthly`;
    }
    return todayKey;
}

export function getBackupTypeLabel(type) {
    return BACKUP_TYPE_LABELS[type] || type;
}

export function getBackupDayName(dayIndex) {
    return BACKUP_DAY_NAMES[dayIndex] || String(dayIndex);
}

export function buildBackupScheduleSummary(settings = {}) {
    return {
        host: settings.host ? '***configured***' : 'NOT SET',
        daily_enabled: settings.daily_enabled,
        daily_time: settings.daily_time,
        weekly_enabled: settings.weekly_enabled,
        weekly_day: settings.weekly_day,
        weekly_day_name: getBackupDayName(settings.weekly_day),
        weekly_time: settings.weekly_time,
        monthly_enabled: settings.monthly_enabled,
        monthly_day: settings.monthly_day,
        monthly_time: settings.monthly_time
    };
}

export function createBackupFailureEmailContent(type, error, duration) {
    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: PARIS_TIME_ZONE });
    const typeLabel = getBackupTypeLabel(type);

    return {
        subject: `Echec de la sauvegarde ${typeLabel} - ResumeConverter`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: #991b1b; margin: 0 0 10px 0;">Echec de sauvegarde planifiee</h2>
                    <p style="color: #374151; margin: 0;">La sauvegarde <strong>${typeLabel}</strong> de la base de donnees a echoue.</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 12px; font-weight: bold; color: #374151;">Type</td>
                        <td style="padding: 8px 12px; color: #6b7280;">${typeLabel}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 12px; font-weight: bold; color: #374151;">Date/Heure</td>
                        <td style="padding: 8px 12px; color: #6b7280;">${timestamp}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 12px; font-weight: bold; color: #374151;">Duree</td>
                        <td style="padding: 8px 12px; color: #6b7280;">${duration}s</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; font-weight: bold; color: #374151;">Erreur</td>
                        <td style="padding: 8px 12px; color: #dc2626;">${error.message}</td>
                    </tr>
                </table>
                <p style="color: #6b7280; font-size: 13px;">Veuillez verifier la configuration de la sauvegarde dans les parametres de ResumeConverter et relancer une sauvegarde manuelle si necessaire.</p>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">Email envoye automatiquement par ResumeConverter.</p>
            </div>
        `,
        text: `Echec de la sauvegarde ${typeLabel}\nErreur: ${error.message}\nDuree: ${duration}s\nDate/Heure: ${timestamp}`
    };
}
