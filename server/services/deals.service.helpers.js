export function normalizeNullableRelationId(value) {
    return value && value.trim() !== '' ? value : null;
}

export function buildCreateDealInsertParams(data, userId, firmId, defaults = {}) {
    const {
        title,
        description,
        client_id,
        contact_id,
        status = defaults.status,
        expected_start_date,
        expected_end_date,
        budget_min,
        budget_max,
        priority = defaults.priority,
        tags = [],
        notes
    } = data;

    return [
        firmId,
        normalizeNullableRelationId(client_id),
        normalizeNullableRelationId(contact_id),
        title,
        description || null,
        status,
        expected_start_date || null,
        expected_end_date || null,
        budget_min || null,
        budget_max || null,
        priority,
        JSON.stringify(tags),
        notes || null,
        userId
    ];
}

export function parseDealsPagination(pagination = {}) {
    const parsedPage = Number.parseInt(pagination.page, 10);
    const parsedLimit = Number.parseInt(pagination.limit, 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

export function buildDealsWhereClause(firmId, filters = {}) {
    const { clientId, status, priority, search } = filters;
    const conditions = ['d.firm_id = $1'];
    const params = [firmId];
    let paramIndex = 2;

    if (clientId) {
        conditions.push(`d.client_id = $${paramIndex}`);
        params.push(clientId);
        paramIndex++;
    }

    if (status && status !== 'all') {
        conditions.push(`d.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }

    if (priority && priority !== 'all') {
        conditions.push(`d.priority = $${paramIndex}`);
        params.push(priority);
        paramIndex++;
    }

    if (search) {
        conditions.push(`(d.title ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
    }

    return {
        whereClause: `WHERE ${conditions.join(' AND ')}`,
        params,
        nextParamIndex: paramIndex
    };
}

export function buildDealsPaginationMetadata(page, limit, offset, totalCount, rowsLength) {
    return {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + rowsLength < totalCount
    };
}

export function buildDealUpdateStatement(data) {
    const assignments = [];
    const params = [];
    let paramIndex = 1;

    const setField = (column, value) => {
        assignments.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
    };

    if (Object.prototype.hasOwnProperty.call(data, 'title')) {
        setField('title', data.title);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'description')) {
        setField('description', data.description);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'client_id')) {
        setField('client_id', normalizeNullableRelationId(data.client_id));
    }
    if (Object.prototype.hasOwnProperty.call(data, 'contact_id')) {
        setField('contact_id', normalizeNullableRelationId(data.contact_id));
    }
    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
        setField('status', data.status);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'expected_start_date')) {
        setField('expected_start_date', data.expected_start_date);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'expected_end_date')) {
        setField('expected_end_date', data.expected_end_date);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'budget_min')) {
        setField('budget_min', data.budget_min);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'budget_max')) {
        setField('budget_max', data.budget_max);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'priority')) {
        setField('priority', data.priority);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'tags')) {
        setField('tags', Array.isArray(data.tags) ? JSON.stringify(data.tags) : null);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'notes')) {
        setField('notes', data.notes);
    }

    return { assignments, params, paramIndex };
}

export function getFirstRowOrNull(result) {
    return result.rows[0] || null;
}

export function getSingleColumnValueOrNull(result, columnName) {
    return result.rows.length > 0 ? result.rows[0][columnName] : null;
}

export function parseCountResult(result, columnName = 'count') {
    return Number.parseInt(result.rows[0][columnName], 10);
}
