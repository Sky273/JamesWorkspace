/**
 * Candidate Pipeline Service
 * Manages the selection pipeline for candidates (freelancers, partner employees)
 * Includes interview scheduling with calendar integration
 */

import { safeLog } from '../utils/logger.backend.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';
import { getPipelineHistory } from './candidatePipeline/history.js';
import {
    addToPipeline as addToPipelineInternal,
    getPipelineById,
    getPipelineByMissionId,
    getPipelineByResumeId,
    getPipelineOverview,
    moveToStage as moveToStageInternal,
    removeFromPipeline as removeFromPipelineInternal,
    updatePipelineNotes
} from './candidatePipeline/pipeline.js';
import {
    cancelInterview as cancelInterviewInternal,
    completeInterview as completeInterviewInternal,
    deleteInterview,
    getInterviews,
    getPipelineStats,
    getUpcomingInterviews,
    scheduleInterview as scheduleInterviewInternal,
    updateInterview
} from './candidatePipeline/interviews.js';
import { query } from '../config/database.js';

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

let lastPipelineActivitySummary = null;

function updateLastPipelineActivitySummary(summary) {
    lastPipelineActivitySummary = {
        timestamp: new Date().toISOString(),
        ...summary
    };
}

export function getLastPipelineActivitySummary() {
    return lastPipelineActivitySummary;
}

export async function initCandidatePipelineTable() {
    try {
        await assertSchemaRequirements({
            context: 'candidate pipeline',
            tables: ['candidate_pipeline', 'pipeline_history', 'pipeline_interviews'],
            columns: {
                candidate_pipeline: ['client_id', 'adaptation_id'],
                pipeline_interviews: ['scheduled_at']
            },
            indexes: [
                'idx_candidate_pipeline_adaptation_id',
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
    getPipelineById,
    getPipelineByResumeId,
    getPipelineByMissionId,
    updatePipelineNotes,
    getPipelineHistory,
    getInterviews,
    getUpcomingInterviews,
    updateInterview,
    deleteInterview,
    getPipelineStats
};

export async function getPipelineOverviewFacade(filters = {}) {
    return getPipelineOverview(filters, PIPELINE_STAGES);
}

export async function scheduleInterview(args) {
    try {
        const interview = await scheduleInterviewInternal({ ...args, pipelineStages: PIPELINE_STAGES });
        updateLastPipelineActivitySummary({
            operation: 'scheduleInterview',
            status: 'completed',
            pipelineId: args.pipelineId,
            interviewId: interview?.id || null,
            interviewType: args.interviewType || 'client'
        });
        return interview;
    } catch (error) {
        updateLastPipelineActivitySummary({
            operation: 'scheduleInterview',
            status: 'failed',
            pipelineId: args.pipelineId,
            interviewType: args.interviewType || 'client',
            error: error.message
        });
        throw error;
    }
}

export async function addToPipeline(args) {
    try {
        const pipelineEntry = await addToPipelineInternal(args);
        updateLastPipelineActivitySummary({
            operation: 'addToPipeline',
            status: 'completed',
            pipelineId: pipelineEntry?.id || null,
            resumeId: args.resumeId,
            adaptationId: args.adaptationId || null,
            missionId: args.missionId || null,
            stage: pipelineEntry?.stage || args.stage || 'new'
        });
        return pipelineEntry;
    } catch (error) {
        updateLastPipelineActivitySummary({
            operation: 'addToPipeline',
            status: 'failed',
            resumeId: args.resumeId,
            adaptationId: args.adaptationId || null,
            missionId: args.missionId || null,
            stage: args.stage || 'new',
            error: error.message
        });
        throw error;
    }
}

export async function moveToStage(args) {
    try {
        const updatedEntry = await moveToStageInternal(args);
        updateLastPipelineActivitySummary({
            operation: 'moveToStage',
            status: 'completed',
            pipelineId: args.pipelineId,
            stage: args.newStage,
            changedBy: args.changedBy || null
        });
        return updatedEntry;
    } catch (error) {
        updateLastPipelineActivitySummary({
            operation: 'moveToStage',
            status: 'failed',
            pipelineId: args.pipelineId,
            stage: args.newStage,
            changedBy: args.changedBy || null,
            error: error.message
        });
        throw error;
    }
}

export async function removeFromPipeline(pipelineId) {
    try {
        const removed = await removeFromPipelineInternal(pipelineId);
        updateLastPipelineActivitySummary({
            operation: 'removeFromPipeline',
            status: 'completed',
            pipelineId
        });
        return removed;
    } catch (error) {
        updateLastPipelineActivitySummary({
            operation: 'removeFromPipeline',
            status: 'failed',
            pipelineId,
            error: error.message
        });
        throw error;
    }
}

export async function completeInterview(args) {
    try {
        const interview = await completeInterviewInternal(args);
        updateLastPipelineActivitySummary({
            operation: 'completeInterview',
            status: 'completed',
            interviewId: args.interviewId,
            outcome: args.outcome || null,
            changedBy: args.changedBy || null
        });
        return interview;
    } catch (error) {
        updateLastPipelineActivitySummary({
            operation: 'completeInterview',
            status: 'failed',
            interviewId: args.interviewId,
            outcome: args.outcome || null,
            changedBy: args.changedBy || null,
            error: error.message
        });
        throw error;
    }
}

export async function cancelInterview(interviewId) {
    try {
        const interview = await cancelInterviewInternal(interviewId);
        updateLastPipelineActivitySummary({
            operation: 'cancelInterview',
            status: 'completed',
            interviewId
        });
        return interview;
    } catch (error) {
        updateLastPipelineActivitySummary({
            operation: 'cancelInterview',
            status: 'failed',
            interviewId,
            error: error.message
        });
        throw error;
    }
}

export async function getResumeFirmId(resumeId) {
    const result = await query('SELECT firm_id FROM resumes WHERE id = $1', [resumeId]);
    return result.rows[0]?.firm_id || null;
}

export async function getAdaptationContext(adaptationId) {
    const result = await query(
        'SELECT id, firm_id, resume_id, mission_id FROM resume_adaptations WHERE id = $1',
        [adaptationId]
    );
    return result.rows[0] || null;
}

export async function getClientFirmId(clientId) {
    const result = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
    return result.rows[0]?.firm_id || null;
}

export async function getMissionContext(missionId) {
    const result = await query('SELECT firm_id, client_id FROM missions WHERE id = $1', [missionId]);
    return result.rows[0] || null;
}

export async function getPipelineAccessContext(pipelineId) {
    const result = await query(`
        SELECT cp.id,
               cp.resume_id,
               cp.mission_id,
               cp.client_id,
               r.firm_id as resume_firm_id,
               m.firm_id as mission_firm_id,
               m.client_id as mission_client_id,
               c.firm_id as client_firm_id
        FROM candidate_pipeline cp
        LEFT JOIN resumes r ON r.id = cp.resume_id
        LEFT JOIN missions m ON m.id = cp.mission_id
        LEFT JOIN clients c ON c.id = cp.client_id
        WHERE cp.id = $1
    `, [pipelineId]);

    return result.rows[0] || null;
}

export async function getInterviewAccessContext(interviewId) {
    const result = await query(`
        SELECT pi.id,
               pi.pipeline_id,
               cp.resume_id,
               cp.mission_id,
               cp.client_id,
               r.firm_id as resume_firm_id,
               m.firm_id as mission_firm_id,
               m.client_id as mission_client_id,
               c.firm_id as client_firm_id
        FROM pipeline_interviews pi
        INNER JOIN candidate_pipeline cp ON cp.id = pi.pipeline_id
        LEFT JOIN resumes r ON r.id = cp.resume_id
        LEFT JOIN missions m ON m.id = cp.mission_id
        LEFT JOIN clients c ON c.id = cp.client_id
        WHERE pi.id = $1
    `, [interviewId]);

    return result.rows[0] || null;
}

export async function validatePipelineAssociations({ resumeId, adaptationId, missionId, clientId, expectedFirmId = null }) {
    const resumeFirmId = resumeId ? await getResumeFirmId(resumeId) : null;
    if (resumeId && !resumeFirmId) {
        return { ok: false, status: 400, error: 'Resume not found' };
    }

    const adaptationContext = adaptationId ? await getAdaptationContext(adaptationId) : null;
    if (adaptationId && !adaptationContext) {
        return { ok: false, status: 400, error: 'Adaptation not found' };
    }

    const missionContext = missionId ? await getMissionContext(missionId) : null;
    if (missionId && !missionContext) {
        return { ok: false, status: 400, error: 'Mission not found' };
    }

    const clientFirmId = clientId ? await getClientFirmId(clientId) : null;
    if (clientId && !clientFirmId) {
        return { ok: false, status: 400, error: 'Client not found' };
    }

    if (adaptationContext && adaptationContext.resume_id !== resumeId) {
        return { ok: false, status: 400, error: 'Adaptation does not match resume' };
    }

    if (adaptationContext && missionId && adaptationContext.mission_id !== missionId) {
        return { ok: false, status: 400, error: 'Adaptation does not match mission' };
    }

    const firmIds = [resumeFirmId, adaptationContext?.firm_id || null, missionContext?.firm_id || null, clientFirmId].filter(Boolean);
    const targetFirmId = expectedFirmId || firmIds[0] || null;

    if (targetFirmId && firmIds.some((firmId) => firmId !== targetFirmId)) {
        return { ok: false, status: 403, error: 'Pipeline entities must belong to the same firm' };
    }

    if (missionContext?.client_id && clientId && missionContext.client_id !== clientId) {
        return { ok: false, status: 400, error: 'Client does not match mission' };
    }

    return { ok: true, firmId: targetFirmId };
}

export { getPipelineOverviewFacade as getPipelineOverview };
