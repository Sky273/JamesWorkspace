import { query } from '../config/database.js';

function formatItems(items) {
    return items.map(item => `'${item}'`).join(', ');
}

export async function assertTablesExist(tableNames, context = 'schema') {
    if (!tableNames || tableNames.length === 0) return;

    const result = await query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
        [tableNames]
    );

    const existing = new Set(result.rows.map(row => row.table_name));
    const missing = tableNames.filter(name => !existing.has(name));
    if (missing.length > 0) {
        throw new Error(`${context} schema is missing required tables: ${formatItems(missing)}. Run npm run migrate.`);
    }
}

export async function assertColumnsExist(columnMap, context = 'schema') {
    const entries = Object.entries(columnMap || {});
    if (entries.length === 0) return;

    for (const [tableName, columnNames] of entries) {
        if (!columnNames || columnNames.length === 0) {
            continue;
        }

        const result = await query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2)`,
            [tableName, columnNames]
        );

        const existing = new Set(result.rows.map(row => row.column_name));
        const missing = columnNames.filter(name => !existing.has(name));
        if (missing.length > 0) {
            throw new Error(`${context} schema is missing required columns on '${tableName}': ${formatItems(missing)}. Run npm run migrate.`);
        }
    }
}

export async function assertIndexesExist(indexNames, context = 'schema') {
    if (!indexNames || indexNames.length === 0) return;

    const result = await query(
        `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
        [indexNames]
    );

    const existing = new Set(result.rows.map(row => row.indexname));
    const missing = indexNames.filter(name => !existing.has(name));
    if (missing.length > 0) {
        throw new Error(`${context} schema is missing required indexes: ${formatItems(missing)}. Run npm run migrate.`);
    }
}

export async function assertSchemaRequirements({ tables = [], columns = {}, indexes = [], context = 'schema' }) {
    await assertTablesExist(tables, context);
    await assertColumnsExist(columns, context);
    await assertIndexesExist(indexes, context);
}
