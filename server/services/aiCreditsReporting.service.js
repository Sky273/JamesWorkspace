import { escapeLike } from '../utils/postgresHelpers.js';

function buildFirmCreditListWhereClause({ search, firmId }) {
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

    return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params,
        nextParamIndex: paramIndex
    };
}

function buildFirmCreditSummaryMaps({ summariesRows, topConsumersRows, recentTransactionsRows }) {
    const summariesByFirmId = new Map(summariesRows.map((row) => [row.firm_id, row]));
    const consumersByFirmId = new Map();
    const transactionsByFirmId = new Map();

    for (const row of topConsumersRows) {
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

    for (const row of recentTransactionsRows) {
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
        summariesByFirmId,
        consumersByFirmId,
        transactionsByFirmId
    };
}

export async function listFirmCreditsReport(queryFn, {
    search,
    page = 1,
    limit = 100,
    firmId = null
} = {}) {
    const offset = (page - 1) * limit;
    const { whereClause, params, nextParamIndex } = buildFirmCreditListWhereClause({ search, firmId });

    const listResult = await queryFn(
        `SELECT * FROM firms ${whereClause} ORDER BY name ASC LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
        [...params, limit + 1, offset]
    );
    const hasMore = listResult.rows.length > limit;
    const firms = hasMore ? listResult.rows.slice(0, limit) : listResult.rows;

    let totalCount = null;
    if (page === 1) {
        const countResult = await queryFn(`SELECT COUNT(*) AS count FROM firms ${whereClause}`, params);
        totalCount = Number.parseInt(countResult.rows[0].count, 10);
    }

    if (firms.length === 0) {
        return { firms, hasMore, totalCount };
    }

    const firmIds = firms.map((firm) => firm.id);
    const summariesResult = await queryFn(
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

    const topConsumersResult = await queryFn(
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

    const recentTransactionsResult = await queryFn(
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

    const {
        summariesByFirmId,
        consumersByFirmId,
        transactionsByFirmId
    } = buildFirmCreditSummaryMaps({
        summariesRows: summariesResult.rows,
        topConsumersRows: topConsumersResult.rows,
        recentTransactionsRows: recentTransactionsResult.rows
    });

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

export async function getFirmCreditsDetailReport(queryFn, firmId) {
    if (!firmId) {
        const error = new Error('Firm ID is required');
        error.statusCode = 400;
        throw error;
    }

    const firmResult = await queryFn(
        'SELECT id, name, status, credits, created_at, updated_at FROM firms WHERE id = $1',
        [firmId]
    );

    if (firmResult.rows.length === 0) {
        const error = new Error('Firm not found');
        error.statusCode = 404;
        throw error;
    }

    const summaryResult = await queryFn(
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

    const usersResult = await queryFn(
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

    const actionsResult = await queryFn(
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

    const userActionsResult = await queryFn(
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

    const recentTransactionsResult = await queryFn(
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
