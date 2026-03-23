/**
 * Google Calendar Integration Service
 * Handles calendar event creation for interview scheduling
 */

import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';
import { googleAuthConfig, encryptToken, decryptToken, calculateTokenExpiry } from '../config/oauth.config.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';

// Lazy-loaded googleapis module
let google = null;

/**
 * Get googleapis module (lazy loaded)
 */
async function getGoogle() {
    if (!google) {
        const googleapis = await import('googleapis');
        google = googleapis.google;
        safeLog('info', 'googleapis module loaded for Calendar service');
    }
    return google;
}

// Calendar-specific OAuth config
const CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
];

const CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 
    `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/calendar/callback`;

/**
 * Create OAuth2 client for Calendar
 */
async function createCalendarOAuth2Client() {
    const g = await getGoogle();
    return new g.auth.OAuth2(
        googleAuthConfig.clientId,
        googleAuthConfig.clientSecret,
        CALENDAR_REDIRECT_URI
    );
}

/**
 * Generate Calendar OAuth authorization URL
 * @param {string} userId - User ID for state
 * @returns {Promise<string>} Authorization URL
 */
export async function getCalendarAuthUrl(userId) {
    const client = await createCalendarOAuth2Client();
    const state = Buffer.from(JSON.stringify({ userId, type: 'calendar' })).toString('base64');
    
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: CALENDAR_SCOPES,
        state: state,
        prompt: 'consent'
    });
}

/**
 * Exchange authorization code for calendar tokens
 * @param {string} code - Authorization code
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function exchangeCalendarCode(code, userId) {
    try {
        const client = await createCalendarOAuth2Client();
        const { tokens } = await client.getToken(code);
        
        // Save tokens
        await saveCalendarTokens(userId, tokens);
        
        safeLog('info', 'Calendar tokens saved', { userId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to exchange calendar code', { error: error.message, userId });
        throw error;
    }
}

/**
 * Save calendar tokens for a user
 */
async function saveCalendarTokens(userId, tokens) {
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : calculateTokenExpiry(3600, !!tokens.refresh_token);
    
    // Check if user already has calendar connection
    const existing = await query(
        'SELECT id FROM user_calendar_tokens WHERE user_id = $1',
        [userId]
    );
    
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
    } else {
        await query(
            `INSERT INTO user_calendar_tokens 
             (user_id, access_token_encrypted, refresh_token_encrypted, token_expiry)
             VALUES ($1, $2, $3, $4)`,
            [userId, encryptedAccess, encryptedRefresh, expiresAt]
        );
    }
}

/**
 * Get calendar tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Tokens or null
 */
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
        safeLog('error', 'Failed to get calendar tokens', { error: error.message, userId });
        return null;
    }
}

/**
 * Get authenticated Calendar client
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Calendar client or null
 */
async function getCalendarClient(userId) {
    const tokens = await getCalendarTokens(userId);
    if (!tokens) {
        return null;
    }
    
    const client = await createCalendarOAuth2Client();
    client.setCredentials(tokens);
    
    // Handle token refresh
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

/**
 * Check if user has calendar connected
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function isCalendarConnected(userId) {
    const tokens = await getCalendarTokens(userId);
    return !!tokens;
}

/**
 * Disconnect calendar
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function disconnectCalendar(userId) {
    try {
        await query('DELETE FROM user_calendar_tokens WHERE user_id = $1', [userId]);
        safeLog('info', 'Calendar disconnected', { userId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to disconnect calendar', { error: error.message, userId });
        return false;
    }
}

/**
 * Create a calendar event for an interview
 * @param {string} userId - User ID
 * @param {Object} interview - Interview details
 * @returns {Promise<Object|null>} Created event or null
 */
export async function createCalendarEvent(userId, interview) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            safeLog('warn', 'Calendar not connected for user', { userId });
            return null;
        }
        
        const startTime = new Date(interview.scheduledAt);
        const endTime = new Date(startTime.getTime() + (interview.durationMinutes || 60) * 60 * 1000);
        
        const event = {
            summary: interview.title,
            description: interview.description || '',
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'Europe/Paris'
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'Europe/Paris'
            },
            location: interview.location || '',
            attendees: (interview.attendees || []).map(a => ({
                email: a.email,
                displayName: a.name
            })),
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 30 }
                ]
            }
        };
        
        // Add conference data if meeting link is a Google Meet link
        if (interview.meetingLink && interview.meetingLink.includes('meet.google.com')) {
            event.conferenceData = {
                entryPoints: [{
                    entryPointType: 'video',
                    uri: interview.meetingLink
                }]
            };
        }
        
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            sendUpdates: 'all',
            conferenceDataVersion: 1
        });
        
        safeLog('info', 'Calendar event created', { userId, eventId: response.data.id });
        
        return {
            eventId: response.data.id,
            htmlLink: response.data.htmlLink,
            hangoutLink: response.data.hangoutLink
        };
    } catch (error) {
        safeLog('error', 'Failed to create calendar event', { error: error.message, userId });
        return null;
    }
}

/**
 * Update a calendar event
 * @param {string} userId - User ID
 * @param {string} eventId - Calendar event ID
 * @param {Object} updates - Event updates
 * @returns {Promise<Object|null>} Updated event or null
 */
export async function updateCalendarEvent(userId, eventId, updates) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            return null;
        }
        
        const event = {};
        
        if (updates.title) event.summary = updates.title;
        if (updates.description) event.description = updates.description;
        if (updates.location) event.location = updates.location;
        
        if (updates.scheduledAt) {
            const startTime = new Date(updates.scheduledAt);
            const endTime = new Date(startTime.getTime() + (updates.durationMinutes || 60) * 60 * 1000);
            event.start = { dateTime: startTime.toISOString(), timeZone: 'Europe/Paris' };
            event.end = { dateTime: endTime.toISOString(), timeZone: 'Europe/Paris' };
        }
        
        if (updates.attendees) {
            event.attendees = updates.attendees.map(a => ({
                email: a.email,
                displayName: a.name
            }));
        }
        
        const response = await calendar.events.patch({
            calendarId: 'primary',
            eventId: eventId,
            resource: event,
            sendUpdates: 'all'
        });
        
        safeLog('info', 'Calendar event updated', { userId, eventId });
        
        return {
            eventId: response.data.id,
            htmlLink: response.data.htmlLink
        };
    } catch (error) {
        safeLog('error', 'Failed to update calendar event', { error: error.message, userId, eventId });
        return null;
    }
}

/**
 * Delete a calendar event
 * @param {string} userId - User ID
 * @param {string} eventId - Calendar event ID
 * @returns {Promise<boolean>}
 */
export async function deleteCalendarEvent(userId, eventId) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            return false;
        }
        
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId,
            sendUpdates: 'all'
        });
        
        safeLog('info', 'Calendar event deleted', { userId, eventId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to delete calendar event', { error: error.message, userId, eventId });
        return false;
    }
}

/**
 * Get upcoming events from calendar
 * @param {string} userId - User ID
 * @param {number} maxResults - Maximum number of events
 * @returns {Promise<Array>} Events
 */
export async function getUpcomingCalendarEvents(userId, maxResults = 10) {
    try {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            return [];
        }
        
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: maxResults,
            singleEvents: true,
            orderBy: 'startTime'
        });
        
        return response.data.items.map(event => ({
            id: event.id,
            title: event.summary,
            description: event.description,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            location: event.location,
            htmlLink: event.htmlLink,
            hangoutLink: event.hangoutLink,
            attendees: event.attendees
        }));
    } catch (error) {
        safeLog('error', 'Failed to get calendar events', { error: error.message, userId });
        return [];
    }
}

/**
 * Verify calendar tokens schema is present
 */
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
        safeLog('error', 'Failed to verify calendar tokens schema', { error: error.message });
        return false;
    }
}

/**
 * Destroy googleapis module reference (for graceful shutdown)
 */
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
