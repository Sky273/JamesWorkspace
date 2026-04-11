/**
 * Resume Routes - CRUD Operations
 * GET /, GET /:id, PUT /:id, DELETE /:id
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { validateParams, validateBody, updateResumeSchema } from '../../utils/validation.js';
import {
    createDeleteResumeHandler,
    createDownloadResumeHandler,
    createGetResumeHandler,
    createListResumesHandler,
    createUpdateResumeHandler
} from './crud/handlers.js';

const router = express.Router();
const applyResumeReadHeaders = (_req, res, next) => {
    res.set({
        'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
};

router.get('/', applyResumeReadHeaders, authenticateToken, createListResumesHandler());
router.get('/:id/download', authenticateToken, validateParams('id'), createDownloadResumeHandler());
router.get('/:id', applyResumeReadHeaders, authenticateToken, validateParams('id'), createGetResumeHandler());
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateResumeSchema), createUpdateResumeHandler());
router.delete('/:id', authenticateToken, validateParams('id'), createDeleteResumeHandler());

export default router;
