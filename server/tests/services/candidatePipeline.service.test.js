/**
 * Tests for Candidate Pipeline Service
 * Tests pipeline CRUD, stage moves, history, interviews, and statistics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    PIPELINE_STAGES,
    initCandidatePipelineTable,
    addToPipeline,
    getLastPipelineActivitySummary,
    getClientFirmId,
    getInterviewAccessContext,
    getMissionContext,
    getPipelineById,
    getPipelineAccessContext,
    getPipelineByResumeId,
    getPipelineByMissionId,
    getPipelineOverview,
    getAdaptationContext,
    getResumeFirmId,
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
    getPipelineStats,
    validatePipelineAssociations
} from '../../services/candidatePipeline.service.js';

describe('Candidate Pipeline Service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // ============================================
    // CONSTANTS
    // ============================================

    describe('PIPELINE_STAGES', () => {
        it('should define 8 stages in order', () => {
            expect(PIPELINE_STAGES).toHaveLength(8);
            expect(PIPELINE_STAGES[0].id).toBe('new');
            expect(PIPELINE_STAGES[5].id).toBe('selected');
            expect(PIPELINE_STAGES[6].id).toBe('rejected');
            expect(PIPELINE_STAGES[7].id).toBe('on_hold');
        });

        it('should have increasing order values', () => {
            for (let i = 1; i < PIPELINE_STAGES.length; i++) {
                expect(PIPELINE_STAGES[i].order).toBeGreaterThan(PIPELINE_STAGES[i - 1].order);
            }
        });
    });

    // ============================================
    // INIT
    // ============================================

    describe('initCandidatePipelineTable', () => {
        it('should verify tables, columns, and indexes', async () => {
            query.mockImplementation((sql, params) => {
                if (sql.includes('information_schema.tables')) {
                    expect(params).toEqual([['candidate_pipeline', 'pipeline_history', 'pipeline_interviews']]);
                    return Promise.resolve({ rows: [
                        { table_name: 'candidate_pipeline' },
                        { table_name: 'pipeline_history' },
                        { table_name: 'pipeline_interviews' }
                    ] });
                }
                if (sql.includes('information_schema.columns')) {
                    if (params[0] === 'candidate_pipeline') {
                        expect(params).toEqual(['candidate_pipeline', ['client_id', 'adaptation_id']]);
                        return Promise.resolve({ rows: [{ column_name: 'client_id' }, { column_name: 'adaptation_id' }] });
                    }
                    expect(params).toEqual(['pipeline_interviews', ['scheduled_at']]);
                    return Promise.resolve({ rows: [{ column_name: 'scheduled_at' }] });
                }
                if (sql.includes('pg_indexes')) {
                    return Promise.resolve({ rows: [
                        { indexname: 'idx_candidate_pipeline_adaptation_id' },
                        { indexname: 'idx_candidate_pipeline_resume_id' },
                        { indexname: 'idx_candidate_pipeline_mission_id' },
                        { indexname: 'idx_candidate_pipeline_client_id' },
                        { indexname: 'idx_candidate_pipeline_stage' },
                        { indexname: 'idx_pipeline_history_pipeline_id' },
                        { indexname: 'idx_pipeline_interviews_pipeline_id' },
                        { indexname: 'idx_pipeline_interviews_scheduled_at' }
                    ] });
                }
                return Promise.resolve({ rows: [] });
            });

            const result = await initCandidatePipelineTable();

            expect(result).toBe(true);
            expect(query).toHaveBeenCalledTimes(4);
        });

        it('should throw on fatal error', async () => {
            query.mockRejectedValueOnce(new Error('DB down'));
            await expect(initCandidatePipelineTable()).rejects.toThrow('DB down');
        });
    });

    // ============================================
    // PIPELINE CRUD
    // ============================================

    describe('addToPipeline', () => {
        it('should insert pipeline entry and add history', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'p1', stage: 'new' }] }) // insert
                .mockResolvedValueOnce({ rows: [] }); // history

            const result = await addToPipeline({
                resumeId: 'r1', adaptationId: 'a1', missionId: 'm1', clientId: 'c1',
                stage: 'new', notes: 'Added', createdBy: 'u1'
            });

            expect(result.id).toBe('p1');
            expect(getLastPipelineActivitySummary()).toMatchObject({
                operation: 'addToPipeline',
                status: 'completed',
                pipelineId: 'p1',
                resumeId: 'r1',
                adaptationId: 'a1',
                missionId: 'm1',
                stage: 'new'
            });
            expect(query.mock.calls[0][0]).toContain('INSERT INTO candidate_pipeline');
            expect(query.mock.calls[0][0]).toContain('ON CONFLICT');
            // Second call is history insert
            expect(query.mock.calls[1][0]).toContain('INSERT INTO pipeline_history');
        });

        it('should use default stage "new"', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'p1', stage: 'new' }] })
                .mockResolvedValueOnce({ rows: [] });

            await addToPipeline({ resumeId: 'r1', createdBy: 'u1' });

            expect(query.mock.calls[0][1][4]).toBe('new');
        });

        it('should expose failed add operation summary', async () => {
            query.mockRejectedValueOnce(new Error('insert failed'));

            await expect(addToPipeline({ resumeId: 'r1', missionId: 'm1', createdBy: 'u1' })).rejects.toThrow('insert failed');

            expect(getLastPipelineActivitySummary()).toMatchObject({
                operation: 'addToPipeline',
                status: 'failed',
                resumeId: 'r1',
                missionId: 'm1',
                stage: 'new',
                error: 'insert failed'
            });
        });
    });

    describe('getPipelineById', () => {
        it('should return pipeline entry with joins', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'p1', resume_name: 'CV', mission_title: 'Dev' }] });

            const result = await getPipelineById('p1');

            expect(result.resume_name).toBe('CV');
            expect(query.mock.calls[0][0]).toContain('LEFT JOIN resumes');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getPipelineById('missing')).toBeNull();
        });
    });

    describe('getPipelineByResumeId', () => {
        it('should return pipeline entries for a resume', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'p1' }, { id: 'p2' }] });

            const result = await getPipelineByResumeId('r1');

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][1]).toEqual(['r1']);
        });
    });

    describe('getPipelineByMissionId', () => {
        it('should return pipeline entries for a mission', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'p1', resume_name: 'CV' }] });

            const result = await getPipelineByMissionId('m1');

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('cp.mission_id = $1');
        });
    });

    describe('getPipelineOverview', () => {
        it('should return overview grouped by stage', async () => {
            query.mockResolvedValueOnce({
                rows: [
                    { stage: 'new', count: 3, items: [{ id: '1' }] },
                    { stage: 'screening', count: 1, items: [{ id: '2' }] }
                ]
            });

            const result = await getPipelineOverview();

            expect(result.new.count).toBe(3);
            expect(result.screening.count).toBe(1);
            expect(result.selected.count).toBe(0); // no data for this stage
            expect(result.selected.items).toEqual([]);
        });

        it('should apply clientId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getPipelineOverview({ clientId: 'c1' });

            expect(query.mock.calls[0][0]).toContain('cp.client_id = $');
            expect(query.mock.calls[0][1]).toContain('c1');
        });

        it('should apply missionId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getPipelineOverview({ missionId: 'm1' });

            expect(query.mock.calls[0][0]).toContain('cp.mission_id = $');
        });

        it('should apply firmId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getPipelineOverview({ firmId: 'f1' });

            expect(query.mock.calls[0][0]).toContain('COALESCE(m.firm_id, r.firm_id, c.firm_id)');
            expect(query.mock.calls[0][1]).toContain('f1');
        });
    });

    describe('moveToStage', () => {
        it('should update stage and record history', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ stage: 'new' }] })       // get current
                .mockResolvedValueOnce({ rows: [{ id: 'p1', stage: 'screening' }] }) // update
                .mockResolvedValueOnce({ rows: [] }); // history

            const result = await moveToStage({
                pipelineId: 'p1', newStage: 'screening', changedBy: 'u1', notes: 'Moved'
            });

            expect(result.stage).toBe('screening');
            expect(getLastPipelineActivitySummary()).toMatchObject({
                operation: 'moveToStage',
                status: 'completed',
                pipelineId: 'p1',
                stage: 'screening',
                changedBy: 'u1'
            });
            expect(query.mock.calls[2][0]).toContain('INSERT INTO pipeline_history');
            expect(query.mock.calls[2][1]).toContain('new'); // from_stage
            expect(query.mock.calls[2][1]).toContain('screening'); // to_stage
        });

        it('should throw if pipeline entry not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await expect(moveToStage({
                pipelineId: 'missing', newStage: 'screening', changedBy: 'u1'
            })).rejects.toThrow('Pipeline entry not found');
        });
    });

    describe('updatePipelineNotes', () => {
        it('should update notes', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'p1', notes: 'Updated' }] });

            const result = await updatePipelineNotes({ pipelineId: 'p1', notes: 'Updated' });

            expect(result.notes).toBe('Updated');
        });
    });

    describe('removeFromPipeline', () => {
        it('should delete entry and return true', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            expect(await removeFromPipeline('p1')).toBe(true);
            expect(getLastPipelineActivitySummary()).toMatchObject({
                operation: 'removeFromPipeline',
                status: 'completed',
                pipelineId: 'p1'
            });
            expect(query.mock.calls[0][0]).toContain('DELETE FROM candidate_pipeline');
        });
    });

    // ============================================
    // HISTORY
    // ============================================

    describe('getPipelineHistory', () => {
        it('should return history entries with user names', async () => {
            query.mockResolvedValueOnce({ rows: [
                { id: 'h1', from_stage: 'new', to_stage: 'screening', changed_by_name: 'Admin' }
            ] });

            const result = await getPipelineHistory('p1');

            expect(result).toHaveLength(1);
            expect(result[0].changed_by_name).toBe('Admin');
        });
    });

    describe('access helpers', () => {
        it('should return resume firm id', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            await expect(getResumeFirmId('r1')).resolves.toBe('f1');
        });

        it('should return adaptation context', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'a1', firm_id: 'f1', resume_id: 'r1', mission_id: 'm1' }] });
            await expect(getAdaptationContext('a1')).resolves.toEqual({ id: 'a1', firm_id: 'f1', resume_id: 'r1', mission_id: 'm1' });
        });

        it('should return mission context', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1', client_id: 'c1' }] });
            await expect(getMissionContext('m1')).resolves.toEqual({ firm_id: 'f1', client_id: 'c1' });
        });

        it('should return client firm id', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            await expect(getClientFirmId('c1')).resolves.toBe('f1');
        });

        it('should return pipeline access context', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'p1', resume_firm_id: 'f1' }] });
            await expect(getPipelineAccessContext('p1')).resolves.toEqual({ id: 'p1', resume_firm_id: 'f1' });
        });

        it('should return interview access context', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', pipeline_id: 'p1' }] });
            await expect(getInterviewAccessContext('i1')).resolves.toEqual({ id: 'i1', pipeline_id: 'p1' });
        });

        it('should validate coherent pipeline associations', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'a1', firm_id: 'f1', resume_id: 'r1', mission_id: 'm1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1', client_id: 'c1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });

            await expect(validatePipelineAssociations({
                resumeId: 'r1',
                adaptationId: 'a1',
                missionId: 'm1',
                clientId: 'c1',
                expectedFirmId: 'f1'
            })).resolves.toEqual({ ok: true, firmId: 'f1' });
        });

        it('should reject client mismatch with mission', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1', client_id: 'c1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });

            await expect(validatePipelineAssociations({
                resumeId: 'r1',
                adaptationId: 'missing',
                missionId: 'm1',
                clientId: 'c1',
                expectedFirmId: 'f1'
            })).resolves.toEqual({
                ok: false,
                status: 400,
                error: 'Adaptation not found'
            });
        });

        it('should reject adaptation mismatch with mission', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'a1', firm_id: 'f1', resume_id: 'r1', mission_id: 'm2' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1', client_id: 'c1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });

            await expect(validatePipelineAssociations({
                resumeId: 'r1',
                adaptationId: 'a1',
                missionId: 'm1',
                clientId: 'c1',
                expectedFirmId: 'f1'
            })).resolves.toEqual({
                ok: false,
                status: 400,
                error: 'Adaptation does not match mission'
            });
        });

        it('should reject client mismatch with mission', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'a1', firm_id: 'f1', resume_id: 'r1', mission_id: 'm1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1', client_id: 'c1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });

            await expect(validatePipelineAssociations({
                resumeId: 'r1',
                adaptationId: 'a1',
                missionId: 'm1',
                clientId: 'c2',
                expectedFirmId: 'f1'
            })).resolves.toEqual({
                ok: false,
                status: 400,
                error: 'Client does not match mission'
            });
        });

        it('should reject client mismatch with mission', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1', client_id: 'c1' }] })
                .mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });

            await expect(validatePipelineAssociations({
                resumeId: 'r1',
                missionId: 'm1',
                clientId: 'c2',
                expectedFirmId: 'f1'
            })).resolves.toEqual({
                ok: false,
                status: 400,
                error: 'Client does not match mission'
            });
        });
    });

    // ============================================
    // INTERVIEWS
    // ============================================

    describe('scheduleInterview', () => {
        it('should create interview and auto-move to interview stage for client type', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'i1', pipeline_id: 'p1' }] }) // insert
                .mockResolvedValueOnce({ rows: [{ id: 'p1', stage: 'screening' }] }) // getPipelineById
                .mockResolvedValueOnce({ rows: [{ stage: 'screening' }] }) // moveToStage: get current
                .mockResolvedValueOnce({ rows: [{ id: 'p1', stage: 'interview' }] }) // moveToStage: update
                .mockResolvedValueOnce({ rows: [] }); // moveToStage: history

            const result = await scheduleInterview({
                pipelineId: 'p1', title: 'Interview', scheduledAt: '2025-06-01',
                interviewType: 'client', createdBy: 'u1'
            });

            expect(result.id).toBe('i1');
            expect(getLastPipelineActivitySummary()).toMatchObject({
                operation: 'scheduleInterview',
                status: 'completed',
                pipelineId: 'p1',
                interviewId: 'i1',
                interviewType: 'client'
            });
        });

        it('should NOT auto-move for non-client interview type', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', pipeline_id: 'p1' }] });

            await scheduleInterview({
                pipelineId: 'p1', title: 'Technical Screen', scheduledAt: '2025-06-01',
                interviewType: 'technical', createdBy: 'u1'
            });

            // Only 1 query (insert), no getPipelineById or moveToStage
            expect(query).toHaveBeenCalledTimes(1);
        });
    });

    describe('getInterviews', () => {
        it('should return interviews for pipeline entry', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', title: 'Interview 1' }] });

            const result = await getInterviews('p1');

            expect(result).toHaveLength(1);
        });
    });

    describe('getUpcomingInterviews', () => {
        it('should return upcoming interviews', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', resume_name: 'CV' }] });

            const result = await getUpcomingInterviews();

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][1]).toContain('scheduled');
        });

        it('should apply userId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getUpcomingInterviews({ userId: 'u1' });

            expect(query.mock.calls[0][0]).toContain('pi.created_by');
        });

        it('should apply days filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getUpcomingInterviews({ days: 7 });

            expect(query.mock.calls[0][0]).toContain('INTERVAL');
        });

        it('should apply firmId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getUpcomingInterviews({ firmId: 'f1' });

            expect(query.mock.calls[0][0]).toContain('COALESCE(m.firm_id, r.firm_id, c.firm_id)');
            expect(query.mock.calls[0][1]).toContain('f1');
        });

        it('should throw on invalid days filter', async () => {
            await expect(getUpcomingInterviews({ days: -1 })).rejects.toThrow('Invalid days filter');
        });
    });

    describe('updateInterview', () => {
        it('should update allowed fields', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', title: 'Updated' }] });

            const result = await updateInterview('i1', { title: 'Updated', status: 'rescheduled' });

            expect(result.title).toBe('Updated');
            expect(query.mock.calls[0][0]).toContain('UPDATE pipeline_interviews');
        });

        it('should throw if no valid fields provided', async () => {
            await expect(updateInterview('i1', { invalid_field: 'x' })).rejects.toThrow('No valid fields to update');
        });

        it('should JSON.stringify attendees', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1' }] });

            await updateInterview('i1', { attendees: [{ id: 'u1' }] });

            expect(query.mock.calls[0][1][0]).toBe(JSON.stringify([{ id: 'u1' }]));
        });
    });

    describe('completeInterview', () => {
        it('should complete and auto-move to interview_done if currently in interview stage', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'i1', pipeline_id: 'p1' }] }) // complete
                .mockResolvedValueOnce({ rows: [{ id: 'p1', stage: 'interview' }] }) // getPipelineById
                .mockResolvedValueOnce({ rows: [{ stage: 'interview' }] }) // moveToStage: get current
                .mockResolvedValueOnce({ rows: [{ id: 'p1', stage: 'interview_done' }] }) // moveToStage: update
                .mockResolvedValueOnce({ rows: [] }); // moveToStage: history

            const result = await completeInterview({
                interviewId: 'i1', outcome: 'positive', outcomeNotes: 'Great',
                changedBy: 'u1'
            });

            expect(result.id).toBe('i1');
            expect(getLastPipelineActivitySummary()).toMatchObject({
                operation: 'completeInterview',
                status: 'completed',
                interviewId: 'i1',
                outcome: 'positive',
                changedBy: 'u1'
            });
        });
    });

    describe('cancelInterview', () => {
        it('should cancel interview', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', status: 'cancelled' }] });

            const result = await cancelInterview('i1');

            expect(result.status).toBe('cancelled');
            expect(getLastPipelineActivitySummary()).toMatchObject({
                operation: 'cancelInterview',
                status: 'completed',
                interviewId: 'i1'
            });
        });
    });

    describe('deleteInterview', () => {
        it('should delete interview', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await deleteInterview('i1')).toBe(true);
        });
    });

    // ============================================
    // STATISTICS
    // ============================================

    describe('getPipelineStats', () => {
        it('should return stage counts', async () => {
            const stats = {
                total: '10', new_count: '3', screening_count: '2', submitted_count: '1',
                interview_count: '1', interview_done_count: '1', selected_count: '1',
                rejected_count: '1', on_hold_count: '0', upcoming_interviews: '2'
            };
            query.mockResolvedValueOnce({ rows: [stats] });

            const result = await getPipelineStats();

            expect(result.total).toBe('10');
            expect(result.upcoming_interviews).toBe('2');
        });

        it('should apply missionId filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '0' }] });

            await getPipelineStats({ missionId: 'm1' });

            expect(query.mock.calls[0][0]).toContain('cp.mission_id = $');
        });

        it('should apply clientId filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '0' }] });

            await getPipelineStats({ clientId: 'c1' });

            expect(query.mock.calls[0][0]).toContain('cp.client_id = $');
        });

        it('should apply firmId filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '0' }] });

            await getPipelineStats({ firmId: 'f1' });

            expect(query.mock.calls[0][0]).toContain('COALESCE(m.firm_id, r.firm_id, c.firm_id)');
            expect(query.mock.calls[0][1]).toContain('f1');
        });
    });
});

