import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { ensureToolingReady } from './tooling-preflight.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const vitestEntry = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
const forwardedArgs = process.argv.slice(2);
const requiredClientTestFiles = [
  'node_modules/happy-dom/package.json',
];

ensureToolingReady('vitest');

const missingClientTestFiles = requiredClientTestFiles.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
if (missingClientTestFiles.length > 0) {
  console.error('Cannot run client Vitest: local installation is incomplete.');
  for (const relativePath of missingClientTestFiles) {
    console.error(`Missing: ${relativePath}`);
  }
  console.error('Run `npm install` or `npm ci` with Node 22 to restore client test dependencies.');
  process.exit(1);
}

const child = spawn(process.execPath, [vitestEntry, ...forwardedArgs], {
  cwd: repoRoot,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env
});

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});

let stderrBuffer = '';
const shouldSuppress = (line) =>
  line.includes('GLib-GIO-WARNING') ||
  line.includes('Failed to open application manifest') ||
  line.includes('Microsoft.Limitless_');

child.stderr.on('data', (chunk) => {
  stderrBuffer += chunk.toString();
  const lines = stderrBuffer.split(/\r?\n/);
  stderrBuffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!shouldSuppress(line)) {
      process.stderr.write(line + '\n');
    }
  }
});

child.on('close', (code) => {
  if (stderrBuffer && !shouldSuppress(stderrBuffer)) {
    process.stderr.write(stderrBuffer);
  }
  process.exit(code ?? 1);
});
