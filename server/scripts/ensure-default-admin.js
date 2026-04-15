import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

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

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@resumeconverter.local';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Default Administrator';
const DEFAULT_ADMIN_ROLE = 'admin';
const DEFAULT_ADMIN_STATUS = 'active';
const DEFAULT_ADMIN_SALT_ROUNDS = 10;
const DEFAULT_ADMIN_FIRM_NAME = process.env.DEFAULT_ADMIN_FIRM_NAME || 'Default Firm';

const [{ query, closePool }, { safeLog }] = await Promise.all([
    import('../config/database.js'),
    import('../utils/logger.backend.js')
]);

export async function ensureDefaultAdminAccount() {
    await repairLegacyAuthAccounts();

    const normalizedEmail = DEFAULT_ADMIN_EMAIL.toLowerCase();
    const firmAssignment = await resolveDefaultAdminFirmAssignment();

    const existingUser = await query(
        `
            SELECT id, email, role, status, firm_id, firm_name, email_verified_at, registration_source
            FROM users
            WHERE LOWER(email) = $1
            LIMIT 1
        `,
        [normalizedEmail]
    );

    if (existingUser.rows[0]) {
        const user = existingUser.rows[0];
        const needsRepair =
            user.role !== DEFAULT_ADMIN_ROLE
            || user.status !== DEFAULT_ADMIN_STATUS
            || !user.firm_id
            || !user.firm_name
            || !user.email_verified_at
            || user.registration_source !== 'system_seed';

        if (needsRepair) {
            await query(
                `
                    UPDATE users
                    SET
                        role = $2,
                        status = $3,
                        firm_id = COALESCE(firm_id, $4),
                        firm_name = COALESCE(firm_name, $5),
                        email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                        registration_source = 'system_seed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `,
                [
                    user.id,
                    DEFAULT_ADMIN_ROLE,
                    DEFAULT_ADMIN_STATUS,
                    firmAssignment.id,
                    firmAssignment.name
                ]
            );
        }

        safeLog('info', 'Default administrator already exists', {
            email: normalizedEmail,
            userId: user.id,
            repaired: needsRepair
        });
        return { created: false, userId: user.id, repaired: needsRepair };
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_SALT_ROUNDS);
    const insertResult = await query(
        `
            INSERT INTO users (email, password, name, role, status, firm_id, firm_name, email_verified_at, registration_source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, 'system_seed')
            RETURNING id, email
        `,
        [
            normalizedEmail,
            hashedPassword,
            DEFAULT_ADMIN_NAME,
            DEFAULT_ADMIN_ROLE,
            DEFAULT_ADMIN_STATUS,
            firmAssignment.id,
            firmAssignment.name
        ]
    );

    safeLog('info', 'Default administrator created', {
        email: normalizedEmail,
        userId: insertResult.rows[0].id
    });

    return { created: true, userId: insertResult.rows[0].id };
}

export async function repairLegacyAuthAccounts() {
    const normalizedEmail = DEFAULT_ADMIN_EMAIL.toLowerCase();

    await query(
        `
            UPDATE users
            SET registration_source = CASE
                WHEN LOWER(COALESCE(email, '')) = $1 THEN 'system_seed'
                WHEN LOWER(COALESCE(firm_name, '')) IN ('public registration', 'cabinet test')
                    OR LOWER(COALESCE(firm_name, '')) LIKE 'cabinet test %' THEN 'self_service'
                ELSE 'admin_created'
            END,
            updated_at = CURRENT_TIMESTAMP
            WHERE registration_source IS NULL
        `,
        [normalizedEmail]
    );

    await query(
        `
            UPDATE users
            SET email_verified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE email_verified_at IS NULL
              AND COALESCE(registration_source, 'admin_created') <> 'self_service'
        `
    );
}

async function resolveDefaultAdminFirmAssignment() {
    const existingFirm = await query(
        `
            SELECT id, name
            FROM firms
            ORDER BY created_at ASC NULLS LAST, id ASC
            LIMIT 1
        `
    );

    if (existingFirm.rows[0]) {
        return existingFirm.rows[0];
    }

    const createdFirm = await query(
        `
            INSERT INTO firms (name, status)
            VALUES ($1, 'active')
            RETURNING id, name
        `,
        [DEFAULT_ADMIN_FIRM_NAME]
    );

    return createdFirm.rows[0];
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
    try {
        await ensureDefaultAdminAccount();
        process.exitCode = 0;
    } catch (error) {
        safeLog('error', 'Failed to ensure default administrator account', {
            error: error.message,
            stack: error.stack
        });
        process.exitCode = 1;
    } finally {
        await closePool();
    }
}
