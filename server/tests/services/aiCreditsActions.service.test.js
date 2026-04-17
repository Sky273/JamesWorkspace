import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClientMock = vi.fn();
const getLockedFirmCreditsMock = vi.fn();
const updateFirmCreditsBalanceMock = vi.fn();
const insertCreditTransactionMock = vi.fn();
const invalidateCreditDependentCachesMock = vi.fn();

vi.mock('../../config/database.js', () => ({
    getClient: (...args) => getClientMock(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/aiCreditsLedger.service.js', () => ({
    getLockedFirmCredits: (...args) => getLockedFirmCreditsMock(...args),
    updateFirmCreditsBalance: (...args) => updateFirmCreditsBalanceMock(...args),
    insertCreditTransaction: (...args) => insertCreditTransactionMock(...args),
    invalidateCreditDependentCaches: (...args) => invalidateCreditDependentCachesMock(...args)
}));

import {
    refundCreditsAmount,
    reserveFirmCredits,
    runAiActionWithCredits
} from '../../services/aiCreditsActions.service.js';

describe('aiCreditsActions.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reserves credits and commits the transaction', async () => {
        const client = {
            query: vi.fn(async () => undefined),
            release: vi.fn()
        };
        getClientMock.mockResolvedValue(client);
        getLockedFirmCreditsMock.mockResolvedValue(12);
        insertCreditTransactionMock.mockResolvedValue({
            id: 'tx-1',
            firm_id: 'firm-1',
            user_id: 'user-1',
            action_type: 'resume.analysis',
            credits_delta: -5,
            balance_after: 7
        });

        const result = await reserveFirmCredits({
            firmId: 'firm-1',
            userId: 'user-1',
            actionType: 'resume.analysis',
            amount: 5,
            metadata: { source: 'test' }
        });

        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(getLockedFirmCreditsMock).toHaveBeenCalledWith(client, 'firm-1');
        expect(updateFirmCreditsBalanceMock).toHaveBeenCalledWith(client, 'firm-1', 7);
        expect(insertCreditTransactionMock).toHaveBeenCalledWith(client, expect.objectContaining({
            firmId: 'firm-1',
            userId: 'user-1',
            actionType: 'resume.analysis',
            creditsDelta: -5,
            balanceAfter: 7
        }));
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(invalidateCreditDependentCachesMock).toHaveBeenCalled();
        expect(client.release).toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({
            id: 'tx-1',
            cost: 5
        }));
    });

    it('refunds credits against the related reservation', async () => {
        const client = {
            query: vi.fn(async () => undefined),
            release: vi.fn()
        };
        getClientMock.mockResolvedValue(client);
        getLockedFirmCreditsMock.mockResolvedValue(7);
        insertCreditTransactionMock.mockResolvedValue({
            id: 'refund-1',
            action_type: 'credit.refund',
            credits_delta: 5,
            balance_after: 12
        });

        const result = await refundCreditsAmount({
            id: 'tx-1',
            firm_id: 'firm-1',
            user_id: 'user-1',
            action_type: 'resume.analysis'
        }, 5, { reason: 'test-refund' });

        expect(updateFirmCreditsBalanceMock).toHaveBeenCalledWith(client, 'firm-1', 12);
        expect(insertCreditTransactionMock).toHaveBeenCalledWith(client, expect.objectContaining({
            actionType: 'credit.refund',
            creditsDelta: 5,
            relatedTransactionId: 'tx-1',
            metadata: expect.objectContaining({
                originalActionType: 'resume.analysis',
                reason: 'test-refund'
            })
        }));
        expect(result.id).toBe('refund-1');
    });

    it('uses an upfront reservation without reserving or refunding again', async () => {
        const action = vi.fn(async ({ maxTokens }) => ({ ok: true, maxTokens }));
        const markReservedConsumption = vi.fn(async () => undefined);
        const reserveAiCredits = vi.fn();
        const getConfiguredAiActionRuntimeConfig = vi.fn(async () => ({ cost: 25, maxTokens: 1234 }));

        const result = await runAiActionWithCredits({
            firmId: 'firm-1',
            userId: 'user-1',
            actionType: 'resume.improvement',
            reservation: { id: 'reserved-1' },
            markReservedConsumption,
            reserveAiCredits,
            getConfiguredAiActionRuntimeConfig
        }, action);

        expect(result).toEqual({ ok: true, maxTokens: 1234 });
        expect(reserveAiCredits).not.toHaveBeenCalled();
        expect(markReservedConsumption).toHaveBeenCalledTimes(1);
        expect(getClientMock).not.toHaveBeenCalled();
    });
});
