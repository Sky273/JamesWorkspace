import { query } from '../config/database.js';

function buildCountMap(rows, keyField) {
    return new Map(rows.map(row => [row[keyField], parseInt(row.count, 10)]));
}

async function loadMissionCountMaps(missionIds) {
    if (missionIds.length === 0) {
        return {
            adaptationsCountMap: new Map(),
            submissionsCountMap: new Map(),
            pipelineCountMap: new Map()
        };
    }

    const [adaptResult, submissionsResult, pipelineResult] = await Promise.all([
        query(`
            SELECT mission_id, COUNT(*) as count
            FROM resume_adaptations
            WHERE mission_id = ANY($1)
            GROUP BY mission_id
        `, [missionIds]),
        query(`
            SELECT mission_id, COUNT(*) as count
            FROM resume_submissions
            WHERE mission_id = ANY($1)
            GROUP BY mission_id
        `, [missionIds]),
        query(`
            SELECT mission_id, COUNT(*) as count
            FROM candidate_pipeline
            WHERE mission_id = ANY($1)
            GROUP BY mission_id
        `, [missionIds])
    ]);

    return {
        adaptationsCountMap: buildCountMap(adaptResult.rows, 'mission_id'),
        submissionsCountMap: buildCountMap(submissionsResult.rows, 'mission_id'),
        pipelineCountMap: buildCountMap(pipelineResult.rows, 'mission_id')
    };
}

function decorateMissionWithCounts(mission, { adaptationsCountMap, submissionsCountMap, pipelineCountMap }) {
    const adaptationsCount = adaptationsCountMap.get(mission.id) || 0;
    const submissionsCount = submissionsCountMap.get(mission.id) || 0;
    const pipelineCount = pipelineCountMap.get(mission.id) || 0;

    return {
        ...mission,
        adaptations_count: adaptationsCount,
        submissions_count: submissionsCount,
        pipeline_count: pipelineCount,
        has_attached_elements: adaptationsCount > 0 || submissionsCount > 0 || pipelineCount > 0
    };
}

function buildUnassignedMissionQuery({ firmId, isAdmin }) {
    const conditions = ['m.deal_id IS NULL'];
    const params = [];

    if (!isAdmin) {
        conditions.push('m.firm_id = $1');
        params.push(firmId);
    }

    return {
        sql: `
            SELECT m.id, m.title, m.content, m.status, m.keywords,
                   m.required_skills, m.preferred_skills,
                   m.created_at, m.updated_at, m.firm,
                   m.client_id, m.contact_id,
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY m.created_at DESC
        `,
        params
    };
}

function groupMissionsByDealId(missions) {
    const grouped = new Map();
    for (const mission of missions) {
        const dealId = mission.deal_id;
        if (!grouped.has(dealId)) {
            grouped.set(dealId, []);
        }
        const { deal_id: _dealId, ...missionWithoutDealId } = mission;
        grouped.get(dealId).push(missionWithoutDealId);
    }
    return grouped;
}

export async function buildGroupedMissionsView({ firmId, isAdmin }) {
    const dealConditions = [];
    const dealParams = [];
    if (!isAdmin) {
        dealConditions.push('d.firm_id = $1');
        dealParams.push(firmId);
    }

    const dealsResult = await query(`
        SELECT d.id, d.title, d.status, d.priority,
               c.name as client_name, c.type as client_type,
               cc.name as contact_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN client_contacts cc ON d.contact_id = cc.id
        ${dealConditions.length > 0 ? `WHERE ${dealConditions.join(' AND ')}` : ''}
        ORDER BY
            CASE d.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
            d.title ASC
    `, dealParams);

    const dealIds = dealsResult.rows.map(deal => deal.id);
    let missionsByDealId = new Map();
    if (dealIds.length > 0) {
        const missionsResult = await query(`
            SELECT m.id, m.title, m.content, m.status, m.keywords,
                   m.required_skills, m.preferred_skills,
                   m.created_at, m.updated_at, m.deal_id, m.firm,
                   m.client_id, m.contact_id,
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE m.deal_id = ANY($1)
            ORDER BY m.deal_id, m.created_at DESC
        `, [dealIds]);
        missionsByDealId = groupMissionsByDealId(missionsResult.rows);
    }

    const assignedMissionIds = Array.from(missionsByDealId.values()).flatMap(missions => missions.map(mission => mission.id));
    const assignedCountMaps = await loadMissionCountMaps(assignedMissionIds);

    let resumeCountMap = new Map();
    if (dealIds.length > 0) {
        const rcResult = await query(`
            SELECT deal_id, COUNT(*) as count
            FROM deal_resumes
            WHERE deal_id = ANY($1)
            GROUP BY deal_id
        `, [dealIds]);
        resumeCountMap = buildCountMap(rcResult.rows, 'deal_id');
    }

    const deals = dealsResult.rows.map(deal => {
        const missions = (missionsByDealId.get(deal.id) || []).map(mission => decorateMissionWithCounts(mission, assignedCountMaps));
        return {
            ...deal,
            missions,
            missions_count: missions.length,
            resumes_count: resumeCountMap.get(deal.id) || 0
        };
    });

    const unassignedQuery = buildUnassignedMissionQuery({ firmId, isAdmin });
    const unassignedResult = await query(unassignedQuery.sql, unassignedQuery.params);
    const unassignedCountMaps = await loadMissionCountMaps(unassignedResult.rows.map(mission => mission.id));
    const unassigned = unassignedResult.rows.map(mission => decorateMissionWithCounts(mission, unassignedCountMaps));

    return {
        deals,
        unassigned,
        totalDeals: deals.length,
        totalAssigned: deals.reduce((sum, deal) => sum + deal.missions_count, 0),
        totalUnassigned: unassigned.length
    };
}
