import { query } from '../config/database.js';

export const SUBMISSION_WITH_JOINS_SELECT = `
    SELECT rs.*,
           r.name as resume_name, r.title as resume_title,
           c.name as client_name, c.type as client_type,
           cc.name as contact_name, cc.email as contact_email,
           m.title as mission_title,
           u.name as sent_by_name,
           f.name as firm_name
    FROM resume_submissions rs
    LEFT JOIN resumes r ON rs.resume_id = r.id
    LEFT JOIN clients c ON rs.client_id = c.id
    LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
    LEFT JOIN missions m ON rs.mission_id = m.id
    LEFT JOIN users u ON rs.sent_by = u.id
    LEFT JOIN firms f ON rs.firm_id = f.id
`;

const SUBMISSION_BY_ID_SELECT = `
    SELECT rs.*,
           r.name as resume_name, r.title as resume_title,
           c.name as client_name, c.type as client_type,
           cc.name as contact_name, cc.email as contact_email, cc.phone as contact_phone,
           m.title as mission_title,
           u.name as sent_by_name,
           f.name as firm_name
    FROM resume_submissions rs
    LEFT JOIN resumes r ON rs.resume_id = r.id
    LEFT JOIN clients c ON rs.client_id = c.id
    LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
    LEFT JOIN missions m ON rs.mission_id = m.id
    LEFT JOIN users u ON rs.sent_by = u.id
    LEFT JOIN firms f ON rs.firm_id = f.id
    WHERE rs.id = $1
`;

function buildSubmissionWhereClause({ clientId, resumeId, missionId, status, firmId }) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (firmId) {
        conditions.push(`rs.firm_id = $${paramIndex}`);
        params.push(firmId);
        paramIndex++;
    }

    if (clientId) {
        conditions.push(`rs.client_id = $${paramIndex}`);
        params.push(clientId);
        paramIndex++;
    }

    if (resumeId) {
        conditions.push(`rs.resume_id = $${paramIndex}`);
        params.push(resumeId);
        paramIndex++;
    }

    if (missionId) {
        conditions.push(`rs.mission_id = $${paramIndex}`);
        params.push(missionId);
        paramIndex++;
    }

    if (status) {
        conditions.push(`rs.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }

    return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params,
        nextParamIndex: paramIndex
    };
}

export async function listSubmissionRows({ page, limit, clientId, resumeId, missionId, status, firmId }) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    const offset = (normalizedPage - 1) * normalizedLimit;
    const { whereClause, params, nextParamIndex } = buildSubmissionWhereClause({
        clientId,
        resumeId,
        missionId,
        status,
        firmId
    });

    const submissionsQuery = `
        ${SUBMISSION_WITH_JOINS_SELECT}
        ${whereClause}
        ORDER BY rs.sent_at DESC
        LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;
    const queryParams = [...params, normalizedLimit + 1, offset];
    const result = await query(submissionsQuery, queryParams);

    return {
        rows: result.rows,
        normalizedPage,
        normalizedLimit,
        whereClause,
        countParams: params,
        queryParams
    };
}

export async function countSubmissionRows(whereClause, params) {
    const countQuery = `SELECT COUNT(*) as count FROM resume_submissions rs ${whereClause}`;
    const countResult = await query(countQuery, params);
    return parseInt(countResult.rows[0].count, 10);
}

export async function getSubmissionRowById(id) {
    const result = await query(SUBMISSION_BY_ID_SELECT, [id]);
    return result.rows[0] || null;
}

export async function createSubmissionRow(data) {
    const { resume_id, client_id, contact_id, mission_id, firm_id, sent_by, notes, sent_at, status } = data;
    const result = await query(
        `INSERT INTO resume_submissions (resume_id, client_id, contact_id, mission_id, firm_id, sent_by, notes, sent_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            resume_id,
            client_id,
            contact_id,
            mission_id || null,
            firm_id,
            sent_by,
            notes || null,
            sent_at || new Date().toISOString(),
            status || 'sent'
        ]
    );
    return result.rows[0];
}

export async function getSubmissionWithJoinsById(id) {
    const result = await query(`${SUBMISSION_WITH_JOINS_SELECT} WHERE rs.id = $1`, [id]);
    return result.rows[0] || null;
}

export async function findSubmissionRow(id) {
    const result = await query('SELECT * FROM resume_submissions WHERE id = $1', [id]);
    return result.rows[0] || null;
}

export async function updateSubmissionRow(id, { status, notes }) {
    const result = await query(
        `UPDATE resume_submissions 
         SET status = COALESCE($1, status),
             notes = COALESCE($2, notes)
         WHERE id = $3
         RETURNING *`,
        [status, notes, id]
    );
    return result.rows[0];
}

export async function deleteSubmissionRow(id) {
    await query('DELETE FROM resume_submissions WHERE id = $1', [id]);
}

export async function deleteSubmissionRowsByResumeId(resumeId, runQuery = query) {
    await runQuery('DELETE FROM resume_submissions WHERE resume_id = $1', [resumeId]);
}

export async function getSubmissionStatsRow(firmId) {
    let firmFilter = '';
    let params = [];

    if (firmId) {
        firmFilter = 'WHERE firm_id = $1';
        params = [firmId];
    }

    const statsQuery = `
        SELECT 
            COUNT(*) as total_submissions,
            COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
            COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed,
            COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(DISTINCT client_id) as unique_clients,
            COUNT(DISTINCT resume_id) as unique_resumes
        FROM resume_submissions
        ${firmFilter}
    `;

    const result = await query(statsQuery, params);
    return result.rows[0];
}
