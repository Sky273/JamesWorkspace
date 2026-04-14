import 'dotenv/config';
import { spawn } from 'child_process';

const HEALTH_URL = process.env.PLAYWRIGHT_WEB_HEALTH_URL || 'http://localhost:3001/health';
const HEALTH_TIMEOUT_MS = Number.parseInt(process.env.PLAYWRIGHT_WEB_HEALTH_TIMEOUT_MS || '110000', 10);
const HEALTH_POLL_INTERVAL_MS = 1000;

let stackProcess = null;
let shuttingDown = false;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'playwright-jwt-secret-minimum-32-characters';
process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'playwright-csrf-secret-minimum-32chars';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'playwright-refresh-token-secret-minimum-32-chars';
process.env.PDF_SERVER_INTERNAL_TOKEN = process.env.PDF_SERVER_INTERNAL_TOKEN || 'playwright-pdf-server-internal-token-32chars';
process.env.HTTPS_ENABLED = 'false';
process.env.VITE_HTTPS_ENABLED = 'false';
process.env.PROXY_PORT = process.env.PROXY_PORT || '3001';
process.env.CACHE_BACKEND = 'memory';
process.env.VITE_BUILD_OUT_DIR = 'dist-e2e';
process.env.STATIC_DIST_DIR = 'client/dist-e2e';
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

function spawnChecked(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
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

try {
  await spawnChecked('cmd.exe', ['/d', '/s', '/c', 'npm run build'], 'build');

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
