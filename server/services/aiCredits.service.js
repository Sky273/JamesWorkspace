import { getClient, query } from '../config/database.js';
import {
    DEFAULT_FIRM_CREDITS,
    getAiActionRuntimeConfig,
    getAiCreditCost,
    getInitialFirmCredits
} from '../config/aiCredits.js';
import { escapeLike } from '../utils/postgresHelpers.js';
import {
    invalidateClientsCaches,
    invalidateDealsCaches,
    invalidateFirmsCaches,
    invalidateMissionsCaches
} from './cache.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from './settings.service.js';

function normalizeMetadata(metadata = {}) {
    return metadata && typeof metadata === 'object' ? metadata : {};
}

async function invalidateCreditDependentCaches() {
    await Promise.all([
        invalidateFirmsCaches(),
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
}

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

async function insertTransaction(client, {
    firmId,
    userId = null,
    actionType,
    creditsDelta,
    balanceAfter,
    metadata = {},
    relatedTransactionId = null
}) {
    const result = await client.query(
        `INSERT INTO firm_credit_transactions (
            firm_id,
            user_id,
            action_type,
            credits_delta,
            balance_after,
            metadata,
            related_transaction_id
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        RETURNING *`,
        [
            firmId,
            userId,
            actionType,
            creditsDelta,
            balanceAfter,
            JSON.stringify(normalizeMetadata(metadata)),
            relatedTransactionId
        ]
    );

    return result.rows[0];
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

    return withManagedClient(client, async (dbClient) => insertTransaction(dbClient, {
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
    } catch (_error) {
        return DEFAULT_FIRM_CREDITS;
    }
}

export async function getConfiguredAiCreditCost(actionType) {
    try {
        return getAiCreditCost(actionType, await getLLMSettings());
    } catch (_error) {
        return getAiCreditCost(actionType);
    }
}

export async function getConfiguredAiActionRuntimeConfig(actionType) {
    try {
        return getAiActionRuntimeConfig(actionType, await getLLMSettings());
    } catch (_error) {
        return getAiActionRuntimeConfig(actionType);
    }
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

        const firmResult = await client.query('SELECT id, credits FROM firms WHERE id = $1 FOR UPDATE', [firmId]);
        if (firmResult.rows.length === 0) {
            const error = new Error('Firm not found');
            error.statusCode = 404;
            throw error;
        }

        const currentCredits = Number(firmResult.rows[0].credits || 0);
        const balanceAfter = currentCredits + numericAmount;

        const updateResult = await client.query(
            `UPDATE firms
             SET credits = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [balanceAfter, firmId]
        );

        const transaction = await insertTransaction(client, {
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
            firm: updateResult.rows[0],
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

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const firmResult = await client.query('SELECT id, credits FROM firms WHERE id = $1 FOR UPDATE', [firmId]);
        if (firmResult.rows.length === 0) {
            const error = new Error('Firm not found');
            error.statusCode = 404;
            throw error;
        }

        const currentCredits = Number(firmResult.rows[0].credits || 0);
        if (currentCredits < cost) {
            throw buildInsufficientCreditsError({
                firmId,
                available: currentCredits,
                required: cost,
                actionType
            });
        }

        const balanceAfter = currentCredits - cost;
        await client.query(
            `UPDATE firms
             SET credits = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [balanceAfter, firmId]
        );

        const transaction = await insertTransaction(client, {
            firmId,
            userId,
            actionType,
            creditsDelta: -cost,
            balanceAfter,
            metadata
        });

        await client.query('COMMIT');
        await invalidateCreditDependentCaches();

        return {
            ...transaction,
            cost
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function refundAiCredits(reservation, metadata = {}) {
    if (!reservation?.firm_id || !reservation?.id) {
        return null;
    }

    const refundAmount = Math.abs(Number(reservation.credits_delta || reservation.cost || 0));
    if (!refundAmount) {
        return null;
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const firmResult = await client.query('SELECT id, credits FROM firms WHERE id = $1 FOR UPDATE', [reservation.firm_id]);
        if (firmResult.rows.length === 0) {
            const error = new Error('Firm not found');
            error.statusCode = 404;
            throw error;
        }

        const currentCredits = Number(firmResult.rows[0].credits || 0);
        const balanceAfter = currentCredits + refundAmount;

        await client.query(
            `UPDATE firms
             SET credits = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [balanceAfter, reservation.firm_id]
        );

        const transaction = await insertTransaction(client, {
            firmId: reservation.firm_id,
            userId: reservation.user_id || null,
            actionType: 'credit.refund',
            creditsDelta: refundAmount,
            balanceAfter,
            metadata: {
                originalActionType: reservation.action_type,
                ...normalizeMetadata(metadata)
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

export async function runAiActionWithCredits({
    firmId,
    userId = null,
    actionType,
    metadata = {}
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

    const reservation = await reserveAiCredits({
        firmId,
        userId,
        actionType,
        metadata
    });

    try {
        return await action(actionConfig);
    } catch (error) {
        try {
            await refundAiCredits(reservation, {
                reason: 'action_failed',
                error: error.message
            });
        } catch (refundError) {
            safeLog('error', 'Failed to refund AI credits after action failure', {
                actionType,
                firmId,
                userId,
                reservationId: reservation?.id,
                error: refundError.message
            });
        }
        throw error;
    }
}

export async function listFirmCredits({
    search,
    page = 1,
    limit = 100,
    bypassCache = false,
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
