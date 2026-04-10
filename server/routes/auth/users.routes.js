/**
 * User Management Routes - Admin CRUD operations
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { SALT_ROUNDS } from '../../config/constants.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, createUserSchema, updateAdminUserSchema } from '../../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import * as usersService from '../../services/users.service.js';
import { PASSWORD_RESET_EMAIL_TYPES, requestPasswordReset } from '../../services/passwordReset.service.js';
import {
    buildAdminUserUpdateData,
    normalizeAdminUserPayload,
    normalizeRole,
    resolveRequiredFirmId
} from './users.routes.helpers.js';

const router = express.Router();

// POST /api/auth/users - Create user (admin only)
router.post('/users', authenticateToken, requireAdmin, validateBody(createUserSchema), async (req, res) => {
    try {
        const normalizedPayload = normalizeAdminUserPayload(req.body);
        const { email, name, jobTitle, phone, status, role } = normalizedPayload;
        const normalizedEmail = email.toLowerCase();
        const metadata = getRequestMetadata(req);
        const requestedFirmId = resolveRequiredFirmId(normalizedPayload);

        const existingUser = await usersService.findUserByEmail(normalizedEmail);

        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);

        const userData = {
            email: normalizedEmail,
            password: hashedPassword,
            name: name,
            job_title: jobTitle || null,
            phone: phone || null,
            role: normalizeRole(role),
            status: (status || 'active').toLowerCase(),
            must_change_password: true
        };

        if (!requestedFirmId) {
            return res.status(400).json({
                error: 'Firm ID selection is required'
            });
        }

        const foundFirm = await usersService.findFirmById(requestedFirmId);
        if (foundFirm) {
            userData.firm_id = foundFirm.id;
            userData.firm_name = foundFirm.name;
        } else {
            return res.status(400).json({
                error: `Firm '${requestedFirmId}' not found`
            });
        }

        const newUser = await usersService.createAdminUser(userData);
        await requestPasswordReset(normalizedEmail, {
            emailType: PASSWORD_RESET_EMAIL_TYPES.INVITE,
            markUserAsMustChangePassword: true,
            skipRateLimit: true
        });

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
            status: newUser.status,
            invitationSent: true
        });
    } catch (error) {
        safeLog('error', 'Create user error', { error: error.message });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.post('/users/:id/force-password-reset', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = await usersService.findUserById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await requestPasswordReset(user.email, {
            emailType: PASSWORD_RESET_EMAIL_TYPES.FORCE_CHANGE,
            markUserAsMustChangePassword: true,
            skipRateLimit: true
        });

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_UPDATED, {
            ...getRequestMetadata(req),
            userId: id,
            updatedBy: req.user.id,
            statusCode: 200,
            action: 'USER_FORCE_PASSWORD_RESET',
            message: 'Admin forced password replacement'
        });

        res.json({
            success: true,
            message: 'Password replacement email sent'
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'User not found' });
        }
        safeLog('error', 'Force password reset error', { error: error.message });
        res.status(500).json({ error: 'Failed to force password reset' });
    }
});

// PUT /api/auth/users/:id - Update user (admin only)
router.put('/users/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateAdminUserSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

        const currentUser = await usersService.findUserById(id);
        
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const normalizedPayload = normalizeAdminUserPayload(req.body);
        const requestedFirmId = resolveRequiredFirmId(normalizedPayload);
        Object.assign(
            updateData,
            buildAdminUserUpdateData(
                normalizedPayload,
                currentUser
            )
        );
        
        if (!requestedFirmId) {
            return res.status(400).json({
                error: 'Firm ID selection is required'
            });
        }

        const foundFirm = await usersService.findFirmById(requestedFirmId);
        if (foundFirm) {
            updateData.firm_id = foundFirm.id;
            updateData.firm_name = foundFirm.name;
        } else {
            return res.status(400).json({
                error: `Firm '${requestedFirmId}' not found`
            });
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const updatedUser = await usersService.updateAdminUser(id, updateData);

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

        await usersService.deleteUser(id);

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
