import express from 'express';
import multer from 'multer';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createFirmSchema, updateFirmSchema } from '../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { invalidateFirmsCaches } from '../services/cache.service.js';
import { safeLog } from '../utils/logger.backend.js';
import * as firmsService from '../services/firms.service.js';

const router = express.Router();

// Configure multer for logo uploads - use memory storage to store in database
const logoUpload = multer({
    storage: multer.memoryStorage(),
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
        const { search } = req.query;

        const { firms, hasMore, totalCount } = await firmsService.listFirms({ search, page, limit });

        return res.json({
            data: firms,
            pagination: {
                page,
                limit,
                hasMore,
                totalCount,
                nextPage: hasMore ? page + 1 : null
            }
        });
    } catch (error) {
        safeLog('error', 'Error fetching firms', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch firms' 
        });
    }
});

// GET /api/firms/:id - Get firm by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const firm = await firmsService.getFirmById(id);
        res.json(firm);
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        safeLog('error', 'Error fetching firm', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch firm' 
        });
    }
});

// POST /api/firms - Create firm
router.post('/', authenticateToken, requireAdmin, validateBody(createFirmSchema), async (req, res) => {
    try {
        await invalidateFirmsCaches();
        
        const firmData = {
            name: req.body.name,
            status: (req.body.status || 'active').toLowerCase()
        };
        
        // Add logo_url if provided
        if (req.body.logo_url || req.body.logoUrl) {
            firmData.logo_url = req.body.logo_url || req.body.logoUrl;
        }

        const firm = await firmsService.createFirm(firmData);
        res.json(firm);
    } catch (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Firm with this name already exists' 
            });
        }
        safeLog('error', 'Error creating firm', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create firm' 
        });
    }
});

// PUT /api/firms/:id - Update firm
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateFirmSchema), async (req, res) => {
    try {
        await invalidateFirmsCaches();
        
        const { id } = req.params;
        const firmData = {
            name: req.body.name,
            status: (req.body.status || 'active').toLowerCase()
        };
        
        // Add logo_url if provided
        if (req.body.logo_url !== undefined || req.body.logoUrl !== undefined) {
            firmData.logo_url = req.body.logo_url || req.body.logoUrl || null;
        }

        const firm = await firmsService.updateFirm(id, firmData);
        res.json(firm);
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
            error: 'Failed to update firm' 
        });
    }
});

// DELETE /api/firms/:id - Delete firm
router.delete('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if any users are associated with this firm
        const usersCount = await firmsService.getAssociatedUsersCount(id);
        if (usersCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete firm with associated users',
                associatedUsers: usersCount
            });
        }
        
        await invalidateFirmsCaches();
        await firmsService.deleteFirm(id);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.FIRM_DELETED, {
            ...getRequestMetadata(req),
            firmId: id,
            deletedBy: req.user.id,
            action: 'FIRM_DELETED',
            message: 'Firm deleted by admin'
        });
        
        res.json({ message: 'Firm deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        safeLog('error', 'Error deleting firm', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete firm' 
        });
    }
});

// POST /api/firms/:id/logo - Upload firm logo (stored in database)
router.post('/:id/logo', authenticateToken, requireAdmin, validateParams('id'), logoUpload.single('logo'), async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Verify firm exists
        await firmsService.getFirmById(id);
        
        // Store logo data directly in database
        const logoData = req.file.buffer;
        const logoMimeType = req.file.mimetype;
        
        const logoUrl = await firmsService.uploadFirmLogo(id, logoData, logoMimeType);
        
        await invalidateFirmsCaches();
        
        safeLog('info', 'Firm logo uploaded to database', { firmId: id, mimeType: logoMimeType, size: logoData.length });
        
        res.json({ 
            success: true, 
            logo_url: logoUrl,
            message: 'Logo uploaded successfully' 
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        safeLog('error', 'Error uploading firm logo', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to upload logo' 
        });
    }
});

// GET /api/firms/:id/logo/image - Serve firm logo from database
router.get('/:id/logo/image', validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const logoResult = await firmsService.getFirmLogo(id);
        if (!logoResult) {
            return res.status(404).json({ error: 'Logo not found' });
        }
        
        res.set('Content-Type', logoResult.logo_mime_type || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.send(logoResult.logo_data);
    } catch (error) {
        safeLog('error', 'Error serving firm logo', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ error: 'Failed to serve logo' });
    }
});

// DELETE /api/firms/:id/logo - Delete firm logo
router.delete('/:id/logo', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify firm exists
        await firmsService.getFirmById(id);
        
        await firmsService.deleteFirmLogo(id);
        
        await invalidateFirmsCaches();
        
        safeLog('info', 'Firm logo deleted', { firmId: id });
        
        res.json({ success: true, message: 'Logo deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        safeLog('error', 'Error deleting firm logo', { error: error.message, firmId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete logo' 
        });
    }
});

export default router;
