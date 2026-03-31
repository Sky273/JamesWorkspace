import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { expect, type Page } from '@playwright/test';
import { generateAccessToken, generateRefreshToken } from '../../server/services/jwt.service.js';

const { Pool } = pg;

const DEFAULT_USER_EMAIL = 'playwright.user@resumeconverter.local';
const DEFAULT_USER_PASSWORD = 'Playwright123!';
const E2E_TEMPLATE_NAME = '000 Playwright Export Template';
const E2E_TEMPLATE_CONTENT = '<section><h1>-name-</h1><h2>-title-</h2><div>-content-</div></section>';
const E2E_TEMPLATE_STYLESHEET = 'body { font-family: Arial, sans-serif; } h1 { font-size: 20px; } h2 { font-size: 14px; color: #555; }';

export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || DEFAULT_USER_EMAIL;
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || DEFAULT_USER_PASSWORD;

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
let bootstrappedTemplate: {
  id: string;
  name: string;
} | null = null;

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
        const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 10);

        await pool.query(
          `
            INSERT INTO users (email, password, name, role, status, firm_id)
            VALUES ($1, $2, $3, 'user', 'active', $4)
            ON CONFLICT (email)
            DO UPDATE SET
              password = EXCLUDED.password,
              name = EXCLUDED.name,
              role = 'user',
              status = 'active',
              firm_id = EXCLUDED.firm_id,
              updated_at = CURRENT_TIMESTAMP
          `,
          [E2E_USER_EMAIL.toLowerCase(), passwordHash, 'Playwright User', firmId]
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
