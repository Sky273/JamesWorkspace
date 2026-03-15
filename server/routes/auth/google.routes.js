/**
 * Google OAuth Routes
 */

import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authLimiter } from '../../middleware/rateLimit.middleware.js';
import { generateAccessToken, generateRefreshToken } from '../../services/jwt.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import * as googleAuthService from '../../services/googleAuth.service.js';
import { useSecureCookies } from './config.js';

const router = express.Router();

// In-memory store for OAuth states (short-lived)
const oauthStates = new Map();
const STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// Cleanup expired states periodically
let authOauthStatesCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStates.entries()) {
        if (now - data.createdAt > STATE_EXPIRY) {
            oauthStates.delete(state);
        }
    }
}, 60 * 1000);

/**
 * Destroy OAuth states cleanup interval (for graceful shutdown)
 */
export function destroyAuthOauthStates() {
    if (authOauthStatesCleanupInterval) {
        clearInterval(authOauthStatesCleanupInterval);
        authOauthStatesCleanupInterval = null;
    }
    oauthStates.clear();
    safeLog('info', 'Auth OAuth states cleanup destroyed');
}

// GET /api/auth/google - Initiate Google OAuth flow
router.get('/google', authLimiter, async (req, res) => {
    try {
        const { action, returnUrl } = req.query;
        
        const state = crypto.randomBytes(32).toString('hex');
        
        oauthStates.set(state, {
            action: action || 'signin',
            userId: req.cookies.accessToken ? req.user?.id : null,
            returnUrl: returnUrl || '/',
            createdAt: Date.now()
        });
        
        const authUrl = await googleAuthService.getAuthUrl(state);
        
        safeLog('info', 'Google OAuth initiated', { action, state: state.substring(0, 8) });
        
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
        
        if (!state || !oauthStates.has(state)) {
            safeLog('warn', 'Invalid OAuth state');
            return res.redirect('/signin?error=invalid_state');
        }
        
        const stateData = oauthStates.get(state);
        oauthStates.delete(state);
        
        if (Date.now() - stateData.createdAt > STATE_EXPIRY) {
            safeLog('warn', 'OAuth state expired');
            return res.redirect('/signin?error=state_expired');
        }
        
        const googleUser = await googleAuthService.exchangeCodeForUserInfo(code);
        
        if (stateData.action === 'link') {
            if (!stateData.userId) {
                return res.redirect('/settings?error=not_authenticated');
            }
            
            await googleAuthService.linkGoogleAccount(
                stateData.userId,
                googleUser.googleId,
                googleUser.email
            );
            
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
                try {
                    const newUserResult = await query(
                        `INSERT INTO users (email, password, name, role, status, google_id, google_email, google_linked_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                         RETURNING *`,
                        [
                            googleUser.email,
                            '',
                            googleUser.name,
                            'user',
                            'pending',
                            googleUser.googleId,
                            googleUser.email
                        ]
                    );
                    
                    user = newUserResult.rows[0];
                    
                    securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_CREATED, {
                        ...metadata,
                        email: user.email,
                        userId: user.id,
                        action: 'GOOGLE_REGISTER',
                        message: 'New user registered via Google OAuth',
                        metadata: { googleId: googleUser.googleId }
                    });
                    
                    return res.redirect('/signin?success=registered_pending');
                } catch (regError) {
                    safeLog('error', 'Google registration failed', { error: regError.message });
                    return res.redirect('/register?error=registration_failed');
                }
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
        
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        const userData = {
            id: user.id,
            email: user.email,
            name: user.name || '',
            jobTitle: user.job_title || '',
            phone: user.phone || '',
            status: user.status,
            role: user.role,
            firm_id: user.firm_id,
            firm: user.firm_name,
            FirmName: user.firm_name,
            FirmLogo: user.firm_logo || '',
            customer: user.firm_name,
            CustomerName: user.firm_name,
            Name: user.name,
            Email: user.email,
            Status: user.status === 'active' ? 'Active' : 'Inactive',
            Role: user.role
        };
        
        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);
        
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: useSecureCookies,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 1000
        });
        
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: useSecureCookies,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
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
        res.redirect('/signin?error=google_auth_failed');
    }
});

// POST /api/auth/google/token - Sign in with Google ID token
router.post('/google/token', authLimiter, async (req, res) => {
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
        
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        const userData = {
            id: user.id,
            email: user.email,
            name: user.name || '',
            jobTitle: user.job_title || '',
            phone: user.phone || '',
            status: user.status,
            role: user.role,
            firm_id: user.firm_id,
            firm: user.firm_name,
            FirmName: user.firm_name,
            FirmLogo: user.firm_logo || '',
            customer: user.firm_name,
            CustomerName: user.firm_name,
            Name: user.name,
            Email: user.email,
            Status: user.status === 'active' ? 'Active' : 'Inactive',
            Role: user.role
        };
        
        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);
        
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: useSecureCookies,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 1000
        });
        
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: useSecureCookies,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
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
