import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const SUPPORTED_NODE_MAJOR = 22;

const TOOL_FILES = {
  eslint: ['node_modules/eslint/package.json', 'node_modules/eslint/bin/eslint.js'],
  typescript: ['node_modules/typescript/package.json', 'node_modules/typescript/bin/tsc'],
  vitest: ['node_modules/vitest/package.json', 'node_modules/vitest/vitest.mjs'],
  playwright: ['node_modules/@playwright/test/package.json', 'node_modules/@playwright/test/cli.js'],
};

function resolveMissingFiles(toolName) {
  const requiredFiles = TOOL_FILES[toolName] || [];
  return requiredFiles.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
}

function ensureSupportedNodeVersion() {
  const currentMajor = Number.parseInt(process.versions.node.split('.')[0] || '', 10);
  if (currentMajor === SUPPORTED_NODE_MAJOR) {
    return;
  }

  const message = [
    `Unsupported Node.js version detected: ${process.versions.node}.`,
    `ResumeConverter validation is standardized on Node ${SUPPORTED_NODE_MAJOR}.x.`,
    'Switch to Node 22 before running lint/typecheck/tests to avoid environment-only failures.',
  ].join('\n');

  throw new Error(message);
}

export function ensureToolingReady(toolName) {
  ensureSupportedNodeVersion();

  const missingFiles = resolveMissingFiles(toolName);
  if (missingFiles.length > 0) {
    throw new Error([
      `Cannot run ${toolName}: local installation is incomplete.`,
      ...missingFiles.map((relativePath) => `Missing: ${relativePath}`),
      'Run `npm install` or `npm ci` to restore project-local tooling.',
    ].join('\n'));
  }
}

export function runNodeTool({ toolName, entryRelativePath, args = [], cwd = repoRoot }) {
  ensureToolingReady(toolName);

  const entryPath = path.join(repoRoot, entryRelativePath);
  const child = spawn(process.execPath, [entryPath, ...args], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error(`Failed to start ${toolName}:`, error);
    process.exit(1);
  });
}
