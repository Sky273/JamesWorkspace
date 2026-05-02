import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getPipelineById, getPipelineCacheContext, invalidateCandidatePipelineContext, moveToStage } from './pipeline.js';
import { CACHE_KEYS, candidatePipelineCache } from '../cache.service.js';

const PIPELINE_AGGREGATE_SCOPE = CACHE_KEYS.candidatePipeline.AGGREGATES || CACHE_KEYS.candidatePipeline.ALL;

function buildInterviewAggregateCacheKey(prefix, filters = {}) {
    return `${prefix}:${JSON.stringify({
        userId: filters.userId || null,
        days: filters.days ?? null,
        firmId: filters.firmId || null,
        missionId: filters.missionId || null,
        clientId: filters.clientId || null
    })}`;
}

async function scheduleInterview({
    pipelineId,
    title,
    description,
    interviewType = 'client',
    scheduledAt,
    durationMinutes = 60,
    location,
    meetingLink,
    attendees = [],
    calendarEventId,
    calendarProvider,
    createdBy,
    pipelineStages
}) {
    try {
        let pipelineContext = null;
        const result = await query(
            `
            INSERT INTO pipeline_interviews (
                pipeline_id, title, description, interview_type, scheduled_at,
                duration_minutes, location, meeting_link, attendees,
                calendar_event_id, calendar_provider, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `,
            [
                pipelineId, title, description, interviewType, scheduledAt,
                durationMinutes, location, meetingLink, JSON.stringify(attendees),
                calendarEventId, calendarProvider, createdBy
            ]
        );

        if (interviewType === 'client') {
            const pipeline = await getPipelineById(pipelineId);
            pipelineContext = pipeline
                ? { id: pipeline.id, resume_id: pipeline.resume_id, mission_id: pipeline.mission_id }
                : null;
            const currentStageOrder = pipelineStages.find((stage) => stage.id === pipeline.stage)?.order || 0;
            const interviewStageOrder = pipelineStages.find((stage) => stage.id === 'interview')?.order || 4;
            if (currentStageOrder < interviewStageOrder) {
                await moveToStage({
                    pipelineId,
                    newStage: 'interview',
                    changedBy: createdBy,
                    notes: `Entretien client planifié: ${title}`
                });
            }
        }

        safeLog('info', 'Interview scheduled', { pipelineId, interviewType, scheduledAt });
        if (!pipelineContext) {
            pipelineContext = await getPipelineCacheContext(pipelineId);
        }
        await invalidateCandidatePipelineContext({
            pipelineId,
            resumeId: pipelineContext?.resume_id,
            missionId: pipelineContext?.mission_id
        });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to schedule interview', { error: error.message });
        throw error;
    }
}

async function getInterviews(pipelineId, { bypassCache = false } = {}) {
    try {
        const loadInterviews = async () => {
            const result = await query(
                `
                SELECT * FROM pipeline_interviews
                WHERE pipeline_id = $1
                ORDER BY scheduled_at ASC
            `,
                [pipelineId]
            );

            return result.rows;
        };

        if (bypassCache) {
            return loadInterviews();
        }

        return candidatePipelineCache.getOrLoad(`interviews:${pipelineId}`, async () => {
            return loadInterviews();
        }, {
            scope: `detail:${pipelineId}`
        });
    } catch (error) {
        safeLog('error', 'Failed to get interviews', { error: error.message });
        throw error;
    }
}

async function getUpcomingInterviews(filters = {}) {
    try {
        const cacheKey = buildInterviewAggregateCacheKey('upcoming', filters);
        let whereClause = 'WHERE pi.scheduled_at >= NOW() AND pi.status = $1';
        const params = ['scheduled'];
        let paramIndex = 2;

        if (filters.userId) {
            whereClause += ` AND (pi.created_by = $${paramIndex} OR pi.attendees @> $${paramIndex + 1}::jsonb)`;
            params.push(filters.userId, JSON.stringify([{ id: filters.userId }]));
            paramIndex += 2;
        }

        if (filters.days) {
            const daysInt = parseInt(filters.days, 10);
            if (!Number.isFinite(daysInt) || daysInt < 0) {
                throw new Error('Invalid days filter');
            }
            whereClause += ` AND pi.scheduled_at <= NOW() + INTERVAL '1 day' * $${paramIndex++}`;
            params.push(daysInt);
        }

        if (filters.firmId) {
            whereClause += ` AND COALESCE(m.firm_id, r.firm_id, c.firm_id) = $${paramIndex++}`;
            params.push(filters.firmId);
        }

        return candidatePipelineCache.getOrLoad(cacheKey, async () => {
            const result = await query(
            `
            SELECT 
                pi.*,
                cp.resume_id,
                r.name as resume_name,
                m.title as mission_title,
                c.name as client_name
            FROM pipeline_interviews pi
            JOIN candidate_pipeline cp ON pi.pipeline_id = cp.id
            LEFT JOIN resumes r ON cp.resume_id = r.id
            LEFT JOIN missions m ON cp.mission_id = m.id
            LEFT JOIN clients c ON cp.client_id = c.id
            ${whereClause}
            ORDER BY pi.scheduled_at ASC
            LIMIT 50
        `,
                params
            );

            return result.rows;
        }, {
            scope: PIPELINE_AGGREGATE_SCOPE
        });
    } catch (error) {
        safeLog('error', 'Failed to get upcoming interviews', { error: error.message });
        throw error;
    }
}

async function updateInterview(interviewId, updates) {
    try {
        const allowedFields = [
            'title', 'description', 'scheduled_at', 'duration_minutes',
            'location', 'meeting_link', 'attendees', 'status', 'outcome', 'outcome_notes'
        ];

        const setClauses = [];
        const params = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(snakeKey)) {
                setClauses.push(`${snakeKey} = $${paramIndex++}`);
                params.push(key === 'attendees' ? JSON.stringify(value) : value);
            }
        }

        if (setClauses.length === 0) {
            throw new Error('No valid fields to update');
        }

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        params.push(interviewId);

        const result = await query(
            `
            UPDATE pipeline_interviews
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `,
            params
        );

        const updatedInterview = result.rows[0];
        const pipelineContext = updatedInterview?.pipeline_id
            ? await getPipelineCacheContext(updatedInterview.pipeline_id)
            : null;
        await invalidateCandidatePipelineContext({
            pipelineId: updatedInterview?.pipeline_id,
            resumeId: pipelineContext?.resume_id,
            missionId: pipelineContext?.mission_id
        });
        return updatedInterview;
    } catch (error) {
        safeLog('error', 'Failed to update interview', { error: error.message });
        throw error;
    }
}

async function completeInterview({ interviewId, outcome, outcomeNotes, changedBy }) {
    try {
        const result = await query(
            `
            UPDATE pipeline_interviews
            SET status = 'completed', outcome = $1, outcome_notes = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `,
            [outcome, outcomeNotes, interviewId]
        );

        const interview = result.rows[0];
        const pipeline = await getPipelineById(interview.pipeline_id);
        if (pipeline.stage === 'interview') {
            await moveToStage({
                pipelineId: interview.pipeline_id,
                newStage: 'interview_done',
                changedBy,
                notes: `Entretien terminé: ${outcome}`
            });
        }

        await invalidateCandidatePipelineContext({
            pipelineId: interview.pipeline_id,
            resumeId: pipeline?.resume_id,
            missionId: pipeline?.mission_id
        });
        return interview;
    } catch (error) {
        safeLog('error', 'Failed to complete interview', { error: error.message });
        throw error;
    }
}

async function cancelInterview(interviewId) {
    try {
        const result = await query(
            `
            UPDATE pipeline_interviews
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `,
            [interviewId]
        );

        const cancelledInterview = result.rows[0];
        const pipelineContext = cancelledInterview?.pipeline_id
            ? await getPipelineCacheContext(cancelledInterview.pipeline_id)
            : null;
        await invalidateCandidatePipelineContext({
            pipelineId: cancelledInterview?.pipeline_id,
            resumeId: pipelineContext?.resume_id,
            missionId: pipelineContext?.mission_id
        });
        return cancelledInterview;
    } catch (error) {
        safeLog('error', 'Failed to cancel interview', { error: error.message });
        throw error;
    }
}

async function deleteInterview(interviewId) {
    try {
        const deleted = await query(
            'DELETE FROM pipeline_interviews WHERE id = $1 RETURNING id, pipeline_id',
            [interviewId]
        );
        const pipelineId = deleted.rows[0]?.pipeline_id || null;
        const pipelineContext = pipelineId ? await getPipelineCacheContext(pipelineId) : null;
        await invalidateCandidatePipelineContext({
            pipelineId,
            resumeId: pipelineContext?.resume_id,
            missionId: pipelineContext?.mission_id
        });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to delete interview', { error: error.message });
        throw error;
    }
}

async function getPipelineStats(filters = {}) {
    try {
        const cacheKey = buildInterviewAggregateCacheKey('stats', filters);
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters.missionId) {
            whereClause += ` AND cp.mission_id = $${paramIndex++}`;
            params.push(filters.missionId);
        }

        if (filters.clientId) {
            whereClause += ` AND cp.client_id = $${paramIndex++}`;
            params.push(filters.clientId);
        }

        if (filters.firmId) {
            whereClause += ` AND COALESCE(m.firm_id, r.firm_id, c.firm_id) = $${paramIndex++}`;
            params.push(filters.firmId);
        }

        return candidatePipelineCache.getOrLoad(cacheKey, async () => {
            const result = await query(
            `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE cp.stage = 'new') as new_count,
                COUNT(*) FILTER (WHERE cp.stage = 'screening') as screening_count,
                COUNT(*) FILTER (WHERE cp.stage = 'submitted') as submitted_count,
                COUNT(*) FILTER (WHERE cp.stage = 'interview') as interview_count,
                COUNT(*) FILTER (WHERE cp.stage = 'interview_done') as interview_done_count,
                COUNT(*) FILTER (WHERE cp.stage = 'selected') as selected_count,
                COUNT(*) FILTER (WHERE cp.stage = 'rejected') as rejected_count,
                COUNT(*) FILTER (WHERE cp.stage = 'on_hold') as on_hold_count,
                (SELECT COUNT(*) FROM pipeline_interviews pi 
                 JOIN candidate_pipeline cp2 ON pi.pipeline_id = cp2.id 
                 ${whereClause.replace('cp.', 'cp2.')} AND pi.status = 'scheduled' AND pi.scheduled_at >= NOW()
                ) as upcoming_interviews
            FROM candidate_pipeline cp
            ${whereClause}
        `,
                params
            );

            return result.rows[0];
        }, {
            scope: PIPELINE_AGGREGATE_SCOPE
        });
    } catch (error) {
        safeLog('error', 'Failed to get pipeline stats', { error: error.message });
        throw error;
    }
}

export {
    cancelInterview,
    completeInterview,
    deleteInterview,
    getInterviews,
    getPipelineStats,
    getUpcomingInterviews,
    scheduleInterview,
    updateInterview
};
