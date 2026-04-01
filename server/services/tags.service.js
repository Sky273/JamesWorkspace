/**
 * Tags Service
 * Data access layer for tag operations
 * Extracted from routes/tags.routes.js
 */

import { selectWithTimeout, updateWithTimeout } from '../utils/postgresHelpers.js';

/**
 * Aggregate all raw tags from resumes (SQL aggregation)
 * @returns {Promise<Object>} { skills, industries, tools, soft_skills }
 */
export async function aggregateRawTags({ isAdmin = false, userFirmId = null } = {}) {
    const firmFilter = isAdmin ? '' : 'WHERE firm_id = $1';
    const aggregateQuery = `
        SELECT 
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                    SELECT DISTINCT tag 
                    FROM resumes, jsonb_array_elements_text(COALESCE(skills, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS skills,
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                    SELECT DISTINCT tag 
                    FROM resumes, jsonb_array_elements_text(COALESCE(industries, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS industries,
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                    SELECT DISTINCT tag 
                    FROM resumes, jsonb_array_elements_text(COALESCE(tools, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS tools,
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                    SELECT DISTINCT tag 
                    FROM resumes, jsonb_array_elements_text(COALESCE(soft_skills, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS soft_skills
    `;

    const result = await selectWithTimeout('resumes', {
        rawQuery: aggregateQuery,
        rawParams: isAdmin ? [] : [userFirmId]
    });

    return result[0] || {};
}

/**
 * Aggregate cleaned tags with optional firm filtering
 * @param {Object} options - { isAdmin, userFirmId, scope }
 * @returns {Promise<Object>} { skills, industries, tools, soft_skills }
 */
export async function aggregateCleanedTags({ isAdmin, userFirmId, scope = 'default' }) {
    let aggregateQuery = '';
    let queryParams = [];

    if (scope === 'grouped-by-deal') {
        const firmCondition = isAdmin
            ? ''
            : `WHERE (
                    r.id IN (
                        SELECT dr.resume_id
                        FROM deal_resumes dr
                        INNER JOIN deals d ON d.id = dr.deal_id
                        WHERE d.firm_id = $1
                    )
                    OR (
                        r.firm_id = $1
                        AND r.id NOT IN (
                            SELECT DISTINCT resume_id
                            FROM deal_resumes
                            WHERE resume_id IS NOT NULL
                        )
                    )
                )`;

        aggregateQuery = `
            WITH visible_resumes AS (
                SELECT DISTINCT
                    COALESCE(r.skills_cleaned, r.skills) as skills_data,
                    COALESCE(r.industries_cleaned, r.industries) as industries_data,
                    COALESCE(r.tools_cleaned, r.tools) as tools_data,
                    COALESCE(r.soft_skills_cleaned, r.soft_skills) as soft_skills_data
                FROM resumes r
                ${firmCondition}
            )
            SELECT 
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag
                        FROM visible_resumes, jsonb_array_elements_text(COALESCE(skills_data, '[]'::jsonb)) AS tag
                        WHERE tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS skills,
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag
                        FROM visible_resumes, jsonb_array_elements_text(COALESCE(industries_data, '[]'::jsonb)) AS tag
                        WHERE tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS industries,
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag
                        FROM visible_resumes, jsonb_array_elements_text(COALESCE(tools_data, '[]'::jsonb)) AS tag
                        WHERE tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS tools,
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag
                        FROM visible_resumes, jsonb_array_elements_text(COALESCE(soft_skills_data, '[]'::jsonb)) AS tag
                        WHERE tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS soft_skills
        `;
        queryParams = isAdmin ? [] : [userFirmId];
    } else {
        const firmFilter = isAdmin ? '' : 'WHERE firm_id = $1';
        const firmParams = isAdmin ? [] : [userFirmId];
        aggregateQuery = `
            SELECT 
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag 
                        FROM resumes, jsonb_array_elements_text(COALESCE(COALESCE(skills_cleaned, skills), '[]'::jsonb)) AS tag 
                        ${firmFilter}
                        ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS skills,
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag 
                        FROM resumes, jsonb_array_elements_text(COALESCE(COALESCE(industries_cleaned, industries), '[]'::jsonb)) AS tag 
                        ${firmFilter}
                        ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS industries,
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag 
                        FROM resumes, jsonb_array_elements_text(COALESCE(COALESCE(tools_cleaned, tools), '[]'::jsonb)) AS tag 
                        ${firmFilter}
                        ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS tools,
                COALESCE(
                    (SELECT jsonb_agg(tag ORDER BY tag) FROM (
                        SELECT DISTINCT tag 
                        FROM resumes, jsonb_array_elements_text(COALESCE(COALESCE(soft_skills_cleaned, soft_skills), '[]'::jsonb)) AS tag 
                        ${firmFilter}
                        ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag != ''
                    ) AS distinct_tags),
                    '[]'::jsonb
                ) AS soft_skills
        `;
        queryParams = firmParams;
    }

    const result = await selectWithTimeout('resumes', {
        rawQuery: aggregateQuery,
        rawParams: queryParams
    });

    return result[0] || {};
}

/**
 * Aggregate ESCO normalized tags from resumes
 * @returns {Promise<Object>} { skills, industries, tools, soft_skills }
 */
export async function aggregateEscoTags({ isAdmin = false, userFirmId = null } = {}) {
    const firmFilter = isAdmin ? '' : 'WHERE firm_id = $1';
    const aggregateQuery = `
        SELECT 
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag->>'label') FROM (
                    SELECT DISTINCT ON (tag->>'uri') tag 
                    FROM resumes, jsonb_array_elements(COALESCE(skills_esco, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag->>'label' IS NOT NULL AND tag->>'label' != ''
                    ORDER BY tag->>'uri', tag->>'label'
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS skills,
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag->>'label') FROM (
                    SELECT DISTINCT ON (tag->>'uri') tag 
                    FROM resumes, jsonb_array_elements(COALESCE(industries_esco, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag->>'label' IS NOT NULL AND tag->>'label' != ''
                    ORDER BY tag->>'uri', tag->>'label'
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS industries,
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag->>'label') FROM (
                    SELECT DISTINCT ON (tag->>'uri') tag 
                    FROM resumes, jsonb_array_elements(COALESCE(tools_esco, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag->>'label' IS NOT NULL AND tag->>'label' != ''
                    ORDER BY tag->>'uri', tag->>'label'
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS tools,
            COALESCE(
                (SELECT jsonb_agg(tag ORDER BY tag->>'label') FROM (
                    SELECT DISTINCT ON (tag->>'uri') tag 
                    FROM resumes, jsonb_array_elements(COALESCE(soft_skills_esco, '[]'::jsonb)) AS tag 
                    ${firmFilter}
                    ${firmFilter ? 'AND' : 'WHERE'} tag IS NOT NULL AND tag->>'label' IS NOT NULL AND tag->>'label' != ''
                    ORDER BY tag->>'uri', tag->>'label'
                ) AS distinct_tags),
                '[]'::jsonb
            ) AS soft_skills
    `;

    const result = await selectWithTimeout('resumes', {
        rawQuery: aggregateQuery,
        rawParams: isAdmin ? [] : [userFirmId]
    });

    return result[0] || {};
}

/**
 * Fetch a batch of resumes for tag recalculation
 * @param {string[]} columns - Columns to select
 * @param {number} limit - Batch size
 * @param {number} offset - Offset
 * @returns {Promise<Object[]>}
 */
export async function fetchResumeBatch(columns, limit, offset, { firmId = null } = {}) {
    return selectWithTimeout('resumes', {
        columns,
        conditions: firmId ? ['firm_id = $1'] : [],
        params: firmId ? [firmId] : [],
        orderBy: 'id ASC',
        limit,
        offset
    });
}

/**
 * Update cleaned tags for a single resume
 * @param {string} id - Resume ID
 * @param {Object} fields - Tag fields to update
 * @returns {Promise<Object>}
 */
export async function updateResumeTags(id, fields) {
    return updateWithTimeout('resumes', id, fields);
}

/**
 * Rename a tag across all resumes using SQL
 * @param {string} dbField - Database column name (skills, industries, tools, soft_skills)
 * @param {string} oldName - Old tag name
 * @param {string} newName - New tag name
 * @returns {Promise<Object[]>} Array of updated records (with id)
 */
export async function renameTag(dbField, oldName, newName, { firmId = null } = {}) {
    const firmCondition = firmId ? 'AND firm_id = $4' : '';
    const updateQuery = `
        UPDATE resumes 
        SET ${dbField} = (
            SELECT jsonb_agg(
                CASE 
                    WHEN elem = $1::text THEN $2::text 
                    ELSE elem 
                END
            )
            FROM jsonb_array_elements_text(COALESCE(${dbField}, '[]'::jsonb)) AS elem
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE ${dbField} @> $3::jsonb
        ${firmCondition}
        RETURNING id
    `;

    return selectWithTimeout('resumes', {
        rawQuery: updateQuery,
        rawParams: firmId
            ? [oldName, newName, JSON.stringify([oldName]), firmId]
            : [oldName, newName, JSON.stringify([oldName])]
    });
}
