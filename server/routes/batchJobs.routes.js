/**
 * Batch Jobs Routes
 * API endpoints for managing batch processing jobs
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
    validateBody,
    validateParams,
    batchImproveSchema,
    batchAdaptSchema,
    batchMatchSchema,
    batchProfileSearchSchema,
    batchProfileAnalysisSchema,
    batchDealExportSchema,
    provideNameSchema
} from '../utils/validation.js';
import {
    createAdaptJob,
    createDealExportJob,
    createImportJob,
    createImproveJob,
    createMatchJob,
    createProfileAnalysisJob,
    createProfileSearchJob
} from './batchJobs/createHandlers.js';
import {
    cancelJobHandler,
    deleteJobHandler,
    downloadJobExport,
    getJobDetails,
    listJobs,
    listPendingNames,
    provideNameForItem
} from './batchJobs/manageHandlers.js';
import { createUploadMiddleware } from './batchJobs/helpers.js';

const router = express.Router();
const upload = createUploadMiddleware();

const applyBatchJobsReadHeaders = (_req, res, next) => {
    res.set({
        'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
};

router.post('/', authenticateToken, upload.array('files', 200), createImportJob);
router.post('/improve', authenticateToken, validateBody(batchImproveSchema), createImproveJob);
router.post('/adapt', authenticateToken, validateBody(batchAdaptSchema), createAdaptJob);
router.post('/match', authenticateToken, validateBody(batchMatchSchema), createMatchJob);
router.post('/profile-search', authenticateToken, validateBody(batchProfileSearchSchema), createProfileSearchJob);
router.post('/profile-analysis', authenticateToken, validateBody(batchProfileAnalysisSchema), createProfileAnalysisJob);
router.post('/deal-export', authenticateToken, validateBody(batchDealExportSchema), createDealExportJob);

router.get('/', applyBatchJobsReadHeaders, authenticateToken, listJobs);
router.get('/:id', applyBatchJobsReadHeaders, authenticateToken, validateParams('id'), getJobDetails);
router.post('/:id/cancel', authenticateToken, validateParams('id'), cancelJobHandler);
router.delete('/:id', authenticateToken, validateParams('id'), deleteJobHandler);
router.get('/:id/download', authenticateToken, validateParams('id'), downloadJobExport);
router.get('/:id/pending-names', applyBatchJobsReadHeaders, authenticateToken, listPendingNames);
router.post('/items/:itemId/provide-name', authenticateToken, validateParams('itemId'), validateBody(provideNameSchema), provideNameForItem);

export default router;
