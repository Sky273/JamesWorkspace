import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { expect, type Page } from '@playwright/test';

const { Pool } = pg;

const DEFAULT_USER_EMAIL = 'playwright.user@resumeconverter.local';
const DEFAULT_USER_PASSWORD = 'Playwright123!';
const DEFAULT_ADMIN_EMAIL = 'playwright.admin@resumeconverter.local';
const DEFAULT_ADMIN_PASSWORD = 'PlaywrightAdmin123!';
const E2E_TEMPLATE_NAME = '000 Playwright Export Template';
const E2E_TEMPLATE_CONTENT = '<section><h1>-name-</h1><h2>-title-</h2><div>-content-</div></section>';
const E2E_TEMPLATE_STYLESHEET = 'body { font-family: Arial, sans-serif; } h1 { font-size: 20px; } h2 { font-size: 14px; color: #555; }';
const JWT_SECRET = process.env.JWT_SECRET || 'playwright-jwt-secret-minimum-32-characters';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'playwright-refresh-token-secret-minimum-32-chars';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || DEFAULT_USER_EMAIL;
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || DEFAULT_USER_PASSWORD;
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

let bootstrapPromise: Promise<void> | null = null;
let bootstrappedUser: {
  id: string;
  email: string;
  name: string;
  status: string;
  role: string;
  firm_id: string;
  firm: string | null;
  customer: string | null;
} | null = null;
let bootstrappedAdmin: {
  id: string;
  email: string;
  name: string;
  status: string;
  role: string;
  firm_id: string;
  firm: string | null;
  customer: string | null;
} | null = null;
let bootstrappedTemplate: {
  id: string;
  name: string;
} | null = null;

function generateAccessToken(user: {
  id: string;
  email: string;
  name: string;
  status: string;
  role: string;
  firm_id: string;
  firm?: string | null;
}) {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    role: user.role || 'user',
    firmId: user.firm_id,
    firmName: user.firm || null,
    jti,
  }, JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshToken(user: { id: string; email: string; }) {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    { id: user.id, email: user.email, type: 'refresh', jti },
    REFRESH_TOKEN_SECRET,
    { algorithm: 'HS256', expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

function createPool(): pg.Pool {
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error('POSTGRES_PASSWORD is required to bootstrap the Playwright user');
  }

  return new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'resumeconverter',
    user: process.env.POSTGRES_USER || 'postgres',
    password,
    ssl: process.env.POSTGRES_SSL === 'true'
      ? { rejectUnauthorized: true }
      : process.env.POSTGRES_SSL === 'relaxed'
        ? { rejectUnauthorized: false }
        : false,
  });
}

async function ensureActivePlaywrightUser(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const pool = createPool();

      try {
        const firmResult = await pool.query(
          'SELECT id FROM firms ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1'
        );

        if (firmResult.rows.length === 0) {
          throw new Error('No firm available to attach the Playwright user');
        }

        const firmId = firmResult.rows[0].id as string;
        const firmNameResult = await pool.query(
          'SELECT name FROM firms WHERE id = $1 LIMIT 1',
          [firmId]
        );
        const userPasswordHash = await bcrypt.hash(E2E_USER_PASSWORD, 10);
        const adminPasswordHash = await bcrypt.hash(E2E_ADMIN_PASSWORD, 10);

        await pool.query(
          `
            INSERT INTO users (email, password, name, role, status, firm_id, firm_name)
            VALUES ($1, $2, $3, 'user', 'active', $4, $5)
            ON CONFLICT (email)
            DO UPDATE SET
              password = EXCLUDED.password,
              name = EXCLUDED.name,
              role = 'user',
              status = 'active',
              firm_id = EXCLUDED.firm_id,
              firm_name = EXCLUDED.firm_name,
              updated_at = CURRENT_TIMESTAMP
          `,
          [E2E_USER_EMAIL.toLowerCase(), userPasswordHash, 'Playwright User', firmId, firmNameResult.rows[0]?.name || null]
        );

        await pool.query(
          `
            INSERT INTO users (email, password, name, role, status, firm_id, firm_name)
            VALUES ($1, $2, $3, 'admin', 'active', $4, $5)
            ON CONFLICT (email)
            DO UPDATE SET
              password = EXCLUDED.password,
              name = EXCLUDED.name,
              role = 'admin',
              status = 'active',
              firm_id = EXCLUDED.firm_id,
              firm_name = EXCLUDED.firm_name,
              updated_at = CURRENT_TIMESTAMP
          `,
          [E2E_ADMIN_EMAIL.toLowerCase(), adminPasswordHash, 'Playwright Admin', firmId, firmNameResult.rows[0]?.name || null]
        );

        const userResult = await pool.query(
          `
            SELECT u.id, u.email, u.name, u.status, u.role, u.firm_id, f.name AS firm
            FROM users u
            LEFT JOIN firms f ON f.id = u.firm_id
            WHERE u.email = $1
            LIMIT 1
          `,
          [E2E_USER_EMAIL.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
          throw new Error('Failed to load the bootstrapped Playwright user');
        }

        const user = userResult.rows[0];
        bootstrappedUser = {
          id: user.id as string,
          email: user.email as string,
          name: user.name as string,
          status: user.status as string,
          role: user.role as string,
          firm_id: user.firm_id as string,
          firm: (firmNameResult.rows[0]?.name as string | null) || (user.firm as string | null) || null,
          customer: (firmNameResult.rows[0]?.name as string | null) || (user.firm as string | null) || null,
        };

        const adminResult = await pool.query(
          `
            SELECT u.id, u.email, u.name, u.status, u.role, u.firm_id, f.name AS firm
            FROM users u
            LEFT JOIN firms f ON f.id = u.firm_id
            WHERE u.email = $1
            LIMIT 1
          `,
          [E2E_ADMIN_EMAIL.toLowerCase()]
        );

        if (adminResult.rows.length === 0) {
          throw new Error('Failed to load the bootstrapped Playwright admin');
        }

        const admin = adminResult.rows[0];
        bootstrappedAdmin = {
          id: admin.id as string,
          email: admin.email as string,
          name: admin.name as string,
          status: admin.status as string,
          role: admin.role as string,
          firm_id: admin.firm_id as string,
          firm: (firmNameResult.rows[0]?.name as string | null) || (admin.firm as string | null) || null,
          customer: (firmNameResult.rows[0]?.name as string | null) || (admin.firm as string | null) || null,
        };

        const templateResult = await pool.query(
          `
            SELECT id
            FROM templates
            WHERE name = $1 AND (firm_id = $2 OR firm_id IS NULL)
            ORDER BY CASE WHEN firm_id = $2 THEN 0 ELSE 1 END, created_at ASC NULLS LAST
            LIMIT 1
          `,
          [E2E_TEMPLATE_NAME, firmId]
        );

        if (templateResult.rows.length > 0) {
          const templateId = templateResult.rows[0].id as string;
          await pool.query(
            `
              UPDATE templates
              SET
                description = $1,
                status = 'active',
                popular = true,
                header_content = '',
                template_content = $2,
                footer_content = '',
                footer_height = 25,
                stylesheet = $3,
                firm_id = $4,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
            `,
            [
              'Template de test stable pour les exports Playwright',
              E2E_TEMPLATE_CONTENT,
              E2E_TEMPLATE_STYLESHEET,
              firmId,
              templateId,
            ]
          );

          bootstrappedTemplate = {
            id: templateId,
            name: E2E_TEMPLATE_NAME,
          };
        } else {
          const createdTemplate = await pool.query(
            `
              INSERT INTO templates (
                name,
                description,
                popular,
                status,
                tags,
                preview_image_url,
                header_content,
                template_content,
                footer_content,
                footer_height,
                stylesheet,
                firm_id
              )
              VALUES ($1, $2, true, 'active', $3, NULL, '', $4, '', 25, $5, $6)
              RETURNING id
            `,
            [
              E2E_TEMPLATE_NAME,
              'Template de test stable pour les exports Playwright',
              ['playwright', 'e2e'],
              E2E_TEMPLATE_CONTENT,
              E2E_TEMPLATE_STYLESHEET,
              firmId,
            ]
          );

          bootstrappedTemplate = {
            id: createdTemplate.rows[0].id as string,
            name: E2E_TEMPLATE_NAME,
          };
        }
      } finally {
        await pool.end();
      }
    })();
  }

  await bootstrapPromise;
}

export async function signInAsE2EUser(page: Page): Promise<void> {
  await ensureActivePlaywrightUser();

  if (!bootstrappedUser || !bootstrappedTemplate) {
    throw new Error('Playwright bootstrap did not produce the required fixtures');
  }

  const accessToken = generateAccessToken(bootstrappedUser);
  const refreshToken = generateRefreshToken(bootstrappedUser);

  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: accessToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'refreshToken',
      value: refreshToken,
      domain: 'localhost',
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
}

export async function signInAsE2EAdmin(page: Page): Promise<void> {
  await ensureActivePlaywrightUser();

  if (!bootstrappedAdmin || !bootstrappedTemplate) {
    throw new Error('Playwright bootstrap did not produce the required admin fixtures');
  }

  const accessToken = generateAccessToken(bootstrappedAdmin);
  const refreshToken = generateRefreshToken(bootstrappedAdmin);

  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: accessToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'refreshToken',
      value: refreshToken,
      domain: 'localhost',
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
}
