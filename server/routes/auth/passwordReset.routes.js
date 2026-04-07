/**
 * Password Reset Routes
 * POST /api/auth/forgot-password - Request password reset email
 * POST /api/auth/reset-password  - Reset password with token
 */

import express from 'express';
import { authLimiter } from '../../middleware/rateLimit.middleware.js';
import { validateBody, forgotPasswordSchema, resetPasswordSchema } from '../../utils/validation.js';
import { requestPasswordReset, resetPassword } from '../../services/passwordReset.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';

const router = express.Router();

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 * Rate limited + always returns 200 to prevent email enumeration
 */
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), async (req, res) => {
    try {
        const { email } = req.body;
        const metadata = getRequestMetadata(req);

        await requestPasswordReset(email);

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.AUTH_FAILURE, {
            ...metadata,
            email: email.toLowerCase(),
            action: 'PASSWORD_RESET_REQUEST',
            message: 'Password reset requested',
            statusCode: 200
        });

        res.json({
            success: true,
            message: 'Si un compte existe avec cette adresse email, un lien de réinitialisation a été envoyé.'
        });
    } catch (error) {
        if (error?.code === 'PASSWORD_RESET_EMAIL_DELIVERY_FAILED') {
            safeLog('error', 'Password reset token created but email delivery failed', {
                error: error.message
            });
        } else {
            safeLog('error', 'Forgot password error', { error: error.message });
        }
        // Still return 200 to prevent enumeration
        res.json({
            success: true,
            message: 'Si un compte existe avec cette adresse email, un lien de réinitialisation a été envoyé.'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token
 */
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), async (req, res) => {
    try {
        const { token, password } = req.body;
        const metadata = getRequestMetadata(req);

        const result = await resetPassword(token, password);

        if (!result.success) {
            const errorMessages = {
                invalid_token: 'Lien de réinitialisation invalide.',
                token_used: 'Ce lien a déjà été utilisé. Veuillez en demander un nouveau.',
                token_expired: 'Ce lien a expiré. Veuillez en demander un nouveau.',
                account_inactive: 'Ce compte est désactivé. Contactez un administrateur.'
            };

            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_FAILURE, {
                ...metadata,
                action: 'PASSWORD_RESET_FAILURE',
                message: `Password reset failed: ${result.error}`,
                statusCode: 400
            });

            return res.status(400).json({
                success: false,
                error: errorMessages[result.error] || 'Erreur lors de la réinitialisation.',
                code: result.error
            });
        }

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
            ...metadata,
            action: 'PASSWORD_RESET_SUCCESS',
            message: 'Password successfully reset',
            statusCode: 200
        });

        res.json({
            success: true,
            message: 'Votre mot de passe a été réinitialisé avec succès.'
        });
    } catch (error) {
        safeLog('error', 'Reset password error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la réinitialisation du mot de passe.'
        });
    }
});

export default router;
