import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockListUsers = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockGetUserFirmId = vi.fn();

vi.mock('../../services/users.service.js', () => ({
    listUsers: (...args) => mockListUsers(...args),
    updateUserProfile: (...args) => mockUpdateUserProfile(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    updateUserProfileSchema: {}
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization !== 'Bearer valid-token') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        req.user = {
            id: req.headers['x-test-user-id'] || 'user-123',
            role: req.headers['x-test-role'] || 'user'
        };
        next();
    },
    requireUserManager: (req, res, next) => {
        if (req.user?.role === 'admin' || req.user?.role === 'local_admin') {
            return next();
        }
        return res.status(403).json({ error: 'User manager access required' });
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') {
            return next();
        }
        return res.status(403).json({ error: 'Admin access required' });
    },
    isUserAdmin: (req) => req.user?.role === 'admin'
}));

import usersRoutes from '../../routes/users.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/users', usersRoutes);
    return app;
}

describe('Users Profile Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should reject invalid pagination on admin list', async () => {
        const res = await request(app)
            .get('/api/users?page=-1&limit=0')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid pagination parameters');
        expect(mockListUsers).not.toHaveBeenCalled();
    });

    it('should bypass cache on admin list when refresh=1', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListUsers.mockResolvedValueOnce({ users: [], hasMore: false });

        const res = await request(app)
            .get('/api/users?refresh=1')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockListUsers).toHaveBeenCalledWith(expect.objectContaining({ bypassCache: true }));
    });

    it('should allow self profile update with basic fields only', async () => {
        mockUpdateUserProfile.mockResolvedValueOnce({
            id: 'user-123',
            name: 'Updated User',
            email: 'user@test.com',
            job_title: 'Engineer',
            phone: '123',
            firm_name: 'Firm',
            firm_id: 'firm-123',
            role: 'user',
            status: 'active'
        });

        const res = await request(app)
            .put('/api/users/user-123')
            .set('Authorization', 'Bearer valid-token')
            .send({
                name: 'Updated User',
                job_title: 'Engineer',
                phone: '123',
                role: 'admin',
                firm_id: '00000000-0000-0000-0000-000000000001'
            });

        expect(res.status).toBe(200);
        expect(mockUpdateUserProfile).toHaveBeenCalledWith('user-123', {
            name: 'Updated User',
            jobTitle: 'Engineer',
            phone: '123'
        }, false);
    });

    it('should reject admin updating another user through profile route', async () => {
        const res = await request(app)
            .put('/api/users/user-456')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ name: 'Nope' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Not authorized to update this profile');
        expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
});
