import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createCustomerSchema } from '../utils/validation.js';
import { customersCache } from '../services/cache.service.js';
import { metrics } from '../services/metrics.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { 
    selectWithTimeout, 
    findWithTimeout, 
    createWithTimeout, 
    updateWithTimeout, 
    destroyWithTimeout,
    buildWhereClause
} from '../utils/postgresHelpers.js';
import { query } from '../config/database.js';

const router = express.Router();

// ============================================
// CUSTOMERS ROUTES (PostgreSQL)
// ============================================

// GET /api/customers - Get all customers (with server-side pagination)
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

        // Fetch customers with pagination
        const customers = await selectWithTimeout('customers', {
            where: whereClause,
            params: params,
            orderBy: 'name ASC',
            limit: limit + 1, // Fetch one extra to check if there are more
            offset: offset
        });

        // Check if there are more records
        const hasMore = customers.length > limit;
        if (hasMore) {
            customers.pop(); // Remove the extra record
        }

        // Get total count (only on first page for performance)
        let totalCount = null;
        if (page === 1) {
            const countQuery = search 
                ? 'SELECT COUNT(*) as count FROM customers WHERE LOWER(name) LIKE $1'
                : 'SELECT COUNT(*) as count FROM customers';
            const countResult = await query(countQuery, search ? [`%${search.toLowerCase()}%`] : []);
            totalCount = parseInt(countResult.rows[0].count);
        }

        const response = {
            data: customers,
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
        safeLog('error', 'Error fetching customers', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch customers',
            message: error.message 
        });
    }
});

// GET /api/customers/:id - Get customer by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await findWithTimeout('customers', id);
        res.json(customer);
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        safeLog('error', 'Error fetching customer', { error: error.message, customerId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch customer',
            message: error.message 
        });
    }
});

// POST /api/customers - Create customer
router.post('/', authenticateToken, requireAdmin, validateBody(createCustomerSchema), async (req, res) => {
    try {
        customersCache.invalidate('all_customers');
        
        const customerData = {
            name: req.body.name || req.body.Name,
            status: (req.body.status || req.body.Status || 'active').toLowerCase()
        };

        const records = await createWithTimeout('customers', [{ fields: customerData }]);
        
        res.json(records[0]);
    } catch (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Customer with this name already exists' 
            });
        }
        safeLog('error', 'Error creating customer', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create customer',
            message: error.message 
        });
    }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        customersCache.invalidate('all_customers');
        
        const { id } = req.params;
        const customerData = {
            name: req.body.name || req.body.Name,
            status: (req.body.status || req.body.Status || 'active').toLowerCase()
        };

        const records = await updateWithTimeout('customers', [{
            id: id,
            fields: customerData
        }]);
        
        res.json(records[0]);
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        // Check for unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Customer with this name already exists' 
            });
        }
        safeLog('error', 'Error updating customer', { error: error.message, customerId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update customer',
            message: error.message 
        });
    }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if any users are associated with this customer
        const associatedUsers = await selectWithTimeout('users', {
            where: 'customer_id = $1',
            params: [id]
        });
        
        if (associatedUsers.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete customer with associated users',
                associatedUsers: associatedUsers.length
            });
        }
        
        customersCache.invalidate('all_customers');
        await destroyWithTimeout('customers', [id]);
        
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        safeLog('error', 'Error deleting customer', { error: error.message, customerId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete customer',
            message: error.message 
        });
    }
});

export default router;
