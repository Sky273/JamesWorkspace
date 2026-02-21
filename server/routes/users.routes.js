import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { selectWithTimeout } from '../utils/postgresHelpers.js';

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
            // Backward compatibility
            customer: user.firm_name,
            customerId: user.firm_id,
            role: user.role || 'user',
            status: user.status || 'active',
            Name: user.name,
            Email: user.email,
            FirmName: user.firm_name,
            CustomerName: user.firm_name,
            Role: user.role,
            Status: user.status,
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

export default router;
