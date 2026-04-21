import { getClient, query } from '../config/database.js';
import {
    DEFAULT_FIRM_CREDITS,
    getAiActionRuntimeConfig,
    getAiCreditCost,
    getInitialFirmCredits
} from '../config/aiCredits.js';
import {
    getLockedFirmCredits,
    insertCreditTransaction,
    invalidateCreditDependentCaches,
    updateFirmCreditsBalance
} from './aiCreditsLedger.service.js';
import { getLLMSettings } from './settings.service.js';
import {
    getFirmCreditsDetailReport,
    listFirmCreditsReport
} from './aiCreditsReporting.service.js';
import { reserveAiWorkflowCreditsWithPlan } from './aiCreditsWorkflow.service.js';
import {
    executeAiWorkflowWithCredits as executeAiWorkflowWithCreditsBase,
    refundAiCredits as refundAiCreditsBase,
    refundCreditsAmount as refundCreditsAmountBase,
    reserveFirmCredits as reserveFirmCreditsBase,
    runAiActionWithCredits as runAiActionWithCreditsBase
} from './aiCreditsActions.service.js';

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

async function withManagedClient(existingClient, operation) {
    if (existingClient) {
        return operation(existingClient);
    }

    const client = await getClient();
    try {
        return await operation(client);
    } finally {
        client.release();
    }
}

export async function addInitialFirmCreditGrant(firmId, { client = null, amount = DEFAULT_FIRM_CREDITS } = {}) {
    if (!Number.isInteger(amount) || amount <= 0) {
        return null;
    }

    return withManagedClient(client, async (dbClient) => insertCreditTransaction(dbClient, {
        firmId,
        userId: null,
        actionType: 'firm.initial_grant',
        creditsDelta: amount,
        balanceAfter: amount,
        metadata: {
            source: 'firm.create'
        }
    }));
}

export async function getConfiguredInitialFirmCredits() {
    try {
        return getInitialFirmCredits(await getLLMSettings());
    } catch {
        return DEFAULT_FIRM_CREDITS;
    }
}

export async function getConfiguredAiCreditCost(actionType) {
    try {
        return getAiCreditCost(actionType, await getLLMSettings());
    } catch {
        return getAiCreditCost(actionType);
    }
}

export async function getConfiguredAiActionRuntimeConfig(actionType) {
    try {
        return getAiActionRuntimeConfig(actionType, await getLLMSettings());
    } catch {
        return getAiActionRuntimeConfig(actionType);
    }
}

export const reserveFirmCredits = (args) => reserveFirmCreditsBase(args);

export async function assertFirmHasCredits({
    firmId,
    requiredCredits,
    actionType
}) {
    const normalizedRequiredCredits = Number(requiredCredits);
    if (!firmId || !Number.isFinite(normalizedRequiredCredits) || normalizedRequiredCredits <= 0) {
        return null;
    }

    const firmResult = await query('SELECT id, credits FROM firms WHERE id = $1', [firmId]);
    if (firmResult.rows.length === 0) {
        const error = new Error('Firm not found');
        error.statusCode = 404;
        throw error;
    }

    const currentCredits = Number(firmResult.rows[0].credits || 0);
    if (currentCredits < normalizedRequiredCredits) {
        throw buildInsufficientCreditsError({
            firmId,
            available: currentCredits,
            required: normalizedRequiredCredits,
            actionType
        });
    }

    return {
        firmId,
        available: currentCredits,
        required: normalizedRequiredCredits,
        actionType
    };
}

export async function assertImportJobHasCredits({
    firmId,
    fileCount = 0,
    improve = false
}) {
    const normalizedFileCount = Number(fileCount);
    if (!Number.isInteger(normalizedFileCount) || normalizedFileCount <= 0) {
        return null;
    }

    const analysisCost = await getConfiguredAiCreditCost('resume.analysis');
    const improvementCost = improve ? await getConfiguredAiCreditCost('resume.improvement') : 0;
    const requiredCredits = normalizedFileCount * (analysisCost + improvementCost);

    return assertFirmHasCredits({
        firmId,
        requiredCredits,
        actionType: 'resume.upload'
    });
}

export async function reserveImportJobCredits({
    firmId,
    userId = null,
    fileCount = 0,
    improve = false,
    metadata = {}
}) {
    const normalizedFileCount = Number(fileCount);
    if (!Number.isInteger(normalizedFileCount) || normalizedFileCount <= 0) {
        return null;
    }

    const analysisCost = await getConfiguredAiCreditCost('resume.analysis');
    const improvementCost = improve ? await getConfiguredAiCreditCost('resume.improvement') : 0;
    const totalReserved = normalizedFileCount * (analysisCost + improvementCost);

    if (totalReserved <= 0) {
        return null;
    }

    const reservation = await reserveFirmCredits({
        firmId,
        userId,
        actionType: 'resume.upload',
        amount: totalReserved,
        metadata: {
            fileCount: normalizedFileCount,
            improve: Boolean(improve),
            analysisCostPerItem: analysisCost,
            improvementCostPerItem: improvementCost,
            ...metadata
        }
    });

    return {
        id: reservation.id,
        firmId,
        userId,
        actionType: 'resume.upload',
        fileCount: normalizedFileCount,
        improve: Boolean(improve),
        totalReserved,
        analysisCostPerItem: analysisCost,
        improvementCostPerItem: improvementCost
    };
}

export async function addFirmCreditsTransaction({
    firmId,
    amount,
    userId = null,
    metadata = {},
    actionType = 'firm.credit_grant',
    client: existingClient = null
}) {
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
        const error = new Error('Credits amount must be a positive integer');
        error.statusCode = 400;
        throw error;
    }

    const client = existingClient || await getClient();
    const shouldManageTransaction = !existingClient;
    try {
        if (shouldManageTransaction) {
            await client.query('BEGIN');
        }

        const currentCredits = await getLockedFirmCredits(client, firmId);
        const balanceAfter = currentCredits + numericAmount;

        const updatedFirm = await updateFirmCreditsBalance(client, firmId, balanceAfter, { returning: true });

        const transaction = await insertCreditTransaction(client, {
            firmId,
            userId,
            actionType,
            creditsDelta: numericAmount,
            balanceAfter,
            metadata
        });

        if (shouldManageTransaction) {
            await client.query('COMMIT');
            await invalidateCreditDependentCaches();
        }

        return {
            firm: updatedFirm,
            transaction
        };
    } catch (error) {
        if (shouldManageTransaction) {
            await client.query('ROLLBACK');
        }
        throw error;
    } finally {
        if (shouldManageTransaction) {
            client.release();
        }
    }
}

export async function reserveAiCredits({
    firmId,
    userId = null,
    actionType,
    metadata = {}
}) {
    const { cost } = await getConfiguredAiActionRuntimeConfig(actionType);
    if (!cost) {
        return null;
    }

    return reserveFirmCredits({
        firmId,
        userId,
        actionType,
        amount: cost,
        metadata
    });
}

export async function reserveAiWorkflowCredits({
    firmId,
    userId = null,
    workflowActionType = null,
    steps = [],
    metadata = {}
}) {
    return reserveAiWorkflowCreditsWithPlan({
        firmId,
        userId,
        workflowActionType,
        steps,
        metadata,
        getConfiguredAiCreditCost
    });
}

export function workflowReservationCoversAction(reservation, actionType) {
    if (!reservation || !actionType) {
        return false;
    }

    return Array.isArray(reservation.plan)
        && reservation.plan.some((step) => step?.actionType === actionType);
}

export const executeAiWorkflowWithCredits = (args, runner) => executeAiWorkflowWithCreditsBase({
    ...args,
    reserveAiWorkflowCredits
}, runner);

export const refundCreditsAmount = (reservation, amount, metadata = {}) => refundCreditsAmountBase(reservation, amount, metadata);

export const refundAiCredits = (reservation, metadata = {}) => refundAiCreditsBase(reservation, metadata);

export const runAiActionWithCredits = (args, action) => runAiActionWithCreditsBase({
    ...args,
    getConfiguredAiActionRuntimeConfig,
    reserveAiCredits
}, action);

export async function listFirmCredits({
    search,
    page = 1,
    limit = 100,
    firmId = null
} = {}) {
    return listFirmCreditsReport(query, {
        search,
        page,
        limit,
        firmId
    });
}

export async function getFirmCreditsDetail(firmId) {
    return getFirmCreditsDetailReport(query, firmId);
}
