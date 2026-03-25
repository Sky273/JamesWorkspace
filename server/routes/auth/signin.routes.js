/**
 * Authentication Routes - Sign In, Register, Refresh, Logout
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '../../config/constants.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authLimiter } from '../../middleware/rateLimit.middleware.js';
import { validateBody, signInSchema, registerSchema, isValidEmail } from '../../utils/validation.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyToken, revokeToken } from '../../services/jwt.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { is2FAEnabled, verifyTotpCode } from '../../services/totp.service.js';
import * as authService from '../../services/auth.service.js';
import { useSecureCookies, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, CLEAR_ACCESS_TOKEN, CLEAR_REFRESH_TOKEN } from './config.js';

const router = express.Router();

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Format a raw DB user row into a consistent API response shape.
 */
function formatUserResponse(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name || '',
        jobTitle: user.job_title || '',
        phone: user.phone || '',
        status: user.status,
        role: user.role,
        firm_id: user.firm_id,
        firm: user.firm_name,
        firmLogo: user.firm_logo || '',
        customer: user.firm_name,
        google_id: user.google_id || null,
        google_email: user.google_email || null
    };
}

/**
 * Fetch a user with firm logo by user ID
 */
async function fetchUserWithFirm(userId) {
    return authService.findUserWithFirmById(userId);
}

// ============================================
// ROUTES
// ============================================

// POST /api/auth/signin - User login
router.post('/signin', authLimiter, validateBody(signInSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
            return res.status(400).json({ error: 'Invalid password format' });
        }

        const normalizedEmail = email.toLowerCase();
        const metadata = getRequestMetadata(req);
        
        // Fetch user with firm logo
        const user = await authService.findUserWithFirmByEmail(normalizedEmail);

        if (!user) {
            securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_FAILURE, {
                ...metadata,
                email: normalizedEmail,
                statusCode: 401,
                action: 'LOGIN_ATTEMPT',
                message: 'Login attempt with non-existent email',
                metadata: { reason: 'user_not_found' }
            });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_FAILURE, {
                ...metadata,
                email: normalizedEmail,
                userId: user.id,
                firm: user.firm_name,
                role: user.role,
                statusCode: 401,
                action: 'LOGIN_ATTEMPT',
                message: 'Login attempt with invalid password',
                metadata: { reason: 'invalid_password' }
            });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.status === 'inactive') {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_BLOCKED, {
                ...metadata,
                email: normalizedEmail,
                userId: user.id,
                firm: user.firm_name,
                role: user.role,
                statusCode: 403,
                action: 'LOGIN_ATTEMPT',
                message: 'Login attempt on inactive account',
                metadata: { reason: 'account_inactive' }
            });
            return res.status(403).json({ error: 'Account is inactive. Please contact administrator.' });
        }

        // Check if 2FA is enabled
        const has2FA = await is2FAEnabled(user.id);
        const { totpCode } = req.body;
        
        if (has2FA) {
            if (!totpCode) {
                return res.status(200).json({
                    requires2FA: true,
                    userId: user.id,
                    message: 'Code 2FA requis'
                });
            }
            
            const verification = await verifyTotpCode(user.id, totpCode);
            
            if (!verification.valid) {
                securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_FAILURE, {
                    ...metadata,
                    email: normalizedEmail,
                    userId: user.id,
                    statusCode: 401,
                    action: '2FA_VERIFICATION',
                    message: '2FA verification failed',
                    metadata: { reason: 'invalid_2fa_code' }
                });
                return res.status(401).json({ error: 'Code 2FA invalide' });
            }
            
            if (verification.usedBackupCode) {
                safeLog('warn', '2FA backup code used during login', { userId: user.id });
            }
        }

        // Update last login timestamp
        await authService.updateLastLogin(user.id);

        const userData = formatUserResponse(user);
        
        safeLog('debug', 'User data prepared for signin', { 
            userId: userData.id, 
            firm: userData.firm 
        });

        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);

        res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE);
        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE);

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
            ...metadata,
            email: userData.email,
            userId: userData.id,
            customer: userData.customer,
            role: userData.role,
            statusCode: 200,
            action: 'LOGIN_SUCCESS',
            message: 'User successfully signed in',
            metadata: { status: userData.status }
        });

        res.json({
            user: userData
        });
    } catch (error) {
        safeLog('error', 'Sign in error', { error: error.message });
        securityLog(LOG_LEVELS.ERROR, SECURITY_EVENTS.AUTH_FAILURE, {
            ...getRequestMetadata(req),
            message: 'Sign in error',
            metadata: { error: error.message }
        });
        res.status(500).json({ error: 'Failed to sign in' });
    }
});

// POST /api/auth/register - User registration
router.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const normalizedEmail = email.toLowerCase();
        const metadata = getRequestMetadata(req);

        const existingUser = await authService.findExistingUserByEmail(normalizedEmail);

        if (existingUser) {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_FAILURE, {
                ...metadata,
                email: normalizedEmail,
                statusCode: 409,
                action: 'REGISTER_ATTEMPT',
                message: 'Registration attempt with existing email',
                metadata: { reason: 'email_exists' }
            });
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userData = {
            email: normalizedEmail,
            password: hashedPassword,
            name: name,
            role: 'user',
            status: 'pending'
        };

        const newUser = await authService.createUser(userData);

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_CREATED, {
            ...metadata,
            email: newUser.email,
            userId: newUser.id,
            role: newUser.role,
            statusCode: 201,
            action: 'USER_REGISTRATION',
            message: 'New user registered successfully'
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role
            }
        });
    } catch (error) {
        safeLog('error', 'Registration error', { error: error.message });
        securityLog(LOG_LEVELS.ERROR, SECURITY_EVENTS.AUTH_FAILURE, {
            ...getRequestMetadata(req),
            message: 'Registration error',
            metadata: { error: error.message }
        });
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// POST /api/auth/refresh - Refresh access token (with token rotation)
router.post('/refresh', authLimiter, async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token not found' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = await fetchUserWithFirm(decoded.id);
        
        if (!user || user.status === 'inactive') {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        const userData = formatUserResponse(user);
        const newAccessToken = generateAccessToken(userData);

        // Refresh token rotation: issue new refresh token and blacklist the old one
        const newRefreshToken = generateRefreshToken(userData);
        await revokeToken(refreshToken);

        res.cookie('accessToken', newAccessToken, ACCESS_TOKEN_COOKIE);
        res.cookie('refreshToken', newRefreshToken, REFRESH_TOKEN_COOKIE);

        res.json({ user: userData });
    } catch (error) {
        safeLog('error', 'Token refresh error', { error: error.message });
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

function resolveLogoutUser(accessToken, refreshToken) {
    const decodedAccessToken = accessToken ? verifyToken(accessToken) : null;
    if (decodedAccessToken) {
        return decodedAccessToken;
    }

    const decodedRefreshToken = refreshToken ? verifyRefreshToken(refreshToken) : null;
    if (decodedRefreshToken) {
        return decodedRefreshToken;
    }

    return null;
}

// Logout handler
const logoutHandler = async (req, res) => {
    try {
        const metadata = getRequestMetadata(req);
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;
        const logoutUser = resolveLogoutUser(accessToken, refreshToken);

        if (accessToken) {
            await revokeToken(accessToken);
        }
        if (refreshToken) {
            await revokeToken(refreshToken);
        }

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.AUTH_LOGOUT, {
            ...metadata,
            userId: logoutUser?.id,
            email: logoutUser?.email,
            statusCode: 200,
            action: 'LOGOUT',
            message: 'User signed out'
        });

        res.clearCookie('accessToken', CLEAR_ACCESS_TOKEN);
        res.clearCookie('refreshToken', CLEAR_REFRESH_TOKEN);
        res.json({ message: 'Signed out successfully' });
    } catch (error) {
        safeLog('error', 'Sign out error', { error: error.message });
        res.status(500).json({ error: 'Failed to sign out' });
    }
};

router.post('/signout', logoutHandler);
router.post('/logout', logoutHandler);

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await fetchUserWithFirm(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: formatUserResponse(user) });
    } catch (error) {
        safeLog('error', 'Get current user error', { error: error.message });
        res.status(500).json({ error: 'Failed to get user information' });
    }
});

export default router;

