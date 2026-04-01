/**
 * Calendar Routes
 * API endpoints for Google Calendar integration
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, createCalendarEventSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    getCalendarAuthUrl,
    exchangeCalendarCode,
    isCalendarConnected,
    disconnectCalendar,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    getUpcomingCalendarEvents
} from '../services/calendar.service.js';

const router = express.Router();

function getTrustedFrontendOrigin() {
    const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
    try {
        return new URL(frontendUrl).origin;
    } catch {
        return 'http://localhost:5173';
    }
}

/**
 * GET /api/calendar/status
 * Check if user has calendar connected
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const connected = await isCalendarConnected(req.user.id);
        res.json({ connected });
    } catch (error) {
        safeLog('error', 'Failed to get calendar status', { error: error.message });
        res.status(500).json({ error: 'Failed to get calendar status' });
    }
});

/**
 * GET /api/calendar/auth-url
 * Get Google Calendar OAuth URL
 */
router.get('/auth-url', authenticateToken, async (req, res) => {
    try {
        const authUrl = await getCalendarAuthUrl(req.user.id);
        res.json({ authUrl });
    } catch (error) {
        safeLog('error', 'Failed to generate calendar auth URL', { error: error.message });
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
});

/**
 * GET /api/calendar/callback
 * OAuth callback for Google Calendar
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        if (!code || !state) {
            return res.status(400).send('Missing code or state parameter');
        }
        
        // Decode state to get userId
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const { userId } = stateData;
        
        if (!userId) {
            return res.status(400).send('Invalid state parameter');
        }
        
        await exchangeCalendarCode(code, userId);
        const targetOrigin = getTrustedFrontendOrigin();
        
        // Close popup and notify parent (no inline scripts for CSP compliance)
        res.send(`
            <html>
                <body data-callback-type="calendar-connected" data-target-origin="${targetOrigin}">
                    <p>Calendar connected! You can close this window.</p>
                    <script src="/api/docs/static/oauth-callback.js"></script>
                </body>
            </html>
        `);
    } catch (error) {
        safeLog('error', 'Calendar OAuth callback failed', { error: error.message });
        const targetOrigin = getTrustedFrontendOrigin();
        res.status(500).send(`
            <html>
                <body data-callback-type="calendar-error" data-callback-error="Connection failed" data-target-origin="${targetOrigin}">
                    <p>Failed to connect calendar. You can close this window.</p>
                    <script src="/api/docs/static/oauth-callback.js"></script>
                </body>
            </html>
        `);
    }
});

/**
 * POST /api/calendar/disconnect
 * Disconnect Google Calendar
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
    try {
        await disconnectCalendar(req.user.id);
        res.json({ success: true });
    } catch (error) {
        safeLog('error', 'Failed to disconnect calendar', { error: error.message });
        res.status(500).json({ error: 'Failed to disconnect calendar' });
    }
});

/**
 * POST /api/calendar/events
 * Create a calendar event
 */
router.post('/events', authenticateToken, validateBody(createCalendarEventSchema), async (req, res) => {
    try {
        const event = await createCalendarEvent(req.user.id, req.body);
        
        if (!event) {
            return res.status(400).json({ error: 'Calendar not connected or event creation failed' });
        }
        
        res.status(201).json(event);
    } catch (error) {
        safeLog('error', 'Failed to create calendar event', { error: error.message });
        res.status(500).json({ error: 'Failed to create event' });
    }
});

/**
 * PATCH /api/calendar/events/:eventId
 * Update a calendar event
 */
router.patch('/events/:eventId', authenticateToken, async (req, res) => {
    try {
        const event = await updateCalendarEvent(req.user.id, req.params.eventId, req.body);
        
        if (!event) {
            return res.status(400).json({ error: 'Calendar not connected or event update failed' });
        }
        
        res.json(event);
    } catch (error) {
        safeLog('error', 'Failed to update calendar event', { error: error.message });
        res.status(500).json({ error: 'Failed to update event' });
    }
});

/**
 * DELETE /api/calendar/events/:eventId
 * Delete a calendar event
 */
router.delete('/events/:eventId', authenticateToken, async (req, res) => {
    try {
        const success = await deleteCalendarEvent(req.user.id, req.params.eventId);
        
        if (!success) {
            return res.status(400).json({ error: 'Calendar not connected or event deletion failed' });
        }
        
        res.json({ success: true });
    } catch (error) {
        safeLog('error', 'Failed to delete calendar event', { error: error.message });
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

/**
 * GET /api/calendar/events
 * Get upcoming calendar events
 */
router.get('/events', authenticateToken, async (req, res) => {
    try {
        const maxResults = parseInt(req.query.maxResults) || 10;
        const events = await getUpcomingCalendarEvents(req.user.id, maxResults);
        res.json(events);
    } catch (error) {
        safeLog('error', 'Failed to get calendar events', { error: error.message });
        res.status(500).json({ error: 'Failed to get events' });
    }
});

export default router;
