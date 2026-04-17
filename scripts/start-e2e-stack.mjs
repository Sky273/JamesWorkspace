/* global console, process, setInterval, setTimeout */
import { spawn } from 'child_process';

const childProcesses = [];
let shuttingDown = false;

const sharedPdfServerToken =
  process.env.PDF_SERVER_INTERNAL_TOKEN || 'playwright-pdf-server-internal-token-32chars';
const localPdfServerUrl = 'http://127.0.0.1:3002';

function spawnChild(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  childProcesses.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[start-e2e-stack] ${label} exited with ${detail}`);
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
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of childProcesses) {
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
