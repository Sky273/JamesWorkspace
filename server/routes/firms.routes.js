import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createFirmSchema } from '../utils/validation.js';
import { firmsCache } from '../services/cache.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { 
    selectWithTimeout, 
    findWithTimeout, 
    createWithTimeout, 
    updateWithTimeout, 
    destroyWithTimeout
} from '../utils/postgresHelpers.js';
import { query } from '../config/database.js';

const router = express.Router();

// ============================================
// FIRMS ROUTES (PostgreSQL)
// ============================================

// GET /api/firms - Get all firms (with server-side pagination)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        const { search } = req.query;

        // Build WHERE clause
        let whereClause = '';
        let params = [];
        
        if (search) {
            whereClause = 'LOWER(name) LIKE $1';
            params = [`%${search.toLowerCase()}%`];
        }

        // Fetch firms with pagination
        const firms = await selectWithTimeout('firms', {
            where: whereClause,
            params: params,
            orderBy: 'name ASC',
            limit: limit + 1, // Fetch one extra to check if there are more
            offset: offset
        });

        // Check if there are more records
        const hasMore = firms.length > limit;
        if (hasMore) {
            firms.pop(); // Remove the extra record
        }

        // Get total count (only on first page for performance)
        let totalCount = null;
        if (page === 1) {
            const countQuery = search 
                ? 'SELECT COUNT(*) as count FROM firms WHERE LOWER(name) LIKE $1'
                : 'SELECT COUNT(*) as count FROM firms';
            const countResult = await query(countQuery, search ? [`%${search.toLowerCase()}%`] : []);
            totalCount = parseInt(countResult.rows[0].count);
        }

        const response = {
            data: firms,
            pagination: {
                page,
                limit,
                hasMore,
                totalCount,
                nextPage: hasMore ? page + 1 : null
            }
        };

        return res.json(response);
    } catch (error) {
        safeLog('error', 'Error fetching firms', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch firms',
            message: error.message 
        });
    }
});

// GET /api/firms/:id - Get firm by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const firm = await findWithTimeout('firms', id);
        res.json(firm);
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        safeLog('error', 'Error fetching firm', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch firm',
            message: error.message 
        });
    }
});

// POST /api/firms - Create firm
router.post('/', authenticateToken, requireAdmin, validateBody(createFirmSchema), async (req, res) => {
    try {
        firmsCache.invalidate('all_firms');
        
        const firmData = {
            name: req.body.name || req.body.Name,
            status: (req.body.status || req.body.Status || 'active').toLowerCase()
        };

        const records = await createWithTimeout('firms', [{ fields: firmData }]);
        
        res.json(records[0]);
    } catch (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Firm with this name already exists' 
            });
        }
        safeLog('error', 'Error creating firm', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create firm',
            message: error.message 
        });
    }
});

// PUT /api/firms/:id - Update firm
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        firmsCache.invalidate('all_firms');
        
        const { id } = req.params;
        const firmData = {
            name: req.body.name || req.body.Name,
            status: (req.body.status || req.body.Status || 'active').toLowerCase()
        };

        const records = await updateWithTimeout('firms', [{
            id: id,
            fields: firmData
        }]);
        
        res.json(records[0]);
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        // Check for unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Firm with this name already exists' 
            });
        }
        safeLog('error', 'Error updating firm', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update firm',
            message: error.message 
        });
    }
});

// DELETE /api/firms/:id - Delete firm
router.delete('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if any users are associated with this firm
        const associatedUsers = await selectWithTimeout('users', {
            where: 'firm_id = $1',
            params: [id]
        });
        
        if (associatedUsers.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete firm with associated users',
                associatedUsers: associatedUsers.length
            });
        }
        
        firmsCache.invalidate('all_firms');
        await destroyWithTimeout('firms', [id]);
        
        res.json({ message: 'Firm deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        safeLog('error', 'Error deleting firm', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete firm',
            message: error.message 
        });
    }
});

export default router;
