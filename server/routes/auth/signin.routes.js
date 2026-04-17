/**
 * Authentication Routes - Sign In, Register, Refresh, Logout
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authLimiter, registrationLimiter } from '../../middleware/rateLimit.middleware.js';
import { validateBody, signInSchema, registerSchema, isValidEmail } from '../../utils/validation.js';
import { consumeRefreshToken, generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyToken, revokeToken } from '../../services/jwt.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { mapUserToFrontend } from '../../utils/mappers.js';
import { is2FAEnabled, verifyTotpCode } from '../../services/totp.service.js';
import * as authService from '../../services/auth.service.js';
import { enforceRegistrationProtection } from '../../services/registrationProtection.service.js';
import {
    getEmailVerificationRedirectUrl,
    sendVerificationEmail,
    verifyEmailToken
} from '../../services/emailVerification.service.js';
import {
    getAccessTokenCookieOptions,
    getRefreshTokenCookieOptions,
    getClearAccessTokenOptions,
    getClearRefreshTokenOptions
} from './config.js';

const router = express.Router();
const AUTH_REVALIDATE_CACHE_HEADERS = {
    'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
};

// ============================================
// SHARED HELPERS
// ============================================

function formatUserResponse(user) {
    return mapUserToFrontend(user, {
        includeLegacyAliases: true,
        includeGoogleFields: true
    });
}

/**
 * Fetch a user with firm logo by user ID
 */
async function fetchUserWithFirm(userId) {
    return authService.findUserWithFirmById(userId);
}

function hasFirmAssignment(user) {
    return Boolean(user?.firm_id && user?.firm_name);
}

function blockUnassignedUser(res) {
    return res.status(403).json({
        error: 'Account is not assigned to a firm. Contact an administrator.',
        code: 'firm_assignment_required'
    });
}

function isEmailVerified(user) {
    return Boolean(user?.email_verified_at);
}

function requiresEmailVerification(user) {
    return authService.isSelfServiceRegistrationUser(user);
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
            return res.status(403).json({
                error: 'Account is inactive. Please contact administrator.',
                code: 'account_inactive'
            });
        }

        if (requiresEmailVerification(user) && !isEmailVerified(user)) {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_BLOCKED, {
                ...metadata,
                email: normalizedEmail,
                userId: user.id,
                firm: user.firm_name,
                role: user.role,
                statusCode: 403,
                action: 'LOGIN_ATTEMPT',
                message: 'Login blocked until email is verified',
                metadata: { reason: 'email_verification_required' }
            });
            return res.status(403).json({
                error: 'Email verification required. Check your inbox before signing in.',
                code: 'email_verification_required'
            });
        }

        if (!hasFirmAssignment(user)) {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_BLOCKED, {
                ...metadata,
                email: normalizedEmail,
                userId: user.id,
                role: user.role,
                statusCode: 403,
                action: 'LOGIN_ATTEMPT',
                message: 'Login attempt on account without firm assignment',
                metadata: { reason: 'missing_firm_assignment' }
            });
            return blockUnassignedUser(res);
        }

        if (user.must_change_password) {
            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.AUTH_BLOCKED, {
                ...metadata,
                email: normalizedEmail,
                userId: user.id,
                firm: user.firm_name,
                role: user.role,
                statusCode: 403,
                action: 'LOGIN_ATTEMPT',
                message: 'Login blocked until password is replaced',
                metadata: { reason: 'password_change_required' }
            });
            return res.status(403).json({
                error: 'Password replacement required. Check your email to define a new password.',
                code: 'password_change_required'
            });
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
            firmId: userData.firmId,
            firmName: userData.firmName
        });

        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);

        res.cookie('accessToken', accessToken, getAccessTokenCookieOptions(req));
        res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions(req));

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
            ...metadata,
            email: userData.email,
            userId: userData.id,
            firmId: userData.firmId,
            firmName: userData.firmName,
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
router.post('/register', authLimiter, registrationLimiter, validateBody(registerSchema), enforceRegistrationProtection, async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const normalizedEmail = email.toLowerCase();
        const metadata = getRequestMetadata(req);
        const existingUser = await authService.findExistingUserByEmail(normalizedEmail);

        if (existingUser) {
            return res.status(409).json({ error: 'An account already exists with this email' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const registrationResult = await authService.registerSelfServiceUser({
            email: normalizedEmail,
            password: hashedPassword,
            name
        });
        const createdUser = registrationResult.user;

        if (registrationResult.autoApproved) {
            try {
                await sendVerificationEmail({
                    userId: createdUser.id,
                    email: normalizedEmail,
                    name
                });
            } catch (emailError) {
                safeLog('warn', 'Registration verification email failed after auto-approval', {
                    email: normalizedEmail,
                    userId: createdUser.id,
                    error: emailError.message
                });
            }
        } else {
            try {
                await sendVerificationEmail({
                    userId: createdUser.id,
                    email: normalizedEmail,
                    name
                });
            } catch (emailError) {
                safeLog('warn', 'Registration verification email failed', {
                    email: normalizedEmail,
                    userId: createdUser.id,
                    error: emailError.message
                });
            }
        }

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_CREATED, {
            ...metadata,
            email: normalizedEmail,
            userId: createdUser.id,
            firm: createdUser.firm_name,
            role: createdUser.role,
            statusCode: 201,
            action: 'REGISTER_SUCCESS',
            message: registrationResult.autoApproved
                ? 'User self-registered with immediate activation and dedicated test firm'
                : 'User self-registered with default firm assignment',
            metadata: {
                status: createdUser.status,
                autoApproved: registrationResult.autoApproved
            }
        });

        res.status(201).json({
            message: registrationResult.autoApproved
                ? 'Registration successful. Verify your email, then sign in to access your test account.'
                : 'Registration successful. Verify your email, then wait for admin approval before signing in.',
            registrationStatus: registrationResult.autoApproved ? 'active' : 'pending',
            autoApproved: registrationResult.autoApproved
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
        // Keep refresh responses out of shared caches without using `no-store`,
        // which blocks BFCache for authenticated page restores.
        res.set(AUTH_REVALIDATE_CACHE_HEADERS);
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token not found' });
        }

        const decoded = await consumeRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = await fetchUserWithFirm(decoded.id);
        
        if (!user || user.status === 'inactive') {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        if (!hasFirmAssignment(user)) {
            return blockUnassignedUser(res);
        }

        const userData = formatUserResponse(user);
        const newAccessToken = generateAccessToken(userData);
        const newRefreshToken = generateRefreshToken(userData);

        res.cookie('accessToken', newAccessToken, getAccessTokenCookieOptions(req));
        res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions(req));

        res.json({ user: userData });
    } catch (error) {
        safeLog('error', 'Token refresh error', { error: error.message });
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

async function resolveLogoutUser(accessToken, refreshToken) {
    const decodedAccessToken = accessToken ? await verifyToken(accessToken) : null;
    if (decodedAccessToken) {
        return decodedAccessToken;
    }

    const decodedRefreshToken = refreshToken ? await verifyRefreshToken(refreshToken) : null;
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
        const logoutUser = await resolveLogoutUser(accessToken, refreshToken);

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

        res.clearCookie('accessToken', getClearAccessTokenOptions(req));
        res.clearCookie('refreshToken', getClearRefreshTokenOptions(req));
        res.json({ message: 'Signed out successfully' });
    } catch (error) {
        safeLog('error', 'Sign out error', { error: error.message });
        res.status(500).json({ error: 'Failed to sign out' });
    }
};

router.post('/signout', logoutHandler);
router.post('/logout', logoutHandler);

router.get('/verify-email', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    if (!token) {
        return res.redirect(getEmailVerificationRedirectUrl({ success: false, error: 'invalid_token' }));
    }

    try {
        const result = await verifyEmailToken(token);
        return res.redirect(getEmailVerificationRedirectUrl(result));
    } catch (error) {
        safeLog('error', 'Email verification error', { error: error.message });
        return res.redirect(getEmailVerificationRedirectUrl({ success: false, error: 'email_verification_failed' }));
    }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        res.set(AUTH_REVALIDATE_CACHE_HEADERS);
        const user = await fetchUserWithFirm(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!hasFirmAssignment(user)) {
            return blockUnassignedUser(res);
        }

        res.json({ user: formatUserResponse(user) });
    } catch (error) {
        safeLog('error', 'Get current user error', { error: error.message });
        res.status(500).json({ error: 'Failed to get user information' });
    }
});

export default router;

