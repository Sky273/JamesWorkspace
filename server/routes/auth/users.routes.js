/**
 * User Management Routes - Admin CRUD operations
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '../../config/constants.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, createUserSchema, updateAdminUserSchema } from '../../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import * as usersService from '../../services/users.service.js';

const router = express.Router();

// POST /api/auth/users - Create user (admin only)
router.post('/users', authenticateToken, requireAdmin, validateBody(createUserSchema), async (req, res) => {
    try {
        const { email, password, name, jobTitle, phone, status, firm, customer, role } = req.body;
        const normalizedEmail = email.toLowerCase();
        const metadata = getRequestMetadata(req);

        const existingUser = await usersService.findUserByEmail(normalizedEmail);

        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const normalizedRole = (role || 'user').toLowerCase();
        const validRole = ['admin', 'user'].includes(normalizedRole) ? normalizedRole : 'user';

        const userData = {
            email: normalizedEmail,
            password: hashedPassword,
            name: name,
            job_title: jobTitle || null,
            phone: phone || null,
            role: validRole,
            status: (status || 'active').toLowerCase()
        };

        const firmName = firm || customer;
        if (firmName) {
            const foundFirm = await usersService.findFirmByName(firmName);
            
            if (foundFirm) {
                userData.firm_id = foundFirm.id;
                userData.firm_name = foundFirm.name;
            } else {
                return res.status(400).json({ 
                    error: `Firm '${firmName}' not found` 
                });
            }
        }

        const newUser = await usersService.createAdminUser(userData);

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
router.put('/users/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateAdminUserSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

        const currentUser = await usersService.findUserById(id);
        
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const name = req.body.name;
        const email = req.body.email;
        const status = req.body.status;
        const role = req.body.role;
        const jobTitle = req.body.jobTitle || req.body.job_title;
        const phone = req.body.phone;

        if (name && name !== currentUser.name) updateData.name = name;
        if (email && email.toLowerCase() !== currentUser.email.toLowerCase()) {
            updateData.email = email.toLowerCase();
        }
        if (status) updateData.status = status.toLowerCase();
        if (role) updateData.role = role.toLowerCase();
        if (jobTitle !== undefined) updateData.job_title = jobTitle || null;
        if (phone !== undefined) updateData.phone = phone || null;
        if (req.body.password) {
            updateData.password = await bcrypt.hash(req.body.password, SALT_ROUNDS);
        }
        
        if (req.body.firm || req.body.customer) {
            const firmName = req.body.firm || req.body.customer;
            const foundFirm = await usersService.findFirmByName(firmName);
            
            if (foundFirm) {
                updateData.firm_id = foundFirm.id;
                updateData.firm_name = foundFirm.name;
            } else {
                return res.status(400).json({ 
                    error: `Firm '${firmName}' not found` 
                });
            }
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
