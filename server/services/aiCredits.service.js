import { getClient, query } from '../config/database.js';
import {
    DEFAULT_FIRM_CREDITS,
    getAiActionRuntimeConfig,
    getAiCreditCost,
    getInitialFirmCredits
} from '../config/aiCredits.js';
import { escapeLike } from '../utils/postgresHelpers.js';
import {
    getLockedFirmCredits,
    insertCreditTransaction,
    invalidateCreditDependentCaches,
    updateFirmCreditsBalance
} from './aiCreditsLedger.service.js';
import { getLLMSettings } from './settings.service.js';
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

async function buildAiWorkflowPlan(steps = []) {
    const normalizedSteps = Array.isArray(steps) ? steps : [];
    const plan = [];

    for (const step of normalizedSteps) {
        const actionType = step?.actionType;
        const units = Number(step?.units ?? 1);
        if (!actionType || !Number.isInteger(units) || units <= 0) {
            continue;
        }

        const costPerUnit = await getConfiguredAiCreditCost(actionType);
        const reservedAmount = units * costPerUnit;
        if (reservedAmount <= 0) {
            continue;
        }

        plan.push({
            actionType,
            units,
            costPerUnit,
            reservedAmount
        });
    }

    return plan;
}

export async function reserveAiWorkflowCredits({
    firmId,
    userId = null,
    workflowActionType = null,
    steps = [],
    metadata = {}
}) {
    const plan = await buildAiWorkflowPlan(steps);
    if (plan.length === 0) {
        return null;
    }

    const totalReserved = plan.reduce((sum, step) => sum + step.reservedAmount, 0);
    const reservationActionType = workflowActionType || (plan.length === 1 ? plan[0].actionType : 'ai.workflow');

    const reservation = await reserveFirmCredits({
        firmId,
        userId,
        actionType: reservationActionType,
        amount: totalReserved,
        metadata: {
            plan,
                ...metadata
        }
    });

    return {
        id: reservation.id,
        firmId,
        userId,
        actionType: reservationActionType,
        totalReserved,
        plan
    };
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
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (firmId) {
        conditions.push(`id = $${paramIndex}`);
        params.push(firmId);
        paramIndex++;
    }

    if (search) {
        conditions.push(`LOWER(name) LIKE $${paramIndex}`);
        params.push(`%${escapeLike(search.toLowerCase())}%`);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const listResult = await query(
        `SELECT * FROM firms ${whereClause} ORDER BY name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit + 1, offset]
    );
    const hasMore = listResult.rows.length > limit;
    const firms = hasMore ? listResult.rows.slice(0, limit) : listResult.rows;

    let totalCount = null;
    if (page === 1) {
        const countResult = await query(`SELECT COUNT(*) AS count FROM firms ${whereClause}`, params);
        totalCount = Number.parseInt(countResult.rows[0].count, 10);
    }

    if (firms.length === 0) {
        return { firms, hasMore, totalCount };
    }

    const firmIds = firms.map((firm) => firm.id);
    const summariesResult = await query(
        `SELECT
            firm_id,
            COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0)::integer AS total_credits_consumed,
            COALESCE(SUM(CASE WHEN credits_delta > 0 THEN credits_delta ELSE 0 END), 0)::integer AS total_credits_added,
            MAX(created_at) AS last_credit_activity_at
         FROM firm_credit_transactions
         WHERE firm_id = ANY($1::uuid[])
         GROUP BY firm_id`,
        [firmIds]
    );

    const topConsumersResult = await query(
        `SELECT *
         FROM (
            SELECT
                t.firm_id,
                t.user_id,
                COALESCE(u.name, 'Deleted user') AS user_name,
                COALESCE(SUM(CASE WHEN t.credits_delta < 0 THEN -t.credits_delta ELSE 0 END), 0)::integer AS credits_consumed,
                COUNT(*) FILTER (WHERE t.credits_delta < 0) AS action_count,
                MAX(t.created_at) AS last_used_at,
                ROW_NUMBER() OVER (
                    PARTITION BY t.firm_id
                    ORDER BY
                        COALESCE(SUM(CASE WHEN t.credits_delta < 0 THEN -t.credits_delta ELSE 0 END), 0) DESC,
                        MAX(t.created_at) DESC
                ) AS firm_rank
            FROM firm_credit_transactions t
            LEFT JOIN users u ON u.id = t.user_id
            WHERE t.firm_id = ANY($1::uuid[])
              AND t.user_id IS NOT NULL
            GROUP BY t.firm_id, t.user_id, u.name
         ) ranked
         WHERE ranked.credits_consumed > 0
           AND ranked.firm_rank <= 5
         ORDER BY ranked.firm_id, ranked.credits_consumed DESC, ranked.last_used_at DESC`,
        [firmIds]
    );

    const recentTransactionsResult = await query(
        `SELECT *
         FROM (
            SELECT
                t.id,
                t.firm_id,
                t.user_id,
                COALESCE(u.name, 'Deleted user') AS user_name,
                t.action_type,
                t.credits_delta,
                t.balance_after,
                t.created_at,
                ROW_NUMBER() OVER (PARTITION BY t.firm_id ORDER BY t.created_at DESC) AS firm_rank
            FROM firm_credit_transactions t
            LEFT JOIN users u ON u.id = t.user_id
            WHERE t.firm_id = ANY($1::uuid[])
         ) ranked
         WHERE ranked.firm_rank <= 5
         ORDER BY ranked.firm_id, ranked.created_at DESC`,
        [firmIds]
    );

    const summariesByFirmId = new Map(summariesResult.rows.map((row) => [row.firm_id, row]));
    const consumersByFirmId = new Map();
    const transactionsByFirmId = new Map();

    for (const row of topConsumersResult.rows) {
        if (!consumersByFirmId.has(row.firm_id)) {
            consumersByFirmId.set(row.firm_id, []);
        }
        consumersByFirmId.get(row.firm_id).push({
            user_id: row.user_id,
            user_name: row.user_name,
            credits_consumed: row.credits_consumed,
            action_count: Number.parseInt(String(row.action_count), 10),
            last_used_at: row.last_used_at
        });
    }

    for (const row of recentTransactionsResult.rows) {
        if (!transactionsByFirmId.has(row.firm_id)) {
            transactionsByFirmId.set(row.firm_id, []);
        }
        transactionsByFirmId.get(row.firm_id).push({
            id: row.id,
            user_id: row.user_id,
            user_name: row.user_name,
            action_type: row.action_type,
            credits_delta: row.credits_delta,
            balance_after: row.balance_after,
            created_at: row.created_at
        });
    }

    return {
        firms: firms.map((firm) => {
            const summary = summariesByFirmId.get(firm.id);
            return {
                ...firm,
                total_credits_consumed: summary?.total_credits_consumed || 0,
                total_credits_added: summary?.total_credits_added || 0,
                last_credit_activity_at: summary?.last_credit_activity_at || null,
                top_consumers: consumersByFirmId.get(firm.id) || [],
                recent_credit_transactions: transactionsByFirmId.get(firm.id) || []
            };
        }),
        hasMore,
        totalCount
    };
}

export async function getFirmCreditsDetail(firmId) {
    if (!firmId) {
        const error = new Error('Firm ID is required');
        error.statusCode = 400;
        throw error;
    }

    const firmResult = await query(
        'SELECT id, name, status, credits, created_at, updated_at FROM firms WHERE id = $1',
        [firmId]
    );

    if (firmResult.rows.length === 0) {
        const error = new Error('Firm not found');
        error.statusCode = 404;
        throw error;
    }

    const summaryResult = await query(
        `SELECT
            COUNT(*)::integer AS transaction_count,
            COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0)::integer AS total_credits_consumed,
            COALESCE(SUM(CASE WHEN credits_delta > 0 THEN credits_delta ELSE 0 END), 0)::integer AS total_credits_added,
            COALESCE(SUM(CASE WHEN credits_delta > 0 AND action_type = 'credit.refund' THEN credits_delta ELSE 0 END), 0)::integer AS total_credits_refunded,
            MAX(created_at) AS last_credit_activity_at
         FROM firm_credit_transactions
         WHERE firm_id = $1`,
        [firmId]
    );

    const usersResult = await query(
        `SELECT
            t.user_id,
            COALESCE(u.name, 'System') AS user_name,
            COUNT(*)::integer AS transaction_count,
            COALESCE(SUM(CASE WHEN t.credits_delta < 0 THEN -t.credits_delta ELSE 0 END), 0)::integer AS consumed_credits,
            COALESCE(SUM(CASE WHEN t.credits_delta > 0 THEN t.credits_delta ELSE 0 END), 0)::integer AS added_credits,
            COALESCE(SUM(CASE WHEN t.credits_delta > 0 AND t.action_type = 'credit.refund' THEN t.credits_delta ELSE 0 END), 0)::integer AS refunded_credits,
            COALESCE(SUM(t.credits_delta), 0)::integer AS net_credits,
            MAX(t.created_at) AS last_activity_at
         FROM firm_credit_transactions t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.firm_id = $1
         GROUP BY t.user_id, COALESCE(u.name, 'System')
         ORDER BY consumed_credits DESC, added_credits DESC, last_activity_at DESC`,
        [firmId]
    );

    const actionsResult = await query(
        `SELECT
            action_type,
            COUNT(*)::integer AS transaction_count,
            COUNT(DISTINCT user_id)::integer AS unique_user_count,
            COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0)::integer AS consumed_credits,
            COALESCE(SUM(CASE WHEN credits_delta > 0 THEN credits_delta ELSE 0 END), 0)::integer AS added_credits,
            COALESCE(SUM(CASE WHEN credits_delta > 0 AND action_type = 'credit.refund' THEN credits_delta ELSE 0 END), 0)::integer AS refunded_credits,
            COALESCE(SUM(credits_delta), 0)::integer AS net_credits,
            MAX(created_at) AS last_activity_at
         FROM firm_credit_transactions
         WHERE firm_id = $1
         GROUP BY action_type
         ORDER BY consumed_credits DESC, added_credits DESC, last_activity_at DESC`,
        [firmId]
    );

    const userActionsResult = await query(
        `SELECT
            t.user_id,
            COALESCE(u.name, 'System') AS user_name,
            t.action_type,
            COUNT(*)::integer AS transaction_count,
            COALESCE(SUM(CASE WHEN t.credits_delta < 0 THEN -t.credits_delta ELSE 0 END), 0)::integer AS consumed_credits,
            COALESCE(SUM(CASE WHEN t.credits_delta > 0 THEN t.credits_delta ELSE 0 END), 0)::integer AS added_credits,
            COALESCE(SUM(CASE WHEN t.credits_delta > 0 AND t.action_type = 'credit.refund' THEN t.credits_delta ELSE 0 END), 0)::integer AS refunded_credits,
            COALESCE(SUM(t.credits_delta), 0)::integer AS net_credits,
            MAX(t.created_at) AS last_activity_at
         FROM firm_credit_transactions t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.firm_id = $1
         GROUP BY t.user_id, COALESCE(u.name, 'System'), t.action_type
         ORDER BY consumed_credits DESC, added_credits DESC, last_activity_at DESC`,
        [firmId]
    );

    const recentTransactionsResult = await query(
        `SELECT
            t.id,
            t.user_id,
            COALESCE(u.name, 'System') AS user_name,
            t.action_type,
            t.credits_delta,
            t.balance_after,
            t.metadata,
            t.related_transaction_id,
            t.created_at
         FROM firm_credit_transactions t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.firm_id = $1
         ORDER BY t.created_at DESC
         LIMIT 25`,
        [firmId]
    );

    return {
        firm: firmResult.rows[0],
        summary: summaryResult.rows[0] || {
            transaction_count: 0,
            total_credits_consumed: 0,
            total_credits_added: 0,
            total_credits_refunded: 0,
            last_credit_activity_at: null
        },
        userBreakdown: usersResult.rows,
        actionBreakdown: actionsResult.rows,
        userActionBreakdown: userActionsResult.rows,
        recentTransactions: recentTransactionsResult.rows
    };
}
