import { getClient } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    getLockedFirmCredits,
    insertCreditTransaction,
    invalidateCreditDependentCaches,
    updateFirmCreditsBalance
} from './aiCreditsLedger.service.js';

function buildInsufficientCreditsError({ firmId, available, required, actionType }) {
    const error = new Error('Insufficient firm credits');
    error.statusCode = 402;
    error.code = 'INSUFFICIENT_CREDITS';
    error.details = {
        firmId,
        available,
        required,
        actionType
    };
    return error;
}

export async function reserveFirmCredits({
    firmId,
    userId = null,
    actionType,
    amount,
    metadata = {}
}) {
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
        return null;
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const currentCredits = await getLockedFirmCredits(client, firmId);
        if (currentCredits < numericAmount) {
            throw buildInsufficientCreditsError({
                firmId,
                available: currentCredits,
                required: numericAmount,
                actionType
            });
        }

        const balanceAfter = currentCredits - numericAmount;
        await updateFirmCreditsBalance(client, firmId, balanceAfter);

        const transaction = await insertCreditTransaction(client, {
            firmId,
            userId,
            actionType,
            creditsDelta: -numericAmount,
            balanceAfter,
            metadata
        });

        await client.query('COMMIT');
        await invalidateCreditDependentCaches();

        return {
            ...transaction,
            cost: numericAmount
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function refundCreditsAmount(reservation, amount, metadata = {}) {
    if (!reservation?.firm_id || !reservation?.id) {
        return null;
    }

    const refundAmount = Math.abs(Number(amount));
    if (!refundAmount) {
        return null;
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const currentCredits = await getLockedFirmCredits(client, reservation.firm_id);
        const balanceAfter = currentCredits + refundAmount;

        await updateFirmCreditsBalance(client, reservation.firm_id, balanceAfter);

        const transaction = await insertCreditTransaction(client, {
            firmId: reservation.firm_id,
            userId: reservation.user_id || null,
            actionType: 'credit.refund',
            creditsDelta: refundAmount,
            balanceAfter,
            metadata: {
                originalActionType: reservation.action_type,
                ...metadata
            },
            relatedTransactionId: reservation.id
        });

        await client.query('COMMIT');
        await invalidateCreditDependentCaches();

        return transaction;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function refundAiCredits(reservation, metadata = {}) {
    const refundAmount = Math.abs(Number(reservation?.credits_delta || reservation?.cost || 0));
    return refundCreditsAmount(reservation, refundAmount, metadata);
}

export async function runAiActionWithCredits({
    firmId,
    userId = null,
    actionType,
    metadata = {},
    reservation = null,
    markReservedConsumption = null,
    getConfiguredAiActionRuntimeConfig,
    reserveAiCredits
}, action) {
    const actionConfig = await getConfiguredAiActionRuntimeConfig(actionType);
    const { cost } = actionConfig;
    if (!cost) {
        return action(actionConfig);
    }

    if (!firmId) {
        safeLog('warn', 'Skipping AI credit charge because no firm is associated', {
            actionType,
            userId
        });
        return action(actionConfig);
    }

    if (reservation) {
        const result = await action(actionConfig);
        if (typeof markReservedConsumption === 'function') {
            await markReservedConsumption();
        }
        return result;
    }

    const directReservation = await reserveAiCredits({
        firmId,
        userId,
        actionType,
        metadata
    });

    try {
        return await action(actionConfig);
    } catch (error) {
        try {
            await refundAiCredits(directReservation, {
                reason: 'action_failed',
                error: error.message
            });
        } catch (refundError) {
            safeLog('error', 'Failed to refund AI credits after action failure', {
                actionType,
                firmId,
                userId,
                reservationId: directReservation?.id,
                error: refundError.message
            });
        }
        throw error;
    }
}

export async function executeAiWorkflowWithCredits({
    firmId,
    userId = null,
    workflowActionType = null,
    steps = [],
    metadata = {},
    reserveAiWorkflowCredits
}, runner) {
    const workflowReservation = await reserveAiWorkflowCredits({
        firmId,
        userId,
        workflowActionType,
        steps,
        metadata
    });

    try {
        return await runner({
            workflowReservation
        });
    } catch (error) {
        if (workflowReservation?.id) {
            try {
                await refundCreditsAmount({
                    id: workflowReservation.id,
                    firm_id: firmId,
                    user_id: userId,
                    action_type: workflowReservation.actionType
                }, workflowReservation.totalReserved, {
                    reason: 'workflow_failed',
                    error: error.message
                });
            } catch (refundError) {
                safeLog('error', 'Failed to refund workflow AI credits after failure', {
                    workflowActionType: workflowReservation.actionType,
                    firmId,
                    userId,
                    reservationId: workflowReservation.id,
                    error: refundError.message
                });
            }
        }
        throw error;
    }
}
