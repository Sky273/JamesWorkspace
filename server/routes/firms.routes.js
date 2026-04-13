import express from 'express';
import multer from 'multer';
import { authenticateToken, requireAdmin, requireUserManager, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createFirmSchema, normalizeRequestBodyAliases, updateFirmSchema } from '../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { invalidateFirmsCaches } from '../services/cache.service.js';
import { safeLog } from '../utils/logger.backend.js';
import * as firmsService from '../services/firms.service.js';
import { applySafeBinaryHeaders, setSafeFileResponseHeaders } from '../utils/fileResponseSecurity.js';
import { resolveUploadMimeType } from '../utils/uploadFileTypes.js';
import { isValidFileSignature } from '../utils/fileSignature.js';
import { shouldBypassCache } from '../utils/requestCacheControl.js';
import { getUserFirmIdFromUser } from '../utils/firmHelpers.js';

const LOGO_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

const router = express.Router();

function normalizeFirmPayload(payload = {}) {
    const normalized = normalizeRequestBodyAliases(payload);

    return {
        ...normalized,
        logoUrl: normalized.logoUrl
    };
}

function parsePaginationParams(pageInput, limitInput) {
    const parsedPage = pageInput === undefined ? DEFAULT_PAGE : Number.parseInt(pageInput, 10);
    const parsedLimit = limitInput === undefined ? DEFAULT_LIMIT : Number.parseInt(limitInput, 10);

    if (!Number.isInteger(parsedPage) || parsedPage <= 0) {
        return { error: 'page must be a positive integer' };
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        return { error: 'limit must be a positive integer' };
    }

    return {
        page: parsedPage,
        limit: Math.min(parsedLimit, MAX_LIMIT)
    };
}

function getManagedFirmId(req) {
    if (isUserAdmin(req)) {
        return null;
    }

    return getUserFirmIdFromUser(req.user);
}

// Configure multer for logo uploads - use memory storage to store in database
const logoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (req, file, cb) => {
        const resolvedMimeType = resolveUploadMimeType(file.originalname, file.mimetype, LOGO_ALLOWED_MIME_TYPES);
        if (LOGO_ALLOWED_MIME_TYPES.has(resolvedMimeType)) {
            file.mimetype = resolvedMimeType;
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'));
        }
    }
});

// ============================================
// FIRMS ROUTES (PostgreSQL)
// ============================================

// GET /api/firms - Get all firms (with server-side pagination)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const pagination = parsePaginationParams(req.query.page, req.query.limit);
        if (pagination.error) {
            return res.status(400).json({ error: pagination.error });
        }

        const { page, limit } = pagination;
        const { search } = req.query;
        const bypassCache = shouldBypassCache(req);

        const { firms, hasMore, totalCount } = await firmsService.listFirms({ search, page, limit, bypassCache });

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

// GET /api/firms/credits - Get firm credits list for manager screens
router.get('/credits', authenticateToken, requireUserManager, async (req, res) => {
    try {
        const pagination = parsePaginationParams(req.query.page, req.query.limit);
        if (pagination.error) {
            return res.status(400).json({ error: pagination.error });
        }

        const { page, limit } = pagination;
        const { search } = req.query;
        const bypassCache = shouldBypassCache(req);
        const managedFirmId = getManagedFirmId(req);

        if (!isUserAdmin(req) && !managedFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const { firms, hasMore, totalCount } = await firmsService.listFirmCredits({
            search,
            page,
            limit,
            bypassCache,
            firmId: managedFirmId
        });

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
        safeLog('error', 'Error fetching firm credits', { error: error.message, userId: req.user?.id });
        return res.status(500).json({
            error: 'Failed to fetch firm credits'
        });
    }
});

// GET /api/firms/:id - Get firm by ID
router.get('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const bypassCache = shouldBypassCache(req);
        const firm = await firmsService.getFirmById(id, { bypassCache });
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

// POST /api/firms/:id/credits - Add credits to a firm (super admin only)
router.post('/:id/credits', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const amount = Number.parseInt(req.body?.amount, 10);
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({ error: 'amount must be a positive integer' });
        }

        const firm = await firmsService.addFirmCredits(req.params.id, amount, req.user?.id);

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.ADMIN_ACTION, {
            ...getRequestMetadata(req),
            firmId: req.params.id,
            updatedBy: req.user.id,
            amount,
            action: 'FIRM_CREDITS_ADDED',
            message: 'Credits added to firm'
        });

        return res.json(firm);
    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({ error: error.message });
        }
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        safeLog('error', 'Error adding firm credits', { error: error.message, firmId: req.params.id });
        return res.status(500).json({
            error: 'Failed to add firm credits'
        });
    }
});

// POST /api/firms - Create firm
router.post('/', authenticateToken, requireAdmin, validateBody(createFirmSchema), async (req, res) => {
    try {
        const normalizedPayload = normalizeFirmPayload(req.body);
        
        const firmData = {
            name: normalizedPayload.name,
            status: (normalizedPayload.status || 'active').toLowerCase()
        };
        
        // Add logo_url if provided
        if (normalizedPayload.logoUrl) {
            firmData.logo_url = normalizedPayload.logoUrl;
        }

        const firm = await firmsService.createFirm(firmData);
        await invalidateFirmsCaches();
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
        const normalizedPayload = normalizeFirmPayload(req.body);
        
        const { id } = req.params;
        const firmData = {
            name: normalizedPayload.name,
            status: (normalizedPayload.status || 'active').toLowerCase()
        };
        
        // Add logo_url if provided
        if (normalizedPayload.logoUrl !== undefined) {
            firmData.logo_url = normalizedPayload.logoUrl || null;
        }

        const firm = await firmsService.updateFirm(id, firmData);
        await invalidateFirmsCaches();
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
        
        await firmsService.deleteFirm(id);
        await invalidateFirmsCaches();
        
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
        if (!isValidFileSignature(logoData, logoMimeType)) {
            return res.status(400).json({ error: 'Invalid logo file contents' });
        }
        
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

        const contentType = logoResult.logo_mime_type || 'image/png';
        const contentLength = logoResult.logo_data?.length;
        if (contentType === 'image/svg+xml') {
            setSafeFileResponseHeaders(res, {
                contentType,
                filename: `firm-logo-${id}.svg`,
                contentLength,
                cacheControl: 'public, max-age=86400'
            });
        } else {
            applySafeBinaryHeaders(res, {
                contentType,
                contentLength,
                cacheControl: 'public, max-age=86400'
            });
        }
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
