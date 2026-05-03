import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const BACKUP_REMOTE_URL = process.env.WORKSPACE_BACKUP_REMOTE_URL || 'https://github.com/Sky273/JamesWorkspace.git';
const BACKUP_BRANCH = process.env.WORKSPACE_BACKUP_BRANCH || 'main';
const backupRoot = process.env.WORKSPACE_BACKUP_LOCAL_DIR
  || path.join(os.homedir(), 'CodexWorkspaceBackups', 'JamesWorkspace');

const EXCLUDED_NAMES = new Set([
  '.git',
  'node_modules',
  '.turbo',
  '.cache',
  '.vite',
  '.next',
  'coverage',
  '.nyc_output',
  'playwright-report',
  'test-results'
]);

const EXCLUDED_SUFFIXES = [
  '.tmp',
  '.cache'
];

function runGit(args, cwd, options = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: options.captureOutput === false ? 'inherit' : 'pipe'
  });

  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    const stdout = String(result.stdout || '').trim();
    const details = stderr || stdout || `git ${args.join(' ')} failed`;
    throw new Error(details);
  }

  return String(result.stdout || '').trim();
}

function shouldExclude(name) {
  if (EXCLUDED_NAMES.has(name)) {
    return true;
  }

  return EXCLUDED_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyFile(sourcePath, targetPath, stat) {
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, stat.mode);
  fs.utimesSync(targetPath, stat.atime, stat.mtime);
}

function syncDirectory(sourceDir, targetDir) {
  ensureDirectory(targetDir);

  const sourceEntries = new Map();
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (shouldExclude(entry.name)) {
      continue;
    }
    sourceEntries.set(entry.name, entry);
  }

  const targetEntries = fs.existsSync(targetDir)
    ? fs.readdirSync(targetDir, { withFileTypes: true })
    : [];

  for (const targetEntry of targetEntries) {
    if (targetEntry.name === '.git') {
      continue;
    }
    if (!sourceEntries.has(targetEntry.name)) {
      removePath(path.join(targetDir, targetEntry.name));
    }
  }

  for (const [entryName, entry] of sourceEntries.entries()) {
    const sourcePath = path.join(sourceDir, entryName);
    const targetPath = path.join(targetDir, entryName);
    const stat = fs.lstatSync(sourcePath);

    if (stat.isSymbolicLink()) {
      const targetLink = fs.readlinkSync(sourcePath);
      try {
        const existing = fs.readlinkSync(targetPath);
        if (existing !== targetLink) {
          removePath(targetPath);
          fs.symlinkSync(targetLink, targetPath);
        }
      } catch {
        removePath(targetPath);
        fs.symlinkSync(targetLink, targetPath);
      }
      continue;
    }

    if (stat.isDirectory()) {
      syncDirectory(sourcePath, targetPath);
      continue;
    }

    copyFile(sourcePath, targetPath, stat);
  }
}

function ensureBackupRepository() {
  if (!fs.existsSync(backupRoot)) {
    ensureDirectory(path.dirname(backupRoot));
    runGit(['clone', BACKUP_REMOTE_URL, backupRoot], workspaceRoot, { captureOutput: false });
  }

  if (!fs.existsSync(path.join(backupRoot, '.git'))) {
    throw new Error(`Backup directory is not a git repository: ${backupRoot}`);
  }

  runGit(['remote', 'set-url', 'origin', BACKUP_REMOTE_URL], backupRoot);
  runGit(['fetch', 'origin'], backupRoot, { captureOutput: false });

  const hasMain = spawnSync('git', ['rev-parse', '--verify', BACKUP_BRANCH], {
    cwd: backupRoot,
    encoding: 'utf8',
    stdio: 'pipe'
  }).status === 0;

  if (hasMain) {
    runGit(['checkout', BACKUP_BRANCH], backupRoot, { captureOutput: false });
  } else {
    const hasOriginMain = spawnSync('git', ['rev-parse', '--verify', `origin/${BACKUP_BRANCH}`], {
      cwd: backupRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    }).status === 0;

    if (hasOriginMain) {
      runGit(['checkout', '-B', BACKUP_BRANCH, `origin/${BACKUP_BRANCH}`], backupRoot, { captureOutput: false });
    } else {
      runGit(['checkout', '--orphan', BACKUP_BRANCH], backupRoot, { captureOutput: false });
      runGit(['reset', '--hard'], backupRoot, { captureOutput: false });
    }
  }
}

function commitMessage() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `Daily workspace backup: ${yyyy}-${mm}-${dd}`;
}

function main() {
  console.log(`[workspace-backup] source: ${workspaceRoot}`);
  console.log(`[workspace-backup] mirror: ${backupRoot}`);
  console.log(`[workspace-backup] remote: ${BACKUP_REMOTE_URL}`);

  ensureBackupRepository();
  syncDirectory(workspaceRoot, backupRoot);

  runGit(['add', '-A'], backupRoot, { captureOutput: false });

  const status = runGit(['status', '--short'], backupRoot);
  if (status) {
    const message = commitMessage();
    console.log(`[workspace-backup] changes detected, creating commit: ${message}`);
    runGit(['commit', '-m', message], backupRoot, { captureOutput: false });
  } else {
    console.log('[workspace-backup] no content changes detected');
  }

  runGit(['push', 'origin', `HEAD:${BACKUP_BRANCH}`], backupRoot, { captureOutput: false });
  console.log('[workspace-backup] backup push completed');
}

try {
  main();
} catch (error) {
  console.error('[workspace-backup] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
