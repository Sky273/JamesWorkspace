/**
 * User Management Routes - Admin CRUD operations
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { SALT_ROUNDS } from '../../config/constants.js';
import { authenticateToken, requireUserManager, isUserAdmin, isUserLocalAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, createUserSchema, updateAdminUserSchema } from '../../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import * as usersService from '../../services/users.service.js';
import { PASSWORD_RESET_EMAIL_TYPES, requestPasswordReset } from '../../services/passwordReset.service.js';
import { getUserFirmIdFromUser } from '../../utils/firmHelpers.js';
import { mapUserToFrontend } from '../../utils/mappers.js';
import {
    buildAdminUserUpdateData,
    normalizeAdminUserPayload,
    normalizeRole,
    resolveRequiredFirmId
} from './users.routes.helpers.js';

const router = express.Router();

function canManageTargetUser(req, targetUser) {
    if (isUserAdmin(req)) {
        return true;
    }

    if (!isUserLocalAdmin(req)) {
        return false;
    }

    const actorFirmId = getUserFirmIdFromUser(req.user);
    const targetFirmId = getUserFirmIdFromUser(targetUser);

    return Boolean(actorFirmId && targetFirmId && actorFirmId === targetFirmId && String(targetUser.role || '').toLowerCase() !== 'admin');
}

function validateManagedRole(req, requestedRole) {
    const normalizedRequestedRole = normalizeRole(requestedRole);

    if (isUserAdmin(req)) {
        return { ok: true, role: normalizedRequestedRole };
    }

    if (normalizedRequestedRole === 'admin') {
        return { ok: false, status: 403, error: 'Local admins cannot assign super administrator role' };
    }

    return { ok: true, role: normalizedRequestedRole };
}

function validateManagedFirm(req, requestedFirmId) {
    if (isUserAdmin(req)) {
        return { ok: true, firmId: requestedFirmId };
    }

    const actorFirmId = getUserFirmIdFromUser(req.user);
    if (!actorFirmId) {
        return { ok: false, status: 403, error: 'No firm association' };
    }

    if (requestedFirmId !== actorFirmId) {
        return { ok: false, status: 403, error: 'Local admins can only manage users from their own firm' };
    }

    return { ok: true, firmId: actorFirmId };
}

// POST /api/auth/users - Create user (admin only)
router.post('/users', authenticateToken, requireUserManager, validateBody(createUserSchema), async (req, res) => {
    try {
        const normalizedPayload = normalizeAdminUserPayload(req.body);
        const { email, name, jobTitle, phone, status, role } = normalizedPayload;
        const normalizedEmail = email.toLowerCase();
        const metadata = getRequestMetadata(req);
        const requestedFirmId = resolveRequiredFirmId(normalizedPayload);
        const managedRole = validateManagedRole(req, role);

        if (!managedRole.ok) {
            return res.status(managedRole.status).json({ error: managedRole.error });
        }

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
            role: managedRole.role,
            status: (status || 'active').toLowerCase(),
            must_change_password: true,
            email_verified_at: new Date(),
            registration_source: 'admin_created'
        };

        if (!requestedFirmId) {
            return res.status(400).json({
                error: 'Firm ID selection is required'
            });
        }

        const managedFirm = validateManagedFirm(req, requestedFirmId);
        if (!managedFirm.ok) {
            return res.status(managedFirm.status).json({ error: managedFirm.error });
        }

        const foundFirm = await usersService.findFirmById(managedFirm.firmId);
        if (foundFirm) {
            userData.firm_id = foundFirm.id;
            userData.firm_name = foundFirm.name;
        } else {
            return res.status(400).json({
                error: `Firm '${requestedFirmId}' not found`
            });
        }

        const newUser = await usersService.createAdminUser(userData);
        let invitationSent = false;

        try {
            await requestPasswordReset(normalizedEmail, {
                emailType: PASSWORD_RESET_EMAIL_TYPES.INVITE,
                markUserAsMustChangePassword: true,
                skipRateLimit: true
            });
            invitationSent = true;
        } catch (inviteError) {
            safeLog('warn', 'User created but invitation email failed', {
                userId: newUser.id,
                email: newUser.email,
                error: inviteError.message
            });
        }

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.USER_CREATED, {
            ...metadata,
            email: newUser.email,
            userId: newUser.id,
            role: newUser.role,
            createdBy: req.user.id,
            statusCode: 201,
            action: 'USER_CREATED_BY_ADMIN',
            invitationSent,
            message: invitationSent
                ? 'New user created by admin'
                : 'New user created by admin but invitation email failed'
        });

        res.status(201).json(mapUserToFrontend(newUser, {
            overrides: {
                name: newUser.name || userData.name,
                role: newUser.role || userData.role,
                status: newUser.status || userData.status,
                jobTitle: newUser.job_title || newUser.jobTitle || userData.job_title || null,
                phone: newUser.phone || userData.phone || null,
                firmId: newUser.firm_id || newUser.firmId || foundFirm.id,
                firmName: newUser.firm_name || newUser.firmName || foundFirm.name,
                invitationSent
            }
        }));
    } catch (error) {
        safeLog('error', 'Create user error', { error: error.message });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.post('/users/:id/force-password-reset', authenticateToken, requireUserManager, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = await usersService.findUserById(id, { useCache: false });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!canManageTargetUser(req, user)) {
            return res.status(403).json({ error: 'Access denied' });
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
router.put('/users/:id', authenticateToken, requireUserManager, validateParams('id'), validateBody(updateAdminUserSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

        const currentUser = await usersService.findUserById(id, { useCache: false });
        
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!canManageTargetUser(req, currentUser)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const normalizedPayload = normalizeAdminUserPayload(req.body);
        const requestedFirmId = resolveRequiredFirmId(normalizedPayload);
        const managedRole = normalizedPayload.role !== undefined
            ? validateManagedRole(req, normalizedPayload.role)
            : { ok: true };

        if (!managedRole.ok) {
            return res.status(managedRole.status).json({ error: managedRole.error });
        }

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

        const managedFirm = validateManagedFirm(req, requestedFirmId);
        if (!managedFirm.ok) {
            return res.status(managedFirm.status).json({ error: managedFirm.error });
        }

        const foundFirm = await usersService.findFirmById(managedFirm.firmId);
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

        res.json(mapUserToFrontend(updatedUser, {
            overrides: {
                jobTitle: updatedUser.job_title || updatedUser.jobTitle || null,
                phone: updatedUser.phone || null,
                firmId: updatedUser.firm_id || updatedUser.firmId || foundFirm.id,
                firmName: updatedUser.firm_name || updatedUser.firmName || foundFirm.name
            }
        }));
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'User not found' });
        }
        safeLog('error', 'Update user error', { error: error.message });
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/auth/users/:id - Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireUserManager, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const user = await usersService.findUserById(id, { useCache: false });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!canManageTargetUser(req, user)) {
            return res.status(403).json({ error: 'Access denied' });
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
