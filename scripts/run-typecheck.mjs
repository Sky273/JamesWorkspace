import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureToolingReady } from './tooling-preflight.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const entryPath = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const forwardedArgs = process.argv.slice(2);

function printKnownFailureHint(output) {
  if (!output.includes('node_modules/typescript/lib/lib.dom.d.ts')) {
    return;
  }

  console.error('\nTypeScript failed inside its own DOM lib. This usually means the local install is corrupted or Node is outside the supported range.');
  console.error('Recommended fix: switch to Node 22, remove `node_modules`, then run `npm install` or `npm ci`.\n');
}

ensureToolingReady('typescript');

const child = spawn(process.execPath, [entryPath, ...forwardedArgs], {
  cwd: repoRoot,
  stdio: ['inherit', 'inherit', 'pipe'],
  env: process.env,
});

let stderr = '';

child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  stderr += text;
  process.stderr.write(text);
});

child.on('close', (code) => {
  if ((code ?? 1) !== 0) {
    printKnownFailureHint(stderr);
  }
  process.exit(code ?? 1);
});
