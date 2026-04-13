/**
 * Google OAuth Routes
 */

import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authLimiter } from '../../middleware/rateLimit.middleware.js';
import { validateBody, googleTokenSchema } from '../../utils/validation.js';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../../services/jwt.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import * as googleAuthService from '../../services/googleAuth.service.js';
import * as authService from '../../services/auth.service.js';
import { sendRegistrationConfirmationEmail } from '../../services/registrationEmail.service.js';
import {
    setAuthOauthState,
    hasAuthOauthState,
    takeAuthOauthState
} from '../../services/authOauthState.service.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './config.js';

const router = express.Router();

const STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const ALLOWED_OAUTH_ACTIONS = new Set(['signin', 'register', 'link']);
const GOOGLE_AUTH_DB_ERROR_CODE = googleAuthService.GOOGLE_AUTH_DB_ERROR_CODE;
const GOOGLE_AUTH_UPSTREAM_ERROR_CODE = googleAuthService.GOOGLE_AUTH_UPSTREAM_ERROR_CODE;

function hasFirmAssignment(user) {
    return Boolean(user?.firm_id && user?.firm_name);
}

function resolveOAuthAction(action) {
    return typeof action === 'string' && ALLOWED_OAUTH_ACTIONS.has(action) ? action : 'signin';
}

function resolveOAuthUserId(req) {
    const accessToken = req.cookies?.accessToken;
    if (!accessToken) {
        return null;
    }

    const decoded = verifyToken(accessToken);
    return decoded?.id || null;
}

function isGoogleAuthDbError(error) {
    return error?.code === GOOGLE_AUTH_DB_ERROR_CODE;
}

function isGoogleAuthUpstreamError(error) {
    return error?.code === GOOGLE_AUTH_UPSTREAM_ERROR_CODE;
}

// GET /api/auth/google - Initiate Google OAuth flow
router.get('/google', authLimiter, async (req, res) => {
    try {
        const { action, returnUrl } = req.query;
        const resolvedAction = resolveOAuthAction(action);
        const state = crypto.randomBytes(32).toString('hex');

        // Sanitize returnUrl: only allow relative paths (prevents open redirect)
        let safeReturnUrl = '/';
        if (returnUrl && typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
            safeReturnUrl = returnUrl;
        }

        setAuthOauthState(state, {
            action: resolvedAction,
            userId: resolvedAction === 'link' ? resolveOAuthUserId(req) : null,
            returnUrl: safeReturnUrl,
            createdAt: Date.now()
        });

        const authUrl = await googleAuthService.getAuthUrl(state);

        safeLog('info', 'Google OAuth initiated', { action: resolvedAction, state: state.substring(0, 8) });

        res.json({ authUrl });
    } catch (error) {
        safeLog('error', 'Google OAuth init error', { error: error.message });
        res.status(500).json({ error: 'Failed to initiate Google authentication' });
    }
});

// GET /api/auth/google/callback - Google OAuth callback
router.get('/google/callback', async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;
        const metadata = getRequestMetadata(req);

        if (oauthError) {
            safeLog('warn', 'Google OAuth error', { error: oauthError });
            return res.redirect('/signin?error=google_auth_failed');
        }

        if (typeof code !== 'string' || !code.trim()) {
            safeLog('warn', 'Google OAuth callback missing code');
            return res.redirect('/signin?error=missing_code');
        }

        if (typeof state !== 'string' || !hasAuthOauthState(state)) {
            safeLog('warn', 'Invalid OAuth state');
            return res.redirect('/signin?error=invalid_state');
        }

        const stateData = takeAuthOauthState(state);

        if (Date.now() - stateData.createdAt > STATE_EXPIRY) {
            safeLog('warn', 'OAuth state expired');
            return res.redirect('/signin?error=state_expired');
        }

        const googleUser = await googleAuthService.exchangeCodeForUserInfo(code);
        
        if (stateData.action === 'link') {
            if (!stateData.userId) {
                return res.redirect('/settings?error=not_authenticated');
            }

            const currentUser = await authService.findUserWithFirmById(stateData.userId);
            if (!currentUser || currentUser.status === 'inactive') {
                return res.redirect('/settings?error=not_authenticated');
            }

            const linked = await googleAuthService.linkGoogleAccount(
                stateData.userId,
                googleUser.googleId,
                googleUser.email
            );
            if (!linked) {
                return res.redirect('/settings?error=not_authenticated');
            }
            
            securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
                ...metadata,
                userId: stateData.userId,
                action: 'GOOGLE_LINK',
                message: 'Google account linked successfully',
                metadata: { googleEmail: googleUser.email }
            });
            
            return res.redirect('/settings?success=google_linked');
        }
        
        // Sign in flow
        let user = await googleAuthService.findUserByGoogleId(googleUser.googleId);
        
        if (!user) {
            user = await googleAuthService.findUserByEmail(googleUser.email);
            
            if (user) {
                await googleAuthService.linkGoogleAccount(
                    user.id,
                    googleUser.googleId,
                    googleUser.email
                );
                safeLog('info', 'Google account auto-linked', { userId: user.id, email: googleUser.email });
            }
        }
        
        if (!user) {
            if (stateData.action === 'register') {
                const registrationResult = await authService.registerSelfServiceUser({
                    email: googleUser.email,
                    name: googleUser.name,
                    googleId: googleUser.googleId,
                    googleEmail: googleUser.email
                });
                const createdUser = registrationResult.user;

                if (registrationResult.autoApproved) {
                    try {
                        await sendRegistrationConfirmationEmail({
                            to: googleUser.email,
                            name: googleUser.name
                        });
                    } catch (emailError) {
                        safeLog('warn', 'Google registration confirmation email failed after auto-approval', {
                            email: googleUser.email,
                            userId: createdUser.id,
                            error: emailError.message
                        });
                    }
                }

                securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_CREATED, {
                    ...metadata,
                    email: googleUser.email,
                    userId: createdUser.id,
                    action: 'GOOGLE_REGISTER_SUCCESS',
                    message: registrationResult.autoApproved
                        ? 'Google self-registration completed with immediate activation and dedicated test firm'
                        : 'Google self-registration completed with default firm assignment',
                    metadata: {
                        googleId: googleUser.googleId,
                        status: createdUser.status,
                        autoApproved: registrationResult.autoApproved
                    }
                });
                return res.redirect(`/signin?success=${registrationResult.autoApproved ? 'registered_active_test' : 'registered_pending'}`);
            } else {
                securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_FAILURE, {
                    ...metadata,
                    email: googleUser.email,
                    action: 'GOOGLE_SIGNIN',
                    message: 'Google sign-in attempt with unregistered email',
                    metadata: { googleId: googleUser.googleId }
                });
                return res.redirect('/signin?error=no_account&email=' + encodeURIComponent(googleUser.email));
            }
        }
        
        if (user.status === 'inactive') {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_BLOCKED, {
                ...metadata,
                email: user.email,
                userId: user.id,
                action: 'GOOGLE_SIGNIN',
                message: 'Google sign-in attempt on inactive account'
            });
            return res.redirect('/signin?error=account_inactive');
        }

        if (!hasFirmAssignment(user)) {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_BLOCKED, {
                ...metadata,
                email: user.email,
                userId: user.id,
                action: 'GOOGLE_SIGNIN',
                message: 'Google sign-in blocked because account has no firm assignment',
                metadata: { reason: 'missing_firm_assignment' }
            });
            return res.redirect('/signin?error=firm_assignment_required');
        }
        
        await authService.updateLastLogin(user.id);
        
        const userData = {
            id: user.id,
            email: user.email,
            name: user.name || '',
            jobTitle: user.job_title || '',
            phone: user.phone || '',
            status: user.status,
            role: user.role,
            firmId: user.firm_id,
            firm_id: user.firm_id,
            firmName: user.firm_name,
            firm: user.firm_name,
            firmLogo: user.firm_logo || '',
            customerId: user.firm_id,
            customerName: user.firm_name,
            customer: user.firm_name
        };
        
        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);
        
        res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE);
        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE);
        
        if (googleUser.accessToken) {
            await googleAuthService.saveGmailTokens(
                user.id,
                googleUser.accessToken,
                googleUser.refreshToken,
                3600
            );
        }
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
            ...metadata,
            email: userData.email,
            userId: userData.id,
            role: userData.role,
            action: 'GOOGLE_SIGNIN_SUCCESS',
            message: 'User signed in via Google OAuth',
            metadata: { gmailConnected: !!googleUser.accessToken }
        });
        
        res.redirect(stateData.returnUrl || '/');
        
    } catch (error) {
        safeLog('error', 'Google OAuth callback error', { error: error.message });
        if (isGoogleAuthDbError(error) || isGoogleAuthUpstreamError(error)) {
            return res.redirect('/signin?error=service_unavailable');
        }
        res.redirect('/signin?error=google_auth_failed');
    }
});

// POST /api/auth/google/token - Sign in with Google ID token
router.post('/google/token', authLimiter, validateBody(googleTokenSchema), async (req, res) => {
    try {
        const { idToken } = req.body;
        const metadata = getRequestMetadata(req);
        
        if (!idToken) {
            return res.status(400).json({ error: 'ID token is required' });
        }
        
        const googleUser = await googleAuthService.verifyIdToken(idToken);
        
        let user = await googleAuthService.findUserByGoogleId(googleUser.googleId);
        
        if (!user) {
            user = await googleAuthService.findUserByEmail(googleUser.email);
            
            if (user) {
                await googleAuthService.linkGoogleAccount(
                    user.id,
                    googleUser.googleId,
                    googleUser.email
                );
            }
        }
        
        if (!user) {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_FAILURE, {
                ...metadata,
                email: googleUser.email,
                action: 'GOOGLE_TOKEN_SIGNIN',
                message: 'Google token sign-in with unregistered email'
            });
            return res.status(401).json({ 
                error: 'No account found with this email',
                email: googleUser.email
            });
        }
        
        if (user.status === 'inactive') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        if (!hasFirmAssignment(user)) {
            return res.status(403).json({
                error: 'Account is not assigned to a firm. Contact an administrator.'
            });
        }
        
        await authService.updateLastLogin(user.id);
        
        const userData = {
            id: user.id,
            email: user.email,
            name: user.name || '',
            jobTitle: user.job_title || '',
            phone: user.phone || '',
            status: user.status,
            role: user.role,
            firmId: user.firm_id,
            firm_id: user.firm_id,
            firmName: user.firm_name,
            firm: user.firm_name,
            firmLogo: user.firm_logo || '',
            customerId: user.firm_id,
            customerName: user.firm_name,
            customer: user.firm_name
        };
        
        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);
        
        res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE);
        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
            ...metadata,
            email: userData.email,
            userId: userData.id,
            role: userData.role,
            action: 'GOOGLE_TOKEN_SIGNIN_SUCCESS',
            message: 'User signed in via Google ID token'
        });
        
        res.json({ user: userData });
        
    } catch (error) {
        safeLog('error', 'Google token signin error', { error: error.message });
        if (isGoogleAuthDbError(error) || isGoogleAuthUpstreamError(error)) {
            return res.status(503).json({ error: 'Authentication service temporarily unavailable' });
        }
        res.status(401).json({ error: 'Invalid Google token' });
    }
});

// GET /api/auth/google/status - Check if Google is linked
router.get('/google/status', authenticateToken, async (req, res) => {
    try {
        const status = await googleAuthService.getGoogleLinkStatus(req.user.id);
        res.json(status);
    } catch (error) {
        safeLog('error', 'Google status error', { error: error.message });
        if (isGoogleAuthDbError(error) || isGoogleAuthUpstreamError(error)) {
            return res.status(503).json({ error: 'Failed to get Google status' });
        }
        res.status(500).json({ error: 'Failed to get Google status' });
    }
});

// POST /api/auth/google/unlink - Unlink Google account
router.post('/google/unlink', authenticateToken, async (req, res) => {
    try {
        await googleAuthService.unlinkGoogleAccount(req.user.id);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
            ...getRequestMetadata(req),
            userId: req.user.id,
            action: 'GOOGLE_UNLINK',
            message: 'Google account unlinked'
        });
        
        res.json({ success: true, message: 'Google account unlinked' });
    } catch (error) {
        safeLog('error', 'Google unlink error', { error: error.message });
        res.status(500).json({ error: 'Failed to unlink Google account' });
    }
});

export default router;
