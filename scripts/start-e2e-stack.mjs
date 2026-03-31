import { spawn } from 'child_process';

const childProcesses = [];
let shuttingDown = false;

function spawnChild(label, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
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

spawnChild('pdf-server', process.execPath, ['pdf-server/server.cjs']);
spawnChild('proxy-server', process.execPath, ['--max-old-space-size=2048', '--expose-gc', 'server/proxy-server.js']);

setInterval(() => {}, 1 << 30);
