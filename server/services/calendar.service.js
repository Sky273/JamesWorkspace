/**
 * Google Calendar Integration Service
 * Handles calendar event creation for interview scheduling
 */

import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';
import { googleAuthConfig, encryptToken, decryptToken, calculateTokenExpiry } from '../config/oauth.config.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';
import crypto from 'crypto';
import { JWT_SECRET } from '../config/constants.js';
import {
    buildCalendarEventPatch,
    buildCalendarEventPayload,
    extractCalendarErrorDetails,
    mapCalendarEventSummary,
    mapUpcomingCalendarEvent,
    withCalendarTimeout
} from './calendar.utils.js';

let google = null;

async function getGoogle() {
    if (!google) {
        const googleapis = await import('googleapis');
        google = googleapis.google;
        safeLog('info', 'googleapis module loaded for Calendar service');
    }
    return google;
}

const CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
];

const CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI
    || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/calendar/callback`;
const CALENDAR_STATE_TTL_MS = 10 * 60 * 1000;

function createCalendarStateSignature(payloadBase64) {
    return crypto
        .createHmac('sha256', JWT_SECRET)
        .update(payloadBase64)
        .digest('base64url');
}

export function buildCalendarOAuthState({ userId, issuedAt = Date.now() }) {
    const payloadBase64 = Buffer.from(JSON.stringify({ userId, type: 'calendar', iat: issuedAt })).toString('base64url');
    const signature = createCalendarStateSignature(payloadBase64);
    return `${payloadBase64}.${signature}`;
}

export function parseCalendarOAuthState(state) {
    if (typeof state !== 'string') {
        return null;
    }

    const [payloadBase64, providedSignature] = state.split('.');
    if (!payloadBase64 || !providedSignature) {
        return null;
    }

    const expectedSignature = createCalendarStateSignature(payloadBase64);
    const provided = Buffer.from(providedSignature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        return null;
    }

    const parsed = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (!parsed?.userId || parsed.type !== 'calendar' || !Number.isFinite(parsed.iat)) {
        return null;
    }

    if (Date.now() - parsed.iat > CALENDAR_STATE_TTL_MS) {
        return null;
    }

    return parsed;
}

async function createCalendarOAuth2Client() {
    const g = await getGoogle();
    return new g.auth.OAuth2(
        googleAuthConfig.clientId,
        googleAuthConfig.clientSecret,
        CALENDAR_REDIRECT_URI
    );
}

export async function getCalendarAuthUrl(userId) {
    const client = await createCalendarOAuth2Client();
    const state = buildCalendarOAuthState({ userId });

    return client.generateAuthUrl({
        access_type: 'offline',
        scope: CALENDAR_SCOPES,
        state,
        prompt: 'consent'
    });
}

export async function exchangeCalendarCode(code, userId) {
    try {
        const client = await createCalendarOAuth2Client();
        const { tokens } = await withCalendarTimeout(client.getToken(code), 'Google Calendar token exchange');
        await saveCalendarTokens(userId, tokens);
        safeLog('info', 'Calendar tokens saved', { userId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to exchange calendar code', { ...extractCalendarErrorDetails(error), userId });
        throw error;
    }
}

async function saveCalendarTokens(userId, tokens) {
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : calculateTokenExpiry(3600, !!tokens.refresh_token);
    const existing = await query('SELECT id FROM user_calendar_tokens WHERE user_id = $1', [userId]);

    if (existing.rows.length > 0) {
        await query(
            `UPDATE user_calendar_tokens
             SET access_token_encrypted = $1,
                 refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
                 token_expiry = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $4`,
            [encryptedAccess, encryptedRefresh, expiresAt, userId]
        );
        return;
    }

    await query(
        `INSERT INTO user_calendar_tokens
         (user_id, access_token_encrypted, refresh_token_encrypted, token_expiry)
         VALUES ($1, $2, $3, $4)`,
        [userId, encryptedAccess, encryptedRefresh, expiresAt]
    );
}

async function getCalendarTokens(userId) {
    try {
        const result = await query(
            'SELECT access_token_encrypted, refresh_token_encrypted, token_expiry FROM user_calendar_tokens WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            access_token: decryptToken(row.access_token_encrypted),
            refresh_token: row.refresh_token_encrypted ? decryptToken(row.refresh_token_encrypted) : null,
            expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : null
        };
    } catch (error) {
        safeLog('error', 'Failed to get calendar tokens', { ...extractCalendarErrorDetails(error), userId });
        return null;
    }
}

async function getCalendarClient(userId) {
    const tokens = await getCalendarTokens(userId);
    if (!tokens) {
        return null;
    }

    const client = await createCalendarOAuth2Client();
    client.setCredentials(tokens);
    client.on('tokens', async (newTokens) => {
        if (newTokens.refresh_token || newTokens.access_token) {
            await saveCalendarTokens(userId, {
                access_token: newTokens.access_token || tokens.access_token,
                refresh_token: newTokens.refresh_token || tokens.refresh_token,
                expiry_date: newTokens.expiry_date
            });
        }
    });

    const g = await getGoogle();
    return g.calendar({ version: 'v3', auth: client });
}

export async function isCalendarConnected(userId) {
    const tokens = await getCalendarTokens(userId);
    return !!tokens;
}

export async function disconnectCalendar(userId) {
    try {
        await query('DELETE FROM user_calendar_tokens WHERE user_id = $1', [userId]);
        safeLog('info', 'Calendar disconnected', { userId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to disconnect calendar', { ...extractCalendarErrorDetails(error), userId });
        return false;
    }
}

export async function createCalendarEvent(userId, interview) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            safeLog('warn', 'Calendar not connected for user', { userId });
            return null;
        }

        const response = await withCalendarTimeout(
            calendar.events.insert({
                calendarId: 'primary',
                resource: buildCalendarEventPayload(interview),
                sendUpdates: 'all',
                conferenceDataVersion: 1
            }),
            'Google Calendar create event'
        );

        safeLog('info', 'Calendar event created', { userId, eventId: response.data.id });
        return mapCalendarEventSummary(response.data);
    } catch (error) {
        safeLog('error', 'Failed to create calendar event', { ...extractCalendarErrorDetails(error), userId });
        return null;
    }
}

export async function updateCalendarEvent(userId, eventId, updates) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            return null;
        }

        const response = await withCalendarTimeout(
            calendar.events.patch({
                calendarId: 'primary',
                eventId,
                resource: buildCalendarEventPatch(updates),
                sendUpdates: 'all'
            }),
            'Google Calendar update event'
        );

        safeLog('info', 'Calendar event updated', { userId, eventId });
        return mapCalendarEventSummary(response.data);
    } catch (error) {
        safeLog('error', 'Failed to update calendar event', { ...extractCalendarErrorDetails(error), userId, eventId });
        return null;
    }
}

export async function deleteCalendarEvent(userId, eventId) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            return false;
        }

        await withCalendarTimeout(
            calendar.events.delete({
                calendarId: 'primary',
                eventId,
                sendUpdates: 'all'
            }),
            'Google Calendar delete event'
        );

        safeLog('info', 'Calendar event deleted', { userId, eventId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to delete calendar event', { ...extractCalendarErrorDetails(error), userId, eventId });
        return false;
    }
}

export async function getUpcomingCalendarEvents(userId, maxResults = 10) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            return [];
        }

        const response = await withCalendarTimeout(
            calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                maxResults,
                singleEvents: true,
                orderBy: 'startTime'
            }),
            'Google Calendar list events'
        );

        return response.data.items.map(mapUpcomingCalendarEvent);
    } catch (error) {
        safeLog('error', 'Failed to get calendar events', { ...extractCalendarErrorDetails(error), userId });
        return [];
    }
}

export async function initCalendarTokensTable() {
    try {
        await assertSchemaRequirements({
            context: 'calendar tokens',
            tables: ['user_calendar_tokens'],
            indexes: ['idx_user_calendar_tokens_user_id']
        });

        safeLog('info', 'Calendar tokens schema verified');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to verify calendar tokens schema', extractCalendarErrorDetails(error));
        return false;
    }
}

export function destroyCalendarService() {
    google = null;
    safeLog('info', 'Calendar service module destroyed');
}

export default {
    getCalendarAuthUrl,
    exchangeCalendarCode,
    isCalendarConnected,
    disconnectCalendar,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    getUpcomingCalendarEvents,
    initCalendarTokensTable,
    destroyCalendarService
};
