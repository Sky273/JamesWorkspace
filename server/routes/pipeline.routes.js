/**
 * Pipeline Routes
 * API endpoints for candidate selection pipeline and interview scheduling
 */

import express from 'express';
import {
    PIPELINE_STAGES,
    addToPipeline,
    getInterviewAccessContext,
    getMissionContext,
    getPipelineById,
    getPipelineAccessContext,
    getPipelineByResumeId,
    getPipelineByMissionId,
    getPipelineOverview,
    moveToStage,
    updatePipelineNotes,
    removeFromPipeline,
    getResumeFirmId,
    getPipelineHistory,
    scheduleInterview,
    getInterviews,
    getUpcomingInterviews,
    updateInterview,
    completeInterview,
    cancelInterview,
    deleteInterview,
    getPipelineStats,
    validatePipelineAssociations
} from '../services/candidatePipeline.service.js';
import { registerInterviewRoutes, registerPipelineCrudRoutes } from './pipeline.routes.registration.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stages', authenticateToken, (req, res) => {
    res.json(PIPELINE_STAGES);
});

const pipelineRouteServices = {
    PIPELINE_STAGES,
    addToPipeline,
    getInterviewAccessContext,
    getMissionContext,
    getPipelineById,
    getPipelineAccessContext,
    getPipelineByResumeId,
    getPipelineByMissionId,
    getPipelineOverview,
    moveToStage,
    updatePipelineNotes,
    removeFromPipeline,
    getResumeFirmId,
    getPipelineHistory,
    scheduleInterview,
    getInterviews,
    getUpcomingInterviews,
    updateInterview,
    completeInterview,
    cancelInterview,
    deleteInterview,
    getPipelineStats,
    validatePipelineAssociations
};

registerInterviewRoutes(router, pipelineRouteServices);
registerPipelineCrudRoutes(router, pipelineRouteServices);

export default router;
