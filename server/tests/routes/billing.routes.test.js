import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

const mockListStripeCreditPacks = vi.fn();
const mockCreateStripeCheckoutSession = vi.fn();

vi.mock('../../services/stripeBilling.service.js', () => ({
    listStripeCreditPacks: (...args) => mockListStripeCreditPacks(...args),
    createStripeCheckoutSession: (...args) => mockCreateStripeCheckoutSession(...args)
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization !== 'Bearer valid-token') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const role = req.headers['x-test-role'] || 'localAdmin';
        req.user = {
            id: 'user-1',
            email: 'local-admin@example.com',
            role,
            firmId: 'firm-1',
            firm_id: 'firm-1',
            firmName: 'Acme'
        };
        next();
    },
    requireUserManager: (req, res, next) => {
        if (req.user?.role === 'admin' || req.user?.role === 'localAdmin') {
            return next();
        }

        return res.status(403).json({ error: 'Manager access required' });
    },
    isUserLocalAdmin: (req) => req.user?.role === 'localAdmin'
}));

vi.mock('../../services/security.service.js', () => ({
    getRequestMetadata: vi.fn(() => ({})),
    LOG_LEVELS: { SECURITY: 'SECURITY' },
    SECURITY_EVENTS: { ADMIN_ACTION: 'ADMIN_ACTION' },
    securityLog: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import billingRoutes from '../../routes/billing.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/billing', billingRoutes);
    return app;
}

describe('Billing Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockListStripeCreditPacks.mockReturnValue({
            enabled: true,
            currency: 'eur',
            packs: [{ id: 'starter', credits: 250, priceCents: 2900 }]
        });
    });

    it('returns Stripe credit packs to managers', async () => {
        const response = await request(app)
            .get('/api/billing/stripe/credit-packs')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(200);
        expect(response.body.enabled).toBe(true);
        expect(mockListStripeCreditPacks).toHaveBeenCalled();
    });

    it('creates a checkout session for local admins', async () => {
        mockCreateStripeCheckoutSession.mockResolvedValue({
            id: 'purchase-1',
            url: 'https://checkout.stripe.test/session'
        });

        const response = await request(app)
            .post('/api/billing/stripe/checkout-session')
            .set('Authorization', 'Bearer valid-token')
            .set('Origin', 'http://localhost:5173')
            .send({ packId: 'starter' });

        expect(response.status).toBe(201);
        expect(response.body.url).toContain('stripe.test');
        expect(mockCreateStripeCheckoutSession).toHaveBeenCalledWith({
            user: expect.objectContaining({ id: 'user-1', firmId: 'firm-1' }),
            packId: 'starter',
            origin: 'http://localhost:5173'
        });
    });

    it('rejects checkout session creation for super admins', async () => {
        const response = await request(app)
            .post('/api/billing/stripe/checkout-session')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ packId: 'starter' });

        expect(response.status).toBe(403);
        expect(mockCreateStripeCheckoutSession).not.toHaveBeenCalled();
    });
});
