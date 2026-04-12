import express from 'express';
import { authenticateToken, requireUserManager, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, updateUserProfileSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import * as usersService from '../services/users.service.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import { shouldBypassCache } from '../utils/requestCacheControl.js';

const router = express.Router();

function parsePositiveInteger(value, fallback, max = null) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
        return { ok: false, value: fallback };
    }

    return {
        ok: true,
        value: max ? Math.min(parsed, max) : parsed
    };
}

// ============================================
// USERS ROUTES (PostgreSQL)
// ============================================

// GET /api/users - Get all users (admin function, with server-side pagination)
router.get('/', authenticateToken, requireUserManager, async (req, res) => {
    try {
        const pageInput = req.query.page;
        const limitInput = req.query.limit;
        const pageResult = pageInput === undefined ? { ok: true, value: 1 } : parsePositiveInteger(pageInput, 1);
        const limitResult = limitInput === undefined ? { ok: true, value: 100 } : parsePositiveInteger(limitInput, 100, 100);
        const { search, role, status } = req.query;
        const bypassCache = shouldBypassCache(req);

        if (!pageResult.ok || !limitResult.ok) {
            return res.status(400).json({ error: 'Invalid pagination parameters' });
        }

        const superAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);

        if (!superAdmin && !userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const { users, hasMore, totalCount } = await usersService.listUsers({
            search,
            role,
            status,
            firmId: superAdmin ? undefined : userFirmId,
            page: pageResult.value,
            limit: limitResult.value,
            ...(bypassCache ? { bypassCache: true } : {})
        });

        // Map to frontend format (exclude password)
        const mappedUsers = users.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            jobTitle: user.job_title || '',
            phone: user.phone || '',
            firmId: user.firm_id,
            firmName: user.firm_name,
            firm: user.firm_name,
            customerId: user.firm_id,
            customerName: user.firm_name,
            customer: user.firm_name,
            role: user.role || 'user',
            status: user.status || 'active',
            createdAt: user.created_at,
            lastLogin: user.last_login
        }));

        const response = {
            data: mappedUsers,
            pagination: {
                page: pageResult.value,
                limit: limitResult.value,
                totalCount,
                hasMore,
                nextPage: hasMore ? pageResult.value + 1 : null
            }
        };

        return res.json(response);
    } catch (error) {
        safeLog('error', 'Error fetching users', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch users'
        });
    }
});

// PUT /api/users/:id - Update user profile
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateUserProfileSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Profile updates are self-service only. Admin account management goes through /api/auth/users/:id.
        if (id !== userId) {
            return res.status(403).json({ error: 'Not authorized to update this profile' });
        }

        const { name, phone } = req.body;
        const jobTitle = req.body.jobTitle ?? req.body.job_title;

        const updatedUser = await usersService.updateUserProfile(id, { name, jobTitle, phone }, false);

        if (updatedUser && updatedUser.noFields) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        safeLog('info', 'User profile updated', { 
            userId: id, 
            updatedBy: userId,
            fields: Object.keys(req.body).filter(k => req.body[k] !== undefined)
        });

        return res.json({
            success: true,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                jobTitle: updatedUser.job_title,
                phone: updatedUser.phone,
                firmId: updatedUser.firm_id,
                firmName: updatedUser.firm_name,
                firm: updatedUser.firm_name,
                customerId: updatedUser.firm_id,
                customerName: updatedUser.firm_name,
                customer: updatedUser.firm_name,
                role: updatedUser.role,
                status: updatedUser.status
            }
        });
    } catch (error) {
        safeLog('error', 'Error updating user profile', { error: error.message, userId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update profile'
        });
    }
});

export default router;
