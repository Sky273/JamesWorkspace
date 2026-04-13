import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { hasExactSupportedProviders, SUPPORTED_LLM_PROVIDERS_FOR_CONSTRAINT } from './dockerMigrate.helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DOCKER_DIR = path.join(ROOT_DIR, 'docker');
const FALLBACK_DOCKER_DIR = '/docker-entrypoint-initdb.d';
const MIGRATION_TABLE = 'schema_migrations';
const MINIMAX_PROVIDER_MIGRATION = 'add_minimax_provider.sql';
const DEEPSEEK_PROVIDER_MIGRATION = 'add_deepseek_provider.sql';
const HUGGINGFACE_PROVIDER_MIGRATION = 'add_huggingface_provider.sql';
const FIX_LLM_PROVIDER_CONSTRAINT_MIGRATION = 'fix_llm_provider_constraint_supported_providers.sql';

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function resolveDockerAssetPaths() {
    const candidates = [
        { schemaPath: path.join(DOCKER_DIR, 'schema.sql'), migrationsDir: path.join(DOCKER_DIR, 'migrations') },
        { schemaPath: path.join(FALLBACK_DOCKER_DIR, 'schema.sql'), migrationsDir: path.join(FALLBACK_DOCKER_DIR, 'migrations') }
    ];

    for (const candidate of candidates) {
        const hasSchema = await pathExists(candidate.schemaPath);
        const hasMigrations = await pathExists(candidate.migrationsDir);

        if (hasSchema && hasMigrations) {
            return candidate;
        }
    }

    throw new Error(`Unable to locate canonical migration assets. Checked: ${candidates.map(c => `${c.schemaPath} | ${c.migrationsDir}`).join('; ')}`);
}

const { schemaPath: SCHEMA_PATH, migrationsDir: MIGRATIONS_DIR } = await resolveDockerAssetPaths();

function loadEnvironment() {
    const envFiles = [
        path.join(ROOT_DIR, '.env'),
        path.join(ROOT_DIR, '.env.docker')
    ];

    for (const envFile of envFiles) {
        dotenv.config({ path: envFile, override: false });
        if (process.env.POSTGRES_PASSWORD) {
            break;
        }
    }
}

loadEnvironment();

const DEFAULT_ADMIN_EMAIL = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@resumeconverter.local').toLowerCase();

const [
    { query, testConnection, closePool },
    { safeLog },
    { cleanupAllCaches },
    { ensureDefaultAdminAccount },
    { initGdprAuditTable },
    { initResumeCommentsTable },
    { initShareResumeTable },
    { initCandidatePipelineTable },
    { initDealsTable },
    { initCalendarTokensTable },
    { initBackupTables },
    { initializeBatchJobsTable }
] = await Promise.all([
    import('../config/database.js'),
    import('../utils/logger.backend.js'),
    import('../services/cache.service.js'),
    import('./ensure-default-admin.js'),
    import('../services/gdprAudit.service.js'),
    import('../services/resumeComments.service.js'),
    import('../services/shareResume.service.js'),
    import('../services/candidatePipeline.service.js'),
    import('../services/deals.service.js'),
    import('../services/calendar.service.js'),
    import('../services/backup.service.js'),
    import('../services/batchJobs.service.js')
]);

const INDUSTRY_ALIASES_SEED_SQL = `
    INSERT INTO industry_aliases (canonical_name, alias) VALUES
    ('Aéronautique & Spatial', 'Aéronautique & Spatial'),
    ('Aéronautique & Spatial', 'Aéronautique'),
    ('Aéronautique & Spatial', 'Spatial'),
    ('Aéronautique & Spatial', 'Aerospace'),
    ('Agroalimentaire', 'Agroalimentaire'),
    ('Agroalimentaire', 'Food & Beverage'),
    ('Agroalimentaire', 'Alimentaire'),
    ('Assurance', 'Assurance'),
    ('Assurance', 'Insurance'),
    ('Automobile', 'Automobile'),
    ('Automobile', 'Automotive'),
    ('Banque & Finance', 'Banque & Finance'),
    ('Banque & Finance', 'Banque'),
    ('Banque & Finance', 'Finance'),
    ('Banque & Finance', 'Banking'),
    ('BTP & Construction', 'BTP & Construction'),
    ('BTP & Construction', 'BTP'),
    ('BTP & Construction', 'Construction'),
    ('BTP & Construction', 'Bâtiment'),
    ('Chimie & Matériaux', 'Chimie & Matériaux'),
    ('Chimie & Matériaux', 'Chimie'),
    ('Chimie & Matériaux', 'Matériaux'),
    ('Commerce & Distribution', 'Commerce & Distribution'),
    ('Commerce & Distribution', 'Commerce'),
    ('Commerce & Distribution', 'Distribution'),
    ('Commerce & Distribution', 'Retail'),
    ('Conseil & Audit', 'Conseil & Audit'),
    ('Conseil & Audit', 'Conseil'),
    ('Conseil & Audit', 'Audit'),
    ('Conseil & Audit', 'Consulting'),
    ('Défense & Sécurité', 'Défense & Sécurité'),
    ('Défense & Sécurité', 'Défense'),
    ('Défense & Sécurité', 'Sécurité'),
    ('Défense & Sécurité', 'Defense'),
    ('Éducation & Formation', 'Éducation & Formation'),
    ('Éducation & Formation', 'Éducation'),
    ('Éducation & Formation', 'Formation'),
    ('Éducation & Formation', 'Education'),
    ('Énergie', 'Énergie'),
    ('Énergie', 'Energy'),
    ('Énergie', 'Énergies renouvelables'),
    ('Environnement', 'Environnement'),
    ('Environnement', 'Environment'),
    ('Environnement', 'Développement durable'),
    ('Hôtellerie & Restauration', 'Hôtellerie & Restauration'),
    ('Hôtellerie & Restauration', 'Hôtellerie'),
    ('Hôtellerie & Restauration', 'Restauration'),
    ('Hôtellerie & Restauration', 'Hospitality'),
    ('Immobilier', 'Immobilier'),
    ('Immobilier', 'Real Estate'),
    ('Industrie & Manufacturing', 'Industrie & Manufacturing'),
    ('Industrie & Manufacturing', 'Industrie'),
    ('Industrie & Manufacturing', 'Manufacturing'),
    ('Industrie & Manufacturing', 'Production industrielle'),
    ('IT & Digital', 'IT & Digital'),
    ('IT & Digital', 'Informatique'),
    ('IT & Digital', 'Digital'),
    ('IT & Digital', 'Technologies de l''information'),
    ('IT & Digital', 'Tech'),
    ('IT & Digital', 'Software'),
    ('Juridique', 'Juridique'),
    ('Juridique', 'Legal'),
    ('Juridique', 'Droit'),
    ('Logistique & Transport', 'Logistique & Transport'),
    ('Logistique & Transport', 'Logistique'),
    ('Logistique & Transport', 'Transport'),
    ('Logistique & Transport', 'Supply Chain'),
    ('Luxe & Mode', 'Luxe & Mode'),
    ('Luxe & Mode', 'Luxe'),
    ('Luxe & Mode', 'Mode'),
    ('Luxe & Mode', 'Fashion'),
    ('Média & Communication', 'Média & Communication'),
    ('Média & Communication', 'Média'),
    ('Média & Communication', 'Communication'),
    ('Média & Communication', 'Media'),
    ('Pharmacie & Biotechnologies', 'Pharmacie & Biotechnologies'),
    ('Pharmacie & Biotechnologies', 'Pharmacie'),
    ('Pharmacie & Biotechnologies', 'Biotechnologies'),
    ('Pharmacie & Biotechnologies', 'Biotech'),
    ('Ressources Humaines', 'Ressources Humaines'),
    ('Ressources Humaines', 'RH'),
    ('Ressources Humaines', 'Human Resources'),
    ('Santé', 'Santé'),
    ('Santé', 'Healthcare'),
    ('Santé', 'Médical'),
    ('Secteur Public', 'Secteur Public'),
    ('Secteur Public', 'Administration publique'),
    ('Secteur Public', 'Public Sector'),
    ('Services aux entreprises', 'Services aux entreprises'),
    ('Services aux entreprises', 'Business Services'),
    ('Sport & Loisirs', 'Sport & Loisirs'),
    ('Sport & Loisirs', 'Sport'),
    ('Sport & Loisirs', 'Loisirs'),
    ('Télécommunications', 'Télécommunications'),
    ('Télécommunications', 'Télécom'),
    ('Télécommunications', 'Telecommunications'),
    ('Tourisme', 'Tourisme'),
    ('Tourisme', 'Tourism'),
    ('Tourisme', 'Travel')
    ON CONFLICT DO NOTHING
`;

async function ensureSchemaMigrationsTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name character varying(255) NOT NULL UNIQUE,
            applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function schemaMigrationsTableExists() {
    const result = await query(
        `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            ) AS exists
        `,
        [MIGRATION_TABLE]
    );

    return result.rows[0]?.exists === true;
}

async function tableExists(tableName) {
    const result = await query(
        `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            ) AS exists
        `,
        [tableName]
    );

    return result.rows[0]?.exists === true;
}

async function getLlmProviderConstraintDefinition() {
    const result = await query(
        `
            SELECT pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conname = 'llm_settings_llm_provider_check'
              AND conrelid = 'public.llm_settings'::regclass
        `
    );

    return result.rows[0]?.definition || '';
}

async function readSqlFile(filePath) {
    return fs.readFile(filePath, 'utf8');
}

async function runSqlFile(filePath) {
    const sql = await readSqlFile(filePath);
    await query(sql);
}

async function getMigrationFiles() {
    const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
    return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrationNames() {
    const result = await query(`SELECT migration_name FROM ${MIGRATION_TABLE}`);
    return new Set(result.rows.map(row => row.migration_name));
}

async function markMigrationApplied(migrationName) {
    await query(
        `
            INSERT INTO ${MIGRATION_TABLE} (migration_name)
            VALUES ($1)
            ON CONFLICT (migration_name) DO NOTHING
        `,
        [migrationName]
    );
}

async function unmarkMigrationApplied(migrationName) {
    await query(
        `DELETE FROM ${MIGRATION_TABLE} WHERE migration_name = $1`,
        [migrationName]
    );
}

async function reconcileCriticalMigrations(appliedMigrations) {
    if (!await tableExists('llm_settings')) {
        return appliedMigrations;
    }

    const definition = await getLlmProviderConstraintDefinition();
    const constraintMatchesSupportedProviders = hasExactSupportedProviders(definition, SUPPORTED_LLM_PROVIDERS_FOR_CONSTRAINT);

    if (!constraintMatchesSupportedProviders) {
        const migrationsToReplay = [
            MINIMAX_PROVIDER_MIGRATION,
            DEEPSEEK_PROVIDER_MIGRATION,
            HUGGINGFACE_PROVIDER_MIGRATION,
            FIX_LLM_PROVIDER_CONSTRAINT_MIGRATION
        ].filter((migrationName) => appliedMigrations.has(migrationName));

        safeLog('warn', 'LLM provider constraint is out of sync with supported providers; forcing migration replay', {
            supportedProviders: SUPPORTED_LLM_PROVIDERS_FOR_CONSTRAINT,
            migrationsToReplay
        });

        for (const migrationName of migrationsToReplay) {
            await unmarkMigrationApplied(migrationName);
            appliedMigrations.delete(migrationName);
        }
    }

    return appliedMigrations;
}

async function applyPendingSqlMigrations() {
    const migrationFiles = await getMigrationFiles();
    let appliedMigrations = await getAppliedMigrationNames();
    appliedMigrations = await reconcileCriticalMigrations(appliedMigrations);

    for (const migrationName of migrationFiles) {
        if (appliedMigrations.has(migrationName)) {
            continue;
        }

        const migrationPath = path.join(MIGRATIONS_DIR, migrationName);
        safeLog('info', 'Applying SQL migration', { migrationName });

        await runSqlFile(migrationPath);
        await markMigrationApplied(migrationName);
        appliedMigrations.add(migrationName);
    }
}

async function applyFreshSchema() {
    if (!SCHEMA_PATH) {
        throw new Error('No canonical schema file found');
    }

    safeLog('info', 'Applying base database schema', {
        source: path.basename(SCHEMA_PATH)
    });
    await runSqlFile(SCHEMA_PATH);

    const migrationFiles = await getMigrationFiles();
    for (const migrationName of migrationFiles) {
        await markMigrationApplied(migrationName);
    }
}

async function seedIndustryAliases() {
    const countResult = await query('SELECT COUNT(*) AS cnt FROM industry_aliases');
    if (parseInt(countResult.rows[0]?.cnt || '0', 10) > 0) {
        return;
    }

    safeLog('info', 'Seeding industry_aliases with default sectors');
    await query(INDUSTRY_ALIASES_SEED_SQL);
}

async function runSchemaInitializer(name, fn) {
    safeLog('info', 'Ensuring auxiliary schema', { name });
    const result = await fn();
    if (result === false) {
        throw new Error(`${name} initialization returned false`);
    }
}

async function ensureAuxiliarySchema() {
    const initializers = [
        ['gdpr_audit_log', initGdprAuditTable],
        ['resume_comments', initResumeCommentsTable],
        ['share_resume', initShareResumeTable],
        ['candidate_pipeline', initCandidatePipelineTable],
        ['deals', initDealsTable],
        ['user_calendar_tokens', initCalendarTokensTable],
        ['backup_tables', initBackupTables],
        ['batch_jobs', initializeBatchJobsTable]
    ];

    for (const [name, fn] of initializers) {
        await runSchemaInitializer(name, fn);
    }
}

async function verifyBootstrapState() {
    const [schemaMigrationsPresent, usersTablePresent] = await Promise.all([
        schemaMigrationsTableExists(),
        tableExists('users')
    ]);

    if (!schemaMigrationsPresent) {
        throw new Error('schema_migrations table is missing after migration bootstrap');
    }

    if (!usersTablePresent) {
        throw new Error('users table is missing after migration bootstrap');
    }

    const [migrationCountResult, adminResult] = await Promise.all([
        query(`SELECT COUNT(*)::int AS cnt FROM ${MIGRATION_TABLE}`),
        query(
            `
                SELECT id
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
            `,
            [DEFAULT_ADMIN_EMAIL]
        )
    ]);

    if (!adminResult.rows[0]?.id) {
        throw new Error(`Default administrator account is missing after migration bootstrap (${DEFAULT_ADMIN_EMAIL})`);
    }

    safeLog('info', 'docker-migrate bootstrap verified', {
        schemaMigrationsTable: true,
        migrationCount: migrationCountResult.rows[0]?.cnt || 0,
        usersTable: true,
        defaultAdminEmail: DEFAULT_ADMIN_EMAIL,
        defaultAdminUserId: adminResult.rows[0].id
    });
}

export async function runDockerMigrate() {
    safeLog('info', 'Starting docker-migrate');

    const connected = await testConnection();
    if (!connected) {
        throw new Error('Failed to connect to PostgreSQL database');
    }

    await ensureSchemaMigrationsTable();

    const hasUsersTable = await tableExists('users');
    if (!hasUsersTable) {
        await applyFreshSchema();
    } else {
        await applyPendingSqlMigrations();
    }
    await seedIndustryAliases();
    await ensureAuxiliarySchema();
    await ensureDefaultAdminAccount();
    await verifyBootstrapState();

    safeLog('info', 'docker-migrate completed successfully');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
    try {
        await runDockerMigrate();
        process.exitCode = 0;
    } catch (error) {
        safeLog('error', 'docker-migrate failed', {
            error: error.message,
            stack: error.stack
        });
        process.exitCode = 1;
    } finally {
        await cleanupAllCaches();
        await closePool();
    }
}
