import express from 'express';

import { handleStripeWebhook } from '../services/stripeBilling.service.js';
import { safeLog } from '../utils/logger.backend.js';

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        await handleStripeWebhook(req.body, Array.isArray(signature) ? signature[0] : signature);
        return res.status(200).json({ received: true });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        safeLog('error', 'Stripe webhook processing failed', {
            error: error.message,
            type: error.type || null
        });
        return res.status(statusCode).send(`Webhook Error: ${error.message}`);
    }
});

export default router;
