import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClientMock = vi.fn();
const queryMock = vi.fn();
const invalidateFirmsCachesMock = vi.fn(async () => undefined);
const invalidateClientsCachesMock = vi.fn(async () => undefined);
const invalidateDealsCachesMock = vi.fn(async () => undefined);
const invalidateMissionsCachesMock = vi.fn(async () => undefined);

vi.mock('../../config/database.js', () => ({
    getClient: (...args) => getClientMock(...args),
    query: (...args) => queryMock(...args)
}));

vi.mock('../../services/cache.service.js', () => ({
    invalidateFirmsCaches: (...args) => invalidateFirmsCachesMock(...args),
    invalidateClientsCaches: (...args) => invalidateClientsCachesMock(...args),
    invalidateDealsCaches: (...args) => invalidateDealsCachesMock(...args),
    invalidateMissionsCaches: (...args) => invalidateMissionsCachesMock(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const getLLMSettingsMock = vi.fn();
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: (...args) => getLLMSettingsMock(...args)
}));

import {
    reserveAiCredits,
    refundAiCredits,
    runAiActionWithCredits,
    addFirmCreditsTransaction
} from '../../services/aiCredits.service.js';
import { getAiCreditCost, getAiActionMaxTokens } from '../../config/aiCredits.js';

function createDbClient(sequence) {
    return {
        query: vi.fn(async (...args) => {
            if (sequence.length === 0) {
                throw new Error(`Unexpected query: ${args[0]}`);
            }
            return sequence.shift();
        }),
        release: vi.fn()
    };
}

describe('aiCredits.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getLLMSettingsMock.mockResolvedValue({});
    });

    it('reserves credits and records a negative transaction', async () => {
        const client = createDbClient([
            undefined,
            { rows: [{ id: 'firm-1', credits: 100 }] },
            undefined,
            { rows: [{ id: 'tx-1', firm_id: 'firm-1', user_id: 'user-1', action_type: 'chatbot.message', credits_delta: -1, balance_after: 99 }] },
            undefined
        ]);
        getClientMock.mockResolvedValue(client);

        const result = await reserveAiCredits({
            firmId: 'firm-1',
            userId: 'user-1',
            actionType: 'chatbot.message',
            metadata: { source: 'test' }
        });

        expect(result.id).toBe('tx-1');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, credits FROM firms'), ['firm-1']);
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firm_credit_transactions'), expect.arrayContaining(['firm-1', 'user-1', 'chatbot.message', -1, 99]));
        expect(invalidateFirmsCachesMock).toHaveBeenCalled();
    });

    it('rejects when credits are insufficient', async () => {
        const client = createDbClient([
            undefined,
            { rows: [{ id: 'firm-1', credits: 0 }] },
            undefined
        ]);
        getClientMock.mockResolvedValue(client);

        await expect(reserveAiCredits({
            firmId: 'firm-1',
            userId: 'user-1',
            actionType: 'chatbot.message'
        })).rejects.toMatchObject({
            statusCode: 402,
            code: 'INSUFFICIENT_CREDITS'
        });

        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('refunds a reserved transaction with a positive delta', async () => {
        const client = createDbClient([
            undefined,
            { rows: [{ id: 'firm-1', credits: 99 }] },
            undefined,
            { rows: [{ id: 'tx-2', action_type: 'credit.refund', credits_delta: 1, balance_after: 100 }] },
            undefined
        ]);
        getClientMock.mockResolvedValue(client);

        const result = await refundAiCredits({
            id: 'tx-1',
            firm_id: 'firm-1',
            user_id: 'user-1',
            action_type: 'chatbot.message',
            credits_delta: -1
        }, { reason: 'test' });

        expect(result.id).toBe('tx-2');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firm_credit_transactions'), expect.arrayContaining(['firm-1', 'user-1', 'credit.refund', 1, 100]));
    });

    it('wraps an AI action and refunds automatically on failure', async () => {
        const reserveClient = createDbClient([
            undefined,
            { rows: [{ id: 'firm-1', credits: 100 }] },
            undefined,
            { rows: [{ id: 'tx-1', firm_id: 'firm-1', user_id: 'user-1', action_type: 'resume.ai_modify', credits_delta: -5, balance_after: 95 }] },
            undefined
        ]);
        const refundClient = createDbClient([
            undefined,
            { rows: [{ id: 'firm-1', credits: 95 }] },
            undefined,
            { rows: [{ id: 'tx-2', action_type: 'credit.refund', credits_delta: 5, balance_after: 100 }] },
            undefined
        ]);
        getClientMock
            .mockResolvedValueOnce(reserveClient)
            .mockResolvedValueOnce(refundClient);

        await expect(runAiActionWithCredits({
            firmId: 'firm-1',
            userId: 'user-1',
            actionType: 'resume.ai_modify'
        }, async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');

        expect(refundClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firm_credit_transactions'), expect.arrayContaining(['firm-1', 'user-1', 'credit.refund', 5, 100]));
    });

    it('records positive credit adjustments for manual grants', async () => {
        const client = createDbClient([
            undefined,
            { rows: [{ id: 'firm-1', credits: 1000 }] },
            { rows: [{ id: 'firm-1', credits: 1250 }] },
            { rows: [{ id: 'tx-1', credits_delta: 250, balance_after: 1250 }] },
            undefined
        ]);
        getClientMock.mockResolvedValue(client);

        const result = await addFirmCreditsTransaction({
            firmId: 'firm-1',
            userId: 'admin-1',
            amount: 250
        });

        expect(result.firm.credits).toBe(1250);
        expect(result.transaction.credits_delta).toBe(250);
    });

    it('exposes the configured business costs for key AI actions', () => {
        expect(getAiCreditCost('resume.analysis')).toBe(25);
        expect(getAiCreditCost('resume.improvement')).toBe(75);
        expect(getAiCreditCost('resume.adaptation')).toBe(50);
        expect(getAiCreditCost('profile.analysis')).toBe(25);
    });

    it('exposes the configured default max token budgets for key AI actions', () => {
        expect(getAiActionMaxTokens('resume.analysis')).toBe(16000);
        expect(getAiActionMaxTokens('resume.improvement')).toBe(16384);
        expect(getAiActionMaxTokens('resume.adaptation')).toBe(8192);
        expect(getAiActionMaxTokens('profile.analysis')).toBe(3072);
    });

    it('uses the configured settings overrides for AI credit costs', async () => {
        getLLMSettingsMock.mockResolvedValueOnce({
            aiCreditResumeAnalysis: 40
        });

        const client = createDbClient([
            undefined,
            { rows: [{ id: 'firm-1', credits: 100 }] },
            undefined,
            { rows: [{ id: 'tx-1', firm_id: 'firm-1', user_id: 'user-1', action_type: 'resume.analysis', credits_delta: -40, balance_after: 60 }] },
            undefined
        ]);
        getClientMock.mockResolvedValue(client);

        const result = await reserveAiCredits({
            firmId: 'firm-1',
            userId: 'user-1',
            actionType: 'resume.analysis'
        });

        expect(result.credits_delta).toBe(-40);
    });

    it('uses the configured settings overrides for AI max token budgets', async () => {
        getLLMSettingsMock.mockResolvedValueOnce({
            aiMaxTokensResumeAnalysis: 12000
        });

        expect(getAiActionMaxTokens('resume.analysis', await getLLMSettingsMock())).toBe(12000);
    });
});
