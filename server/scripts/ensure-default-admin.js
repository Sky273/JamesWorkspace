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

const [{ query, closePool }, { safeLog }] = await Promise.all([
    import('../config/database.js'),
    import('../utils/logger.backend.js')
]);

export async function ensureDefaultAdminAccount() {
    const normalizedEmail = DEFAULT_ADMIN_EMAIL.toLowerCase();

    const existingUser = await query(
        `
            SELECT id, email
            FROM users
            WHERE LOWER(email) = $1
            LIMIT 1
        `,
        [normalizedEmail]
    );

    if (existingUser.rows[0]) {
        safeLog('info', 'Default administrator already exists', {
            email: normalizedEmail,
            userId: existingUser.rows[0].id
        });
        return { created: false, userId: existingUser.rows[0].id };
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_SALT_ROUNDS);
    const insertResult = await query(
        `
            INSERT INTO users (email, password, name, role, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email
        `,
        [normalizedEmail, hashedPassword, DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_STATUS]
    );

    safeLog('info', 'Default administrator created', {
        email: normalizedEmail,
        userId: insertResult.rows[0].id
    });

    return { created: true, userId: insertResult.rows[0].id };
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
