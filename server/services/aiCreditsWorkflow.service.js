import { reserveFirmCredits } from './aiCreditsActions.service.js';

export async function buildAiWorkflowPlan(steps = [], getConfiguredAiCreditCost) {
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

export async function reserveAiWorkflowCreditsWithPlan({
    firmId,
    userId = null,
    workflowActionType = null,
    steps = [],
    metadata = {},
    getConfiguredAiCreditCost
}) {
    const plan = await buildAiWorkflowPlan(steps, getConfiguredAiCreditCost);
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
