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

router.get('/', authenticateToken, createListResumesHandler());
router.get('/:id/download', authenticateToken, validateParams('id'), createDownloadResumeHandler());
router.get('/:id', authenticateToken, validateParams('id'), createGetResumeHandler());
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateResumeSchema), createUpdateResumeHandler());
router.delete('/:id', authenticateToken, validateParams('id'), createDeleteResumeHandler());

export default router;
