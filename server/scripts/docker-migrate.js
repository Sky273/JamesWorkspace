import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DOCKER_DIR = path.join(ROOT_DIR, 'docker');
const FALLBACK_DOCKER_DIR = '/docker-entrypoint-initdb.d';
const MIGRATION_TABLE = 'schema_migrations';

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
        { schemaPath: path.join(DOCKER_DIR, 'schema.sql'), legacyInitDbPath: path.join(DOCKER_DIR, 'init-db.sql'), migrationsDir: path.join(DOCKER_DIR, 'migrations') },
        { schemaPath: path.join(FALLBACK_DOCKER_DIR, 'schema.sql'), legacyInitDbPath: path.join(FALLBACK_DOCKER_DIR, 'init-db.sql'), migrationsDir: path.join(FALLBACK_DOCKER_DIR, 'migrations') }
    ];

    for (const candidate of candidates) {
        const hasSchema = await pathExists(candidate.schemaPath);
        const hasLegacyInit = await pathExists(candidate.legacyInitDbPath);
        const hasMigrations = await pathExists(candidate.migrationsDir);

        if ((hasSchema || hasLegacyInit) && hasMigrations) {
            return {
                schemaPath: hasSchema ? candidate.schemaPath : null,
                legacyInitDbPath: hasLegacyInit ? candidate.legacyInitDbPath : null,
                migrationsDir: candidate.migrationsDir
            };
        }
    }

    throw new Error(`Unable to locate migration assets. Checked: ${candidates.map(c => `${c.schemaPath} | ${c.legacyInitDbPath} | ${c.migrationsDir}`).join('; ')}`);
}

const { schemaPath: SCHEMA_PATH, legacyInitDbPath: LEGACY_INIT_DB_PATH, migrationsDir: MIGRATIONS_DIR } = await resolveDockerAssetPaths();

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

const [
    { query, testConnection, closePool },
    { safeLog },
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

async function applyPendingSqlMigrations() {
    const migrationFiles = await getMigrationFiles();
    const appliedMigrations = await getAppliedMigrationNames();

    for (const migrationName of migrationFiles) {
        if (appliedMigrations.has(migrationName)) {
            continue;
        }

        const migrationPath = path.join(MIGRATIONS_DIR, migrationName);
        safeLog('info', 'Applying SQL migration', { migrationName });

        try {
            await runSqlFile(migrationPath);
        } catch (error) {
            safeLog('warn', 'SQL migration reported an error and will be marked as applied', {
                migrationName,
                error: error.message
            });
        }

        await markMigrationApplied(migrationName);
    }
}

async function applyFreshSchema() {
    const bootstrapPath = SCHEMA_PATH || LEGACY_INIT_DB_PATH;

    if (!bootstrapPath) {
        throw new Error('No bootstrap schema file found');
    }

    safeLog('info', 'Applying base database schema', {
        source: path.basename(bootstrapPath)
    });
    await runSqlFile(bootstrapPath);

    const migrationFiles = await getMigrationFiles();
    for (const migrationName of migrationFiles) {
        await markMigrationApplied(migrationName);
    }
}


async function ensureResumeAdaptationsColumns() {
    await query(`ALTER TABLE resume_adaptations ADD COLUMN IF NOT EXISTS candidate_name VARCHAR(255)`);
    await query(`ALTER TABLE resume_adaptations ADD COLUMN IF NOT EXISTS adapted_title VARCHAR(500)`);
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

    await ensureResumeAdaptationsColumns();
    await seedIndustryAliases();
    await ensureAuxiliarySchema();

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
        await closePool();
    }
}

