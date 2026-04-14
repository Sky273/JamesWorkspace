import express from 'express';

import { authenticateToken, isUserLocalAdmin, requireUserManager } from '../middleware/auth.middleware.js';
import { getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS, securityLog } from '../services/security.service.js';
import { createStripeCheckoutSession, listStripeCreditPacks } from '../services/stripeBilling.service.js';
import { safeLog } from '../utils/logger.backend.js';

const router = express.Router();

router.get('/stripe/credit-packs', authenticateToken, requireUserManager, async (req, res) => {
    try {
        return res.json(listStripeCreditPacks());
    } catch (error) {
        safeLog('error', 'Error listing Stripe credit packs', { error: error.message, userId: req.user?.id || null });
        return res.status(500).json({ error: 'Failed to load Stripe credit packs' });
    }
});

router.post('/stripe/checkout-session', authenticateToken, requireUserManager, async (req, res) => {
    try {
        if (!isUserLocalAdmin(req)) {
            return res.status(403).json({ error: 'Only local admins can purchase credits via Stripe' });
        }

        const packId = typeof req.body?.packId === 'string' ? req.body.packId.trim() : '';
        const session = await createStripeCheckoutSession({
            user: req.user,
            packId,
            origin: req.headers.origin || ''
        });

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.ADMIN_ACTION, {
            ...getRequestMetadata(req),
            action: 'FIRM_CREDITS_STRIPE_CHECKOUT_CREATED',
            message: 'Stripe checkout session created for cabinet credit purchase',
            resourceId: session.id,
            resourceType: 'firm_credit_purchase'
        });

        return res.status(201).json(session);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        safeLog('error', 'Error creating Stripe checkout session', {
            error: error.message,
            userId: req.user?.id || null,
            firmId: req.user?.firmId || null
        });
        return res.status(statusCode).json({
            error: error.message || 'Failed to create Stripe checkout session'
        });
    }
});

export default router;
