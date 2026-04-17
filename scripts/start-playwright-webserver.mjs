/* global URL, console, fetch, process, setInterval, setTimeout */
import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import net from 'net';
import pg from 'pg';

const HEALTH_URL = process.env.PLAYWRIGHT_WEB_HEALTH_URL || 'http://localhost:3001/health';
const HEALTH_TIMEOUT_MS = Number.parseInt(process.env.PLAYWRIGHT_WEB_HEALTH_TIMEOUT_MS || '170000', 10);
const HEALTH_POLL_INTERVAL_MS = 1000;
const CLIENT_DIR = fileURLToPath(new URL('../client', import.meta.url));
const { Client } = pg;

let stackProcess = null;
let shuttingDown = false;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'playwright-jwt-secret-minimum-32-characters';
process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'playwright-csrf-secret-minimum-32chars';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'playwright-refresh-token-secret-minimum-32-chars';
process.env.PDF_SERVER_INTERNAL_TOKEN = process.env.PDF_SERVER_INTERNAL_TOKEN || 'playwright-pdf-server-internal-token-32chars';
process.env.DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Playwright-admin-password-2026!';
process.env.HTTPS_ENABLED = 'false';
process.env.VITE_HTTPS_ENABLED = 'false';
process.env.PROXY_PORT = process.env.PROXY_PORT || '3001';
process.env.CACHE_BACKEND = 'memory';
process.env.VITE_BUILD_OUT_DIR = 'dist-e2e';
process.env.STATIC_DIST_DIR = 'client/dist-e2e';
process.env.PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://127.0.0.1:3002';
process.env.VITE_DISABLE_ASSET_COMPRESSION = 'true';
process.env.E2E_DISABLE_EXTERNAL_EMAIL = 'true';
process.env.E2E_DISABLE_GDPR_SCHEDULER = 'true';
process.env.E2E_DISABLE_BACKUP_SCHEDULER = 'true';
process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';
process.env.E2E_RELAX_RATE_LIMITING = 'true';
process.env.E2E_QUIET_EXPECTED_WARNINGS = 'true';
process.env.VITE_TURNSTILE_SITE_KEY = '';
process.env.CLOUDFLARE_TURNSTILE_SITE_KEY = '';
process.env.TURNSTILE_SECRET_KEY = '';
process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '';

const PROXY_PORT = Number.parseInt(process.env.PROXY_PORT || '3001', 10);
const PDF_SERVER_PORT = Number.parseInt(new URL(process.env.PDF_SERVER_URL || 'http://127.0.0.1:3002').port || '3002', 10);

function spawnChecked(command, args, label, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.once('error', (error) => {
      reject(new Error(`[playwright-webserver] Failed to start ${label}: ${error.message}`));
    });

    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`[playwright-webserver] ${label} exited with ${detail}`));
    });
  });
}

async function ensurePortAvailable(port, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        reject(new Error(
          `[playwright-webserver] Cannot start ${label}: port ${port} is already in use. ` +
          'Stop the stale local service or set PLAYWRIGHT_REUSE_EXISTING_SERVER=true if reuse is intentional.'
        ));
        return;
      }

      reject(new Error(`[playwright-webserver] Failed to probe port ${port} for ${label}: ${error.message}`));
    });

    server.listen(port, '127.0.0.1', () => {
      server.close((closeError) => {
        if (closeError) {
          reject(new Error(`[playwright-webserver] Failed to release probed port ${port}: ${closeError.message}`));
          return;
        }
        resolve();
      });
    });
  });
}

async function waitForHealth() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    if (shuttingDown) {
      return false;
    }

    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) {
        return true;
      }
    } catch {
      // Retry until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }

  return false;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (stackProcess && !stackProcess.killed) {
    stackProcess.kill('SIGTERM');
    setTimeout(() => {
      if (stackProcess && !stackProcess.killed) {
        stackProcess.kill('SIGKILL');
      }
      process.exit(exitCode);
    }, 5000).unref();
    return;
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGBREAK', () => shutdown(0));
process.on('disconnect', () => shutdown(0));

async function verifyDatabaseConnection() {
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error(
      '[playwright-webserver] POSTGRES_PASSWORD is required for local E2E bootstrap. ' +
      'Set the same PostgreSQL credentials you use for `npm run migrate` before running Playwright.'
    );
  }

  const client = new Client({
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
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT current_user, current_database()');
    const row = result.rows[0] || {};
    console.log('[playwright-webserver] PostgreSQL preflight OK', {
      user: row.current_user || client.user,
      database: row.current_database || client.database,
      host: client.host,
      port: client.port,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      '[playwright-webserver] PostgreSQL preflight failed. ' +
      `Check POSTGRES_HOST/PORT/DB/USER/PASSWORD for local E2E bootstrap. Details: ${details}`,
      { cause: error }
    );
  } finally {
    await client.end().catch(() => {});
  }
}

try {
  await ensurePortAvailable(PROXY_PORT, 'proxy server');
  await ensurePortAvailable(PDF_SERVER_PORT, 'PDF server');
  await verifyDatabaseConnection();

  await spawnChecked(
    process.execPath,
    ['../node_modules/vite/bin/vite.js', 'build'],
    'build',
    CLIENT_DIR
  );

  stackProcess = spawn(process.execPath, ['scripts/start-e2e-stack.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  stackProcess.once('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[playwright-webserver] e2e stack exited with ${detail}`);
    shutdown(code ?? 1);
  });

  const healthy = await waitForHealth();
  if (!healthy) {
    console.error(`[playwright-webserver] Timed out waiting for health URL: ${HEALTH_URL}`);
    shutdown(1);
  }

  setInterval(() => {}, 1 << 30);
} catch (error) {
  console.error(error.message);
  shutdown(1);
}
