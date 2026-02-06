import express from 'express';
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '../config/constants.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import { validateBody, validateParams, signInSchema, registerSchema, createUserSchema, isValidEmail } from '../utils/validation.js';
import { generateAccessToken, generateRefreshToken, verifyToken, verifyRefreshToken, extractRoleFromUser, revokeToken } from '../services/jwt.service.js';
import { blacklistUser, unblacklistUser } from '../services/tokenBlacklist.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { selectWithTimeout, findWithTimeout, createWithTimeout, updateWithTimeout, destroyWithTimeout } from '../utils/postgresHelpers.js';
import { query } from '../config/database.js';

const router = express.Router();

// ============================================
// AUTHENTICATION ROUTES (PostgreSQL)
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
        
        const users = await selectWithTimeout('users', {
            where: 'LOWER(email) = $1',
            params: [normalizedEmail],
            limit: 1
        });

        if (users.length === 0) {
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

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_FAILURE, {
                ...metadata,
                email: normalizedEmail,
                userId: user.id,
                customer: user.customer_name,
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
                customer: user.customer_name,
                role: user.role,
                statusCode: 403,
                action: 'LOGIN_ATTEMPT',
                message: 'Login attempt on inactive account',
                metadata: { reason: 'account_inactive' }
            });
            return res.status(403).json({ error: 'Account is inactive. Please contact administrator.' });
        }

        // Update last login timestamp
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const userData = {
            id: user.id,
            email: user.email,
            name: user.name || '',
            status: user.status,
            role: user.role,
            customer: user.customer_name,
            CustomerName: user.customer_name,
            // Uppercase versions for compatibility
            Name: user.name,
            Email: user.email,
            Status: user.status === 'active' ? 'Active' : 'Inactive',
            Role: user.role
        };
        
        safeLog('debug', 'User data prepared for signin', { 
            userId: userData.id, 
            customer: userData.customer 
        });

        const accessToken = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_SUCCESS, {
            ...metadata,
            email: userData.email,
            userId: userData.id,
            customer: userData.CustomerName,
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

        // Check if user already exists
        const existingUsers = await selectWithTimeout('users', {
            where: 'LOWER(email) = $1',
            params: [normalizedEmail],
            limit: 1
        });

        if (existingUsers.length > 0) {
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

        const records = await createWithTimeout('users', [{
            fields: userData
        }]);

        const newUser = records[0];

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

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token not found' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Verify user still exists and is active
        const user = await findWithTimeout('users', decoded.id);
        
        if (!user || user.status === 'inactive') {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        const userData = {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            role: user.role,
            customer: user.customer_name,
            CustomerName: user.customer_name
        };

        const newAccessToken = generateAccessToken(userData);

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 1000
        });

        res.json({ message: 'Token refreshed successfully' });
    } catch (error) {
        safeLog('error', 'Token refresh error', { error: error.message });
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// POST /api/auth/signout - User logout
router.post('/signout', authenticateToken, (req, res) => {
    try {
        const metadata = getRequestMetadata(req);
        
        // SECURITY: Revoke tokens to prevent reuse if captured
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;
        
        if (accessToken) {
            revokeToken(accessToken);
        }
        if (refreshToken) {
            revokeToken(refreshToken);
        }
        
        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.AUTH_LOGOUT, {
            ...metadata,
            userId: req.user?.id,
            email: req.user?.email,
            statusCode: 200,
            action: 'LOGOUT',
            message: 'User signed out'
        });

        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
        res.json({ message: 'Signed out successfully' });
    } catch (error) {
        safeLog('error', 'Sign out error', { error: error.message });
        res.status(500).json({ error: 'Failed to sign out' });
    }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await findWithTimeout('users', req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            customer: user.customer_name,
            CustomerName: user.customer_name,
            Name: user.name,
            Email: user.email,
            Status: user.status === 'active' ? 'Active' : 'Inactive',
            Role: user.role
        });
    } catch (error) {
        safeLog('error', 'Get current user error', { error: error.message });
        res.status(500).json({ error: 'Failed to get user information' });
    }
});

// POST /api/auth/users - Create user (admin only)
router.post('/users', authenticateToken, requireAdmin, validateBody(createUserSchema), async (req, res) => {
    try {
        const { email, password, name, status, customer, CustomerName } = req.body;
        const normalizedEmail = email.toLowerCase();
        const metadata = getRequestMetadata(req);

        // Check if user already exists
        const existingUsers = await selectWithTimeout('users', {
            where: 'LOWER(email) = $1',
            params: [normalizedEmail],
            limit: 1
        });

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userData = {
            email: normalizedEmail,
            password: hashedPassword,
            name: name,
            role: 'user',
            status: (status || 'active').toLowerCase()
        };

        // Handle customer assignment via foreign key
        const customerName = customer || CustomerName;
        if (customerName) {
            const customers = await selectWithTimeout('customers', {
                where: 'name = $1',
                params: [customerName],
                limit: 1
            });
            
            if (customers.length > 0) {
                userData.customer_id = customers[0].id;
                userData.customer_name = customers[0].name;
            } else {
                return res.status(400).json({ 
                    error: `Customer '${customerName}' not found` 
                });
            }
        }

        const records = await createWithTimeout('users', [{
            fields: userData
        }]);

        const newUser = records[0];

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_CREATED, {
            ...metadata,
            email: newUser.email,
            userId: newUser.id,
            role: newUser.role,
            createdBy: req.user.id,
            statusCode: 201,
            action: 'USER_CREATED_BY_ADMIN',
            message: 'New user created by admin'
        });

        res.status(201).json({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            status: newUser.status
        });
    } catch (error) {
        safeLog('error', 'Create user error', { error: error.message });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PUT /api/auth/users/:id - Update user (admin only)
router.put('/users/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

        if (req.body.name) updateData.name = req.body.name;
        if (req.body.email) updateData.email = req.body.email.toLowerCase();
        if (req.body.status) updateData.status = req.body.status.toLowerCase();
        if (req.body.role) updateData.role = req.body.role.toLowerCase();
        if (req.body.password) {
            updateData.password = await bcrypt.hash(req.body.password, SALT_ROUNDS);
        }
        
        // Handle customer assignment via foreign key
        if (req.body.customer || req.body.CustomerName) {
            const customerName = req.body.customer || req.body.CustomerName;
            
            // Find customer by name to get the ID
            const customers = await selectWithTimeout('customers', {
                where: 'name = $1',
                params: [customerName],
                limit: 1
            });
            
            if (customers.length > 0) {
                updateData.customer_id = customers[0].id;
                updateData.customer_name = customers[0].name;
            } else {
                return res.status(400).json({ 
                    error: `Customer '${customerName}' not found` 
                });
            }
        }

        // Only update if there are fields to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const records = await updateWithTimeout('users', [{
            id: id,
            fields: updateData
        }]);

        const updatedUser = records[0];

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_UPDATED, {
            ...getRequestMetadata(req),
            userId: id,
            updatedBy: req.user.id,
            statusCode: 200,
            action: 'USER_UPDATED_BY_ADMIN',
            message: 'User updated by admin'
        });

        res.json({
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            status: updatedUser.status
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'User not found' });
        }
        safeLog('error', 'Update user error', { error: error.message });
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/auth/users/:id - Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await destroyWithTimeout('users', [id]);

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_DELETED, {
            ...getRequestMetadata(req),
            userId: id,
            deletedBy: req.user.id,
            statusCode: 200,
            action: 'USER_DELETED_BY_ADMIN',
            message: 'User deleted by admin'
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'User not found' });
        }
        safeLog('error', 'Delete user error', { error: error.message });
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
