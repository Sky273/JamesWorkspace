/* global console, process, setInterval, setTimeout */
import { spawn } from 'child_process';

const childProcesses = new Map();
let shuttingDown = false;
const restartCounts = new Map();
const MAX_RESTARTS = 2;
const RESTART_DELAY_MS = 1000;

const sharedPdfServerToken =
  process.env.PDF_SERVER_INTERNAL_TOKEN || 'playwright-pdf-server-internal-token-32chars';
const localPdfServerUrl = 'http://127.0.0.1:3002';

function createChildKey(label) {
  return label;
}

function spawnChild(label, command, args, extraEnv = {}) {
  const childKey = createChildKey(label);
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  childProcesses.set(childKey, { child, command, args, extraEnv, label });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code}`;
    const restartCount = restartCounts.get(childKey) || 0;

    if (restartCount < MAX_RESTARTS) {
      restartCounts.set(childKey, restartCount + 1);
      console.warn(
        `[start-e2e-stack] ${label} exited with ${detail}; restarting ` +
        `(${restartCount + 1}/${MAX_RESTARTS})...`
      );
      setTimeout(() => {
        if (!shuttingDown) {
          spawnChild(label, command, args, extraEnv);
        }
      }, RESTART_DELAY_MS).unref();
      return;
    }

    console.error(`[start-e2e-stack] ${label} exited with ${detail} after ${MAX_RESTARTS} restart attempts`);
    shutdown(code ?? 1);
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`[start-e2e-stack] Failed to start ${label}: ${error.message}`);
    shutdown(1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const { child } of childProcesses.values()) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const { child } of childProcesses.values()) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGBREAK', () => shutdown(0));
process.on('disconnect', () => shutdown(0));

spawnChild('pdf-server', process.execPath, ['pdf-server/server.cjs'], {
  PDF_SERVER_INTERNAL_TOKEN: sharedPdfServerToken,
});
spawnChild('proxy-server', process.execPath, ['--max-old-space-size=2048', '--expose-gc', 'server/proxy-server.js'], {
  PDF_SERVER_INTERNAL_TOKEN: sharedPdfServerToken,
  PDF_SERVER_URL: localPdfServerUrl,
});

setInterval(() => {}, 1 << 30);
