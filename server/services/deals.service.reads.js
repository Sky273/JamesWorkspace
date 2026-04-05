import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    buildDealsWhereClause,
    buildDealsPaginationMetadata,
    getFirstRowOrNull,
    getSingleColumnValueOrNull,
    parseCountResult,
    parseDealsPagination
} from './deals.service.helpers.js';
import {
    CLIENT_FIRM_ID_SQL,
    CONTACT_OWNERSHIP_SQL,
    DEAL_BY_ID_SQL,
    DEAL_FIRM_ID_SQL,
    DEAL_MISSIONS_SQL,
    GET_DEALS_LIST_COUNTS_CTE_SQL,
    GET_DEALS_LIST_ORDER_SQL,
    GET_DEALS_LIST_SELECT_SQL,
    DEAL_STATS_SQL,
    DEALS_COUNT_FOR_CLIENT_SQL,
    DEALS_FOR_RESUME_SQL,
    RESUME_FIRM_ID_SQL,
    RESUMES_FOR_DEAL_SQL
} from './deals.service.queries.js';

export async function getDealById(dealId) {
    try {
        const result = await query(DEAL_BY_ID_SQL, [dealId]);
        return getFirstRowOrNull(result);
    } catch (error) {
        safeLog('error', 'Error fetching deal', { error: error.message, dealId });
        throw error;
    }
}

export async function getDeals(firmId, filters = {}, pagination = {}) {
    try {
        const { page, limit, offset } = parseDealsPagination(pagination);
        const { whereClause, params, nextParamIndex } = buildDealsWhereClause(firmId, filters);

        const countResult = await query(`SELECT COUNT(*) as total FROM deals d ${whereClause}`, params);
        const totalCount = parseInt(countResult.rows[0].total, 10);

        const dataParams = [...params, limit, offset];
        const result = await query(`
            ${GET_DEALS_LIST_COUNTS_CTE_SQL}
            ${GET_DEALS_LIST_SELECT_SQL}
            ${whereClause}
            ${GET_DEALS_LIST_ORDER_SQL}
            LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
        `, dataParams);

        return {
            data: result.rows,
            pagination: buildDealsPaginationMetadata(page, limit, offset, totalCount, result.rows.length)
        };
    } catch (error) {
        safeLog('error', 'Error fetching deals', { error: error.message, firmId });
        throw error;
    }
}

export async function getDealStats(firmId) {
    try {
        const result = await query(DEAL_STATS_SQL, [firmId]);
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error fetching deal stats', { error: error.message, firmId });
        throw error;
    }
}

export async function getDealFirmId(dealId) {
    const result = await query(DEAL_FIRM_ID_SQL, [dealId]);
    return getSingleColumnValueOrNull(result, 'firm_id');
}

export async function getClientFirmId(clientId) {
    const result = await query(CLIENT_FIRM_ID_SQL, [clientId]);
    return getSingleColumnValueOrNull(result, 'firm_id');
}

export async function getContactOwnership(contactId) {
    const result = await query(CONTACT_OWNERSHIP_SQL, [contactId]);
    return getFirstRowOrNull(result);
}

export async function getResumeFirmId(resumeId) {
    const result = await query(RESUME_FIRM_ID_SQL, [resumeId]);
    return getSingleColumnValueOrNull(result, 'firm_id');
}

export async function getMissionsForDeal(dealId) {
    const result = await query(DEAL_MISSIONS_SQL, [dealId]);
    return result.rows;
}

export async function getDealsForResume(resumeId, firmId) {
    try {
        const result = await query(DEALS_FOR_RESUME_SQL, [resumeId, firmId]);
        return result.rows;
    } catch (error) {
        safeLog('error', 'Error fetching deals for resume', { error: error.message, resumeId });
        throw error;
    }
}

export async function getResumesForDeal(dealId) {
    try {
        const result = await query(RESUMES_FOR_DEAL_SQL, [dealId]);
        return result.rows;
    } catch (error) {
        safeLog('error', 'Error fetching resumes for deal', { error: error.message, dealId });
        throw error;
    }
}

export async function getDealsCountForClient(clientId) {
    try {
        const result = await query(DEALS_COUNT_FOR_CLIENT_SQL, [clientId]);
        return parseCountResult(result);
    } catch (error) {
        safeLog('error', 'Error fetching deals count for client', { error: error.message, clientId });
        throw error;
    }
}
