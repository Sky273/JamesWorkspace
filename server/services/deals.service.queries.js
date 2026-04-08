export const INSERT_DEAL_SQL = `
    INSERT INTO deals (
        firm_id, client_id, contact_id, title, description, status,
        expected_start_date, expected_end_date,
        budget_min, budget_max, priority, tags, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
`;

export const GET_DEAL_BY_ID_SQL = `
    SELECT d.*,
           c.name as client_name,
           c.type as client_type,
           cc.name as contact_name,
           cc.email as contact_email,
           cc.phone as contact_phone,
           cc.role as contact_role,
           u.name as created_by_name,
           (SELECT COUNT(*) FROM deal_resumes dr WHERE dr.deal_id = d.id) as resumes_count,
           (SELECT COUNT(*) FROM missions m WHERE m.deal_id = d.id) as missions_count
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN client_contacts cc ON d.contact_id = cc.id
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.id = $1
`;

export const GET_DEALS_LIST_SELECT_SQL = `
    SELECT d.*,
           c.name as client_name,
           c.type as client_type,
           cc.name as contact_name,
           cc.email as contact_email,
           cc.role as contact_role,
           COALESCE(dr_counts.resumes_count, 0) as resumes_count,
           COALESCE(m_counts.missions_count, 0) as missions_count
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN client_contacts cc ON d.contact_id = cc.id
    LEFT JOIN dr_counts ON dr_counts.deal_id = d.id
    LEFT JOIN m_counts ON m_counts.deal_id = d.id
`;

export const GET_DEALS_LIST_COUNTS_CTE_SQL = `
    WITH dr_counts AS (
        SELECT dr.deal_id, COUNT(*) as resumes_count
        FROM deal_resumes dr
        INNER JOIN deals d ON d.id = dr.deal_id
        WHERE d.firm_id = $1
        GROUP BY dr.deal_id
    ),
    m_counts AS (
        SELECT m.deal_id, COUNT(*) as missions_count
        FROM missions m
        INNER JOIN deals d ON d.id = m.deal_id
        WHERE d.firm_id = $1
        GROUP BY m.deal_id
    )
`;

export const GET_DEALS_LIST_ORDER_SQL = `
    ORDER BY
        CASE d.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
        END,
        d.updated_at DESC
`;

export const UPSERT_DEAL_RESUME_SQL = `
    INSERT INTO deal_resumes (deal_id, resume_id, added_by, notes, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (deal_id, resume_id) DO UPDATE SET
        notes = COALESCE(EXCLUDED.notes, deal_resumes.notes),
        status = COALESCE(EXCLUDED.status, deal_resumes.status)
    RETURNING *
`;

export const UPDATE_DEAL_RESUME_STATUS_SQL = `
    UPDATE deal_resumes SET
        status = $1,
        notes = COALESCE($2, notes)
    WHERE deal_id = $3 AND resume_id = $4
    RETURNING *
`;

export const GET_DEALS_FOR_RESUME_SQL = `
    SELECT d.id as deal_id,
           d.title as deal_title,
           d.status,
           d.priority,
           dr.status as resume_status,
           dr.notes as resume_notes,
           dr.added_at,
           c.name as client_name,
           c.type as client_type,
           cc.name as contact_name
    FROM deals d
    INNER JOIN deal_resumes dr ON d.id = dr.deal_id
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN client_contacts cc ON d.contact_id = cc.id
    WHERE dr.resume_id = $1 AND d.firm_id = $2
    ORDER BY dr.added_at DESC
`;

export const GET_RESUMES_FOR_DEAL_SQL = `
    SELECT r.id, r.name, r.title, r.status, r.global_rating, r.improved_global_rating,
           r.industries, r.skills, r.tools, r.soft_skills, r.firm_name, r.created_at,
           r.candidate_name, r.candidate_email, r.consent_status, r.consent_token_expires_at, r.retention_until,
           dr.status as deal_status,
           dr.notes as deal_notes,
           dr.added_at,
           u.name as added_by_name
    FROM resumes r
    INNER JOIN deal_resumes dr ON r.id = dr.resume_id
    LEFT JOIN users u ON dr.added_by = u.id
    WHERE dr.deal_id = $1
    ORDER BY
        CASE dr.status
            WHEN 'selected' THEN 1
            WHEN 'submitted' THEN 2
            WHEN 'proposed' THEN 3
            WHEN 'rejected' THEN 4
        END,
        dr.added_at DESC
`;

export const GET_DEAL_STATS_SQL = `
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'won') as won_count,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_count,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count
    FROM deals
    WHERE firm_id = $1
`;

export const GET_CONTACT_OWNERSHIP_SQL = `
    SELECT cc.client_id, c.firm_id
    FROM client_contacts cc
    INNER JOIN clients c ON c.id = cc.client_id
    WHERE cc.id = $1
`;

export const GET_MISSIONS_FOR_DEAL_SQL = `
    SELECT m.id, m.title, m.status, m.created_at, m.updated_at,
           m.client_id, m.contact_id, m.deal_id,
           c.name as client_name,
           cc.name as contact_name,
           (SELECT COUNT(*) FROM resume_adaptations ra WHERE ra.mission_id = m.id) as adaptations_count
    FROM missions m
    LEFT JOIN clients c ON m.client_id = c.id
    LEFT JOIN client_contacts cc ON m.contact_id = cc.id
    WHERE m.deal_id = $1
    ORDER BY m.created_at DESC
`;

export const DEAL_BY_ID_SQL = GET_DEAL_BY_ID_SQL;
export const DEALS_FOR_RESUME_SQL = GET_DEALS_FOR_RESUME_SQL;
export const RESUMES_FOR_DEAL_SQL = GET_RESUMES_FOR_DEAL_SQL;
export const DEAL_STATS_SQL = GET_DEAL_STATS_SQL;
export const CONTACT_OWNERSHIP_SQL = GET_CONTACT_OWNERSHIP_SQL;
export const DEAL_MISSIONS_SQL = GET_MISSIONS_FOR_DEAL_SQL;

export const DEAL_FIRM_ID_SQL = 'SELECT firm_id FROM deals WHERE id = $1';
export const CLIENT_FIRM_ID_SQL = 'SELECT firm_id FROM clients WHERE id = $1';
export const RESUME_FIRM_ID_SQL = 'SELECT firm_id FROM resumes WHERE id = $1';
export const DEALS_COUNT_FOR_CLIENT_SQL = 'SELECT COUNT(*) as count FROM deals WHERE client_id = $1';
