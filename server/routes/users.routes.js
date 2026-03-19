import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { selectWithTimeout } from '../utils/postgresHelpers.js';
import { query } from '../config/database.js';

const router = express.Router();

// ============================================
// USERS ROUTES (PostgreSQL)
// ============================================

// GET /api/users - Get all users (admin function, with server-side pagination)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        const { search, role, status } = req.query;

        // Build WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(email) LIKE $${paramIndex})`);
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        if (role && role !== 'all') {
            conditions.push(`role = $${paramIndex}`);
            params.push(role.toLowerCase());
            paramIndex++;
        }

        if (status && status !== 'all') {
            conditions.push(`status = $${paramIndex}`);
            params.push(status.toLowerCase());
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';

        // Fetch users with pagination
        const users = await selectWithTimeout('users', {
            where: whereClause,
            params: params,
            orderBy: 'name ASC',
            limit: limit + 1,
            offset: offset
        });

        // Check if there are more records
        const hasMore = users.length > limit;
        if (hasMore) {
            users.pop();
        }

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
            error: 'Failed to fetch users',
            message: error.message 
        });
    }
});

// PUT /api/users/:id - Update user profile
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Users can only update their own profile, admins can update anyone
        if (id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to update this profile' });
        }

        const { name, jobTitle, phone, role, status, firm_id } = req.body;

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }

        if (jobTitle !== undefined) {
            updates.push(`job_title = $${paramIndex++}`);
            params.push(jobTitle);
        }

        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phone);
        }

        // Admin-only fields
        if (isAdmin) {
            if (role !== undefined) {
                updates.push(`role = $${paramIndex++}`);
                params.push(role.toLowerCase());
            }

            if (status !== undefined) {
                updates.push(`status = $${paramIndex++}`);
                params.push(status.toLowerCase());
            }

            if (firm_id !== undefined) {
                updates.push(`firm_id = $${paramIndex++}`);
                params.push(firm_id);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Add updated_at
        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add user ID to params
        params.push(id);

        const result = await query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = result.rows[0];

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
            error: 'Failed to update profile',
            message: error.message 
        });
    }
});

export default router;
