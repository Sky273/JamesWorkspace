import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, updateUserProfileSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import * as usersService from '../services/users.service.js';

const router = express.Router();

// ============================================
// USERS ROUTES (PostgreSQL)
// ============================================

// GET /api/users - Get all users (admin function, with server-side pagination)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const { search, role, status } = req.query;

        const { users, hasMore } = await usersService.listUsers({ search, role, status, page, limit });

        // Map to frontend format (exclude password)
        const mappedUsers = users.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            jobTitle: user.job_title || '',
            phone: user.phone || '',
            firm: user.firm_name,
            firmId: user.firm_id,
            customer: user.firm_name,
            customerId: user.firm_id,
            role: user.role || 'user',
            status: user.status || 'active',
            createdAt: user.created_at,
            lastLogin: user.last_login
        }));

        const response = {
            data: mappedUsers,
            pagination: {
                page,
                limit,
                hasMore,
                nextPage: hasMore ? page + 1 : null
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
        const isAdmin = req.user?.role === 'admin';

        // Users can only update their own profile, admins can update anyone
        if (id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to update this profile' });
        }

        const { name, jobTitle, phone, role, status, firm_id } = req.body;

        const updatedUser = await usersService.updateUserProfile(id, { name, jobTitle, phone, role, status, firm_id }, isAdmin);

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
                firm: updatedUser.firm_name,
                firmId: updatedUser.firm_id,
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
