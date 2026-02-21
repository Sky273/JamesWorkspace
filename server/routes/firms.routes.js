import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for logo uploads
const LOGOS_DIR = path.join(__dirname, '../../client/public/logos');

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, LOGOS_DIR);
    },
    filename: (req, file, cb) => {
        const firmId = req.params.id;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `firm-${firmId}${ext}`);
    }
});

const logoUpload = multer({
    storage: logoStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP and SVG are allowed.'));
        }
    }
});

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
        
        // Add logo_url if provided
        if (req.body.logo_url || req.body.logoUrl) {
            firmData.logo_url = req.body.logo_url || req.body.logoUrl;
        }

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
        
        // Add logo_url if provided
        if (req.body.logo_url !== undefined || req.body.logoUrl !== undefined) {
            firmData.logo_url = req.body.logo_url || req.body.logoUrl || null;
        }

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

// POST /api/firms/:id/logo - Upload firm logo
router.post('/:id/logo', authenticateToken, requireAdmin, validateParams('id'), logoUpload.single('logo'), async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Verify firm exists
        const firm = await findWithTimeout('firms', id);
        if (!firm) {
            // Delete uploaded file if firm doesn't exist
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Firm not found' });
        }
        
        // Generate the public URL for the logo
        const logoUrl = `/logos/${req.file.filename}`;
        
        // Update firm with logo URL
        await updateWithTimeout('firms', [{
            id: id,
            fields: { logo_url: logoUrl }
        }]);
        
        firmsCache.invalidate('all_firms');
        
        safeLog('info', 'Firm logo uploaded', { firmId: id, logoUrl });
        
        res.json({ 
            success: true, 
            logo_url: logoUrl,
            message: 'Logo uploaded successfully' 
        });
    } catch (error) {
        safeLog('error', 'Error uploading firm logo', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to upload logo',
            message: error.message 
        });
    }
});

// DELETE /api/firms/:id/logo - Delete firm logo
router.delete('/:id/logo', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get firm to find current logo
        const firm = await findWithTimeout('firms', id);
        if (!firm) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        
        // Delete logo file if exists
        if (firm.logo_url) {
            const logoPath = path.join(LOGOS_DIR, path.basename(firm.logo_url));
            if (fs.existsSync(logoPath)) {
                fs.unlinkSync(logoPath);
            }
        }
        
        // Update firm to remove logo URL
        await updateWithTimeout('firms', [{
            id: id,
            fields: { logo_url: null }
        }]);
        
        firmsCache.invalidate('all_firms');
        
        safeLog('info', 'Firm logo deleted', { firmId: id });
        
        res.json({ success: true, message: 'Logo deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting firm logo', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete logo',
            message: error.message 
        });
    }
});

export default router;
