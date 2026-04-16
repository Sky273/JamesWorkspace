import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    getConfiguredAiCreditCost,
    refundCreditsAmount,
    reserveFirmCredits
} from './aiCredits.service.js';
import { getJobItems, mergeJobItemPendingData } from './batchJobs.service.js';

const BATCH_JOB_ACTION_PLANS = Object.freeze({
    import: ({ itemCount, options = {} }) => ([
        { actionType: 'resume.analysis', units: itemCount },
        ...(options.improve ? [{ actionType: 'resume.improvement', units: itemCount }] : [])
    ]),
    improve: ({ itemCount }) => ([
        { actionType: 'resume.improvement', units: itemCount }
    ]),
    adapt: ({ itemCount }) => ([
        { actionType: 'resume.adaptation', units: itemCount }
    ]),
    match: ({ itemCount }) => ([
        { actionType: 'resume.match', units: itemCount }
    ]),
    'profile-search': ({ itemCount }) => ([
        { actionType: 'profile.search', units: itemCount }
    ]),
    'profile-analysis': ({ itemCount }) => ([
        { actionType: 'profile.analysis', units: itemCount }
    ])
});

function normalizeMetadata(metadata = {}) {
    return metadata && typeof metadata === 'object' ? metadata : {};
}

function parseJobOptions(jobOrOptions) {
    if (!jobOrOptions) {
        return {};
    }

    if (jobOrOptions.options !== undefined) {
        return parseJobOptions(jobOrOptions.options);
    }

    if (typeof jobOrOptions === 'string') {
        try {
            return JSON.parse(jobOrOptions);
        } catch {
            return {};
        }
    }

    return jobOrOptions;
}

function parsePendingData(item) {
    if (!item?.pending_data) {
        return {};
    }

    if (typeof item.pending_data === 'string') {
        try {
            return JSON.parse(item.pending_data);
        } catch {
            return {};
        }
    }

    return item.pending_data;
}

function getCreditUsageFlag(creditUsage, actionType) {
    if (!creditUsage || typeof creditUsage !== 'object') {
        return false;
    }

    if (creditUsage[actionType]) {
        return true;
    }

    if (actionType === 'resume.analysis') {
        return Boolean(creditUsage.analysisConsumed);
    }

    if (actionType === 'resume.improvement') {
        return Boolean(creditUsage.improvementConsumed);
    }

    return false;
}

function getPrimaryReservationActionType(jobType, plan = []) {
    if (jobType === 'import') {
        return 'resume.upload';
    }

    if (plan.length === 1) {
        return plan[0].actionType;
    }

    return `batch-job.${jobType}`;
}

async function buildReservationPlan({ jobType, itemCount, options = {} }) {
    const planner = BATCH_JOB_ACTION_PLANS[jobType];
    if (!planner) {
        return [];
    }

    const normalizedItemCount = Number(itemCount);
    if (!Number.isInteger(normalizedItemCount) || normalizedItemCount <= 0) {
        return [];
    }

    const rawPlan = planner({ itemCount: normalizedItemCount, options })
        .filter((entry) => Number(entry?.units) > 0);

    const plan = [];
    for (const entry of rawPlan) {
        const costPerUnit = await getConfiguredAiCreditCost(entry.actionType);
        const units = Number(entry.units);
        plan.push({
            actionType: entry.actionType,
            units,
            costPerUnit,
            reservedAmount: units * costPerUnit
        });
    }

    return plan.filter((entry) => entry.reservedAmount > 0);
}

export async function reserveBatchJobCredits({
    firmId,
    userId = null,
    jobType,
    itemCount = 0,
    options = {},
    metadata = {}
}) {
    const plan = await buildReservationPlan({ jobType, itemCount, options });
    if (plan.length === 0) {
        return null;
    }

    const totalReserved = plan.reduce((sum, entry) => sum + entry.reservedAmount, 0);
    const actionType = getPrimaryReservationActionType(jobType, plan);

    const reservation = await reserveFirmCredits({
        firmId,
        userId,
        actionType,
        amount: totalReserved,
        metadata: {
            jobType,
            itemCount: Number(itemCount),
            plan,
            ...normalizeMetadata(metadata)
        }
    });

    return {
        id: reservation.id,
        firmId,
        userId,
        actionType,
        jobType,
        itemCount: Number(itemCount),
        totalReserved,
        plan
    };
}

export function getBatchJobCreditReservation(jobOrOptions) {
    const options = parseJobOptions(jobOrOptions);
    const reservation = options.creditReservation;

    if (!reservation || typeof reservation !== 'object') {
        return null;
    }

    return reservation;
}

export function getBatchJobActionCreditReservation(jobOrOptions, actionType) {
    const reservation = getBatchJobCreditReservation(jobOrOptions);
    if (!reservation || reservation.settledAt) {
        return null;
    }

    const hasPlanEntry = Array.isArray(reservation.plan)
        && reservation.plan.some((entry) => entry?.actionType === actionType);

    return hasPlanEntry ? reservation : null;
}

export async function markBatchJobActionCreditConsumed(itemId, actionType) {
    if (!itemId || !actionType) {
        return;
    }

    await mergeJobItemPendingData(itemId, {
        creditUsage: {
            [actionType]: true
        }
    });
}

export async function markBatchJobCreditReservationSettled(jobId, jobOptions, creditReservation) {
    await query(
        'UPDATE batch_jobs SET options = $2::jsonb WHERE id = $1',
        [jobId, JSON.stringify({ ...jobOptions, creditReservation })]
    );
}

export async function settleBatchJobCredits(job, metadata = {}) {
    if (!job?.id) {
        return null;
    }

    const jobOptions = parseJobOptions(job);
    const reservation = getBatchJobCreditReservation(jobOptions);
    if (!reservation || reservation.settledAt) {
        return null;
    }

    const items = await getJobItems(job.id);
    const settlementPlan = Array.isArray(reservation.plan) ? reservation.plan : [];

    let refundAmount = 0;
    const settledPlan = settlementPlan.map((entry) => {
        const consumedCount = items.reduce((count, item) => {
            const creditUsage = parsePendingData(item)?.creditUsage;
            return getCreditUsageFlag(creditUsage, entry.actionType) ? count + 1 : count;
        }, 0);
        const refundedCount = Math.max(0, Number(entry.units || 0) - consumedCount);
        const refundedAmount = refundedCount * Number(entry.costPerUnit || 0);
        refundAmount += refundedAmount;

        return {
            ...entry,
            consumedCount,
            refundedCount,
            refundedAmount
        };
    });

    let refundTransaction = null;
    if (refundAmount > 0) {
        refundTransaction = await refundCreditsAmount({
            id: reservation.id,
            firm_id: job.firm_id,
            user_id: job.user_id || null,
            action_type: reservation.actionType,
            credits_delta: -Math.abs(Number(reservation.totalReserved || refundAmount))
        }, refundAmount, {
            reason: metadata.reason || 'batch_job_settlement',
            jobId: job.id,
            jobType: job.job_type,
            jobStatus: job.status,
            ...normalizeMetadata(metadata)
        });
    }

    const settledReservation = {
        ...reservation,
        settledAt: new Date().toISOString(),
        refundedAmount: refundAmount,
        refundedTransactionId: refundTransaction?.id || null,
        plan: settledPlan
    };

    await markBatchJobCreditReservationSettled(job.id, jobOptions, settledReservation);
    safeLog('info', 'Settled batch upfront credit reservation', {
        jobId: job.id,
        jobType: job.job_type,
        refundAmount
    });

    return settledReservation;
}

export async function getCancelledJobsNeedingCreditSettlement(limit = 10) {
    const result = await query(
        `SELECT *
         FROM batch_jobs
         WHERE status = 'cancelled'
           AND options IS NOT NULL
           AND options->'creditReservation' IS NOT NULL
           AND COALESCE(options->'creditReservation'->>'settledAt', '') = ''
         ORDER BY completed_at ASC NULLS FIRST, started_at ASC NULLS FIRST, created_at ASC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}

export const reserveImportJobCredits = (args) => reserveBatchJobCredits({
    ...args,
    jobType: 'import',
    itemCount: args?.fileCount,
    options: {
        improve: Boolean(args?.improve)
    }
});

export const getImportJobCreditReservation = getBatchJobCreditReservation;
export const settleImportJobCredits = settleBatchJobCredits;
export const getCancelledImportJobsNeedingSettlement = getCancelledJobsNeedingCreditSettlement;
