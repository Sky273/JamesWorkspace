/**
 * Candidate Pipeline Service
 * Manages the selection pipeline for candidates (freelancers, partner employees)
 * Includes interview scheduling with calendar integration
 */

import { safeLog } from '../utils/logger.backend.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';
import { getPipelineHistory } from './candidatePipeline/history.js';
import {
    addToPipeline,
    getPipelineById,
    getPipelineByMissionId,
    getPipelineByResumeId,
    getPipelineOverview,
    moveToStage,
    removeFromPipeline,
    updatePipelineNotes
} from './candidatePipeline/pipeline.js';
import {
    cancelInterview,
    completeInterview,
    deleteInterview,
    getInterviews,
    getPipelineStats,
    getUpcomingInterviews,
    scheduleInterview as scheduleInterviewInternal,
    updateInterview
} from './candidatePipeline/interviews.js';

export const PIPELINE_STAGES = [
    { id: 'new', label: 'Nouveau', labelEn: 'New', order: 1, color: '#6B7280' },
    { id: 'screening', label: 'Présélection', labelEn: 'Screening', order: 2, color: '#3B82F6' },
    { id: 'submitted', label: 'Soumis au client', labelEn: 'Submitted to Client', order: 3, color: '#8B5CF6' },
    { id: 'interview', label: 'Entretien planifié', labelEn: 'Interview Scheduled', order: 4, color: '#F59E0B' },
    { id: 'interview_done', label: 'Entretien effectué', labelEn: 'Interview Done', order: 5, color: '#10B981' },
    { id: 'selected', label: 'Sélectionné', labelEn: 'Selected', order: 6, color: '#059669' },
    { id: 'rejected', label: 'Non retenu', labelEn: 'Not Selected', order: 7, color: '#EF4444' },
    { id: 'on_hold', label: 'En attente', labelEn: 'On Hold', order: 8, color: '#F97316' }
];

export async function initCandidatePipelineTable() {
    try {
        await assertSchemaRequirements({
            context: 'candidate pipeline',
            tables: ['candidate_pipeline', 'pipeline_history', 'pipeline_interviews'],
            columns: {
                candidate_pipeline: ['client_id'],
                pipeline_interviews: ['scheduled_at']
            },
            indexes: [
                'idx_candidate_pipeline_resume_id',
                'idx_candidate_pipeline_mission_id',
                'idx_candidate_pipeline_client_id',
                'idx_candidate_pipeline_stage',
                'idx_pipeline_history_pipeline_id',
                'idx_pipeline_interviews_pipeline_id',
                'idx_pipeline_interviews_scheduled_at'
            ]
        });

        safeLog('info', 'Candidate pipeline schema verified');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to verify candidate pipeline schema', { error: error.message });
        throw error;
    }
}

export {
    addToPipeline,
    getPipelineById,
    getPipelineByResumeId,
    getPipelineByMissionId,
    moveToStage,
    updatePipelineNotes,
    removeFromPipeline,
    getPipelineHistory,
    getInterviews,
    getUpcomingInterviews,
    updateInterview,
    completeInterview,
    cancelInterview,
    deleteInterview,
    getPipelineStats
};

export async function getPipelineOverviewFacade(filters = {}) {
    return getPipelineOverview(filters, PIPELINE_STAGES);
}

export async function scheduleInterview(args) {
    return scheduleInterviewInternal({ ...args, pipelineStages: PIPELINE_STAGES });
}

export { getPipelineOverviewFacade as getPipelineOverview };

export default {
    PIPELINE_STAGES,
    initCandidatePipelineTable,
    addToPipeline,
    getPipelineById,
    getPipelineByResumeId,
    getPipelineByMissionId,
    getPipelineOverview: getPipelineOverviewFacade,
    moveToStage,
    updatePipelineNotes,
    removeFromPipeline,
    getPipelineHistory,
    scheduleInterview,
    getInterviews,
    getUpcomingInterviews,
    updateInterview,
    completeInterview,
    cancelInterview,
    deleteInterview,
    getPipelineStats
};
