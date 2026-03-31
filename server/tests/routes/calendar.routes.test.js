/**
 * Tests for Calendar routes
 * GET /status, GET /auth-url, GET /callback, POST /disconnect,
 * POST /events, PATCH /events/:eventId, DELETE /events/:eventId, GET /events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock calendar service
const mockIsCalendarConnected = vi.fn();
const mockGetCalendarAuthUrl = vi.fn();
const mockExchangeCalendarCode = vi.fn();
const mockDisconnectCalendar = vi.fn();
const mockCreateCalendarEvent = vi.fn();
const mockUpdateCalendarEvent = vi.fn();
const mockDeleteCalendarEvent = vi.fn();
const mockGetUpcomingCalendarEvents = vi.fn();
vi.mock('../../services/calendar.service.js', () => ({
    isCalendarConnected: (...args) => mockIsCalendarConnected(...args),
    getCalendarAuthUrl: (...args) => mockGetCalendarAuthUrl(...args),
    exchangeCalendarCode: (...args) => mockExchangeCalendarCode(...args),
    disconnectCalendar: (...args) => mockDisconnectCalendar(...args),
    createCalendarEvent: (...args) => mockCreateCalendarEvent(...args),
    updateCalendarEvent: (...args) => mockUpdateCalendarEvent(...args),
    deleteCalendarEvent: (...args) => mockDeleteCalendarEvent(...args),
    getUpcomingCalendarEvents: (...args) => mockGetUpcomingCalendarEvents(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createCalendarEventSchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', email: 'user@test.com', role: 'user' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import calendarRoutes from '../../routes/calendar.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/calendar', calendarRoutes);
    return app;
}

describe('Calendar Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // GET /api/calendar/status
    // ==========================================
    describe('GET /status', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/calendar/status');
            expect(res.status).toBe(401);
        });

        it('should return connected true', async () => {
            mockIsCalendarConnected.mockResolvedValueOnce(true);

            const res = await request(app)
                .get('/api/calendar/status')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.connected).toBe(true);
            expect(mockIsCalendarConnected).toHaveBeenCalledWith('user-123');
        });

        it('should return connected false', async () => {
            mockIsCalendarConnected.mockResolvedValueOnce(false);

            const res = await request(app)
                .get('/api/calendar/status')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.connected).toBe(false);
        });

        it('should return 500 on error', async () => {
            mockIsCalendarConnected.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/calendar/status')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to get calendar status');
        });
    });

    // ==========================================
    // GET /api/calendar/auth-url
    // ==========================================
    describe('GET /auth-url', () => {
        it('should return OAuth URL', async () => {
            mockGetCalendarAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');

            const res = await request(app)
                .get('/api/calendar/auth-url')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.authUrl).toContain('google.com');
        });

        it('should return 500 on error', async () => {
            mockGetCalendarAuthUrl.mockRejectedValueOnce(new Error('Config missing'));

            const res = await request(app)
                .get('/api/calendar/auth-url')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to generate auth URL');
        });
    });

    // ==========================================
    // GET /api/calendar/callback (PUBLIC)
    // ==========================================
    describe('GET /callback', () => {
        it('should exchange code and return success HTML', async () => {
            mockExchangeCalendarCode.mockResolvedValueOnce(true);
            const state = Buffer.from(JSON.stringify({ userId: 'user-123' })).toString('base64');

            const res = await request(app)
                .get(`/api/calendar/callback?code=auth-code-123&state=${state}`);

            expect(res.status).toBe(200);
            expect(res.text).toContain('Calendar connected');
            expect(res.text).toContain('data-target-origin="http://localhost:5173"');
            expect(mockExchangeCalendarCode).toHaveBeenCalledWith('auth-code-123', 'user-123');
        });

        it('should return 400 if code missing', async () => {
            const res = await request(app)
                .get('/api/calendar/callback?state=abc');

            expect(res.status).toBe(400);
            expect(res.text).toContain('Missing code or state');
        });

        it('should return 400 if state missing', async () => {
            const res = await request(app)
                .get('/api/calendar/callback?code=abc');

            expect(res.status).toBe(400);
        });

        it('should return 400 if state has no userId', async () => {
            const state = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64');

            const res = await request(app)
                .get(`/api/calendar/callback?code=abc&state=${state}`);

            expect(res.status).toBe(400);
            expect(res.text).toContain('Invalid state');
        });

        it('should return 500 on exchange failure', async () => {
            mockExchangeCalendarCode.mockRejectedValueOnce(new Error('Token exchange failed'));
            const state = Buffer.from(JSON.stringify({ userId: 'user-123' })).toString('base64');

            const res = await request(app)
                .get(`/api/calendar/callback?code=bad-code&state=${state}`);

            expect(res.status).toBe(500);
            expect(res.text).toContain('Failed to connect');
        });
    });

    // ==========================================
    // POST /api/calendar/disconnect
    // ==========================================
    describe('POST /disconnect', () => {
        it('should disconnect calendar', async () => {
            mockDisconnectCalendar.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/calendar/disconnect')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockDisconnectCalendar).toHaveBeenCalledWith('user-123');
        });

        it('should return 500 on error', async () => {
            mockDisconnectCalendar.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .post('/api/calendar/disconnect')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // POST /api/calendar/events
    // ==========================================
    describe('POST /events', () => {
        const eventBody = {
            summary: 'Interview with John',
            start: '2026-02-01T10:00:00Z',
            end: '2026-02-01T11:00:00Z'
        };

        it('should create event', async () => {
            mockCreateCalendarEvent.mockResolvedValueOnce({
                id: 'evt-1',
                ...eventBody
            });

            const res = await request(app)
                .post('/api/calendar/events')
                .set('Authorization', 'Bearer valid-token')
                .send(eventBody);

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('evt-1');
        });

        it('should return 400 if calendar not connected', async () => {
            mockCreateCalendarEvent.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/calendar/events')
                .set('Authorization', 'Bearer valid-token')
                .send(eventBody);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('not connected');
        });

        it('should return 500 on error', async () => {
            mockCreateCalendarEvent.mockRejectedValueOnce(new Error('API error'));

            const res = await request(app)
                .post('/api/calendar/events')
                .set('Authorization', 'Bearer valid-token')
                .send(eventBody);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // PATCH /api/calendar/events/:eventId
    // ==========================================
    describe('PATCH /events/:eventId', () => {
        it('should update event', async () => {
            mockUpdateCalendarEvent.mockResolvedValueOnce({ id: 'evt-1', summary: 'Updated' });

            const res = await request(app)
                .patch('/api/calendar/events/evt-1')
                .set('Authorization', 'Bearer valid-token')
                .send({ summary: 'Updated' });

            expect(res.status).toBe(200);
            expect(mockUpdateCalendarEvent).toHaveBeenCalledWith('user-123', 'evt-1', { summary: 'Updated' });
        });

        it('should return 400 if update fails', async () => {
            mockUpdateCalendarEvent.mockResolvedValueOnce(null);

            const res = await request(app)
                .patch('/api/calendar/events/evt-1')
                .set('Authorization', 'Bearer valid-token')
                .send({ summary: 'x' });

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // DELETE /api/calendar/events/:eventId
    // ==========================================
    describe('DELETE /events/:eventId', () => {
        it('should delete event', async () => {
            mockDeleteCalendarEvent.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/calendar/events/evt-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 if deletion fails', async () => {
            mockDeleteCalendarEvent.mockResolvedValueOnce(false);

            const res = await request(app)
                .delete('/api/calendar/events/evt-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // GET /api/calendar/events
    // ==========================================
    describe('GET /events', () => {
        it('should return upcoming events', async () => {
            mockGetUpcomingCalendarEvents.mockResolvedValueOnce([
                { id: 'evt-1', summary: 'Meeting' }
            ]);

            const res = await request(app)
                .get('/api/calendar/events')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(mockGetUpcomingCalendarEvents).toHaveBeenCalledWith('user-123', 10);
        });

        it('should respect maxResults param', async () => {
            mockGetUpcomingCalendarEvents.mockResolvedValueOnce([]);

            await request(app)
                .get('/api/calendar/events?maxResults=25')
                .set('Authorization', 'Bearer valid-token');

            expect(mockGetUpcomingCalendarEvents).toHaveBeenCalledWith('user-123', 25);
        });

        it('should return 500 on error', async () => {
            mockGetUpcomingCalendarEvents.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/calendar/events')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to get events');
        });
    });
});
