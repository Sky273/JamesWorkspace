import {
    invalidateClientsCaches,
    invalidateDealsCaches,
    invalidateFirmsCaches,
    invalidateMissionsCaches
} from './cache.service.js';

function normalizeMetadata(metadata = {}) {
    return metadata && typeof metadata === 'object' ? metadata : {};
}

export async function invalidateCreditDependentCaches() {
    await Promise.all([
        invalidateFirmsCaches(),
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
}

export async function insertCreditTransaction(client, {
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

export async function getLockedFirmCredits(client, firmId) {
    const firmResult = await client.query('SELECT id, credits FROM firms WHERE id = $1 FOR UPDATE', [firmId]);
    if (firmResult.rows.length === 0) {
        const error = new Error('Firm not found');
        error.statusCode = 404;
        throw error;
    }

    return Number(firmResult.rows[0].credits || 0);
}

export async function updateFirmCreditsBalance(client, firmId, balanceAfter, { returning = false } = {}) {
    const updateQuery = returning
        ? `UPDATE firms
             SET credits = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`
        : `UPDATE firms
             SET credits = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`;

    const updateResult = await client.query(updateQuery, [balanceAfter, firmId]);
    return returning ? updateResult.rows[0] || null : null;
}
