export function normalizeNullableRelationId(value) {
    return value && value.trim() !== '' ? value : null;
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
