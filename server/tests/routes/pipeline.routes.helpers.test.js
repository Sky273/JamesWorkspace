import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../utils/validation.js', () => ({
    normalizeRequestBodyAliases: (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }

        const normalized = { ...value };
        if (Object.prototype.hasOwnProperty.call(normalized, 'resume_id') && normalized.resumeId === undefined) {
            normalized.resumeId = normalized.resume_id;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'mission_id') && normalized.missionId === undefined) {
            normalized.missionId = normalized.mission_id;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'client_id') && normalized.clientId === undefined) {
            normalized.clientId = normalized.client_id;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'Stage') && normalized.stage === undefined) {
            normalized.stage = normalized.Stage;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'Notes') && normalized.notes === undefined) {
            normalized.notes = normalized.Notes;
        }
        return normalized;
    }
}));

import {
    buildInterviewCompletionPayload,
    buildInterviewSchedulePayload,
    buildPipelineEntryCreatePayload,
    createPipelineRouteHandler,
    isValidPipelineStage,
    parseNonNegativeIntegerQuery
} from '../../routes/pipeline.routes.helpers.js';

describe('Pipeline route helpers', () => {
    it('normalizes pipeline create payloads', () => {
        expect(buildPipelineEntryCreatePayload({
            resume_id: 'r-1',
            mission_id: '',
            client_id: 'c-1',
            Stage: 'screening',
            Notes: 'legacy'
        })).toEqual({
            resumeId: 'r-1',
            adaptationId: null,
            missionId: null,
            clientId: 'c-1',
            stage: 'screening',
            notes: 'legacy'
        });
    });

    it('builds interview payload helpers', () => {
        expect(buildInterviewSchedulePayload({ title: 'Interview', scheduledAt: '2026-04-05T10:00:00Z' }, 'pipe-1', 'user-1')).toMatchObject({
            pipelineId: 'pipe-1',
            title: 'Interview',
            scheduledAt: '2026-04-05T10:00:00Z',
            createdBy: 'user-1'
        });
        expect(buildInterviewCompletionPayload({ outcome: 'selected', outcomeNotes: 'ok' }, 'int-1', 'user-2')).toEqual({
            interviewId: 'int-1',
            outcome: 'selected',
            outcomeNotes: 'ok',
            changedBy: 'user-2'
        });
    });

    it('parses non-negative integer queries', () => {
        expect(parseNonNegativeIntegerQuery(undefined, 30)).toBe(30);
        expect(parseNonNegativeIntegerQuery('12', 30)).toBe(12);
        expect(parseNonNegativeIntegerQuery('-1', 30)).toBeNull();
    });

    it('validates pipeline stages', () => {
        expect(isValidPipelineStage('screening', [{ id: 'new' }, { id: 'screening' }])).toBe(true);
        expect(isValidPipelineStage('unknown', [{ id: 'new' }])).toBe(false);
    });

    it('wraps handlers with consistent error responses', async () => {
        const send = vi.fn();
        const res = {
            status: vi.fn(() => ({ json: send })),
            json: send
        };
        const handler = createPipelineRouteHandler('log message', 'fallback', async () => {
            throw new Error('boom');
        });

        await handler({}, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(send).toHaveBeenCalledWith({ error: 'fallback' });
    });
});
